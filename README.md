# RailSync 🚄⚡
### Intelligent Railway Kinematics, Live Satellite Telemetry & Dynamic ETA Engine

RailSync is a next-generation railway operations and simulation intelligence platform. It merges **live satellite GPS feeds (RTIS / ISRO NavIC)**, **high-precision train physics (WAP-7 traction kinematics)**, **aviation METAR / Doppler weather feeds**, and **LightGBM gradient-boosted delay models** to deliver **strictly P50 expected arrival times** and **station-to-station progressive delay/time-deletion analysis**.

---

## 🌟 Key Highlights & Capabilities

- 🛰️ **Live Railway Satellite Telemetry**: Integrated directly with Ministry of Railways NTES feeds and Indian Railway live station APIs for real-time tracking across 5-digit train numbers.
- ⏱️ **Dynamic Time Deletion / Slack Recovery**: Computes section-by-section delay recovery at 130 km/h line speed vs. delay injected from weather, caution TSRs, and outer-home holding.
- 📍 **Progressive Station Delay Transitions**: Progressive hop-by-hop tracking ($Current \rightarrow Hop\ 1 \rightarrow Hop\ 2 \rightarrow Destination$) with delay delta explanation.
- 🚉 **Station Platform Contention Radar**: Real-time junction throat inflow monitoring, platform overlap collision prevention, and outer-home holding penalty quantification.
- 🌦️ **Doppler & Aviation METAR Weather Radar**: Multi-tier resilient weather provider chain linking track sections to airport METAR observations (fog, monsoon rain, extreme heat speed caps).
- 🖥️ **Full-Stack Experience**:
  - **FastAPI REST Backend**: Comprehensive operational and telemetry API endpoints.
  - **React 19 + TypeScript Frontend**: 8 specialized operations consoles (Train Status, Dynamic ETA, Gantt Scheduling, Interlocking Visualizer, Operations Console, Telemetry Stream, Turnaround Roster, Home).
  - **Terminal CLI Radar**: High-resolution ANSI 4-Box operational dispatch radar for terminal usage.

---

## 📐 Architecture & Multi-Factor Waterfall

$$\text{Net Delay} = T_{\text{weather}} + (T_{\text{sig}} + T_{\text{tsr}}) + T_{\text{throat}} + T_{\text{platform}} - T_{\text{recovery}}$$

| Delay Component | Mechanism & Physical Source |
| :--- | :--- |
| **$T_{\text{weather}}$** | Severe/heavy fog (MPS clamped to 60–75 km/h), torrential rain, track temperature cautions |
| **$T_{\text{sig}} + T_{\text{tsr}}$** | Headway aspect caution (double yellow/yellow) and engineering temporary speed restrictions |
| **$T_{\text{throat}}$** | Terminal junction switch diamond speed limits (25–30 km/h) |
| **$T_{\text{platform}}$** | Platform berthing contention and outer-home signal holding |
| **$T_{\text{recovery}}$** | **Time Deletion**: Slack recovery buffer utilization at Maximum Permissible Speed (130 km/h) |

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ & npm

### 2. Backend Setup & CLI Usage
```bash
# Clone the repository
git clone https://github.com/ark2006aug13-byte/railsync.git
cd railsync

# Install Python dependencies
pip install -r requirements.txt

# Run the Terminal CLI for any train
python cli.py --train 12004
python cli.py --train 12301
python cli.py --train 12367

# Run live station traffic & platform contention radar
python cli.py --station NDLS --hours 2

# Start the FastAPI backend server
uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
```

### 3. Frontend Setup
```bash
# Install NPM dependencies
npm install

# Start Vite React development server
npm run dev
```

### 4. Running Verification Test Suite
```bash
python -m pytest tests/ -v
```

---

## 🗂️ Project Structure

```
railsync/
├── api/                   # FastAPI REST backend & operational schemas
│   ├── main.py            # Primary REST endpoints & live feeds
│   ├── incidents.py       # Crowdsourced incident reporting engine
│   └── schemas.py         # Pydantic v2 data models
├── engine/                # Core kinematics & analytical engines
│   ├── live_rail_api.py   # NTES & Indian Rail API live scraper & normalizer
│   ├── predictor.py       # Multi-factor ETA waterfall & dynamic time deletion
│   ├── weather_engine.py  # Aviation METAR & climatological weather radar
│   ├── incident_detector.py # Kinematic telemetry anomaly & sudden-stop detector
│   ├── network_tracker.py # Real-time section tracking & corridor congestion
│   └── replay.py          # Physics-based historical simulation replay
├── ml/                    # Machine learning runtime artifacts & training pipelines
│   └── artifacts/         # LightGBM model, feature metadata, encoders
├── src/                   # React 19 + TypeScript frontend
│   ├── components/        # Operational screens & UI controls
│   ├── context/           # TrainContext global telemetry state provider
│   └── services/          # railSyncApi client
├── tests/                 # Automated test suite (71 passing tests)
├── cli.py                 # ANSI 4-Box Terminal Dispatcher Radar
└── config.py              # Central corridor stations, sections, locomotives config
```

---

## 🛡️ License & Acknowledgements
Built for modern, reliable, and intelligent railway transit management.
