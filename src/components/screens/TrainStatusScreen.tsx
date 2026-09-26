import React, { useState } from 'react';
import { 
  ArrowLeft, 
  RotateCw, 
  Share2, 
  Clock, 
  Gauge, 
  MapPin, 
  Radio, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Train, 
  ShieldCheck, 
  ArrowRight,
  ChevronDown,
  Info,
  TrendingDown,
  AlertTriangle
} from 'lucide-react';
import { AppView, TrainOverview } from '../../types';
import { useTrain } from '../../context/TrainContext';

interface TrainStatusScreenProps {
  onNavigate: (view: AppView) => void;
  trainData?: TrainOverview;
}

export const TrainStatusScreen: React.FC<TrainStatusScreenProps> = ({ 
  onNavigate, 
  trainData 
}) => {
  const { 
    trainOverview, 
    routeStations, 
    trainState, 
    isBackendOnline, 
    lastSyncedAt, 
    refresh 
  } = useTrain();

  const currentTrain = trainData || trainOverview;
  const [selectedCoach, setSelectedCoach] = useState<string | null>('B2');
  const [showAllStops, setShowAllStops] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="space-y-1">
          <button
            onClick={() => onNavigate('home')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Search
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <span>{currentTrain.trainNumber} {currentTrain.trainName}</span>
              <span className="text-sm font-mono font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                {currentTrain.sourceCode} → {currentTrain.destinationCode}
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            {currentTrain.type} • {currentTrain.locoClass} {currentTrain.locoNumber} • {currentTrain.schedule}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="text-right hidden sm:block">
            <span className="text-[11px] font-mono text-emerald-700 font-semibold flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${isBackendOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
              {isBackendOnline ? 'FastAPI Live Stream' : 'Local Fallback'}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {lastSyncedAt ? `Synced ${lastSyncedAt.toLocaleTimeString()}` : 'GPS/NavIC RTIS Dual Link'}
            </span>
          </div>

          <button
            onClick={handleRefresh}
            title="Refresh Telemetry"
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-all cursor-pointer shadow-xs"
          >
            <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          <button
            onClick={() => alert('Live train tracking link copied to clipboard!')}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share Live</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Details & Right Route Progression */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Cols 1-7) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Main Hero Prediction Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <span className="text-xs font-mono font-bold tracking-wider text-slate-500 uppercase">
                PREDICTED ARRIVAL AT {currentTrain.nextStation.toUpperCase()} ({currentTrain.nextStationCode})
              </span>
              <span className="text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                {currentTrain.confidencePercent}% Confidence (±{trainState?.upcoming_stations?.[0]?.confidence_min ?? 2.5}m)
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-4">
              <div className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight font-mono">
                {currentTrain.predictedArrival}
              </div>
              <div className="text-slate-400 line-through text-lg font-mono">
                {currentTrain.scheduledArrival}
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 border ${
                currentTrain.delayMinutes > 20 
                  ? 'bg-rose-100 text-rose-900 border-rose-200'
                  : currentTrain.delayMinutes > 5
                  ? 'bg-amber-100 text-amber-900 border-amber-200'
                  : 'bg-emerald-100 text-emerald-900 border-emerald-200'
              }`}>
                <AlertCircle className="w-3.5 h-3.5" />
                <span>
                  {currentTrain.delayMinutes > 0 ? `+${currentTrain.delayMinutes}m delay` : currentTrain.delayMinutes < 0 ? `${currentTrain.delayMinutes}m early` : 'On-time'}
                </span>
              </div>
            </div>

            {/* Dynamic Recovery Window Box */}
            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 text-xs text-blue-900 space-y-1">
              <div className="font-bold flex items-center justify-between gap-1.5 text-blue-700">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  Time Deletion & Slack Absorption Active
                </span>
                {trainState?.upcoming_stations?.[0]?.time_deletion_min ? (
                  <span className="bg-emerald-100 text-emerald-800 text-[11px] font-mono px-2 py-0.5 rounded border border-emerald-200">
                    -{trainState.upcoming_stations[0].time_deletion_min}m Deleted
                  </span>
                ) : null}
              </div>
              <p className="text-blue-800/90 leading-relaxed">
                {trainState?.upcoming_stations?.[0]?.why || 'LightGBM model predicts section runtime based on current 130 km/h track speed, dynamic headway, and scheduled timetabled slack.'}
              </p>
            </div>
          </div>

          {/* 3 Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-2">
              <span className="text-xs text-slate-500 font-semibold block uppercase">Current Speed</span>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {currentTrain.currentSpeed} <span className="text-xs font-normal text-slate-500">km/h</span>
              </div>
              <div className="space-y-1">
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 rounded-full" 
                    style={{ width: `${Math.min(100, (currentTrain.currentSpeed / currentTrain.mps) * 100)}%` }}
                  ></div>
                </div>
                <span className="text-[10px] text-slate-400 font-mono block">MPS: {currentTrain.mps} km/h allowed</span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-2">
              <span className="text-xs text-slate-500 font-semibold block uppercase">Next Station</span>
              <div className="text-lg font-bold text-slate-900 truncate">
                {currentTrain.nextStation}
              </div>
              <div className="text-xs text-slate-500 font-medium">
                <strong className="text-slate-800">{currentTrain.distanceToNextStationKm} km</strong> away, approx <strong className="text-slate-800">{currentTrain.timeRemainingMinutes} mins</strong>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-2">
              <span className="text-xs text-slate-500 font-semibold block uppercase">Expected Track</span>
              <div className="text-lg font-bold text-amber-700 flex items-center gap-1.5">
                <span>{currentTrain.assignedPlatform}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">Confirmed</span>
              </div>
              <span className="text-[11px] text-slate-500 block leading-tight">
                {currentTrain.platformDetail}
              </span>
            </div>
          </div>

          {/* Trackside Telemetry & NavIC Status Strip */}
          <div className="bg-slate-900 text-slate-200 rounded-xl p-4 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div>
              <span className="text-slate-400 block text-[10px]">SECTION SIGNAL</span>
              <span className="text-emerald-400 font-semibold">{currentTrain.sectionSignal}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">HEADWAY TO LEADING</span>
              <span className="text-slate-200 font-semibold">
                {trainState?.leading_train ? `${trainState.leading_train.headway_gap_km} km (${trainState.leading_train.name})` : `Headway ${currentTrain.loopCongestionHeadwayKm} km`}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">NAVIC SAT LINK</span>
              <span className="text-blue-400 font-semibold">Locked ({currentTrain.navicSatLockCount} Sats RTIS)</span>
            </div>
          </div>

          {/* Large Callout Banner: Inspect Delay Factors & AI Logic */}
          <div 
            onClick={() => onNavigate('dynamic-eta')}
            className="group bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white p-5 rounded-2xl shadow-md hover:shadow-xl transition-all cursor-pointer border border-blue-600 flex items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-sm tracking-wide">
                <Sparkles className="w-4 h-4 fill-amber-300" />
                Inspect Delay Factors & AI Logic →
              </div>
              <p className="text-xs text-blue-100 max-w-xl leading-relaxed">
                Analyze why +20m variance occurred near Pt. Deen Dayal Upadhyaya outer loop & view machine-learning recovery forecast.
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white group-hover:translate-x-1 transition-transform">
              <ArrowRight className="w-5 h-5" />
            </div>
          </div>

          {/* Rake Composition */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Rake Composition • 22 Coaches (LHB Rake)
              </span>
              <span className="text-[11px] text-slate-400">Click coach to view axle telemetry</span>
            </div>

            {/* Coach layout strip */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-2">
              <div className="px-2 py-2 bg-slate-800 text-white rounded text-[10px] font-bold font-mono">
                LOCO WAP-7
              </div>
              {trainData.rakeComposition.map((coach, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedCoach(coach)}
                  className={`px-2.5 py-2 rounded text-xs font-mono font-bold transition-all ${
                    selectedCoach === coach
                      ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {coach}
                </button>
              ))}
            </div>

            {selectedCoach && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-700 font-medium">
                  Coach <strong>{selectedCoach}</strong>: AC 3-Tier LHB (Bogie #WAP-B74)
                </span>
                <span className="text-emerald-700 font-mono font-semibold">
                  Axle Temp: 42.1°C (Nominal) • Bearing Vibration: Low
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Route Progression (Cols 8-12) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Live Route Progression</h3>
              <span className="text-xs text-slate-500">
                {trainState?.position?.km ? `${Math.min(100, Math.round((trainState.position.km / 1451) * 100))}% Journey Complete (KM ${Math.round(trainState.position.km)} / 1451)` : 'Corridor Live Stream'}
              </span>
            </div>
            <div className="text-right font-mono text-xs">
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Active NavIC Fix
              </span>
            </div>
          </div>

          {/* Dynamic Timeline Nodes */}
          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {/* 1. Passed Stations */}
            {routeStations.filter(s => s.status === 'passed').map((stn) => (
              <div key={stn.stationCode} className="relative">
                <div className="absolute -left-6 top-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow"></div>
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{stn.stationName} ({stn.stationCode})</span>
                    <span className="font-mono text-slate-400">{stn.platform}</span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    Departed {stn.departureTime || stn.aiForecastTime || stn.scheduledTime}
                    {stn.delayMinutes ? (
                      <span className="text-amber-700 font-semibold ml-1">
                        (Sched {stn.scheduledTime} +{Math.round(stn.delayMinutes)}m)
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}

            {/* 2. Active RTIS GPS Position Card */}
            <div className="relative -ml-2 p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
                  Active RTIS GPS Position
                </div>
                <span className="text-xs font-mono font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">
                  {trainState?.position?.speed_kmph ?? currentTrain.currentSpeed} km/h
                </span>
              </div>
              <p className="text-xs text-blue-800 leading-snug">
                Section KM {Math.round(trainState?.position?.km ?? 0)} ({trainState?.position?.current_section || 'Grand Chord Trunk'}) • Signal: <strong className="text-emerald-700">{trainState?.signal_aspect?.badge || currentTrain.sectionSignal}</strong>
              </p>
              {trainState?.leading_train && (
                <div className="text-[11px] text-slate-600 font-mono bg-white/70 p-1.5 rounded border border-blue-100 flex items-center justify-between">
                  <span>Leading Train #{trainState.leading_train.train_no} {trainState.leading_train.name}</span>
                  <span className="font-bold text-blue-900">{trainState.leading_train.headway_gap_km} km ahead</span>
                </div>
              )}
            </div>

            {/* 3. Upcoming Stations */}
            {routeStations.filter(s => s.status !== 'passed').map((stn, idx) => {
              const isFirstUpcoming = idx === 0;
              return (
                <div key={stn.stationCode} className="relative">
                  <div className={`absolute -left-6 top-0 w-4 h-4 rounded-full border-2 border-white shadow ${
                    isFirstUpcoming 
                      ? 'bg-blue-600 ring-2 ring-blue-300' 
                      : stn.isTerminal 
                      ? 'bg-slate-800' 
                      : 'bg-slate-300'
                  }`}></div>

                  {isFirstUpcoming ? (
                    /* Next Immediate Stop - Highlighted Card */
                    <div className={`space-y-2 p-3.5 rounded-xl border ${
                      stn.platformConflict 
                        ? 'bg-red-50/80 border-red-200' 
                        : (stn.delayMinutes ?? 0) > 10 
                        ? 'bg-amber-50/80 border-amber-200' 
                        : 'bg-emerald-50/60 border-emerald-200'
                    }`}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{stn.stationName} ({stn.stationCode})</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-600 text-white font-mono uppercase tracking-wider">Next Stop</span>
                        </span>
                        <span className="font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                          {stn.platform}
                        </span>
                      </div>

                      {/* Platform Conflict Banner */}
                      {stn.platformConflict && (
                        <div className="p-2 rounded-lg bg-red-100 border border-red-300 text-red-900 text-xs font-semibold flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                          <span>⚠️ Pf Contention: Pf occupied by {stn.conflictingTrain || 'Train 12876'}. +{stn.outerHoldingMinutes || 8}m Outer Signal Hold</span>
                        </div>
                      )}

                      <div className="text-xs text-slate-700 font-mono flex flex-wrap items-center gap-2">
                        <span>Scheduled: <span className="line-through text-slate-400">{stn.scheduledTime}</span></span>
                        <span>→</span>
                        <strong className="text-slate-900 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          AI ETA: {stn.aiForecastTime}
                        </strong>
                        {stn.delayMinutes !== undefined && stn.delayMinutes > 0 ? (
                          <span className="text-rose-700 font-bold">+{Math.round(stn.delayMinutes)}m delay</span>
                        ) : null}
                      </div>

                      {/* Time Deletion Badge */}
                      {stn.timeDeletionMinutes && stn.timeDeletionMinutes > 0 ? (
                        <div className="text-[11px] font-mono text-emerald-800 bg-emerald-100/80 px-2 py-1 rounded flex items-center gap-1.5 border border-emerald-200">
                          <TrendingDown className="w-3 h-3 text-emerald-600" />
                          <span>⚡ Time Deletion: Recovers {stn.timeDeletionMinutes}m (130 km/h speed + scheduled slack)</span>
                        </div>
                      ) : null}

                      {/* Explainability Why */}
                      {stn.why && (
                        <div className="text-[11px] text-slate-600 font-mono">
                          Reason: {stn.why}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Remaining Downstream Stations */
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className={`font-bold ${stn.isTerminal ? 'text-slate-900 font-extrabold' : 'text-slate-700'}`}>
                          {stn.stationName} ({stn.stationCode}) {stn.isTerminal ? 'TERMINAL' : ''}
                        </span>
                        <span className="font-mono text-slate-400">{stn.platform}</span>
                      </div>
                      <div className="text-xs text-slate-500 font-mono flex flex-wrap items-center gap-1.5">
                        <span>Sched {stn.scheduledTime} • AI Forecast <strong className="text-slate-800">{stn.aiForecastTime}</strong></span>
                        {stn.timeDeletionMinutes && stn.timeDeletionMinutes > 0 ? (
                          <span className="text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            (Recovers {stn.timeDeletionMinutes}m)
                          </span>
                        ) : stn.delayMinutes ? (
                          <span className="text-amber-700 font-medium">
                            (+{Math.round(stn.delayMinutes)}m)
                          </span>
                        ) : null}
                      </div>
                      {stn.why && (
                        <div className="text-[10px] text-slate-400 font-mono truncate max-w-sm">
                          {stn.why}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Accordion toggle */}
          <button
            onClick={() => setShowAllStops(!showAllStops)}
            className="w-full py-2.5 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <span>{showAllStops ? 'Hide intermediate section waypoints' : 'View intermediate corridor waypoints'}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAllStops ? 'rotate-180' : ''}`} />
          </button>

          {showAllStops && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2 font-mono text-slate-600">
              <div className="flex justify-between"><span>Saktigarh Block (SKG)</span><span>Passed at line speed</span></div>
              <div className="flex justify-between"><span>Gomoh Jn Loop Line (GMO)</span><span>Clear Quad track</span></div>
              <div className="flex justify-between"><span>Sasaram Outer (SSM)</span><span>Aspect Clear Green</span></div>
              <div className="flex justify-between"><span>Chandauli Majhwar (CDMR)</span><span>Headway Normal</span></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
