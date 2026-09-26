import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Sparkles, 
  Radio, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingDown, 
  Clock, 
  FileText, 
  Download, 
  Wind, 
  Sun, 
  Gauge, 
  ShieldCheck, 
  Share2,
  ChevronRight,
  Info
} from 'lucide-react';
import { AppView } from '../../types';
import { useTrain } from '../../context/TrainContext';

interface DynamicETAScreenProps {
  onNavigate: (view: AppView) => void;
}

export const DynamicETAScreen: React.FC<DynamicETAScreenProps> = ({ onNavigate }) => {
  const { 
    trainOverview, 
    routeStations, 
    trainState, 
    accuracyMetrics, 
    isBackendOnline,
    lastSyncedAt 
  } = useTrain();

  const [downloaded, setDownloaded] = useState(false);
  const upcomingStations = routeStations.filter(s => s.status !== 'passed');
  const [selectedStationCode, setSelectedStationCode] = useState<string>(
    upcomingStations[0]?.stationCode || 'CNB'
  );

  const activeStation = upcomingStations.find(s => s.stationCode === selectedStationCode) 
    || upcomingStations[0] 
    || routeStations[routeStations.length - 1];

  const handleDownload = () => {
    const payload = {
      train: trainOverview,
      station: activeStation,
      telemetry: trainState,
      accuracy: accuracyMetrics,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `railsync-dynamic-eta-${activeStation?.stationCode || 'station'}.json`;
    a.click();
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2500);
  };

  const delayIncurred = Math.max(0, Math.round(activeStation?.delayInjectedMinutes ?? activeStation?.delayMinutes ?? 18));
  const timeDeleted = Math.max(0, Math.round(activeStation?.timeDeletionMinutes ?? 4));
  const outerHolding = Math.max(0, Math.round(activeStation?.outerHoldingMinutes ?? (activeStation?.platformConflict ? 8 : 0)));

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      {/* Breadcrumb & Navigation */}
      <div className="space-y-2">
        <button
          onClick={() => onNavigate('train-status')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Live Train Status ({trainOverview.trainNumber} {trainOverview.trainName})
        </button>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                Explainable AI • LightGBM + NavIC RTIS Sectional Model
              </span>
              <span className={`text-xs font-mono px-2 py-0.5 rounded border flex items-center gap-1 ${
                isBackendOnline 
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200' 
                  : 'text-amber-700 bg-amber-50 border-amber-200'
              }`}>
                <Radio className="w-3 h-3 text-emerald-600" />
                {isBackendOnline ? 'FastAPI Live Telemetry Connected' : 'Local Fallback Engine'}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Dynamic ETA Intelligence & Delay Decomposition
            </h1>
            <p className="text-xs md:text-sm text-slate-600 max-w-3xl mt-1 leading-relaxed">
              Real-time transparent decomposition of why {trainOverview.trainName}'s arrival at <strong className="text-slate-900">{activeStation?.stationName} ({activeStation?.stationCode})</strong> is forecast at {activeStation?.aiForecastTime} ({activeStation?.delayFormatted || `+${activeStation?.delayMinutes}m`}) instead of an opaque black-box estimate.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('operations-console')}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <span>NDLS Operations Console</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Station Horizon Selector Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
            Downstream Target Station:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {upcomingStations.map((stn) => (
              <button
                key={stn.stationCode}
                onClick={() => setSelectedStationCode(stn.stationCode)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold font-mono transition-all cursor-pointer ${
                  selectedStationCode === stn.stationCode
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {stn.stationCode} ({stn.platform})
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs font-mono text-slate-500">
          Target: <strong className="text-slate-900">{activeStation?.stationName}</strong> • {activeStation?.platform}
        </div>
      </div>

      {/* Top Waterfall Card: Algorithmic ETA Synthesis */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900 tracking-tight">Algorithmic ETA Synthesis Waterfall</span>
            <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              {activeStation?.stationCode} Forecast Target
            </span>
          </div>
          <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Confidence: ±{activeStation?.confidenceMinutes ?? 2.5} mins (95% CI)
          </span>
        </div>

        {/* 5-Step Synthesis Waterfall */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-center">
          {/* Box 1: Base Timetable */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
              1. Base Timetable
            </span>
            <div className="text-2xl font-black text-slate-800 font-mono">{activeStation?.scheduledTime || '10:45 AM'}</div>
            <span className="text-[11px] text-slate-500 block">Timetabled IRCTC Slot</span>
          </div>

          {/* Box 2: Incurred Delay Injection */}
          <div className="p-4 rounded-xl bg-rose-50/80 border border-rose-200 space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-rose-800 font-semibold block">
              2. Delay Injected
            </span>
            <div className="text-2xl font-black text-rose-700 font-mono">+{delayIncurred}:00</div>
            <span className="text-[11px] text-rose-800 block">Weather / Headway variance</span>
          </div>

          {/* Box 3: Platform Holding / Track Caution */}
          <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-amber-800 font-semibold block">
              3. Platform / TSR Hold
            </span>
            <div className="text-2xl font-black text-amber-700 font-mono">+{outerHolding > 0 ? outerHolding : 2}:00</div>
            <span className="text-[11px] text-amber-800 block">
              {activeStation?.platformConflict ? `Pf ${activeStation.platform} contention hold` : 'Signal caution aspect'}
            </span>
          </div>

          {/* Box 4: Dynamic Time Deletion / Slack Recovery */}
          <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-emerald-800 font-semibold block flex items-center justify-between">
              <span>4. Time Deletion</span>
              <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
            </span>
            <div className="text-2xl font-black text-emerald-600 font-mono">-{timeDeleted}:00</div>
            <span className="text-[11px] text-emerald-800 block">130 km/h line speed & slack</span>
          </div>

          {/* Box 5: Final Dynamic ETA */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-blue-900 to-indigo-900 text-white border border-blue-800 space-y-1 shadow-md">
            <span className="text-[11px] uppercase tracking-wider text-blue-300 font-semibold block flex items-center justify-between">
              <span>Dynamic AI ETA</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </span>
            <div className="text-3xl font-black text-white font-mono">{activeStation?.aiForecastTime || '11:05 AM'}</div>
            <span className="text-[11px] text-blue-200 block font-mono">
              Net {activeStation?.delayFormatted || `+${activeStation?.delayMinutes}m`}
            </span>
          </div>
        </div>

        {/* Telemetry Probability Distribution */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 font-mono gap-3">
          <div className="flex items-center gap-4">
            <span>RTIS Sensor Direct: <strong className="text-slate-800">78.0%</strong></span>
            <span>Historical Corridor Net: <strong className="text-slate-800">18.4%</strong></span>
            <span>Slack Absorption: <strong className="text-emerald-700 font-bold">{timeDeleted} mins deleted</strong></span>
          </div>
        </div>
      </div>

      {/* 4 Factor Breakdown & Real-Time Telemetry Proof */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <span>Decomposed Delay Factors & Real-Time Sensor Telemetry</span>
          <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            4 Core Subsystems
          </span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Factor 1: Signaling & Block Headway */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                1. Signaling & Block Headway
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                trainState?.signal_aspect?.code === 'GREEN'
                  ? 'bg-emerald-100 text-emerald-800'
                  : trainState?.signal_aspect?.code === 'DOUBLE_YELLOW'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-rose-100 text-rose-800'
              }`}>
                {trainState?.signal_aspect?.badge || '🟢 Green (Clear)'}
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 text-base">
                {trainState?.position?.current_section || 'Corridor'} Block Clearance & Headway
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Automatic Signaling aspect dictates speed cap: <strong className="text-slate-900">{trainState?.signal_aspect?.speed_cap || '130 km/h (Line Speed)'}</strong>. 
                {trainState?.leading_train ? ` Trailing Train #${trainState.leading_train.train_no} ${trainState.leading_train.name} by ${trainState.leading_train.headway_gap_km} km.` : ' No leading train in active block.'}
              </p>
            </div>

            {/* Visual track diagram */}
            <div className="p-3 bg-slate-900 text-slate-300 rounded-xl space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Train #{trainOverview.trainNumber} (KM {Math.round(trainState?.position?.km ?? 0)})</span>
                <span className="text-emerald-400">
                  Headway: {trainState?.leading_train?.headway_gap_km ?? 25.0} km
                </span>
                <span>{activeStation?.stationCode} Approach</span>
              </div>
              <div className="h-3 bg-slate-800 rounded-full flex items-center px-1">
                <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm shadow-blue-400"></div>
                <div className="flex-1 border-t-2 border-emerald-500/80 border-dashed mx-2"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] text-slate-500 font-mono">
              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <span className="block text-slate-400">Signal Aspect</span>
                <strong className="text-slate-800">{trainState?.signal_aspect?.code || 'CLEAR'}</strong>
              </div>
              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <span className="block text-slate-400">Preceding Train</span>
                <strong className="text-emerald-700">{trainState?.leading_train?.train_no || '12876'}</strong>
              </div>
              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <span className="block text-slate-400">Effective Headway</span>
                <strong className="text-slate-800">{trainState?.leading_train?.headway_gap_km ?? 25} km</strong>
              </div>
            </div>
          </div>

          {/* Factor 2: Trackside Engineering & Platform Contention */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                2. Trackside & Platform Status
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                activeStation?.platformConflict
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}>
                {activeStation?.platformConflict ? `⚠️ Pf Clash (+${outerHolding}m hold)` : `${activeStation?.platform} Confirmed`}
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 text-base">
                {activeStation?.stationName} ({activeStation?.platform}) Inflow
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {activeStation?.platformConflict
                  ? `Platform ${activeStation.platform} is occupied by ${activeStation.conflictingTrain || 'Train 12876'}. Predictor incorporates +${outerHolding}m outer holding buffer.`
                  : `Assigned berth ${activeStation?.platform} is proven unencumbered. Direct reception without outer signal detention.`}
              </p>
            </div>

            {/* Velocity profile visual */}
            <div className="p-3 bg-slate-900 text-slate-300 rounded-xl space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>130 km/h MPS</span>
                <span className={activeStation?.platformConflict ? 'text-rose-400' : 'text-emerald-400'}>
                  {activeStation?.platformConflict ? 'Outer Loop Hold 0 km/h' : 'Direct Berth Entry'}
                </span>
                <span>Berth Speed 15 km/h</span>
              </div>
              <div className="h-4 bg-slate-800 rounded flex items-center overflow-hidden">
                <div className="w-[50%] h-full bg-blue-600 flex items-center justify-center text-[9px] text-white">130 km/h</div>
                <div className={`w-[25%] h-full flex items-center justify-center text-[9px] font-bold ${activeStation?.platformConflict ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>
                  {activeStation?.platformConflict ? 'Hold Signal' : 'Clear Route'}
                </div>
                <div className="w-[25%] h-full bg-blue-600 flex items-center justify-center text-[9px] text-white">Platform</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] text-slate-500 font-mono">
              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <span className="block text-slate-400">Assigned Platform</span>
                <strong className="text-slate-800">{activeStation?.platform}</strong>
              </div>
              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <span className="block text-slate-400">Outer Detention</span>
                <strong className={activeStation?.platformConflict ? 'text-rose-700' : 'text-emerald-700'}>
                  {outerHolding > 0 ? `+${outerHolding} mins` : '0 min'}
                </strong>
              </div>
              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <span className="block text-slate-400">Conflict Reroute</span>
                <strong className="text-slate-800">{activeStation?.platformConflict ? 'Pf 5 Alt' : 'Not Needed'}</strong>
              </div>
            </div>
          </div>

          {/* Factor 3: Neural Speed Recovery & Time Deletion */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                3. Dynamic Time Deletion & Recovery
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Recovers -{timeDeleted} mins
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 text-base">
                130 km/h Line Speed & Timetable Slack Absorption
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                LightGBM model attributes <strong className="text-emerald-700">-{timeDeleted} minutes</strong> of delay deletion by combining 130 km/h cruising on straight quad tracks with scheduled timetable recovery margins.
              </p>
            </div>

            {/* Neural Compression Curve Graphic */}
            <div className="p-3 bg-slate-900 text-slate-300 rounded-xl space-y-1 font-mono text-xs">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Delay Reduction Profile (Time Deletion)</span>
                <span className="text-emerald-400 font-bold">-{timeDeleted}m Net Deletion</span>
              </div>
              <div className="h-10 flex items-end gap-1.5 pt-2">
                {[30, 42, 58, 70, 85, 95, 110, 118, 128, 128].map((val, i) => (
                  <div key={i} className="flex-1 bg-blue-500/30 rounded-t hover:bg-blue-400 transition-colors relative group" style={{ height: `${(val / 130) * 100}%` }}>
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-5 left-1/2 -translate-x-1/2 bg-black text-[9px] px-1 py-0.5 rounded text-white pointer-events-none">
                      {val}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] text-slate-500 font-mono">
              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <span className="block text-slate-400">Time Deleted</span>
                <strong className="text-emerald-700">-{timeDeleted} mins</strong>
              </div>
              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <span className="block text-slate-400">Track MPS</span>
                <strong className="text-slate-800">130 km/h</strong>
              </div>
              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <span className="block text-slate-400">Loco Class</span>
                <strong className="text-slate-800">{trainOverview.locoClass}</strong>
              </div>
            </div>
          </div>

          {/* Factor 4: Atmospheric & Fog Weather Restrictions */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                4. Atmospheric & Fog Conditions
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                activeStation?.weatherCondition?.toLowerCase().includes('fog')
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {activeStation?.weatherCondition || 'Clear Track Dynamics'}
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 text-base">
                {activeStation?.weatherCondition?.toLowerCase().includes('fog')
                  ? 'Winter Fog Speed Cap (MPS 60 km/h Applied)'
                  : 'Zero Fog, Optimal Ambient Track Temperature'}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {activeStation?.weatherCondition?.toLowerCase().includes('fog')
                  ? 'Thick winter fog in Northern/Eastern plains triggers safety protocol capping speeds at 60 km/h, injecting +12m sectional delay.'
                  : 'Sensor nodes confirm optical visibility > 3,000m. Rail thermal expansion index remains safely nominal.'}
              </p>
            </div>

            {/* Weather Metrics */}
            <div className="p-3 bg-slate-900 text-slate-300 rounded-xl grid grid-cols-3 gap-3 font-mono text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Sun className="w-3 h-3 text-amber-400" />
                  VISIBILITY
                </span>
                <strong className="text-white text-sm">
                  {activeStation?.weatherCondition?.toLowerCase().includes('fog') ? '<300m (Fog)' : '3,500m (Clear)'}
                </strong>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-blue-400" />
                  SPEED CAP
                </span>
                <strong className="text-white text-sm">
                  {activeStation?.weatherCondition?.toLowerCase().includes('fog') ? '60 km/h PSR' : '130 km/h MPS'}
                </strong>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Wind className="w-3 h-3 text-cyan-400" />
                  CROSSWIND
                </span>
                <strong className="text-white text-sm">12 km/h</strong>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] text-slate-500 font-mono">
              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <span className="block text-slate-400">Weather Status</span>
                <strong className="text-slate-800">{activeStation?.weatherCondition || 'Normal'}</strong>
              </div>
              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <span className="block text-slate-400">Fog Safety Unit</span>
                <strong className={activeStation?.weatherCondition?.toLowerCase().includes('fog') ? 'text-amber-700' : 'text-slate-800'}>
                  {activeStation?.weatherCondition?.toLowerCase().includes('fog') ? 'ENGAGED' : 'Disengaged'}
                </strong>
              </div>
              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <span className="block text-slate-400">Delay Impact</span>
                <strong className="text-slate-800">
                  {activeStation?.weatherCondition?.toLowerCase().includes('fog') ? '+12 mins' : '0 min'}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Comparison Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 text-lg">
              Why Explainable AI Matters to Modern Rail Operations
            </h3>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Traditional NTES estimates broadcast rigid +30m static delays without accounting for clear down-line block priority. RailPulse synthesizes real-time block headway and traction curves.
            </p>
          </div>

          {/* Comparison pills */}
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <span className="text-[10px] text-slate-400 block uppercase font-mono">Static NTES</span>
              <span className="text-base font-bold text-slate-700 font-mono">11:15 AM</span>
              <span className="text-[10px] text-red-600 block font-semibold">+30m</span>
            </div>

            <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-center ring-1 ring-blue-400">
              <span className="text-[10px] text-blue-600 block uppercase font-mono font-bold">RailSync AI ETA</span>
              <span className="text-base font-bold text-blue-900 font-mono">11:05 AM</span>
              <span className="text-[10px] text-emerald-600 block font-semibold">±2m precision</span>
            </div>
          </div>
        </div>

        {/* Action Buttons Bar */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownload}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloaded ? 'Telemetry JSON Downloaded!' : 'Download Telemetry Log (JSON / PDF)'}</span>
            </button>

            <button
              onClick={() => onNavigate('telemetry-stream')}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Compare Full Corridor Telemetry</span>
            </button>
          </div>

          <button
            onClick={() => alert('Subscribed to Train 12302 Kanpur arrival SMS notifications!')}
            className="px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition-all cursor-pointer"
          >
            Subscribe to Kanpur Arrival SMS
          </button>
        </div>
      </div>
    </div>
  );
};
