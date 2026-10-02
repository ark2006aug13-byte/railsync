"""
backend/cli.py - RailSync Terminal CLI
Real-Time Train Location Tracker via Live GPS Telemetry API.

Usage:
  python cli.py
  python cli.py 12301
  python cli.py 12424 --date tomorrow
  python cli.py 12367 --date 2026-10-03
  python cli.py Vikramshila
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
    print(f"\n{CYAN}========================================================================================{RESET}")
    print(f"{CYAN}{BOLD}  🚆 RAILSYNC - REAL-TIME TRAIN LOCATION RADAR (LIVE GPS TELEMETRY)                    {RESET}")
    print(f"{CYAN}{DIM}  Official Indian Railways Satellite Telemetry • Dynamic Kinematics & Date Engine      {RESET}")
    print(f"{CYAN}========================================================================================{RESET}\n")


def print_box_line(left_text: str, total_inner: int = 86):
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


def render_train_location(data: Dict[str, Any]):
    """Renders the authentic live location and operational telemetry."""
    train = data.get("train", {})
    running = data.get("running_status", {})
    curr_loc = running.get("current_location", {})
    last_stn = running.get("last_station", {})
    next_stn = running.get("next_station", {})

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
        print(f"{CYAN}----------------------------------------------------------------------------------------{RESET}")

        print(f"{CYAN}┌─ EXACT LIVE LOCATION & GPS TELEMETRY ──────────────────────────────────────────────────┐{RESET}")
        print_box_line("")
        print_box_line(f"{BOLD}📍 Current Location  :{RESET} {loc_desc}")
        print_box_line(f"{BOLD}🌐 GPS Coordinates   :{RESET} {coords_str}")
        print_box_line(f"{BOLD}🚦 Operational Status:{RESET} {status_badge}")
        print_box_line(f"{BOLD}⚡ Instant Speed     :{RESET} 0 km/h (Standing at Destination Platform)")
        print_box_line(f"{BOLD}⏱️  Arrival Analysis :{RESET} {arr_delay_str}")
        if sch_arr != "N/A" and act_arr != "N/A":
            print_box_line(f"{BOLD}🕒 Arrival Timings   :{RESET} Scheduled: {sch_arr} IST • Actual: {act_arr} IST")
        print_box_line("")
        print_box_line(f"{BOLD}🏁 Destination Halt  :{RESET} {dest_name} ({dest_code}) [Platform {pf}] • Arrived {act_arr} IST")

        last_sync = data.get("last_synced_ist", "")
        if last_sync:
            try:
                sync_time = datetime.fromisoformat(last_sync).strftime("%H:%M:%S")
                print_box_line(f"{BOLD}🕒 Telemetry Sync    :{RESET} {sync_time} IST (Live Satellite / NTES Feed)")
            except Exception:
                pass

        print_box_line("")
        print(f"{CYAN}└────────────────────────────────────────────────────────────────────────────────────────┘{RESET}\n")
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
    print(f"{CYAN}----------------------------------------------------------------------------------------{RESET}")

    # Print Location Radar Box
    print(f"{CYAN}┌─ EXACT LIVE LOCATION & GPS TELEMETRY ──────────────────────────────────────────────────┐{RESET}")
    print_box_line("")
    print_box_line(f"{BOLD}📍 Current Location  :{RESET} {loc_desc}")
    print_box_line(f"{BOLD}🌐 GPS Coordinates   :{RESET} {coords_str}")
    print_box_line(f"{BOLD}🚦 Operational Status:{RESET} {status_badge}")
    print_box_line(f"{BOLD}⚡ Instant Speed     :{RESET} {speed:.0f} km/h")
    print_box_line(f"{BOLD}⏱️  Live Ground Delay :{RESET} {delay_str}")
    print_box_line("")

    # Station punches
    last_dep = last_stn.get("actual_departure") or last_stn.get("scheduled_departure") or "N/A"
    dep_label = "Scheduled Dep." if status == "NOT_STARTED" else "Departed"
    print_box_line(f"{BOLD}⏮️  Last Passed Halt  :{RESET} {last_name} ({last_code}) • {dep_label} {last_dep} IST")

    if status != "TERMINATED" and next_name:
        next_exp = next_stn.get("expected_arrival") or next_stn.get("scheduled_arrival") or "N/A"
        dist_text = f" • {rem_dist:.1f} km away" if rem_dist > 0 else ""
        print_box_line(f"{BOLD}⏭️  Next Upcoming Halt:{RESET} {next_name} ({next_code}) • Expected {next_exp} IST{dist_text}")

    last_sync = data.get("last_synced_ist", "")
    if last_sync:
        try:
            sync_time = datetime.fromisoformat(last_sync).strftime("%H:%M:%S")
            print_box_line(f"{BOLD}🕒 Telemetry Sync    :{RESET} {sync_time} IST (Live Satellite / NTES Feed)")
        except Exception:
            pass

    print_box_line("")
    print(f"{CYAN}└────────────────────────────────────────────────────────────────────────────────────────┘{RESET}\n")


async def track_train(train_query: str, journey_date: Optional[str] = None):
    """Fetches and displays live authentic train status."""
    clean_date = parse_user_date_input(journey_date)
    print(f"{DIM}📡 Fetching live GPS telemetry for train '{train_query}' ({clean_date})...{RESET}")

    try:
        data = await get_authentic_train_status(
            train_query=train_query,
            journey_date=clean_date
        )
        render_train_location(data)
        return True
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
                        return await track_train(selected_no, clean_date)
                    elif len(pick) == 5:
                        return await track_train(pick, clean_date)
            except (KeyboardInterrupt, EOFError):
                return False
        elif exc.status_code == 404:
            err_msg = exc.detail.get("error") if isinstance(exc.detail, dict) else str(exc.detail)
            print(f"\n{RED}❌ {err_msg}{RESET}\n")
        else:
            detail = exc.detail.get("error") if isinstance(exc.detail, dict) else str(exc.detail)
            print(f"\n{RED}❌ Error ({exc.status_code}): {detail}{RESET}\n")
        return False
    except Exception as exc:
        print(f"\n{RED}❌ Unexpected error resolving train status: {exc}{RESET}\n")
        return False


def main():
    print_banner()

    parser = argparse.ArgumentParser(description="RailSync Live Train Location CLI")
    parser.add_argument("query", nargs="?", default=None, help="5-digit Train Number (e.g. 12301) or Train Name")
    parser.add_argument("--train", "-t", type=str, default=None, help="Train Number or Name")
    parser.add_argument("--date", "-d", type=str, default=None, help="Journey Date ('today', 'tomorrow', 'yesterday', or YYYY-MM-DD)")

    args = parser.parse_args()
    initial_query = args.train or args.query
    initial_date = parse_user_date_input(args.date) if args.date else None

    # Direct execution mode if train query passed as argument
    if initial_query:
        today_default = datetime.now().strftime("%Y-%m-%d")
        asyncio.run(track_train(initial_query, initial_date or today_default))
        return

    # Interactive continuous prompt mode
    today_str = datetime.now().strftime("%Y-%m-%d")
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

        asyncio.run(track_train(train_input, date_input))

        try:
            nxt = input(f"{DIM}Press Enter to track another train, or 'q' to quit: {RESET}").strip()
            if nxt.lower() in ["q", "quit", "exit"]:
                break
            print("")
        except (KeyboardInterrupt, EOFError):
            break


if __name__ == "__main__":
    main()
