/**
 * src/components/ReplayControlBar.tsx
 * Interactive Global Simulation Replay & Backend Synchronization Bar
 * Connects directly to TrainContext to provide play/pause, scrub, speed, and status.
 */
import React from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Wifi, 
  WifiOff, 
  Calendar, 
  Clock, 
  Gauge, 
  RefreshCw 
} from 'lucide-react';
import { useTrain } from '../context/TrainContext';

export const ReplayControlBar: React.FC = () => {
  const {
    isBackendOnline,
    lastSyncedAt,
    isLoading,
    isPlaying,
    playbackSpeed,
    currentSimTime,
    minSimTime,
    maxSimTime,
    runDate,
    availableDates,
    setRunDate,
    scrubToTime,
    togglePlay,
    setSpeed,
    trainState,
    trainOverview,
    refresh
  } = useTrain();

  // Calculate scrub percentage (0 to 100)
  let sliderPercent = 0;
  if (minSimTime && maxSimTime && currentSimTime) {
    const tMin = new Date(minSimTime).getTime();
    const tMax = new Date(maxSimTime).getTime();
    const tCur = new Date(currentSimTime).getTime();
    if (tMax > tMin) {
      sliderPercent = Math.max(0, Math.min(100, ((tCur - tMin) / (tMax - tMin)) * 100));
    }
  }

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!minSimTime || !maxSimTime) return;
    const pct = parseFloat(e.target.value);
    const tMin = new Date(minSimTime).getTime();
    const tMax = new Date(maxSimTime).getTime();
    const targetMs = tMin + (tMax - tMin) * (pct / 100);
    const targetIso = new Date(targetMs).toISOString();
    scrubToTime(targetIso);
  };

  const handleReset = () => {
    if (minSimTime) {
      scrubToTime(minSimTime);
    }
  };

  // Format current simulated time
  const formattedTime = currentSimTime 
    ? new Date(currentSimTime).toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--:--';

  return (
    <div className="bg-[#081220] border-b border-[#182942] text-white px-4 py-2 text-xs select-none shadow-md">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        
        {/* Left: Backend Online/Offline Status & Sync */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {isBackendOnline ? (
              <span className="flex items-center gap-1.5 font-semibold text-emerald-400 font-mono text-[11px] bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                <Wifi className="w-3 h-3 text-emerald-400" />
                <span>FASTAPI: ONLINE</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 font-semibold text-amber-400 font-mono text-[11px] bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60">
                <WifiOff className="w-3 h-3 text-amber-400" />
                <span>FALLBACK: MOCK DATA</span>
              </span>
            )}

            <button
              onClick={() => refresh()}
              disabled={isLoading}
              title="Sync with FastAPI backend"
              className="p-1 rounded bg-[#112035] hover:bg-[#1b3152] text-slate-300 hover:text-white border border-[#1e3452] transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          </div>

          {lastSyncedAt && (
            <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
              Synced {lastSyncedAt.toLocaleTimeString('en-IN', { hour12: false })}
            </span>
          )}
        </div>

        {/* Center: Playback Controls (Play/Pause, Reset, Speed Pills) */}
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            className={`px-3 py-1 rounded-lg font-semibold flex items-center gap-1.5 text-xs transition-all shadow-sm cursor-pointer ${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>PAUSE</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>REPLAY</span>
              </>
            )}
          </button>

          <button
            onClick={handleReset}
            title="Reset to trip origin"
            className="p-1.5 rounded-lg bg-[#112035] hover:bg-[#1b3152] text-slate-300 hover:text-white border border-[#1e3452] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
          </button>

          <div className="h-4 w-px bg-slate-700 mx-1 hidden sm:block"></div>

          {/* Speed Pills: 1x, 2x, 5x, 10x */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400 font-mono mr-0.5 hidden sm:inline">Speed:</span>
            {[1, 2, 5, 10].map((spd) => (
              <button
                key={spd}
                onClick={() => setSpeed(spd)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                  playbackSpeed === spd
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-[#112035] text-slate-400 hover:text-slate-200 hover:bg-[#1a3050] border border-[#1e3452]'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Right: Date Picker, Clock & Live Telemetry Snippet */}
        <div className="flex items-center gap-3">
          {/* Trip Date Picker */}
          <div className="flex items-center gap-1 bg-[#112035] px-2 py-0.5 rounded border border-[#1e3452]">
            <Calendar className="w-3 h-3 text-slate-400" />
            <select
              value={runDate}
              onChange={(e) => setRunDate(e.target.value)}
              className="bg-transparent text-white text-[11px] font-mono focus:outline-none cursor-pointer"
            >
              {availableDates.map((date) => (
                <option key={date} value={date} className="bg-[#0c1829] text-white">
                  {date}
                </option>
              ))}
            </select>
          </div>

          {/* Simulated Clock */}
          <div className="bg-[#070f1a] border border-[#142338] px-2.5 py-0.5 rounded font-mono text-cyan-400 font-bold text-[11px] flex items-center gap-1 shadow-inner">
            <Clock className="w-3 h-3 text-cyan-400" />
            <span>{formattedTime} IST</span>
          </div>
        </div>

      </div>

      {/* Scrubbing Timeline Slider */}
      <div className="max-w-7xl mx-auto mt-1.5 flex items-center gap-3">
        <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
          HWH (0 km)
        </span>
        <input
          type="range"
          min="0"
          max="100"
          step="0.1"
          value={sliderPercent}
          onChange={handleSliderChange}
          className="w-full accent-blue-500 cursor-pointer h-1.5 bg-[#142338] rounded-lg appearance-none"
        />
        <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
          NDLS (1451 km)
        </span>
        {trainState?.position && (
          <span className="text-[10px] font-mono text-blue-300 bg-blue-950/70 border border-blue-800/60 px-2 py-0.2 rounded whitespace-nowrap hidden lg:inline">
            KM {trainState.position.km.toFixed(1)} • {trainState.position.speed_kmph} km/h • Sec {trainState.position.current_section}
          </span>
        )}
      </div>
    </div>
  );
};
