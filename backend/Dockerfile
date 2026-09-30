# ==============================================================================
# RailSync Backend Production Dockerfile (FastAPI + Python 3.10)
# ==============================================================================

FROM python:3.10-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend source directories and configs
COPY backend/api/ /app/api/
COPY backend/engine/ /app/engine/
COPY backend/ml/ /app/ml/
COPY backend/models/ /app/models/
COPY backend/config.py /app/config.py
COPY backend/cli.py /app/cli.py
COPY database/data/ /app/database/data/

# Create non-privileged user for container security
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

# Container liveness check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
