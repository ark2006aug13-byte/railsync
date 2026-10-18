"""
backend/cli.py - RailSync Terminal CLI
Real-Time Train Location Tracker via Live GPS Telemetry API.
Complete Route Stoppage Schedule, Dynamic Station ETAs, Delay Recovery,
Live Inter-Station Visual Tracker, and Interactive Station Search.

Usage:
  python cli.py 12301
  python cli.py 12301 -d yesterday
  python cli.py 12301 -s CNB
  python cli.py 12301 -i
  python cli.py Vikramshila --date today
"""
import argparse
import asyncio
from datetime import datetime, timedelta
import logging
import os
from pathlib import Path
import re
import sys
from typing import Optional, Dict, Any, List

# Ensure backend directory is in sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

if sys.platform == "win32":
    try:
        import ctypes
        kernel32 = ctypes.windll.kernel32
        kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
    except Exception:
        pass

# Suppress noisy internal library logs during CLI usage
logging.disable(logging.INFO)
logging.getLogger("railsync.live_rail_api").setLevel(logging.WARNING)
logging.getLogger("LiveRailAPI").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

from fastapi.exceptions import HTTPException
from engine.live_rail_api import get_authentic_train_status, get_current_ist_datetime

# ANSI Color Codes
CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"


def print_banner():
    print(f"\n{CYAN}==================================================================================================={RESET}")
    print(f"{CYAN}{BOLD}  🚆 RAILSYNC - REAL-TIME TRAIN LOCATION RADAR & ROUTE STOPPAGE TIMELINE                           {RESET}")
    print(f"{CYAN}{DIM}  Official Indian Railways Satellite Telemetry • Dynamic Station ETAs & Ground Kinematics          {RESET}")
    print(f"{CYAN}==================================================================================================={RESET}\n")


def print_box_line(left_text: str, total_inner: int = 93):
    """Prints a line inside box borders with exact ANSI-aware padding."""
    visible = re.sub(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])', '', left_text)
    pad = " " * max(0, total_inner - len(visible))
    print(f"│  {left_text}{pad}│")


def parse_user_date_input(raw: Optional[str]) -> str:
    """Parses date string or natural keywords (today, tomorrow, yesterday) to YYYY-MM-DD."""
    today = datetime.now()
    if not raw or not str(raw).strip():
        return today.strftime("%Y-%m-%d")
    clean = str(raw).strip().lower()
    if clean in ["today", "aaj", "t"]:
        return today.strftime("%Y-%m-%d")
    if clean in ["tomorrow", "kal", "tom", "+1"]:
        return (today + timedelta(days=1)).strftime("%Y-%m-%d")
    if clean in ["yesterday", "beeta kal", "yest", "-1"]:
        return (today - timedelta(days=1)).strftime("%Y-%m-%d")

    # Try common calendar formats
    for fmt in ["%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d", "%Y%m%d"]:
        try:
            return datetime.strptime(clean, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass

    return today.strftime("%Y-%m-%d")


def render_inter_station_track(data: Dict[str, Any], halts: List[Dict[str, Any]]):
    """Renders the dynamic visual inter-station track position between last departed and next station."""
    running = data.get("running_status", {})
    status = running.get("status", "UNKNOWN").upper()
    speed = float(running.get("current_speed_kmh", 0.0))
    last_stn = running.get("last_station", {})
    next_stn = running.get("next_station", {})

    last_code = last_stn.get("code", "")
    next_code = next_stn.get("code", "")
    last_name = last_stn.get("name", last_code)
    next_name = next_stn.get("name", next_code)
    rem_dist = float(next_stn.get("distance_km", 0.0))

    if status != "RUNNING" or not last_name or not next_name:
        return

    last_halt_obj = next((h for h in halts if h["code"] == last_code), None)
    next_halt_obj = next((h for h in halts if h["code"] == next_code), None)
    l_km = last_halt_obj["distance_km"] if last_halt_obj else 0.0
    n_km = next_halt_obj["distance_km"] if next_halt_obj else l_km + rem_dist

    sec_tot = max(1.0, n_km - l_km)
    passed_km = max(0.0, round(sec_tot - rem_dist, 1))
    pct = min(100, max(0, int((passed_km / sec_tot) * 100)))

    # Construct progressive ASCII/Unicode track bar
    bar_len = 28
    bullet_pos = min(bar_len - 1, max(0, int((pct / 100.0) * bar_len)))
    bar_str = "━" * bullet_pos + f"{GREEN}●{RESET}" + "─" * (bar_len - bullet_pos - 1)

    print(f"\n{CYAN}┌─ 🚆 LIVE INTER-STATION TRACK POSITION ────────────────────────────────────────────────────────┐{RESET}")
    print_box_line("", 93)
    track_vis = f"[{BOLD}{last_code}{RESET} ({l_km:.0f}km)] {bar_str}► [{BOLD}{next_code}{RESET} ({n_km:.0f}km)]"
    print_box_line(track_vis, 93)
    print_box_line("", 93)
    print_box_line(f"{BOLD}📍 Exact Ground Location:{RESET} In Motion • {passed_km:.1f} km past {last_name} • {rem_dist:.1f} km to {next_name}", 93)
    print_box_line(f"{BOLD}⚡ Instant Speed        :{RESET} {GREEN}{speed:.0f} km/h{RESET} • Section Progress: {BOLD}{pct}%{RESET}", 93)
    print_box_line("", 93)
    print(f"{CYAN}└───────────────────────────────────────────────────────────────────────────────────────────────┘{RESET}")


def render_stoppages_table(halts: List[Dict[str, Any]], running_status: Dict[str, Any], show_intermediate: bool = False):
    """Renders the authentic route stoppages table with dynamic ETAs, delay recovery, and loco pin."""
    if not halts:
        return

    status = running_status.get("status", "UNKNOWN").upper()
    speed = float(running_status.get("current_speed_kmh", 0.0))
    next_stn = running_status.get("next_station", {})
    rem_dist = float(next_stn.get("distance_km", 0.0))

    W = 101
    print(f"\n{CYAN}┌─ 📋 ROUTE STOPPAGE TIMELINE & STATION-BY-STATION DYNAMICS {'─' * (W - 58)}┐{RESET}")
    header = f"{'STN':<5} {'STATION NAME':<22} {'PF':<3} {'DIST':<6} {'TIMETABLE(SCH)':<14} {'ACT / DYN. ETA':<17} {'DELAY & RECOVERY':<18} {'STATUS':<8}"
    print(f"│  {BOLD}{header}{RESET} │")
    print(f"├{'─' * W}┤")

    loco_inserted = False

    for idx, h in enumerate(halts):
        # Insert moving train marker between last departed and next halt
        if status == "RUNNING" and not loco_inserted:
            if h.get("status") in ["NEXT", "UPCOMING", "DEST"] and idx > 0 and halts[idx - 1].get("has_passed"):
                curr_dist_val = float(running_status.get("current_distance_km") or running_status.get("current_location", {}).get("distance_km") or 0.0)
                dist_to_h = max(0.0, h.get("distance_km", 0.0) - curr_dist_val) if curr_dist_val > 0 else rem_dist
                curr_del_val = int(running_status.get("last_station", {}).get("delay_minutes", 0) or halts[idx - 1].get("delay_min", 0))
                loco_line = f"{GREEN}{BOLD}──► [ 🚆 IN-MOTION: {speed:.0f} km/h • {dist_to_h:.1f} km to {h['name'][:18]} • Current Delay: {curr_del_val}m ]{RESET}"
                vis = re.sub(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])', '', loco_line)
                pad = " " * max(0, (W - 2) - len(vis))
                print(f"│  {loco_line}{pad}│")
                loco_inserted = True

        # Status badge
        st_val = h.get("status", "UPCOMING")
        if st_val == "PASSED":
            st_badge = f"{GREEN}✅ PASSED{RESET}"
        elif st_val == "AT_PLATFORM":
            st_badge = f"{YELLOW}{BOLD}🛑 AT PF {RESET}"
        elif st_val == "NEXT":
            st_badge = f"{CYAN}{BOLD}⏳ NEXT  {RESET}"
        elif st_val == "DEST":
            st_badge = f"{CYAN}🏁 DEST  {RESET}"
        else:
            st_badge = f"{DIM}⏱️  UPCOM{RESET}"

        # Delay & Recovery badge
        del_m = h.get("delay_min", 0)
        delta = h.get("delay_delta", 0)

        if st_val == "PASSED":
            # For passed stations: display authentic ground punch delay, NO forward dynamic recovery badge!
            if del_m == 0:
                del_badge = f"{GREEN}Right Time (0m){RESET}"
            else:
                del_badge = f"{YELLOW}+{del_m}m Late{RESET}"
        elif st_val == "AT_PLATFORM":
            if del_m == 0:
                del_badge = f"{GREEN}Right Time (0m){RESET}"
            else:
                del_badge = f"{YELLOW}+{del_m}m Late{RESET}"
        else:
            # Future / upcoming stations (NEXT, UPCOMING, DEST): display dynamic delay with timetable recovery / penalty
            if del_m == 0:
                del_badge = f"{GREEN}Right Time (0m){RESET}"
            elif delta < 0:
                del_badge = f"{GREEN}+{del_m}m (⚡ {abs(delta)}m rec.){RESET}"
            elif delta > 0:
                del_badge = f"{RED}+{del_m}m (🔴 +{delta}m){RESET}"
            else:
                del_badge = f"{YELLOW}+{del_m}m (➡️ steady){RESET}"

        sch_combo = f"{h.get('sch_arr', '--:--')}/{h.get('sch_dep', '--:--')}"
        time_disp = h.get("time_display", f"Exp. {h.get('exp_arr', '--:--')} IST")
        dist_str = f"{h.get('distance_km', 0.0):>4.0f}km"

        vis_del = re.sub(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])', '', del_badge)
        vis_st = re.sub(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])', '', st_badge)
        pad_del = " " * max(0, 18 - len(vis_del))
        pad_st = " " * max(0, 8 - len(vis_st))

        row_content = f"{h['code']:<5} {h['name'][:21]:<22} {h.get('platform', '1'):<3} {dist_str:<6} {sch_combo:<14} {time_disp:<17} {del_badge}{pad_del} {st_badge}{pad_st}"
        print(f"│  {row_content} │")

        # Intermediate passing stations
        if show_intermediate and h.get("intermediate_stations"):
            for ip in h["intermediate_stations"]:
                p_code = ip.get("code", "")
                p_name = ip.get("name", p_code)
                p_dist = ip.get("distance_km", 0.0)
                p_time = ip.get("time", "--:--")
                p_stat = ip.get("status", "UPCOMING")
                p_line = f"{DIM}   ├─ {p_code:<5} {p_name[:20]:<21} --  {p_dist:>4.0f}km    --:--/--:--    Pass {p_time:<8}  Non-Stop Passing   {p_stat}{RESET}"
                vis_p = re.sub(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])', '', p_line)
                pad_p = " " * max(0, (W - 2) - len(vis_p))
                print(f"│  {p_line}{pad_p}│")

    print(f"{CYAN}└{'─' * W}┘{RESET}\n")


def render_station_spotlight(target_query: str, halts: List[Dict[str, Any]]):
    """Renders a prominent spotlight card for an individual searched station."""
    if not target_query or not halts:
        return

    q_clean = str(target_query).strip().upper()
    matched = next((h for h in halts if h["code"].upper() == q_clean or q_clean in h["name"].upper()), None)
    if not matched:
        print(f"\n{YELLOW}⚠️  Station '{target_query}' not found in official halts for this train.{RESET}\n")
        return

    print(f"{CYAN}┌─ 🎯 TARGET STATION SPOTLIGHT: {matched['name'].upper()} ({matched['code']}) ────────────────────────┐{RESET}")
    print_box_line("", 93)
    print_box_line(f"{BOLD}Station Platform    :{RESET} Platform {matched.get('platform', '1')}", 93)
    print_box_line(f"{BOLD}Timetable Schedule  :{RESET} Scheduled Arrival: {matched.get('sch_arr', '--:--')} IST • Scheduled Departure: {matched.get('sch_dep', '--:--')} IST", 93)
    print_box_line(f"{BOLD}Dynamic Forecast    :{RESET} {GREEN}{BOLD}Expected Arrival: {matched.get('exp_arr', matched.get('act_arr', '--:--'))} IST (+{matched.get('delay_min', 0)}m delay){RESET}", 93)
    print_box_line(f"{BOLD}Distance from Origin:{RESET} {matched.get('distance_km', 0.0):.1f} km", 93)
    print_box_line(f"{BOLD}Halt Status         :{RESET} {matched.get('status', 'UPCOMING')} ({matched.get('time_display', '')})", 93)
    print_box_line("", 93)
    print(f"{CYAN}└───────────────────────────────────────────────────────────────────────────────────────────────┘{RESET}\n")


def render_train_location(data: Dict[str, Any], target_station: Optional[str] = None, show_intermediate: bool = False):
    """Renders the authentic live location, track visualizer, stoppage table, and station spotlight."""
    train = data.get("train", {})
    running = data.get("running_status", {})
    curr_loc = running.get("current_location", {})
    last_stn = running.get("last_station", {})
    next_stn = running.get("next_station", {})
    halts = data.get("route_halts", [])

    train_num = train.get("number", "N/A")
    train_name = train.get("name", "N/A")
    source = train.get("source", "SRC")
    dest = train.get("destination", "DST")
    origin_date = train.get("origin_date", datetime.now().strftime("%Y-%m-%d"))

    status = running.get("status", "UNKNOWN").upper()
    speed = float(running.get("current_speed_kmh", 0.0))
    lat = curr_loc.get("lat")
    lng = curr_loc.get("lng")
    delay = int(last_stn.get("delay_minutes", 0))

    today_s = datetime.now().strftime("%Y-%m-%d")
    tom_s = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    yest_s = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

    if origin_date == today_s:
        date_label = f"{origin_date} (Today)"
    elif origin_date == tom_s:
        date_label = f"{origin_date} (Tomorrow • Scheduled Service)"
    elif origin_date == yest_s:
        date_label = f"{origin_date} (Yesterday • Completed / Archived)"
    else:
        date_label = f"{origin_date}"

    # Operational status badge
    if status == "RUNNING":
        status_badge = f"{GREEN}{BOLD}🟢 RUNNING (In Motion • {speed:.0f} km/h){RESET}"
    elif status == "HALTED":
        status_badge = f"{YELLOW}{BOLD}🟡 HALTED (At Station / Signal • 0 km/h){RESET}"
    elif status == "NOT_STARTED":
        status_badge = f"{DIM}⚪ NOT STARTED (At Origin Platform • 0 km/h){RESET}"
    elif status in ["TERMINATED", "COMPLETED", "REACHED"]:
        status_badge = f"{CYAN}{BOLD}🏁 REACHED (Journey Completed • 0 km/h){RESET}"
    else:
        status_badge = f"{BOLD}{status}{RESET}"

    # Delay format
    if delay == 0:
        delay_str = f"{GREEN}Right Time (0m delay){RESET}"
    elif delay > 0:
        delay_str = f"{RED}{BOLD}+{delay} minutes late{RESET}"
    else:
        delay_str = f"{GREEN}{BOLD}{abs(delay)} minutes early{RESET}"

    # Coordinates format
    if lat is not None and lng is not None:
        coords_str = f"{lat:.4f}° N, {lng:.4f}° E"
    else:
        coords_str = "Unavailable"

    # Location text derivation
    last_name = last_stn.get("name") or last_stn.get("code") or "Origin"
    last_code = last_stn.get("code", "")
    next_name = next_stn.get("name") or next_stn.get("code") or "Destination"
    next_code = next_stn.get("code", "")
    rem_dist = float(next_stn.get("distance_km", 0.0))

    # Specialized rendering for REACHED / TERMINATED trains
    if status in ["TERMINATED", "COMPLETED", "REACHED"]:
        arrival_timing = running.get("arrival_timing") or {}
        dest_name = arrival_timing.get("destination_name") or next_name or last_name
        dest_code = arrival_timing.get("destination_code") or next_code or last_code
        pf = arrival_timing.get("platform", "1")
        sch_arr = arrival_timing.get("scheduled_arrival") or next_stn.get("scheduled_arrival") or "N/A"
        act_arr = arrival_timing.get("actual_arrival") or next_stn.get("expected_arrival") or "N/A"
        arr_delay = int(arrival_timing.get("delay_minutes", delay))

        status_badge = f"{CYAN}{BOLD}🏁 REACHED (Journey Completed • Standing at Platform {pf}){RESET}"
        loc_desc = f"Reached Destination Terminal • {dest_name} ({dest_code}) [Platform {pf}]"

        if arr_delay == 0:
            arr_delay_str = f"{GREEN}{BOLD}🟢 Arrived On-Time / Right Time (0m delay){RESET}"
        elif arr_delay > 0:
            arr_delay_str = f"{RED}{BOLD}🔴 Arrived +{arr_delay} minutes late{RESET}"
        else:
            arr_delay_str = f"{GREEN}{BOLD}🟢 Arrived {abs(arr_delay)} minutes early{RESET}"

        print(f"{BOLD}TRAIN           :{RESET} {CYAN}{train_num} - {train_name}{RESET}")
        print(f"{BOLD}ROUTE           :{RESET} {source} ──► {dest}")
        print(f"{BOLD}JOURNEY DATE    :{RESET} {date_label}")
        print(f"{CYAN}---------------------------------------------------------------------------------------------------{RESET}")

        print(f"{CYAN}┌─ EXACT LIVE LOCATION & GPS TELEMETRY ─────────────────────────────────────────────────────────┐{RESET}")
        print_box_line("", 93)
        print_box_line(f"{BOLD}📍 Current Location  :{RESET} {loc_desc}", 93)
        print_box_line(f"{BOLD}🌐 GPS Coordinates   :{RESET} {coords_str}", 93)
        print_box_line(f"{BOLD}🚦 Operational Status:{RESET} {status_badge}", 93)
        print_box_line(f"{BOLD}⚡ Instant Speed     :{RESET} 0 km/h (Standing at Destination Platform)", 93)
        print_box_line(f"{BOLD}⏱️  Arrival Analysis :{RESET} {arr_delay_str}", 93)
        if sch_arr != "N/A" and act_arr != "N/A":
            print_box_line(f"{BOLD}🕒 Arrival Timings   :{RESET} Scheduled: {sch_arr} IST • Actual: {act_arr} IST", 93)
        print_box_line("", 93)
        print_box_line(f"{BOLD}🏁 Destination Halt  :{RESET} {dest_name} ({dest_code}) [Platform {pf}] • Arrived {act_arr} IST", 93)

        last_sync = data.get("last_synced_ist", "")
        if last_sync:
            try:
                sync_time = datetime.fromisoformat(last_sync).strftime("%H:%M:%S")
                print_box_line(f"{BOLD}🕒 Telemetry Sync    :{RESET} {sync_time} IST (Live Satellite / NTES Feed)", 93)
            except Exception:
                pass

        print_box_line("", 93)
        print(f"{CYAN}└───────────────────────────────────────────────────────────────────────────────────────────────┘{RESET}\n")

        # Stoppages table
        render_stoppages_table(halts, running, show_intermediate=show_intermediate)
        if target_station:
            render_station_spotlight(target_station, halts)
        return

    if status == "NOT_STARTED":
        loc_desc = f"Origin Platform • {last_name} ({last_code})"
    elif status == "HALTED" or speed == 0.0:
        loc_desc = f"Standing at / near {last_name} ({last_code})"
    else:
        loc_desc = f"Passed {last_name} ({last_code}) • Approaching {next_name} ({next_code})"

    # Print Train Specification Header
    print(f"{BOLD}TRAIN           :{RESET} {CYAN}{train_num} - {train_name}{RESET}")
    print(f"{BOLD}ROUTE           :{RESET} {source} ──► {dest}")
    print(f"{BOLD}JOURNEY DATE    :{RESET} {date_label}")
    print(f"{CYAN}---------------------------------------------------------------------------------------------------{RESET}")

    # Print Location Radar Box
    print(f"{CYAN}┌─ EXACT LIVE LOCATION & GPS TELEMETRY ─────────────────────────────────────────────────────────┐{RESET}")
    print_box_line("", 93)
    print_box_line(f"{BOLD}📍 Current Location  :{RESET} {loc_desc}", 93)
    print_box_line(f"{BOLD}🌐 GPS Coordinates   :{RESET} {coords_str}", 93)
    print_box_line(f"{BOLD}🚦 Operational Status:{RESET} {status_badge}", 93)
    print_box_line(f"{BOLD}⚡ Instant Speed     :{RESET} {speed:.0f} km/h", 93)
    print_box_line(f"{BOLD}⏱️  Live Ground Delay :{RESET} {delay_str}", 93)
    print_box_line("", 93)

    # Station punches
    last_dep = last_stn.get("actual_departure") or last_stn.get("scheduled_departure") or "N/A"
    dep_label = "Scheduled Dep." if status == "NOT_STARTED" else "Departed"
    print_box_line(f"{BOLD}⏮️  Last Passed Halt  :{RESET} {last_name} ({last_code}) • {dep_label} {last_dep} IST", 93)

    if status != "TERMINATED" and next_name:
        next_exp = next_stn.get("expected_arrival") or next_stn.get("scheduled_arrival") or "N/A"
        dist_text = f" • {rem_dist:.1f} km away" if rem_dist > 0 else ""
        print_box_line(f"{BOLD}⏭️  Next Upcoming Halt:{RESET} {next_name} ({next_code}) • Expected {next_exp} IST{dist_text}", 93)

    # -----------------------------------------------------------------------
    # Advanced Geospatial, Topography & Environmental Radar (4 APIs)
    # -----------------------------------------------------------------------
    geo = data.get("geospatial_telemetry") or running.get("geospatial_telemetry") or {}
    elev = geo.get("elevation") or running.get("elevation") or {}
    weather = geo.get("weather_visibility") or running.get("weather_visibility") or {}
    infra = geo.get("track_infrastructure") or running.get("track_infrastructure") or {}
    landmark = geo.get("landmark") or running.get("landmark") or {}

    if elev or weather or infra or landmark:
        print_box_line("", 93)
        print_box_line(f"{CYAN}{BOLD}── GEOSPATIAL, TOPOGRAPHY & ATMOSPHERIC RADAR ──────────────────────────────────────{RESET}", 93)

        if landmark.get("formatted_text"):
            lm_text = landmark['formatted_text'][:64]
            print_box_line(f"{BOLD}📍 Ground Landmark   :{RESET} {lm_text}", 93)

        if elev.get("elevation_m") is not None:
            e_val = elev.get("elevation_m", 0.0)
            g_desc = elev.get("grade_description", "Level Track")
            print_box_line(f"{BOLD}⛰️  Track Elevation  :{RESET} {e_val:.0f}m MSL • {g_desc}", 93)

        if weather.get("visibility_meters") is not None:
            vis_km = weather.get("visibility_km", 10.0)
            w_desc = weather.get("weather_description", "Clear")
            temp = weather.get("temperature_c", 28.0)
            fog_cap = weather.get("fog_speed_cap_kmh")
            fog_tag = f"{RED}{BOLD}⚠️ Fog Cap: {fog_cap:.0f} km/h{RESET}" if fog_cap else f"{GREEN}Normal{RESET}"
            print_box_line(f"{BOLD}🌫️  Atmosphere & Fog :{RESET} {vis_km:.1f} km vis • {w_desc} ({temp:.1f}°C) • IR Fog Safety: {fog_tag}", 93)

        if infra.get("gauge_name"):
            g_name = infra.get("gauge_name", "Indian Broad Gauge")
            elec = infra.get("electrification", "25 kV AC 50 Hz")
            sec_mps = infra.get("section_mps_kmh", 130.0)
            print_box_line(f"{BOLD}🛤️  Track Infra      :{RESET} {g_name} • {elec} • Section MPS: {sec_mps:.0f} km/h", 93)

    last_sync = data.get("last_synced_ist", "")
    if last_sync:
        try:
            sync_time = datetime.fromisoformat(last_sync).strftime("%H:%M:%S")
            print_box_line("", 93)
            print_box_line(f"{BOLD}🕒 Telemetry Sync    :{RESET} {sync_time} IST (Live Satellite / NTES Feed)", 93)
        except Exception:
            pass

    print_box_line("", 93)
    print(f"{CYAN}└───────────────────────────────────────────────────────────────────────────────────────────────┘{RESET}\n")

    # Visual Inter-Station Track
    render_inter_station_track(data, halts)

    # Route Stoppages Table
    render_stoppages_table(halts, running, show_intermediate=show_intermediate)

    # Target Station Spotlight
    if target_station:
        render_station_spotlight(target_station, halts)


async def track_train(
    train_query: str,
    journey_date: Optional[str] = None,
    target_station: Optional[str] = None,
    show_intermediate: bool = False
):
    """Fetches and displays live authentic train status with route schedule and interactivity."""
    clean_date = parse_user_date_input(journey_date)
    print(f"{DIM}📡 Fetching live GPS telemetry for train '{train_query}' ({clean_date})...{RESET}")

    try:
        data = await get_authentic_train_status(
            train_query=train_query,
            journey_date=clean_date
        )
        render_train_location(data, target_station=target_station, show_intermediate=show_intermediate)
        return data
    except HTTPException as exc:
        if exc.status_code == 300 and isinstance(exc.detail, dict):
            # Multiple matches for disambiguation
            matches = exc.detail.get("matches", [])
            print(f"\n{YELLOW}Multiple trains matched query '{train_query}':{RESET}")
            for idx, m in enumerate(matches, 1):
                print(f"  [{idx}] {BOLD}{m.get('train_number')}{RESET} - {m.get('train_name')} ({m.get('origin')} ──► {m.get('destination')})")
            
            try:
                pick = input(f"\nSelect option [1-{len(matches)}] or enter 5-digit train number: ").strip()
                if pick.isdigit():
                    val = int(pick)
                    if 1 <= val <= len(matches):
                        selected_no = matches[val - 1]["train_number"]
                        return await track_train(selected_no, clean_date, target_station, show_intermediate)
                    elif len(pick) == 5:
                        return await track_train(pick, clean_date, target_station, show_intermediate)
            except (KeyboardInterrupt, EOFError):
                return None
        elif exc.status_code == 404:
            err_msg = exc.detail.get("error") if isinstance(exc.detail, dict) else str(exc.detail)
            print(f"\n{RED}❌ {err_msg}{RESET}\n")
        else:
            detail = exc.detail.get("error") if isinstance(exc.detail, dict) else str(exc.detail)
            print(f"\n{RED}❌ Error ({exc.status_code}): {detail}{RESET}\n")
        return None
    except Exception as exc:
        print(f"\n{RED}❌ Unexpected error resolving train status: {exc}{RESET}\n")
        return None


def main():
    print_banner()

    parser = argparse.ArgumentParser(description="RailSync Live Train Location & Route Stoppage CLI")
    parser.add_argument("query", nargs="?", default=None, help="5-digit Train Number (e.g. 12301) or Train Name")
    parser.add_argument("--train", "-t", type=str, default=None, help="Train Number or Name")
    parser.add_argument("--date", "-d", type=str, default=None, help="Journey Date ('today', 'tomorrow', 'yesterday', or YYYY-MM-DD)")
    parser.add_argument("--station", "-s", type=str, default=None, help="Spotlight a specific station (e.g. CNB, Kanpur)")
    parser.add_argument("--all-stops", "-i", "--intermediate", action="store_true", default=False, help="Show intermediate non-stop passing stations")

    args = parser.parse_args()
    initial_query = args.train or args.query
    initial_date = parse_user_date_input(args.date) if args.date else None
    current_target_station = args.station
    current_show_intermediate = args.all_stops

    # Direct execution mode if train query passed as argument
    if initial_query:
        today_default = datetime.now().strftime("%Y-%m-%d")
        data = asyncio.run(track_train(
            initial_query,
            initial_date or today_default,
            target_station=current_target_station,
            show_intermediate=current_show_intermediate
        ))
        
        # Enter interactive sub-menu after direct execution
        if data:
            current_train = initial_query
            current_date = initial_date or today_default
            while True:
                try:
                    cmd_prompt = input(f"{DIM}Commands: [s <station>] Find Station  |  [i] Toggle Passing Points  |  [r] Refresh  |  [Enter] Next Train  |  [q] Quit\n► {RESET}").strip()
                except (KeyboardInterrupt, EOFError):
                    break

                if not cmd_prompt:
                    break
                if cmd_prompt.lower() in ["q", "quit", "exit"]:
                    return
                elif cmd_prompt.lower() in ["i", "toggle"]:
                    current_show_intermediate = not current_show_intermediate
                    render_train_location(data, target_station=current_target_station, show_intermediate=current_show_intermediate)
                elif cmd_prompt.lower() in ["r", "refresh"]:
                    data = asyncio.run(track_train(current_train, current_date, current_target_station, current_show_intermediate))
                elif cmd_prompt.lower().startswith("s ") or cmd_prompt.lower().startswith("station "):
                    parts = cmd_prompt.split(maxsplit=1)
                    if len(parts) > 1:
                        current_target_station = parts[1].strip()
                        render_station_spotlight(current_target_station, data.get("route_halts", []))
                else:
                    break
        return

    # Interactive continuous prompt mode
    today_str = datetime.now().strftime("%Y-%m-%d")
    show_inter = current_show_intermediate

    while True:
        try:
            print(f"{CYAN}┌─ [ENTER TRAIN] ────────────────────────────────────────────────────────────────────────┐{RESET}")
            print(f"│ Enter Train Number (e.g. 12301, 12424, 12367) or Name (or 'q' to exit)                 │")
            train_input = input(f"└─► {BOLD}Train Query:{RESET} ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nExiting RailSync.")
            break

        if not train_input or train_input.lower() in ["q", "quit", "exit"]:
            print("Exiting RailSync.")
            break

        # Prompt for Journey Date with intelligent defaults
        try:
            print(f"{CYAN}┌─ [JOURNEY DATE] ───────────────────────────────────────────────────────────────────────┐{RESET}")
            print(f"│ Press Enter for Today [{today_str}], or enter 'tomorrow', 'yesterday', or YYYY-MM-DD     │")
            raw_date = input(f"└─► {BOLD}Journey Date [{today_str}]:{RESET} ").strip()
            date_input = parse_user_date_input(raw_date)
        except (KeyboardInterrupt, EOFError):
            print("\nExiting RailSync.")
            break

        data = asyncio.run(track_train(train_input, date_input, show_intermediate=show_inter))
        if not data:
            continue

        # Interactive sub-menu loop for this train
        cur_station_search = None
        while True:
            try:
                cmd = input(f"{DIM}Commands: [s <station>] Find Station  |  [i] Toggle Passing Points  |  [r] Refresh  |  [Enter] Next Train  |  [q] Quit\n► {RESET}").strip()
            except (KeyboardInterrupt, EOFError):
                break

            if not cmd:
                break
            if cmd.lower() in ["q", "quit", "exit"]:
                print("Exiting RailSync.")
                return
            elif cmd.lower() in ["i", "toggle"]:
                show_inter = not show_inter
                render_train_location(data, target_station=cur_station_search, show_intermediate=show_inter)
            elif cmd.lower() in ["r", "refresh"]:
                data = asyncio.run(track_train(train_input, date_input, cur_station_search, show_inter))
            elif cmd.lower().startswith("s ") or cmd.lower().startswith("station "):
                parts = cmd.split(maxsplit=1)
                if len(parts) > 1:
                    cur_station_search = parts[1].strip()
                    render_station_spotlight(cur_station_search, data.get("route_halts", []))
            else:
                break


if __name__ == "__main__":
    main()
