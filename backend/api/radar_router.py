"""
backend/api/radar_router.py
FastAPI router for All-India Live Train Radar, SSE Delta Streaming,
Chokepoints Radar, Airport FIDS Live Board, and Physical Track Geometry.
"""

import asyncio
import json
import logging
import time
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Response, Request
from fastapi.responses import JSONResponse, StreamingResponse

from engine.rail_radar_engine import radar_engine

logger = logging.getLogger("RadarRouter")
router = APIRouter(prefix="/api", tags=["Live Rail Radar"])

@router.get("/trains/live-all-india")
def get_live_all_india_trains():
    """Returns the full fleet of 2,349+ live trains snapped to physical track polylines."""
    fleet, payload, last_t = radar_engine.get_fleet_snapshot()
    if not payload or payload == b"[]":
        return JSONResponse(content=[], status_code=200)

    return Response(
        content=payload,
        media_type="application/json",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "X-Total-Trains": str(len(fleet)),
            "X-Last-Updated": str(int(last_t)),
            "Access-Control-Allow-Origin": "*",
        }
    )

@router.get("/trains/stream")
async def stream_live_train_deltas(request: Request):
    """
    Server-Sent Events (SSE) delta stream.
    Transmits initial full snapshot, then streams periodic delta packets
    only for trains whose coordinate, speed, or signal aspect changed.
    """
    async def event_generator():
        fleet, _, last_t = radar_engine.get_fleet_snapshot()
        init_payload = json.dumps({"type": "init", "timestamp": int(last_t), "fleet": fleet}, separators=(',', ':'))
        yield f"data: {init_payload}\n\n"

        last_snapshot = {t["id"]: (t["lat"], t["lng"], t.get("spd"), t.get("signal")) for t in fleet}

        while True:
            if await request.is_disconnected():
                break

            await asyncio.sleep(3.0)
            curr_fleet, _, cur_t = radar_engine.get_fleet_snapshot()

            deltas = []
            for t in curr_fleet:
                t_id = t["id"]
                cur_state = (t["lat"], t["lng"], t.get("spd"), t.get("signal"))
                if t_id not in last_snapshot or last_snapshot[t_id] != cur_state:
                    deltas.append({
                        "id": t_id,
                        "lat": t["lat"],
                        "lng": t["lng"],
                        "spd": t["spd"],
                        "brg": t["brg"],
                        "sig": t.get("signal", "GREEN"),
                        "hdwy": t.get("headway_km", 25.0),
                        "dep_m": t.get("dep_m", 0)
                    })
                    last_snapshot[t_id] = cur_state

            if deltas:
                delta_payload = json.dumps({
                    "type": "delta",
                    "timestamp": int(cur_t),
                    "count": len(deltas),
                    "trains": deltas
                }, separators=(',', ':'))
                yield f"data: {delta_payload}\n\n"
            else:
                yield ": ping\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        }
    )

@router.get("/chokepoints")
def get_chokepoints():
    """Returns real-time congestion scores and active trains around India's 10 major junction bottlenecks."""
    return radar_engine.get_live_chokepoints()

@router.get("/station/{station_code}/live-board")
def get_station_live_board(station_code: str):
    """Returns Airport-style FIDS arrival board, delay recovery, and platform occupancy (PF 1-16)."""
    return radar_engine.generate_station_live_board(station_code)

@router.get("/train/{train_no}/track")
def get_train_track_polyline(train_no: str):
    """Returns authentic physical track geometry polyline for a given train from train_tracks.json."""
    return radar_engine.get_train_track_polyline(train_no)

@router.get("/radar/stats")
def get_radar_stats():
    """Returns high-level network telemetry statistics (active trains, avg speed, on-time %, signaling)."""
    return radar_engine.get_radar_summary_stats()
