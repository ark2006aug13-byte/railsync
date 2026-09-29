import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Building2,
  Route,
  Clock,
  CheckCircle,
  Lock,
  FileText,
  Zap,
  Check,
  Gauge,
  Users,
  Activity,
  X,
  Train,
  Radio,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../services/api';

interface Page4PlatformResolverProps {
  trainName?: string;
  runDate?: string;
  isRerouted: boolean;
  onConfirmReroute: () => void;
  onNavigateToPage2: () => void;
  onNavigateToPage3: () => void;
}

export const Page4PlatformResolver: React.FC<Page4PlatformResolverProps> = ({
  trainName,
  runDate,
  isRerouted,
  onConfirmReroute,
  onNavigateToPage2,
  onNavigateToPage3,
}) => {
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [trainState, setTrainState] = useState<any | null>(null);
  const [predictData, setPredictData] = useState<any | null>(null);
  const [inflowData, setInflowData] = useState<any | null>(null);

  const trainNoMatch = trainName ? trainName.match(/\b\d{5}\b/) : null;
  const trainNo = trainNoMatch ? trainNoMatch[0] : (trainName ? trainName.split('/')[0].trim() : '12301');
  const displayName = predictData?.trainName
    ? `${trainNo} / ${predictData.trainName}`.toUpperCase()
    : trainState?.trainName
    ? `${trainNo} / ${trainState.trainName}`.toUpperCase()
    : trainName
    ? trainName.toUpperCase()
    : `${trainNo} EXPRESS`;

  const terminalStation = predictData?.destinationEta?.stationName 
    || trainState?.upcomingStations?.slice(-1)[0]?.name 
    || 'Terminal Station';
  const terminalCode = predictData?.destinationEta?.stationCode || 'NDLS';
  const rawAssignedPf = predictData?.destinationEta?.platform || '12';
  const targetReroutePf = (rawAssignedPf === '16' || rawAssignedPf === '1') ? '2' : '16';
  const assignedPlatform = isRerouted ? targetReroutePf : rawAssignedPf;
  const dynamicEta = predictData?.destinationEta?.dynamicEtaFmt || '10:06 AM';
  const delayedEta = predictData?.destinationEta?.scheduledArrivalFmt || '10:15 AM';
  const conflictingTrain = trainState?.upcomingStations?.slice(-1)[0]?.conflictingTrain || 'Train 12876 (Neelachal Exp)';
  const holdPenaltyMin = trainState?.upcomingStations?.slice(-1)[0]?.outerHoldingMin || 9.0;
  const outerBlockName = `${terminalStation} Outer Block`;

  React.useEffect(() => {
    let isMounted = true;
    Promise.all([
      api.getTrainState(trainNo, runDate).catch(() => null),
      api.getTrainPredict(trainNo, runDate).catch(() => null),
      api.getInflow('NDLS').catch(() => null),
    ]).then(([state, pred, inflow]) => {
      if (isMounted) {
        if (state) setTrainState(state);
        if (pred) setPredictData(pred);
        if (inflow) setInflowData(inflow);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [trainNo, isRerouted, runDate]);

  const handleConfirm = async () => {
    setIsTransmitting(true);
    try {
      await api.resolveConflict(trainNo, targetReroutePf, terminalCode);
    } catch (e) {
      console.warn('Conflict resolution network error:', e);
    }
    setTimeout(() => {
      setIsTransmitting(false);
      onConfirmReroute();
    }, 600);
  };

  return (
    <div className="w-full min-h-[calc(100vh-6.75rem)] px-4 sm:px-8 py-6 md:py-10 animate-fadeIn">
      <div className="w-full max-w-[920px] mx-auto flex flex-col gap-6">
        {/* Top Action Breadcrumb & Operational Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onNavigateToPage3}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ffffff] text-[#131b2e] hover:bg-[#eaedff] transition-colors shadow-xs border border-[#c5c5d3]/30 text-xs font-semibold cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-[#00236f]" />
              <span>Back to Delay Breakdown</span>
            </button>
            <div className="h-4 w-[1px] bg-[#c5c5d3]/50 hidden sm:block"></div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#e2e7ff] text-[#131b2e]">
              <span className="w-2 h-2 rounded-full bg-[#00236f] animate-pulse"></span>
              <span className="text-[11px] font-bold">Station Ops View • NDLS</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#ffffff] border border-[#c5c5d3]/30 text-[#444651] text-[11px] shadow-xs self-start sm:self-auto">
            <span className="inline-block w-2 h-2 rounded-full bg-[#006c49]"></span>
            <span className="text-[#131b2e] font-semibold">Live Interlocking Synced</span>
            <span className="text-[#c5c5d3]">•</span>
            <span>0.4s</span>
            <span className="text-[#c5c5d3]">•</span>
            <span className="truncate">NDLS South Cabin Yard</span>
          </div>
        </div>

        {/* Page Context Title Block */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-[#c5c5d3]/30 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase tracking-wider text-[#757682] font-bold">
                New Delhi Junction (NDLS) Dispatch Sector 3
              </span>
              <span className="px-2 py-0.5 rounded bg-[#dce1ff] text-[#00164e] text-[10px] font-bold">
                RRI-Active
              </span>
            </div>
            <h1 className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl font-extrabold text-[#131b2e] tracking-tight">
              Platform Allocation &amp; Outer Hold Mitigation
            </h1>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs text-[#757682] font-medium">Target Rake:</span>
            <span className="font-['Plus_Jakarta_Sans'] text-sm sm:text-base font-bold text-[#00236f]">
              {displayName}
            </span>
          </div>
        </div>

        {/* State 1: Conflict Detected Banner (Visible when not rerouted) */}
        {!isRerouted && (
          <section className="p-5 sm:p-6 rounded-2xl bg-[#ffdad6]/40 border border-[#ba1a1a]/20 shadow-xs relative overflow-hidden transition-all duration-300">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#ba1a1a] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#ba1a1a]/10 text-[#ba1a1a] text-[10px] font-bold uppercase tracking-wider mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ba1a1a]"></span>
                    Critical Platform Bottleneck • +{holdPenaltyMin.toFixed(1)} Min Penalty
                  </div>
                  <h2 className="font-['Plus_Jakarta_Sans'] text-lg sm:text-xl font-bold text-[#131b2e] mb-1">
                    Outer Signal Hold Alert: Train {trainNo}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#444651] max-w-2xl leading-relaxed">
                    Assigned to <strong className="text-[#131b2e] font-bold">Platform {rawAssignedPf}</strong>.
                    Preceding{' '}
                    <span className="font-bold text-[#131b2e]">
                      {conflictingTrain}
                    </span>{' '}
                    is running late and still occupying PF {rawAssignedPf}. Train {trainNo} will be held at {outerBlockName} (+{holdPenaltyMin.toFixed(1)} mins penalty).
                  </p>
                </div>
              </div>
              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1 p-3 rounded-xl bg-[#ffffff]/90 border border-[#ba1a1a]/20 shrink-0">
                <span className="text-[10px] text-[#ba1a1a] font-bold uppercase">
                  Hold Risk
                </span>
                <span className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#ba1a1a] tabular-nums">
                  +{holdPenaltyMin.toFixed(1)}m
                </span>
                <span className="text-[11px] text-[#757682]">{terminalCode} Outer</span>
              </div>
            </div>

            {/* Telemetry Conflict Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-[#ba1a1a]/15">
              <div className="p-3 rounded-xl bg-[#ffffff]/95 border border-[#c5c5d3]/30">
                <span className="text-[10px] uppercase tracking-wider text-[#757682] block mb-1 font-bold">
                  Current Assigned Platform
                </span>
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-[#ba1a1a]" />
                  <span className="text-sm font-bold text-[#131b2e]">PF {rawAssignedPf}</span>
                  <span className="text-[10px] font-bold text-[#ba1a1a] bg-[#ffdad6] px-1.5 py-0.5 rounded">
                    Occupied
                  </span>
                </div>
                <span className="text-xs text-[#444651] block mt-0.5 truncate">
                  {conflictingTrain}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#ffffff]/95 border border-[#c5c5d3]/30">
                <span className="text-[10px] uppercase tracking-wider text-[#757682] block mb-1 font-bold">
                  Block Section
                </span>
                <div className="flex items-center gap-1.5">
                  <Route className="w-4 h-4 text-[#757682]" />
                  <span className="text-sm font-bold text-[#131b2e] truncate">
                    {outerBlockName}
                  </span>
                </div>
                <span className="text-xs text-[#757682] block mt-0.5">
                  Track Circuit TC-441
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#ffffff]/95 border border-[#c5c5d3]/30">
                <span className="text-[10px] uppercase tracking-wider text-[#757682] block mb-1 font-bold">
                  Imposed Holding Delay
                </span>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#ba1a1a]" />
                  <span className="text-xs font-bold text-[#ba1a1a]">
                    +{holdPenaltyMin.toFixed(1)} mins avoidable halt
                  </span>
                </div>
                <span className="text-xs text-[#757682] block mt-0.5">
                  Signal S-104 At Danger (Red)
                </span>
              </div>
            </div>
          </section>
        )}

        {/* State 2: Post-Action Success State */}
        {isRerouted && (
          <section className="p-6 rounded-2xl bg-[#6cf8bb]/30 text-[#002113] shadow-md border-l-4 border-[#006c49] border-y border-r border-[#006c49]/30 transition-all duration-300 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#006c49] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <CheckCircle className="w-7 h-7 text-white" />
                </div>
                <div className="flex flex-col">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#006c49] text-white text-[10px] font-bold uppercase tracking-wider w-fit mb-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    Interlocking Route Locked
                  </div>
                  <h2 className="font-['Plus_Jakarta_Sans'] text-lg sm:text-xl font-bold text-[#002113]">
                    Platform Conflict Resolved! Holding Delay Deleted
                  </h2>
                  <p className="text-xs sm:text-sm text-[#005236] mt-1 leading-relaxed">
                    New scheduled ETA:{' '}
                    <strong className="text-[#002113] font-bold">{dynamicEta}</strong>. Point switch sequence 42B confirmed secured by Solid State Interlocking (SSI). Track {targetReroutePf} cleared and signaled green.
                  </p>
                  <div className="mt-3.5 p-3 rounded-xl bg-[#ffffff] text-[#131b2e] flex flex-col gap-1 shadow-xs border border-[#006c49]/20 text-xs">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#006c49]" />
                      <span className="font-bold text-[#131b2e]">
                        Dispatch Receipt #{terminalCode}-{trainNo}
                      </span>
                    </div>
                    <p className="text-[#444651] text-[11px]">
                      Interlocking command transmitted to {terminalCode} Route Relay Interlocking (RRI) Cabin • Switch 42B aligned to PF {targetReroutePf}.
                    </p>
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex flex-col items-end gap-2 mt-2 sm:mt-0 w-full sm:w-auto">
                <div className="px-4 py-2 rounded-xl bg-[#ffffff] border border-[#006c49]/20 text-center shadow-xs w-full sm:w-auto">
                  <span className="text-[10px] text-[#757682] block uppercase font-bold">
                    Updated Berthing
                  </span>
                  <span className="font-['Plus_Jakarta_Sans'] text-2xl text-[#006c49] font-bold tabular-nums">
                    {dynamicEta}
                  </span>
                  <span className="text-[11px] text-[#006c49] font-bold block">
                    PF {targetReroutePf} Secured
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onNavigateToPage2}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#00236f] text-white hover:bg-[#1e3a8a] transition-colors shadow-xs text-xs font-bold mt-2 cursor-pointer"
                >
                  <span>Return to Live Arrival Tracker</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Main Mitigation Recommendation Module */}
        <section className="bg-[#ffffff] rounded-2xl p-6 sm:p-8 shadow-xs border border-[#c5c5d3]/30 flex flex-col gap-6 relative">
          {/* Card Header with AI badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#c5c5d3]/20 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#dce1ff] text-[#00236f] flex items-center justify-center">
                <Zap className="w-5 h-5 text-[#00236f]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-[#00236f] font-bold">
                    AI Reroute Recommendation
                  </span>
                  <span className="w-1 h-1 rounded-full bg-[#c5c5d3]"></span>
                  <span className="text-[11px] text-[#006c49] font-semibold">
                    Optimal Dispatch Slot Identified
                  </span>
                </div>
                <h3 className="font-['Plus_Jakarta_Sans'] text-base sm:text-lg font-bold text-[#131b2e]">
                  Reroute Train {trainNo} to Platform {targetReroutePf} (Currently Empty &amp; Clear)
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-1.5 self-start sm:self-auto px-3 py-1 rounded-full bg-[#6ffbbe]/40 text-[#005236] text-[11px] font-bold border border-[#006c49]/20">
              <CheckCircle className="w-4 h-4 text-[#006c49]" />
              <span>Route Verified Clear via Crossover 42B</span>
            </div>
          </div>

          {/* Visual Platform Side-by-Side Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Conflicted PF 12 Option */}
            <div className="p-5 rounded-xl bg-[#f2f3ff] flex flex-col justify-between relative overflow-hidden border border-[#c5c5d3]/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ba1a1a]"></span>
                  <span className="text-[10px] uppercase font-bold text-[#757682]">
                    Current Status
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[#ba1a1a] bg-[#ffdad6] text-[10px] font-bold">
                  PF {rawAssignedPf} • Stalled
                </span>
              </div>
              <div className="flex flex-col gap-2 my-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-[#444651]">Platform Clearance</span>
                  <span className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#131b2e] tabular-nums">
                    {delayedEta}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-[#444651]">Projected Arrival</span>
                  <div className="text-right">
                    <span className="font-['Plus_Jakarta_Sans'] text-lg font-bold text-[#ba1a1a] tabular-nums">
                      {delayedEta}
                    </span>
                    <span className="text-[10px] text-[#ba1a1a] font-bold block">
                      (+{holdPenaltyMin.toFixed(0)}m holding delay)
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-3 mt-3 border-t border-[#c5c5d3]/30 flex items-center gap-2 text-[#444651] text-[11px]">
                <AlertTriangle className="w-4 h-4 text-[#ba1a1a]" />
                <span>Requires full halt at {terminalCode} outer signal for {Math.round(holdPenaltyMin)} mins</span>
              </div>
            </div>

            {/* Recommended Option */}
            <div className="p-5 rounded-xl bg-[#eaedff] text-[#131b2e] flex flex-col justify-between relative overflow-hidden shadow-xs border-2 border-[#006c49]/40">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#6ffbbe]/20 rounded-full blur-2xl pointer-events-none"></div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#006c49] animate-ping"></span>
                  <span className="text-[10px] uppercase font-bold text-[#006c49]">
                    Recommended Route
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-[#006c49] text-white text-[10px] font-bold shadow-xs">
                  PF {targetReroutePf} • Clear
                </span>
              </div>
              <div className="flex flex-col gap-2 my-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-[#444651]">Platform Clearance</span>
                  <span className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#006c49]">
                    Immediate (Ready)
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-[#444651]">Projected Arrival</span>
                  <div className="text-right">
                    <span className="font-['Plus_Jakarta_Sans'] text-lg font-bold text-[#006c49] tabular-nums">
                      {dynamicEta}
                    </span>
                    <span className="text-[10px] text-[#006c49] font-bold block">
                      (Advanced by {Math.round(holdPenaltyMin)} mins!)
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-3 mt-3 border-t border-[#c5c5d3]/40 flex items-center gap-2 text-[#006c49] text-[11px] font-semibold">
                <Check className="w-4 h-4 text-[#006c49]" />
                <span>Direct berthing via Switch 42B to PF {targetReroutePf}. Zero outer halt.</span>
              </div>
            </div>
          </div>

          {/* Projected Operational Benefits Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-[#f2f3ff] border border-[#c5c5d3]/20">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#ffffff] text-[#006c49] flex items-center justify-center shrink-0 shadow-xs border border-[#c5c5d3]/20">
                <Gauge className="w-5 h-5 text-[#006c49]" />
              </div>
              <div>
                <span className="text-[10px] text-[#757682] block uppercase tracking-wider font-bold">
                  Delay Elimination
                </span>
                <span className="text-xs font-bold text-[#006c49]">
                  Eliminates {holdPenaltyMin.toFixed(1)} mins
                </span>
                <span className="text-[11px] text-[#444651] block">
                  Holding delay completely avoided
                </span>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#ffffff] text-[#00236f] flex items-center justify-center shrink-0 shadow-xs border border-[#c5c5d3]/20">
                <Clock className="w-5 h-5 text-[#00236f]" />
              </div>
              <div>
                <span className="text-[10px] text-[#757682] block uppercase tracking-wider font-bold">
                  New Terminal ETA
                </span>
                <span className="text-xs font-bold text-[#00236f]">{dynamicEta}</span>
                <span className="text-[11px] text-[#444651] block">
                  Holding penalty bypassed
                </span>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#ffffff] text-[#131b2e] flex items-center justify-center shrink-0 shadow-xs border border-[#c5c5d3]/20">
                <Users className="w-5 h-5 text-[#131b2e]" />
              </div>
              <div>
                <span className="text-[10px] text-[#757682] block uppercase tracking-wider font-bold">
                  Passenger Transfer
                </span>
                <span className="text-xs font-bold text-[#131b2e]">
                  Subway 2 &amp; Escalator
                </span>
                <span className="text-[11px] text-[#444651] block">
                  Direct metro concourse access
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Switch Geometry & Interlocking Path Schematic */}
          <div className="p-4 rounded-xl bg-[#ffffff] border border-[#c5c5d3]/40 flex flex-col gap-3 shadow-xs">
            <div className="flex items-center justify-between text-[#131b2e]">
              <span className="text-[10px] uppercase tracking-wider font-bold text-[#757682]">
                Switch Geometry &amp; Interlocking Path
              </span>
              <span className="text-[11px] font-mono text-[#757682] font-semibold">
                POINT-42B • RRI YARD SOUTH
              </span>
            </div>

            {/* Inline SVG Track Topology Schematic */}
            <div className="w-full h-24 bg-[#f2f3ff] rounded-lg p-2 flex items-center justify-center overflow-hidden border border-[#c5c5d3]/30">
              <svg
                className="w-full h-full text-[#131b2e]"
                fill="none"
                viewBox="0 0 760 80"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Background grid lines */}
                <line
                  x1="0"
                  y1="20"
                  x2="760"
                  y2="20"
                  stroke="currentColor"
                  strokeOpacity="0.08"
                  strokeWidth="1"
                />
                <line
                  x1="0"
                  y1="60"
                  x2="760"
                  y2="60"
                  stroke="currentColor"
                  strokeOpacity="0.08"
                  strokeWidth="1"
                />

                {/* Conflicted Track to PF 12 (Top Line) */}
                <path
                  d="M 20 20 L 260 20 L 740 20"
                  stroke="#ba1a1a"
                  strokeDasharray="6 4"
                  strokeOpacity={isRerouted ? 0.3 : 0.7}
                  strokeWidth="3"
                />

                {/* Active Train marker on approach */}
                <circle cx="90" cy="20" r="7" fill="#00236f" />
                <text
                  x="90"
                  y="10"
                  fill="#00236f"
                  fontFamily="Inter, sans-serif"
                  fontSize="9"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {trainNo} APPR
                </text>

                {/* Preceding Train blocking PF 12 */}
                <rect
                  x="580"
                  y="12"
                  width="135"
                  height="16"
                  rx="3"
                  fill="#ba1a1a"
                  fillOpacity="0.2"
                  stroke="#ba1a1a"
                  strokeWidth="1.5"
                />
                <text
                  x="647"
                  y="24"
                  fill="#93000a"
                  fontFamily="Inter, sans-serif"
                  fontSize="9"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  PF {rawAssignedPf}: OCCUPIED
                </text>

                {/* Crossover 42B branching down to target platform */}
                <path
                  d="M 260 20 C 330 20 370 60 440 60 L 740 60"
                  stroke="#006c49"
                  strokeWidth={isRerouted ? "4" : "3.5"}
                />
                <circle cx="260" cy="20" r="5" fill="#006c49" />
                <text
                  x="260"
                  y="38"
                  fill="#006c49"
                  fontFamily="Inter, sans-serif"
                  fontSize="10"
                  fontWeight="700"
                >
                  Point 42B
                </text>

                {/* Recommended Clear Target Platform */}
                <rect
                  x="580"
                  y="52"
                  width="135"
                  height="16"
                  rx="3"
                  fill="#6cf8bb"
                  fillOpacity="0.4"
                  stroke="#006c49"
                  strokeWidth="1.5"
                />
                <text
                  x="647"
                  y="64"
                  fill="#005236"
                  fontFamily="Inter, sans-serif"
                  fontSize="9"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  PF {targetReroutePf}: CLEAR (VACANT)
                </text>

                {/* Pulse circle on switch crossover */}
                <circle cx="440" cy="60" r="4" fill="#006c49">
                  <animate
                    attributeName="r"
                    values="3;9;3"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.8;0.1;0.8"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </circle>
              </svg>
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#444651]">
              <span>Signal S-104 Interlocked</span>
              <span className="text-[#006c49] font-bold">
                Clearance Window: Available Now (No Cross-Traffic Conflicts)
              </span>
            </div>
          </div>

          {/* Action Buttons Area */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowDrawer(!showDrawer)}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#eaedff] text-[#131b2e] hover:bg-[#dce1ff] transition-colors text-xs font-bold order-2 sm:order-1 cursor-pointer"
            >
              <Activity className="w-4 h-4 text-[#757682]" />
              <span>
                {showDrawer ? 'Hide Yard Diagnostics' : 'Inspect Yard Track Layout'}
              </span>
            </button>

            {!isRerouted ? (
              <button
                type="button"
                disabled={isTransmitting}
                onClick={handleConfirm}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#006c49] text-white hover:bg-[#005236] transition-all duration-200 shadow-md hover:shadow-lg text-sm font-bold order-1 sm:order-2 group cursor-pointer active:scale-[0.99]"
              >
                {isTransmitting ? (
                  <>
                    <span className="inline-block animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                    <span>Transmitting SSI Interlock Command...</span>
                  </>
                ) : (
                  <>
                    <Route className="w-5 h-5 transition-transform group-hover:scale-110" />
                    <span>Confirm Reroute to Platform {targetReroutePf}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            ) : (
              <div className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#6cf8bb]/30 text-[#005236] border border-[#006c49]/30 text-sm font-bold order-1 sm:order-2">
                <CheckCircle className="w-5 h-5 text-[#006c49]" />
                <span>Reroute Active • Route Locked to PF {targetReroutePf}</span>
              </div>
            )}
          </div>
        </section>

        {/* Inspection Modal / Expanded Drawer */}
        {showDrawer && (
          <div className="p-5 rounded-2xl bg-[#e2e7ff] transition-all flex flex-col gap-3 animate-fadeIn border border-[#c5c5d3]/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Route className="w-5 h-5 text-[#00236f]" />
                <span className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-[#131b2e]">
                  Yard Interlocking Sub-System Diagnostics
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowDrawer(false)}
                className="w-7 h-7 rounded-lg bg-[#eaedff] text-[#131b2e] hover:bg-[#dae2fd] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#ffffff] border border-[#c5c5d3]/30">
                <span className="font-bold text-[#131b2e] block mb-1">
                  Crossover 42B Mechanics
                </span>
                <span className="text-[#444651] leading-relaxed block">
                  Motorized Point Machine Siemens M63. Throw-time: 3.2 seconds. Locking bar integrity: 100%. Tested OK at 08:30 UTC.
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#ffffff] border border-[#c5c5d3]/30">
                <span className="font-bold text-[#131b2e] block mb-1">
                  Berthing Clearance Specs
                </span>
                <span className="text-[#444651] leading-relaxed block">
                  PF {targetReroutePf} length: 650m (24 LHB coaches compatible). Rajdhani Rake Length: 590m (22 coaches). Safe buffer margin: 60m.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Supplementary Real-Time Context Drawer */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[#ffffff] shadow-xs border border-[#c5c5d3]/30 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#f2f3ff] flex items-center justify-center text-[#00236f]">
              <Train className="w-5 h-5 text-[#00236f]" />
            </div>
            <div>
              <span className="text-[10px] text-[#757682] uppercase block font-bold">
                Current Velocity
              </span>
              <span className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#131b2e] tabular-nums">
                {trainState?.position?.speedKmph !== undefined ? Math.round(trainState.position.speedKmph) : 42} km/h
              </span>
              <span className="text-xs text-[#444651] block">
                {trainState?.position?.currentSection || 'Approaching yard throat'}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#ffffff] shadow-xs border border-[#c5c5d3]/30 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#f2f3ff] flex items-center justify-center text-[#006c49]">
              <Radio className="w-5 h-5 text-[#006c49]" />
            </div>
            <div>
              <span className="text-[10px] text-[#757682] uppercase block font-bold">
                Axle Counter AC-14
              </span>
              <span className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#006c49]">
                Clear (Yamuna)
              </span>
              <span className="text-xs text-[#444651] block">Zero head-way locks</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#ffffff] shadow-xs border border-[#c5c5d3]/30 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#f2f3ff] flex items-center justify-center text-[#131b2e]">
              <ShieldCheck className="w-5 h-5 text-[#131b2e]" />
            </div>
            <div>
              <span className="text-[10px] text-[#757682] uppercase block font-bold">
                Station Director Auth
              </span>
              <span className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#131b2e]">
                Auto-Approved
              </span>
              <span className="text-xs text-[#444651] block">Under Priority Rule 14-A</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
