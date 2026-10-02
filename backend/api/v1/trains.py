"""
api/v1/trains.py
FastAPI router for v1 Live Train Status API.
Provides high-performance, strictly validated, and cached train tracking.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Response, status

from api.v1.schemas import LiveTrainStatusResponse
from services.live_train_service import (
    live_train_service,
    validate_train_number,
    validate_and_normalize_date,
)

router = APIRouter(
    prefix="/api/v1/trains",
    tags=["Trains V1 Live Tracking"]
)


@router.get(
    "/{train_number}/live-status",
    response_model=LiveTrainStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Real-Time Live Running Status and Route Schedule",
    description=(
        "Fetches, normalizes, and caches real-time telemetry, location coordinates, "
        "next station ETA, and complete route stoppages for any 5-digit Indian Railways train."
    ),
    responses={
        200: {
            "description": "Live telemetry synchronized successfully",
            "headers": {
                "X-Data-Source": {
                    "description": "Origin source of the data ('live', 'cache', or 'mock')",
                    "schema": {"type": "string", "example": "live"}
                }
            }
        },
        400: {
            "description": "Invalid input parameter (e.g. invalid train number or calendar date)",
            "content": {
                "application/json": {
                    "example": {"detail": "Invalid train number. Must be a 5-digit numeric string (e.g. 12424)."}
                }
            }
        }
    }
)
async def get_live_train_status(
    train_number: str,
    journey_date: Optional[str] = Query(
        None,
        description="Journey start date in YYYY-MM-DD or DD-MM-YYYY format. Defaults to current date."
    ),
    response: Response = None
) -> LiveTrainStatusResponse:
    """
    Retrieves live train location and schedule:
    1. Validates 5-digit train number and calendar date.
    2. Checks Redis/TTL cache (45s TTL).
    3. If cache miss, requests external Indian Rail API / RapidAPI with 8s timeout.
    4. Falls back gracefully to authentic mock data with 'X-Data-Source: mock'.
    5. Normalizes into strict Pydantic v2 schema.
    """
    # 1. Input Validation
    try:
        clean_train_no = validate_train_number(train_number)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    try:
        validate_and_normalize_date(journey_date)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # 2. Execution through isolated service
    try:
        result, data_source = await live_train_service.get_live_train_status(
            train_number=clean_train_no,
            journey_date=journey_date
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred while resolving train status: {str(e)}"
        )

    # 3. Attach X-Data-Source header
    if response:
        response.headers["X-Data-Source"] = data_source

    return result
