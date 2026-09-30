# 🚆 RailSync: Intelligent Railway Decision Support & Real-Time Predictive Transit Platform

<div align="center">

![RailSync Platform](https://img.shields.io/badge/RailSync-v2.0.0-blue?style=for-the-badge&logo=train)
![Next.js 16](https://img.shields.io/badge/Next.js-16.3.6-black?style=for-the-badge&logo=next.js)
![React 19](https://img.shields.io/badge/React-19.0.1-61DAFB?style=for-the-badge&logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110.0-009688?style=for-the-badge&logo=fastapi)
![Python](https://img.shields.io/badge/Python-3.10-3776AB?style=for-the-badge&logo=python)
![Redis Hybrid](https://img.shields.io/badge/Cache-Redis%20Hybrid-DC382D?style=for-the-badge&logo=redis)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker)
![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?style=for-the-badge&logo=githubactions)
![Tests](https://img.shields.io/badge/Tests-71%2F71%20Passed-success?style=for-the-badge)

<p align="center">
  <b>A physics-informed, real-time railway telemetry, dynamic ETA prediction, and terminal dispatch optimization system for the Indian Railways network.</b>
</p>

</div>

---

## 📖 Table of Contents

1. [Architectural Overview](#-architectural-overview)
2. [Key Innovations & Technical Pillars](#-key-innovations--technical-pillars)
3. [Repository Layout](#-repository-layout)
4. [Caching & Performance Architecture](#-caching--performance-architecture)
5. [Docker & Container Orchestration](#-docker--container-orchestration)
6. [CI/CD Automation Pipeline](#-cicd-automation-pipeline)
7. [Local Development & Quickstart](#-local-development--quickstart)
8. [Automated Verification & Test Suite](#-automated-verification--test-suite)
9. [API Documentation](#-api-documentation)

---

## 🏛️ Architectural Overview

RailSync combines physical train kinematics, satellite telemetry (ISRO RTIS 1-second GPS feeds), localized meteorological conditions (Open-Meteo), and terminal throat occupancy models to deliver transparent, explainable ETA predictions.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   CLIENT TIER (Next.js 16 + React 19)                  │
│  - Page 1: Search & Journey Planner (Instant Autocomplete & Presets)   │
│  - Page 2: Live Arrival ("Where Is My Train" Timeline + Leaflet Map)  │
│  - Page 3: Explainable ETA Diagnostics (Waterfall Delay Breakdown)    │
│  - Page 4: Platform Resolver & Terminal Inflow Gantt Chart            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST & SSE Stream
┌───────────────────────────────────▼────────────────────────────────────┐
│                  BACKEND ENGINE (FastAPI + Python 3.10)                │
│  - /api/train/predict      : Authentic Stoppages, Intermediates & GPS  │
│  - /api/train/{no}/state   : Physics Replay, Telemetry & Headway       │
│  - /api/operations/inflow  : Terminal Yard & Platform Conflict Engine  │
│  - /api/cache/stats        : Hybrid Cache Telemetry & Hit Metrics      │
└───────────────────────┬────────────────────────────┬───────────────────┘
                        │                            │
┌───────────────────────▼───────────┐    ┌───────────▼───────────────────┐
│     HYBRID CACHING SUBSYSTEM      │    │     INTELLIGENCE ENGINES      │
│  • Redis Cluster (Production)     │    │  • Kinematics & Tractive MPS  │
│  • Zero-Overhead In-Memory LRU    │    │  • Headway & Caution Aspects  │
│    (Auto-Fallback for Local Dev)  │    │  • Open-Meteo Fog Friction    │
└───────────────────────────────────┘    │  • Time Deletion / Slack Math │
                                         └───────────────────────────────┘
```

---

## ✨ Key Innovations & Technical Pillars

### 1. "Where Is My Train" Route Timeline
* **Prominent Official Halts:** Scheduled commercial stops are rendered with clear status badges (`Source Station`, `Scheduled Stop`, `Destination Terminal`), halt durations (`5m stop`), assigned platform (`PF 1`), and scheduled arrival/departure times.
* **Hidden-by-Default Intermediate Stations:** Non-stop passing stations between consecutive halts are collapsed to maintain a clean viewport.
* **Accordion Strips & Master Slider:** Expandable strips (`Show X Intermediate Stations (via ...) Non-Stop`) allow drilled-down per-segment expansion, while the header master slider (`Halts Only 🔘 All Stops`) toggles the entire route in one click.
* **Live Moving Locomotive Capsule:** Real-time animated capsule positioned at the train's active track segment with live GPS speed (`⚡ 124 km/h`), distance countdown, and progress bar.

### 2. Multi-Factor Dynamic ETA & Delay Waterfall
Decomposes delays into 5 distinct operational friction points:
* **Weather Friction (+m):** Dynamic speed suppression triggered by low visibility (fog < 200m clamped to 60 km/h).
* **Signal & Headway Caution (+m):** Penalties computed from distance gap to leading train.
* **Terminal Junction Throat Friction (+m):** Turnout speed restrictions on junction approach tracks.
* **Platform Contention Hold (+m):** Outer signal holding durations when assigned berth is occupied.
* **Time Deletion / Slack Recovery (-m):** Delay minutes recovered by operating at Maximum Permissible Speed (130–160 km/h) against timetable buffer slack.

### 3. Terminal Throat & Platform Conflict Resolver
Visualizes inflow queues and platform berth occupancy at major junctions (e.g. NDLS, CNB). Automatically recommends alternate platform reroutes (e.g. PF 12 ➔ PF 16) to instantly eliminate outer holding penalties (reducing hold time to 0.0m).

---

## 📁 Repository Layout

```
railsync/
├── .github/
│   └── workflows/
│       └── ci.yml               # Automated GitHub Actions CI/CD Pipeline
├── api/
│   ├── main.py                  # FastAPI Application Entrypoint & Routers
│   └── schemas.py               # Pydantic Request & Response Data Models
├── app/                         # Next.js 16 App Router Pages & SSR Auth
│   ├── auth/                    # Server Actions (Login, Signup, Recovery)
│   ├── dashboard/               # Protected Operational Dashboard
│   ├── login/                   # Authentication Interface
│   └── layout.tsx               # Root Shell & Global Providers
├── docker/
│   ├── Dockerfile.backend       # Multi-stage Python 3.10 Backend Image
│   └── Dockerfile.frontend      # Multi-stage Node 20 Frontend Image
├── docs/
│   ├── DEMO_SCRIPT.md           # Live Presentation Walkthrough Script
│   └── architecture_guide.pdf   # Complete Engineering Whitepaper
├── engine/
│   ├── cache_manager.py         # Resilient Hybrid Cache Manager (Redis + In-Memory)
│   ├── predictor.py             # Multi-Factor Waterfall & Dynamic ETA Predictor
│   ├── train_registry.py        # Indian Railways Schedules & Stoppage Presets
│   ├── weather_engine.py        # Open-Meteo Fog & Visibility Ingestion
│   ├── live_rail_api.py         # ISRO RTIS & RailRadar GPS Clients
│   └── replay.py                # Kinematic Historical Replay Engine
├── src/
│   ├── components/              # Page 1 (Search), Page 2 (Live Arrival), Page 3, Page 4
│   │   ├── LiveRouteMap.tsx     # Full-Viewport High-Precision Leaflet GIS Map
│   │   └── Page2LiveArrival.tsx # "Where Is My Train" Interactive Route Timeline
│   └── services/api.ts          # Typed Frontend API Client
├── tests/                       # Pytest Suite (71 Automated Tests)
├── .dockerignore                # Clean Container Build Filter
├── docker-compose.yml           # Multi-Container Compose Orchestration
├── requirements.txt             # Python Backend Dependencies
└── package.json                 # Node.js Frontend Dependencies
```

---

## ⚡ Caching & Performance Architecture

RailSync implements a **Resilient Hybrid Cache Layer** (`engine/cache_manager.py`):
1. **Production Mode (Redis):** When `REDIS_URL` is configured and reachable, all queries are cached in a distributed Redis key-value store with configurable TTL (default: 30s).
2. **Localhost Mode (In-Memory Fallback):** If Redis is offline or not installed, the system automatically and silently falls back to a thread-safe, high-performance In-Memory TTL/LRU cache. **Zero extra software needed, zero background RAM overhead on local laptops.**
3. **Cache Telemetry Endpoints:**
   * `GET /api/cache/stats`: Returns real-time metrics (mode, hits, misses, hit ratio percentage, active keys).
   * `POST /api/cache/clear`: Flushes cache entries on demand or upon conflict rerouting.

---

## 🐳 Docker & Container Orchestration

Run the complete multi-service production stack (Frontend + Backend + Redis) with a single command:

```bash
# Build and start all services in isolated bridge network
docker compose up --build
```

### Services Deployed:
* **Frontend:** `http://localhost:3000` (Next.js Production Runner)
* **Backend:** `http://localhost:8000` (FastAPI with Healthchecks)
* **Redis:** `localhost:6379` (Redis 7 Alpine with AOF persistence)

To stop the containers:
```bash
docker compose down
```

---

## 🔄 CI/CD Automation Pipeline

RailSync includes a production-grade GitHub Actions workflow (`.github/workflows/ci.yml`):
* **Backend Job:** Tests against Python 3.10, installs dependencies, and runs all 71 unit and integration tests.
* **Frontend Job:** Sets up Node.js 20, verifies strict TypeScript typing (`npx tsc --noEmit`), and builds Next.js production bundle.
* **Docker Verification Job:** Validates `docker-compose.yml` configuration and verifies both container builds.

> **Note:** CI/CD runs 100% on GitHub cloud servers and consumes **0 MB RAM / 0% CPU** on your local machine.

---

## 💻 Local Development & Quickstart

For local development without Docker:

### 1. Start the Backend Server (FastAPI)
```bash
# Install Python dependencies
pip install -r requirements.txt

# Launch FastAPI on port 8000 with hot-reload
python -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
```
* Interactive API Documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### 2. Start the Frontend Server (Next.js 16)
```bash
# Install NPM dependencies
npm install

# Launch Next.js dev server on port 3000
npm run dev
```
* Frontend Application: [http://localhost:3000](http://localhost:3000)

### 3. Run the Terminal Railway Dispatcher CLI
```bash
python cli.py --train 12301
```

---

## 🧪 Automated Verification & Test Suite

Run the full automated test suite covering kinematics, weather injection, headway tracking, and platform conflict resolution:

```bash
python -m pytest tests/ -v
```

```
============================== 71 passed in 15.39s ==============================
```

Verify frontend TypeScript types:
```bash
npx tsc --noEmit
```

---

## 📡 API Documentation

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service health status and system version |
| `GET` | `/api/train/predict?query={train_no}` | Real-time dynamic prediction, full stoppages, passing stations & GPS |
| `GET` | `/api/train/{train_no}/state` | Historical kinematic replay telemetry & headway gap |
| `GET` | `/api/operations/inflow?station={code}` | Terminal yard queue, platform occupancy & conflict detection |
| `POST` | `/api/operations/resolve-conflict` | Two-way platform rerouting with automatic cache clearance |
| `GET` | `/api/cache/stats` | Redis / In-Memory cache hit metrics & health |
| `POST` | `/api/cache/clear` | Flushes active cache entries |

---

<div align="center">
  <b>RailSync Platform</b> • Built with precision for Indian Railways.
</div>
