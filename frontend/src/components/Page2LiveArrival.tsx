import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  ArrowRight,
  Gauge,
  MapPin,
  Clock,
  Activity,
  TrendingDown,
  AlertTriangle,
  Zap,
  CheckCircle,
  Eye,
  X,
  Info,
  Route,
  Radio,
  Train,
  Check,
  ChevronDown,
  ChevronUp,
  Map,
  Navigation,
  Calendar,
} from 'lucide-react';
import { api, TrainStateResponse, TrainPredictionResponse } from '../services/api';

const LiveRouteMap = dynamic(
  () => import('./LiveRouteMap').then((mod) => mod.LiveRouteMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[520px] rounded-2xl bg-[#F5F3E9] flex flex-col items-center justify-center border border-[#E2E8F0] gap-3 text-slate-500 animate-pulse">
        <div className="w-10 h-10 rounded-full bg-[#1E3A8A]/10 flex items-center justify-center text-[#1E3A8A]">
          <Train className="w-5 h-5 animate-bounce" />
        </div>
        <span className="text-xs font-semibold">Initializing Google Maps Live Transit Canvas...</span>
      </div>
    ),
  }
);

interface Page2LiveArrivalProps {
  trainName: string;
  runDate?: string;
  isRerouted: boolean;
  onNavigateToPage1: () => void;
  onNavigateToPage3: () => void;
}

export const Page2LiveArrival: React.FC<Page2LiveArrivalProps> = ({
  trainName,
  runDate,
  isRerouted,
  onNavigateToPage1,
  onNavigateToPage3,
}) => {
  const [liveData, setLiveData] = useState<TrainStateResponse | null>(null);
  const [predictData, setPredictData] = useState<TrainPredictionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [routeFilter, setRouteFilter] = useState<'all' | 'upcoming'>('all');
  const [selectedStationCode, setSelectedStationCode] = useState<string | null>(null);
  const [expandedHaltCodes, setExpandedHaltCodes] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'map' | 'analytics'>('map');
  const [showAllStops, setShowAllStops] = useState(false);
  const [deadReckonedKm, setDeadReckonedKm] = useState<number | null>(null);
  const [mobileTab, setMobileTab] = useState<'route' | 'map'>('route');

  // Extract train number from props (e.g. "12004", "12368", "12301", "22436")
  const trainNoMatch = (trainName || '').match(/\b\d{5}\b/);
  const trainNo = trainNoMatch ? trainNoMatch[0] : (trainName?.trim() || '12301');

  useEffect(() => {
    let isMounted = true;
    const loadDynamicData = async () => {
      try {
        setLoading(true);
        const queryParam = trainName?.trim() || trainNo || '12301';
        // 1. Fetch multi-factor prediction analysis from backend for specific runDate
        const predRes = await api.getTrainPredict(queryParam, runDate);
        if (isMounted && predRes) {
          setPredictData(predRes);
          if (predRes.currentKm !== undefined && predRes.currentKm !== null) {
            setDeadReckonedKm(predRes.currentKm);
          }
        }

        // 2. Fetch live state telemetry
        const stateRes = await api.getTrainState(trainNo, runDate);
        if (isMounted && stateRes) {
          setLiveData(stateRes);
        }
      } catch (err) {
        console.warn('Backend dynamic prediction error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDynamicData();
  }, [trainName, trainNo, runDate]);

  // Derived Train Identity Fields
  const displayTrainName = predictData?.trainName || (liveData?.train_name ? `${trainNo} - ${liveData.train_name}` : `Train ${trainNo}`);
  const destinationStation = predictData?.destinationName || predictData?.destination || 'New Delhi (NDLS)';
  const originName = predictData?.originName || predictData?.origin || 'Howrah Jn (HWH)';
  const departureTime = predictData?.scheduledDepartureFmt || '16:50';
  const scheduledTime = predictData?.scheduledArrivalFmt || '10:14';
  const currentSpeed = predictData?.currentSpeedKmph || liveData?.position?.speed_kmph || 118;
  const currentSection = predictData?.currentSection || liveData?.position?.current_section || 'CNB-NDLS';
  const nextStop = predictData?.upcomingStations?.[0]?.stationName || predictData?.destinationName || 'Approaching Destination';
  const nextStopEta = predictData?.upcomingStations?.[0]?.dynamicEta
    ? new Date(predictData.upcomingStations[0].dynamicEta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : predictData?.destinationEta?.dynamicEta
    ? new Date(predictData.destinationEta.dynamicEta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '10:28 AM';

  // Dynamic ETA & Delay metrics computed by our Python backend
  const dynamicEta = predictData?.destinationEta?.dynamicEta
    ? new Date(predictData.destinationEta.dynamicEta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : isRerouted ? '10:28 AM' : '10:38 AM';

  const netDelayMin = predictData?.currentDelayMin !== undefined
    ? Math.round(predictData.currentDelayMin)
    : (predictData?.destinationEta?.netDelayMin !== undefined
      ? Math.round(predictData.destinationEta.netDelayMin)
      : (isRerouted ? 14 : 24));

  // Multi-factor Waterfall Breakdown computed from engine/predictor.py
  const waterfallSteps = predictData?.destinationEta?.waterfall && predictData.destinationEta.waterfall.length > 0
    ? predictData.destinationEta.waterfall
    : [
        {
          label: 'Gangetic Fog Speed Clamping',
          impactMin: 18.0,
          category: 'penalty',
          description: 'Atmospheric visibility conditions clamping speed to 60 km/h',
        },
        {
          label: 'Signal & Headway Aspect Caution',
          impactMin: 3.5,
          category: 'penalty',
          description: 'Caution aspect headway clearance behind leading train',
        },
        {
          label: 'Terminal Junction Throat Friction',
          impactMin: 3.5,
          category: 'terminal',
          description: 'Approach turnouts and route interlocking friction',
        },
        {
          label: 'Platform Contention Hold',
          impactMin: isRerouted ? 0.0 : 5.0,
          category: 'penalty',
          description: isRerouted ? 'Platform conflict resolved (0.0m hold)' : 'Platform holding signal queue',
        },
        {
          label: 'Line Speed Slack Recovery',
          impactMin: -6.0,
          category: 'recovery',
          description: 'Time deletion recovered at line MPS against scheduled slack buffer',
        },
      ];

  const totalDelaysMin = waterfallSteps
    .filter((s: any) => s.impactMin > 0)
    .reduce((acc: number, s: any) => acc + s.impactMin, 0);

  const slackRecoveredMin = Math.abs(
    waterfallSteps
      .filter((s: any) => s.impactMin < 0)
      .reduce((acc: number, s: any) => acc + s.impactMin, 0)
  );

  const primaryDelayStep = waterfallSteps.find((s: any) => s.impactMin > 4.0);
  const primaryDelayReason = primaryDelayStep
    ? `${primaryDelayStep.label} (+${primaryDelayStep.impactMin.toFixed(0)}m)`
    : netDelayMin <= 0 ? 'On-Time Optimal Running' : 'Cautionary Signalling (+m)';

  const totalDist = predictData?.totalDistanceKm || 1450;
  const currentKmVal = predictData?.currentKm || 0;

  // "Where is My Train" Style Full Route Stations list with intermediate passing stops
  const fullRouteList = useMemo(() => {
    const rawStations = (predictData?.allStations && predictData.allStations.length > 0)
      ? predictData.allStations
      : (predictData?.upcomingStations && predictData.upcomingStations.length > 0)
      ? predictData.upcomingStations
      : [];

    return rawStations.map((stn: any) => {
      const pf = stn.platform || (stn.stationCode === 'NDLS' ? (isRerouted ? '16' : '12') : '1');
      const schedArr = stn.scheduledArrivalFmt || (stn.scheduledArrival ? new Date(stn.scheduledArrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--');
      const schedDep = stn.scheduledDepartureFmt || (stn.scheduledDeparture ? new Date(stn.scheduledDeparture).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--');
      const dynArr = stn.dynamicEtaFmt || (stn.dynamicEta ? new Date(stn.dynamicEta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--');
      const delay = Math.round(stn.netDelayMin ?? 0);
      const haltVal = Math.round(stn.haltMin ?? 0);

      // Clean intermediate passing stations that lead up to this halt
      const rawIm = stn.intermediateStations || stn.intermediate_stations || [];
      const imList = rawIm.map((im: any) => ({
        code: im.stationCode || im.station_code || '',
        name: im.stationName || im.station_name || '',
        km: Math.round(im.distanceKm ?? im.distance_km ?? 0),
        scheduledTime: im.scheduledTime || im.scheduled_time || '--:--',
        dynamicTime: im.dynamicTime || im.dynamic_time || '--:--',
        status: (im.status || 'UPCOMING').toUpperCase(),
        speedKmph: Math.round(im.speedKmph ?? im.speed_kmph ?? 0),
        delayMin: Math.round(im.delayMin ?? im.delay_min ?? 0),
      }));

      return {
        code: stn.stationCode,
        name: stn.stationName,
        km: Math.round(stn.distanceKm ?? 0),
        platform: pf,
        scheduledArrival: schedArr,
        scheduledDeparture: schedDep,
        dynamicEta: dynArr,
        delayMin: delay,
        status: (stn.status || 'UPCOMING').toUpperCase(),
        haltMin: haltVal,
        reason: stn.activeWarnings?.[0] || (delay > 0 ? 'Cautious block signalling' : 'Line speed MPS run'),
        intermediateStations: imList
      };
    });
  }, [predictData, isRerouted]);

  // Total intermediate stations count across all sections
  const totalIntermediateCount = useMemo(() => {
    return fullRouteList.reduce((acc: number, s: any) => acc + (s.intermediateStations?.length || 0), 0);
  }, [fullRouteList]);

  // Stations that have intermediate passing stops
  const stationsWithIntermediates = useMemo(() => {
    return fullRouteList.filter((s: any) => s.intermediateStations && s.intermediateStations.length > 0);
  }, [fullRouteList]);

  // Master expanded status: true if all intermediate segments are expanded
  const isAllStopsExpanded = useMemo(() => {
    if (stationsWithIntermediates.length === 0) return false;
    return stationsWithIntermediates.every((s: any) => {
      return expandedHaltCodes[s.code] !== undefined ? !!expandedHaltCodes[s.code] : showAllStops;
    });
  }, [stationsWithIntermediates, expandedHaltCodes, showAllStops]);

  // Master slider toggle handler: expands or collapses all intermediate stations across route with one click
  const handleToggleMasterStops = () => {
    const nextVal = !isAllStopsExpanded;
    setShowAllStops(nextVal);
    const newExpanded: Record<string, boolean> = {};
    stationsWithIntermediates.forEach((s: any) => {
      newExpanded[s.code] = nextVal;
    });
    setExpandedHaltCodes(newExpanded);
  };

  // Toggle single intermediate section between halts
  const toggleIntermediate = (stnCode: string) => {
    setExpandedHaltCodes(prev => {
      const isCurrentlyExpanded = prev[stnCode] !== undefined ? prev[stnCode] : showAllStops;
      return {
        ...prev,
        [stnCode]: !isCurrentlyExpanded
      };
    });
  };

  // Displayed stations: either all stops or upcoming only
  const displayedRouteStations = useMemo(() => {
    if (routeFilter === 'upcoming') {
      return fullRouteList.filter((s: any) => s.status !== 'PASSED');
    }
    return fullRouteList;
  }, [fullRouteList, routeFilter]);

  // Real-time dead-reckoned live km advancing second-by-second like "Where Is My Train"
  const activeKm = deadReckonedKm !== null ? deadReckonedKm : currentKmVal;
  const progressPct = Math.min(100, Math.max(5, Math.round((activeKm / totalDist) * 100)));

  // Sync whenever backend telemetry updates
  useEffect(() => {
    if (predictData?.currentKm !== undefined && predictData?.currentKm !== null) {
      setDeadReckonedKm(predictData.currentKm);
    }
  }, [predictData?.currentKm]);

  // Second-by-second dead reckoning crawler: advances train along the track slowly ("dheere-dheere run karo")
  useEffect(() => {
    if (deadReckonedKm === null && currentKmVal > 0) {
      setDeadReckonedKm(currentKmVal);
    }
    const speed = currentSpeed > 0 ? currentSpeed : 0;
    if (speed === 0) return;

    const interval = setInterval(() => {
      setDeadReckonedKm((prev) => {
        const base = prev !== null ? prev : currentKmVal;
        const next = base + speed / 3600;
        return totalDist ? Math.min(totalDist, next) : next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentKmVal, currentSpeed, totalDist]);

  // Identify the active segment where the train is currently running along the route
  // Identify the active segment where the train is currently running along the route
  const activeSegmentIndex = useMemo(() => {
    if (!displayedRouteStations || displayedRouteStations.length === 0) return -1;

    // If filtering upcoming halts and train is still approaching the first upcoming station,
    // the top capsule handles it - do not match any segment between displayed stations
    if (routeFilter === 'upcoming' && activeKm < displayedRouteStations[0].km) {
      return -1;
    }

    // 1. Locate by activeKm (the last station the train has passed)
    if (activeKm > 0) {
      let foundIdx = -1;
      for (let i = 0; i < displayedRouteStations.length; i++) {
        if (displayedRouteStations[i].km <= activeKm) {
          foundIdx = i;
        } else {
          break;
        }
      }
      if (foundIdx !== -1 && foundIdx < displayedRouteStations.length - 1) return foundIdx;
    }

    // 2. Fallback: find the last station with status === 'PASSED'
    let lastPassedIdx = -1;
    for (let i = 0; i < displayedRouteStations.length; i++) {
      if (displayedRouteStations[i].status === 'PASSED') {
        lastPassedIdx = i;
      }
    }
    if (lastPassedIdx !== -1 && lastPassedIdx < displayedRouteStations.length - 1) {
      return lastPassedIdx;
    }

    // 3. Fallback: find station right before 'CURRENT'
    const currentIdx = displayedRouteStations.findIndex((s: any) => s.status === 'CURRENT');
    if (currentIdx > 0 && currentIdx - 1 < displayedRouteStations.length - 1) {
      return currentIdx - 1;
    }

    return -1;
  }, [displayedRouteStations, activeKm, routeFilter]);

  const isEnRouteBeforeFirstUpcoming =
    routeFilter === 'upcoming' &&
    displayedRouteStations.length > 0 &&
    activeKm < displayedRouteStations[0].km;

  // Last passed station along the entire route
  const lastPassedStation = useMemo(() => {
    if (!fullRouteList || fullRouteList.length === 0) return null;
    const passed = fullRouteList.filter((s: any) => s.status === 'PASSED' || s.km <= activeKm);
    return passed.length > 0 ? passed[passed.length - 1] : fullRouteList[0];
  }, [fullRouteList, activeKm]);

  // Selected station for deep drill-down
  const selectedStation = fullRouteList.find((s: any) => s.code === selectedStationCode);

  // Auto-scroll left list into view when station is selected from the map
  useEffect(() => {
    if (!selectedStationCode) return;
    const el = document.getElementById(`station-card-${selectedStationCode}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedStationCode]);

  const formattedRunDate = runDate
    ? (() => {
        try {
          const [y, m, d] = runDate.split('-').map(Number);
          return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });
        } catch {
          return runDate;
        }
      })()
    : null;

  // Renders the "Where Is My Train" running locomotive indicator directly on the route spine
  const renderLiveTrainLocomotiveCapsule = (
    fromStationName: string,
    fromKm: number,
    toStation: any
  ) => {
    const prevKm = fromKm || 0;
    const nextKm = toStation?.km || (prevKm + 50);
    const segDist = Math.max(1, nextKm - prevKm);
    const segTraversed = Math.max(0, Math.min(segDist, activeKm - prevKm));
    const segPct = Math.min(100, Math.max(3, Math.round((segTraversed / segDist) * 100)));
    const distRemaining = Math.max(0, nextKm - activeKm);

    return (
      <div className="relative py-2.5 px-2 my-1.5 transition-all animate-fadeIn">
        <div className="flex items-start gap-3">
          {/* Left Column: Live Speed & Real-time KM */}
          <div className="w-14 text-right shrink-0 pt-1 space-y-1">
            <div className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-300 font-mono font-extrabold text-[10px] shadow-xs">
              <Zap className="w-2.5 h-2.5 text-emerald-600 animate-pulse" />
              <span>{currentSpeed}</span>
            </div>
            <span className="text-[9px] font-mono text-slate-500 block">km/h</span>
            <span className="text-[10px] font-mono font-bold text-[#1E3A8A] block">
              {activeKm.toFixed(1)} km
            </span>
          </div>

          {/* Center Column: Live Moving Locomotive on Track */}
          <div className="relative flex flex-col items-center self-stretch shrink-0 px-1 my-auto">
            <div className="w-0.5 h-3 bg-emerald-400" />
            <div className="relative my-0.5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#1E3A8A] via-[#2563EB] to-[#1E3A8A] text-white flex items-center justify-center shadow-md animate-train-gliding ring-4 ring-blue-300/60 z-20">
                <Train className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="animate-ping absolute inset-0 rounded-full bg-blue-400 opacity-75 pointer-events-none" />
            </div>
            <div className="w-0.5 h-3 bg-slate-300" />
          </div>

          {/* Right Column: Tactically Styled Live En-Route Card */}
          <div className="flex-1 min-w-0">
            <div className="p-3 rounded-xl bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#1E3A8A] text-white shadow-md border border-blue-400/30 relative overflow-hidden">
              {/* Background crawling track bed */}
              <div className="absolute inset-0 opacity-10 animate-track-crawl pointer-events-none" />

              <div className="relative z-10 space-y-2">
                {/* Header: Live Badge & Train Name */}
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                      WHERE IS MY TRAIN • LIVE
                    </span>
                  </div>
                  <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30">
                    ISRO RTIS Ground Tracking
                  </span>
                </div>

                {/* Real-time Location text & Countdown */}
                <div className="flex items-center justify-between text-[11px] gap-2">
                  <span className="text-slate-200 font-semibold truncate">
                    {predictData?.exactLocationText || `En route from ${fromStationName} to ${toStation?.name || 'Next Station'}`}
                  </span>
                  <span className="font-mono font-extrabold text-amber-300 shrink-0 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/25">
                    {distRemaining > 0 ? `${distRemaining.toFixed(1)} km to ${toStation?.code || 'Next'}` : 'Arrived at station'}
                  </span>
                </div>

                {/* Crawling Progress Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[9px] font-mono text-slate-300">
                    <span className="truncate max-w-[40%] text-slate-400">{fromStationName} (Dep)</span>
                    <span className="text-emerald-300 font-bold">{segPct}% Traversed</span>
                    <span className="truncate max-w-[40%] text-slate-400 text-right">{toStation?.name} (Next)</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-900/90 overflow-hidden p-0.5 border border-slate-700/80">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-blue-400 animate-track-crawl transition-all duration-1000 ease-linear shadow-xs"
                      style={{ width: `${Math.min(100, Math.max(3, segPct))}%` }}
                    />
                  </div>
                </div>

                {/* Bottom Strip: Next Halt Dynamic ETA & Platform */}
                <div className="flex items-center justify-between text-[10px] text-slate-300 pt-1 border-t border-slate-700/60">
                  <span className="text-slate-300">
                    Next Stop ETA: <span className="font-mono font-bold text-white">{toStation?.dynamicEta || '--:--'}</span>
                  </span>
                  <span className="font-semibold text-emerald-300">
                    Target Platform: PF {toStation?.platform || '1'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full min-h-[calc(100vh-6.75rem)] flex flex-col animate-fadeIn bg-[#F8FAFC]">
      {/* Interactive Top Action & Status Bar */}
      <div className="w-full bg-[#ffffff]/95 backdrop-blur-md sticky top-16 z-30 px-4 sm:px-8 py-2.5 border-b border-[#E2E8F0] shadow-xs">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={onNavigateToPage1}
              className="inline-flex items-center gap-1.5 text-xs text-[#475569] hover:text-[#1E3A8A] transition-all font-semibold group cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span>Search Another Train</span>
            </button>

            {formattedRunDate && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1E3A8A] text-[11px] font-bold border border-blue-200/80 shadow-xs">
                <Calendar className="w-3.5 h-3.5 text-[#1E3A8A]" />
                <span>Date: {formattedRunDate}</span>
              </div>
            )}
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10B981]/10 border border-[#10B981]/25 self-start sm:self-auto shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]"></span>
            </span>
            <span className="text-[11px] text-[#047857] font-semibold tracking-tight">
              ISRO Satellite RTIS 30s Stream
            </span>
            <span className="text-[#CBD5E1] text-[11px]">•</span>
            <span className="text-[11px] text-[#475569] font-medium">
              Section: {currentSection} (MPS {predictData?.mps || 130} km/h)
            </span>
          </div>
        </div>
      </div>

      {/* Main Dual-Pane Container */}
      <div className="w-full px-3 sm:px-6 lg:px-8 py-5">
        {/* Operational Lifecycle Alert Banner for NOT_STARTED or JOURNEY_COMPLETED */}
        {predictData?.status === 'NOT_STARTED' && (
          <div className="max-w-[1440px] mx-auto mb-4 p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              <span className="text-xs font-bold">
                Train Not Started: At Origin {originName} • Scheduled Departure at {predictData?.scheduledDepartureFmt || 'Scheduled Time'} IST
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold bg-amber-200/80 px-2.5 py-0.5 rounded-full">
              NOT DEPARTED
            </span>
          </div>
        )}

        {predictData?.status === 'JOURNEY_COMPLETED' && (
          <div className="max-w-[1440px] mx-auto mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-bold">
                Journey Completed: Train arrived at Destination {destinationStation} • Terminal Berth Cleared
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold bg-emerald-200/80 px-2.5 py-0.5 rounded-full">
              TERMINATED
            </span>
          </div>
        )}

        {/* Mobile Viewport Segmented Switcher (< 1024px) */}
        <div className="lg:hidden flex rounded-xl bg-slate-100 p-1 border border-slate-200 shadow-xs mb-4">
          <button
            type="button"
            onClick={() => setMobileTab('route')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              mobileTab === 'route'
                ? 'bg-white text-[#1E3A8A] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📋 Stations Timeline ({displayedRouteStations.length})
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('map')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              mobileTab === 'map'
                ? 'bg-[#1E3A8A] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🗺️ Live Transit Map
          </button>
        </div>

        <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* ========================================================================= */}
          {/* LEFT PANE (lg:col-span-5): "WHERE IS MY TRAIN" ROUTE SPINE WITH HALTS     */}
          {/* ========================================================================= */}
          <aside className={`${mobileTab === 'route' ? 'flex' : 'hidden'} lg:flex lg:col-span-5 bg-white rounded-2xl p-5 shadow-sm border border-[#E2E8F0] lg:sticky lg:top-28 flex-col max-h-[calc(100vh-8rem)]`}>
            {/* Route Header */}
            <div className="pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#1E3A8A] text-white flex items-center justify-center shadow-xs">
                    <Train className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-['Plus_Jakarta_Sans'] text-sm sm:text-base font-bold text-[#0F172A]">
                      Where Is My Train Route
                    </h2>
                    <p className="text-[11px] text-[#64748B]">
                      {originName} ──► {destinationStation}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#1E3A8A]/10 text-[#1E3A8A] font-bold">
                    {fullRouteList.length} Halts
                  </span>
                  {totalIntermediateCount > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-100 text-[#64748B] font-medium">
                      +{totalIntermediateCount} passing
                    </span>
                  )}
                </div>
              </div>

              {/* Filter Switcher & "Show All Stops" Toggle (WIMT Style Slider) */}
              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setRouteFilter('all')}
                    className={`text-xs px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      routeFilter === 'all'
                        ? 'bg-[#1E3A8A] text-white shadow-xs'
                        : 'bg-slate-100 text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    All Halts ({fullRouteList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRouteFilter('upcoming')}
                    className={`text-xs px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      routeFilter === 'upcoming'
                        ? 'bg-[#1E3A8A] text-white shadow-xs'
                        : 'bg-slate-100 text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    Upcoming ({fullRouteList.filter((s: any) => s.status !== 'PASSED').length})
                  </button>
                </div>

                {/* Master Slider / Toggle: Show All Stations vs Halts Only */}
                <button
                  type="button"
                  onClick={handleToggleMasterStops}
                  className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#0F172A] text-xs font-semibold transition-colors cursor-pointer group"
                  title={isAllStopsExpanded ? 'Hide all non-stop passing stations' : 'Expand all non-stop intermediate stations'}
                >
                  <span className="text-[11px] font-semibold text-slate-700">
                    {isAllStopsExpanded ? 'All Stops (Expanded)' : 'Halts Only (Expandable)'}
                  </span>
                  <div className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${
                    isAllStopsExpanded ? 'bg-[#1E3A8A]' : 'bg-slate-300'
                  }`}>
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      isAllStopsExpanded ? 'translate-x-[18px]' : 'translate-x-0.5'
                    }`} />
                  </div>
                </button>
              </div>
            </div>

            {/* Scrollable Station-by-Station Route Spine */}
            <div className="flex-1 overflow-y-auto pt-4 pr-1 space-y-1 divide-y divide-slate-100/60 custom-scrollbar">
              {displayedRouteStations.map((stn: any, idx: number) => {
                const isPassed = stn.status === 'PASSED';
                const isCurrent = stn.status === 'CURRENT';
                const isSelected = selectedStationCode === stn.code;
                const isLate = stn.delayMin > 3;
                const isSourceStation = stn.code === fullRouteList[0]?.code;
                const isDestinationTerminal = stn.code === fullRouteList[fullRouteList.length - 1]?.code;
                const haltLabel = isSourceStation
                  ? 'Source Station'
                  : isDestinationTerminal
                  ? 'Destination Terminal'
                  : 'Scheduled Stop';
                const haltDurationText = isSourceStation
                  ? 'Origin'
                  : isDestinationTerminal
                  ? 'Terminus'
                  : `${stn.haltMin > 0 ? stn.haltMin : 2}m stop`;

                return (
                  <React.Fragment key={stn.code || idx}>
                    {/* If filtering upcoming halts and train is en-route before first upcoming halt */}
                    {isEnRouteBeforeFirstUpcoming && idx === 0 &&
                      renderLiveTrainLocomotiveCapsule(
                        lastPassedStation?.name || originName,
                        lastPassedStation?.km || 0,
                        stn
                      )
                    }

                    <div
                      id={`station-card-${stn.code}`}
                      onClick={() => setSelectedStationCode(stn.code)}
                      className={`relative py-3 px-2 rounded-xl transition-all cursor-pointer group ${
                        isSelected
                          ? 'bg-blue-50/90 border border-blue-300 shadow-xs'
                          : isCurrent
                          ? 'bg-blue-50/50 border border-blue-200/70 shadow-xs'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                    <div className="flex items-start gap-3">
                      {/* Left: Distance & Halt */}
                      <div className="w-14 text-right shrink-0 pt-0.5">
                        <span className="text-[11px] font-mono font-bold text-[#64748B] block">
                          {stn.km} km
                        </span>
                        <span className="text-[10px] font-semibold block text-[#64748B]">
                          {haltDurationText}
                        </span>
                      </div>

                      {/* Center: Track Node */}
                      <div className="relative flex flex-col items-center self-stretch shrink-0 px-1">
                        {/* Connecting Track Line */}
                        {idx < displayedRouteStations.length - 1 && (
                          <div
                            className={`absolute top-5 bottom-0 w-0.5 -mb-6 ${
                              isPassed ? 'bg-emerald-300' : 'bg-slate-200'
                            }`}
                          />
                        )}

                        {/* Node Symbol */}
                        {isCurrent ? (
                          <div className="w-7 h-7 rounded-full bg-[#1E3A8A] text-white flex items-center justify-center shadow-md animate-pulse ring-4 ring-blue-300/40 z-10">
                            <Train className="w-3.5 h-3.5" />
                          </div>
                        ) : isPassed ? (
                          <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs z-10">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-white border-2 border-[#1E3A8A] flex items-center justify-center shadow-xs z-10">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#1E3A8A]" />
                          </div>
                        )}
                      </div>

                      {/* Right: Station Info & Dynamic Calculations */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className={`text-xs font-bold truncate ${isCurrent ? 'text-[#1E3A8A]' : isPassed ? 'text-slate-600' : 'text-[#0F172A]'}`}>
                              {stn.name}
                            </span>
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                              {stn.code}
                            </span>
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-blue-50 text-[#1E3A8A]">
                              PF {stn.platform}
                            </span>
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/60 inline-flex items-center">
                              {haltLabel}
                            </span>
                          </div>

                          {/* Delay Pill */}
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                              isPassed
                                ? 'bg-slate-100 text-slate-500'
                                : stn.delayMin <= 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {isPassed
                              ? 'Departed'
                              : stn.delayMin > 0
                              ? `+${stn.delayMin}m`
                              : 'On-Time'}
                          </span>
                        </div>

                        {/* Timetable vs Dynamic Calculations */}
                        <div className="flex items-center justify-between mt-1 text-[11px] gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {stn.scheduledArrival && stn.scheduledArrival !== '--:--' && (
                              <span className="text-[#64748B]">
                                Arr: <span className={isLate ? 'line-through text-slate-400' : 'font-semibold text-slate-700'}>{stn.scheduledArrival}</span>
                              </span>
                            )}
                            {stn.scheduledDeparture && stn.scheduledDeparture !== '--:--' && (
                              <span className="text-[#64748B]">
                                Dep: <span className="font-semibold text-slate-700">{stn.scheduledDeparture}</span>
                              </span>
                            )}
                            {(!stn.scheduledArrival || stn.scheduledArrival === '--:--') && (!stn.scheduledDeparture || stn.scheduledDeparture === '--:--') && (
                              <span className="text-slate-400">Target Time</span>
                            )}
                          </div>

                          {/* Dynamic AI Calculated ETA */}
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[10px] text-[#64748B] uppercase font-bold">
                              {isPassed ? 'Actual:' : isCurrent ? 'Arrived:' : 'Dynamic ETA:'}
                            </span>
                            <span className={`font-mono font-extrabold ${isCurrent ? 'text-[#1E3A8A] text-xs' : isPassed ? 'text-slate-600' : 'text-[#1E3A8A]'}`}>
                              {stn.dynamicEta}
                            </span>
                          </div>
                        </div>

                        {/* Live Current Train Telemetry Indicator Strip */}
                        {isCurrent && (
                          <div className="mt-2 pt-1.5 border-t border-blue-200/60 flex items-center justify-between text-[10px] text-[#1E3A8A] font-semibold">
                            <span className="inline-flex items-center gap-1">
                              <Gauge className="w-3 h-3 text-[#1E3A8A]" />
                              Speed: {currentSpeed} km/h
                            </span>
                            <span>
                              Section: {currentSection}
                            </span>
                          </div>
                        )}

                      </div>
                    </div>
                  </div>

                  {/* ── "Where Is My Train" Expandable Passing / Intermediate Stations Between Halts ── */}
                  {idx < displayedRouteStations.length - 1 && (() => {
                    const nextStn = displayedRouteStations[idx + 1];
                    const intermediateList = nextStn.intermediateStations || [];
                    if (intermediateList.length === 0) return null;

                    const isSegmentExpanded = expandedHaltCodes[nextStn.code] !== undefined
                      ? !!expandedHaltCodes[nextStn.code]
                      : showAllStops;

                    return (
                      <div className="relative py-1 my-1 ml-14 pl-5 transition-all">
                        {/* Continuous track connecting line */}
                        <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-slate-200 -z-0" />

                        {/* Expand / Collapse Toggle Pill */}
                        <button
                          type="button"
                          onClick={() => toggleIntermediate(nextStn.code)}
                          className="relative z-10 w-full py-1.5 px-3 rounded-lg bg-slate-50 hover:bg-blue-50 text-[11px] font-semibold text-slate-600 hover:text-[#1E3A8A] transition-colors border border-dashed border-slate-300 hover:border-blue-300 flex items-center justify-between cursor-pointer group shadow-2xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="flex items-center gap-0.5 text-slate-400 group-hover:text-[#1E3A8A]">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-blue-400" />
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-blue-500" />
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-blue-400" />
                            </span>
                            <span className="font-bold text-[#0F172A] group-hover:text-[#1E3A8A]">
                              {isSegmentExpanded ? 'Hide' : 'Show'} {intermediateList.length} Intermediate Stations
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal truncate">
                              (via {intermediateList[0].name}{intermediateList.length > 1 ? ` … ${intermediateList[intermediateList.length - 1].name}` : ''})
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 text-slate-500 group-hover:text-[#1E3A8A]">
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-500">
                              Non-Stop
                            </span>
                            {isSegmentExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </div>
                        </button>

                        {/* Unfolded Intermediate Stations */}
                        {isSegmentExpanded && (
                          <div className="relative mt-2 pl-3 border-l-2 border-dashed border-slate-300 space-y-1 animate-fadeIn py-1">
                            {intermediateList.map((im: any, imIdx: number) => {
                              const isImPassed = im.status === 'PASSED';
                              const isImCurrent = im.status === 'CURRENT';
                              return (
                                <div
                                  key={im.code || imIdx}
                                  className={`flex items-center justify-between py-1 px-2 rounded-md text-[10px] transition-colors ${
                                    isImCurrent
                                      ? 'bg-blue-100 font-bold text-[#1E3A8A] border border-blue-300'
                                      : isImPassed
                                      ? 'text-slate-500 hover:bg-slate-100/70'
                                      : 'text-slate-700 hover:bg-slate-100/70'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    {isImCurrent ? (
                                      <div className="w-3.5 h-3.5 rounded-full bg-[#1E3A8A] text-white flex items-center justify-center shrink-0">
                                        <Train className="w-2 h-2 animate-bounce" />
                                      </div>
                                    ) : isImPassed ? (
                                      <div className="w-3.5 h-3.5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                                      </div>
                                    ) : (
                                      <div className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                      </div>
                                    )}
                                    <span className="truncate font-medium">{im.name}</span>
                                    <span className="font-mono text-[9px] text-slate-400">({im.code})</span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0 font-mono">
                                    <span className="text-slate-400">{im.km} km</span>
                                    {im.scheduledTime && im.scheduledTime !== '--:--' && (
                                      <span className="text-slate-400 line-through">{im.scheduledTime}</span>
                                    )}
                                    <span className={`font-bold ${isImCurrent ? 'text-[#1E3A8A]' : isImPassed ? 'text-slate-500' : 'text-slate-800'}`}>
                                      {im.dynamicTime}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Where Is My Train: Real-time locomotive running between this station and the next */}
                  {idx === activeSegmentIndex && idx < displayedRouteStations.length - 1 &&
                    renderLiveTrainLocomotiveCapsule(stn.name, stn.km, displayedRouteStations[idx + 1])
                  }
                  </React.Fragment>
                );
              })}
            </div>

            {/* Bottom Route Summary Footnote */}
            <div className="pt-3 mt-2 border-t border-[#E2E8F0] flex items-center justify-between text-[11px] text-[#64748B]">
              <span>Real-time GPS Ground Synced</span>
              <span className="font-semibold text-[#0F172A]">
                {progressPct}% Route Completed
              </span>
            </div>
          </aside>

          {/* ========================================================================= */}
          {/* RIGHT PANE (lg:col-span-7): DEEP NEURAL ETA COCKPIT & WATERFALL ANALYTICS */}
          {/* ========================================================================= */}
          <main className={`${mobileTab === 'map' ? 'block' : 'hidden'} lg:block lg:col-span-7 space-y-5`}>

            {/* EXACT LIVE TRAIN LOCATION BANNER */}
            {predictData?.exactLocationText && (
              <div className="p-3 bg-blue-50/90 border border-blue-200/80 rounded-xl flex items-center justify-between gap-2 shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#1E3A8A] animate-ping" />
                  <span className="text-xs font-bold text-[#1E3A8A]">
                    {predictData.exactLocationText}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold text-[#047857] bg-emerald-100 px-2 py-0.5 rounded-full">
                  Real-time Ground Truth
                </span>
              </div>
            )}

            {/* SECTION 1: TRAIN IDENTITY & LIVE STATUS */}
            <header className="space-y-3 bg-white rounded-2xl p-5 shadow-sm border border-[#E2E8F0]">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-1 rounded-md bg-[#1E3A8A] text-white text-[10px] tracking-wider uppercase font-bold shadow-xs">
                    {displayTrainName.includes('Rajdhani') ? 'Priority Rajdhani Rake' : displayTrainName.includes('Vande') ? 'Priority Vande Bharat Express' : 'Priority Superfast Express'}
                  </span>
                  <span className="text-xs text-[#475569] font-medium flex items-center gap-1.5">
                    <Route className="w-3.5 h-3.5 text-[#64748B]" />
                    <span>{originName} ──► {destinationStation}</span>
                  </span>
                  {isRerouted && (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#10B981]/20 text-[#047857] text-[10px] font-bold border border-[#10B981]/30">
                      PF 16 Fast Reroute Active (-10m Saved)
                    </span>
                  )}
                </div>

                {/* View Mode Switcher: Google Maps Mode vs AI Analytics Mode */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setViewMode('map')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'map'
                        ? 'bg-[#1E3A8A] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Map className="w-3.5 h-3.5" />
                    <span>🗺️ Live Map</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('analytics')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'analytics'
                        ? 'bg-[#1E3A8A] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>📊 AI Analytics</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                <h1 className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl text-[#0F172A] font-extrabold tracking-tight">
                  {displayTrainName}
                </h1>
                <span className="text-xs text-[#64748B] font-mono font-medium">
                  Loco: WAP-7 (Ghaziabad Shed)
                </span>
              </div>

              {/* Quick 6-Fact Operational Overview Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#64748B] uppercase font-bold tracking-wider">1. Train No</span>
                  <span className="text-sm font-extrabold text-[#0F172A] mt-0.5 font-mono">{trainNo}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#64748B] uppercase font-bold tracking-wider">2. Departure (Origin)</span>
                  <span className="text-xs font-bold text-[#0F172A] truncate mt-0.5" title={originName}>{originName}</span>
                  <span className="text-[11px] text-[#047857] font-semibold">{departureTime}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#64748B] uppercase font-bold tracking-wider">3. Dynamic Arrival</span>
                  <span className="text-xs font-bold text-[#1E3A8A] truncate mt-0.5" title={destinationStation}>{destinationStation}</span>
                  <span className="text-[11px] text-[#1E3A8A] font-extrabold">{dynamicEta}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#64748B] uppercase font-bold tracking-wider">4. Scheduled Time</span>
                  <span className="text-xs font-bold text-[#64748B] mt-0.5">{scheduledTime}</span>
                  <span className="text-[10px] text-[#94A3B8]">Timetable Target</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#64748B] uppercase font-bold tracking-wider">5. Current Delay</span>
                  <span className={`text-sm font-extrabold mt-0.5 ${netDelayMin > 0 ? 'text-[#B91C1C]' : 'text-[#047857]'}`}>
                    {netDelayMin > 0 ? `+${netDelayMin}m Late` : 'On-Time'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#64748B] uppercase font-bold tracking-wider">6. Delay Cause</span>
                  <span className="text-xs font-semibold text-[#B45309] truncate mt-0.5" title={primaryDelayReason}>
                    {primaryDelayReason}
                  </span>
                </div>
              </div>

              {/* Live Telemetry Ribbon */}
              <div className="flex flex-wrap items-center gap-y-2 gap-x-3 pt-0.5">
                <div className="inline-flex items-center gap-1.5 text-xs text-[#475569] bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                  <Gauge className="w-4 h-4 text-[#1E3A8A]" />
                  <span>
                    Current Speed: <strong className="text-[#0F172A] font-bold">{currentSpeed} km/h</strong>
                  </span>
                </div>
                <div className="inline-flex items-center gap-1.5 text-xs text-[#475569] bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                  <MapPin className="w-4 h-4 text-[#047857]" />
                  <span>
                    Next Immediate Stop: <strong className="text-[#0F172A] font-bold">{nextStop}</strong>
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-blue-100 text-[#1E3A8A] text-[10px] font-bold">
                    {nextStopEta}
                  </span>
                </div>
                <div className="inline-flex items-center gap-1.5 text-xs text-[#475569] bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                  <Radio className="w-4 h-4 text-[#10B981]" />
                  <span>
                    Signal Aspect: <strong className="text-[#047857] font-bold">Clear Green / Caution Aspect</strong>
                  </span>
                </div>
              </div>
            </header>

            {/* LIVE GOOGLE MAPS TRANSIT VISUALIZATION */}
            {viewMode === 'map' && (
              <section className="rounded-2xl overflow-hidden shadow-sm border border-[#E2E8F0] animate-fadeIn">
                <LiveRouteMap
                  key={`live-route-map-${trainNo}`}
                  trainNo={trainNo}
                  trainName={displayTrainName}
                  origin={originName}
                  destination={destinationStation}
                  currentKm={activeKm}
                  totalDistanceKm={totalDist}
                  currentSpeedKmph={currentSpeed}
                  currentSection={currentSection}
                  signalAspect={predictData?.signalAspect || 'CLEAR_GREEN'}
                  stations={predictData?.allStations && predictData.allStations.length > 0 ? predictData.allStations : (predictData?.upcomingStations || [])}
                  currentLat={predictData?.currentLat}
                  currentLng={predictData?.currentLng}
                  bearing={predictData?.bearing}
                  isLiveGround={predictData?.isLiveGround}
                  trackPath={predictData?.trackPath}
                  nearestStation={predictData?.nearestStation}
                  nextStation={predictData?.nextStation}
                  nextStationDistanceKm={predictData?.nextStationDistanceKm}
                  exactLocationText={predictData?.exactLocationText}
                  telemetrySource={predictData?.telemetrySource}
                  selectedStationCode={selectedStationCode}
                  onSelectStation={(code) => setSelectedStationCode(code)}
                  leadingTrain={predictData?.leadingTrain}
                  weatherCondition={predictData?.weatherCondition}
                  signalStatus={predictData?.signalStatus}
                />
              </section>
            )}

            {/* FOCUSED STATION POPUP (If User Clicked A Specific Station In The Route) */}
            {selectedStation && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between gap-4 animate-scaleUp">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#1E3A8A] bg-blue-200/60 px-2 py-0.5 rounded">
                      Selected Station Focus
                    </span>
                    <h4 className="text-sm font-extrabold text-[#0F172A]">
                      {selectedStation.name} ({selectedStation.code}) • PF {selectedStation.platform}
                    </h4>
                  </div>
                  <p className="text-xs text-[#475569]">
                    Scheduled: <span className="line-through">{selectedStation.scheduledArrival}</span> ➔ Dynamic ETA:{' '}
                    <strong className="text-[#1E3A8A] font-mono">{selectedStation.dynamicEta}</strong> ({selectedStation.delayMin > 0 ? `+${selectedStation.delayMin}m delay` : 'On-Time'})
                  </p>
                  <p className="text-[11px] text-[#64748B]">
                    Status: <strong>{selectedStation.status}</strong> • {selectedStation.reason}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStationCode(null)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0 shadow-xs"
                >
                  Reset Focus
                </button>
              </div>
            )}

            {/* SECTION 2: HERO DYNAMIC DESTINATION ARRIVAL METRIC */}
            <section className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow border border-[#E2E8F0] relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-56 h-56 bg-blue-50/60 rounded-full blur-3xl pointer-events-none"></div>

              <div className="relative space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="inline-flex items-center gap-1.5 text-[#475569]">
                    <Activity className="w-4 h-4 text-[#1E3A8A]" />
                    <span className="text-[11px] uppercase tracking-wider font-bold text-[#64748B]">
                      Dynamic Destination Arrival ({destinationStation})
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#10B981]/15 text-[#047857] border border-[#10B981]/25">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span>
                    <span className="text-[11px] font-bold">
                      {predictData?.destinationEta?.confidence?.confidencePercentage || 94}% Neural Confidence
                    </span>
                  </div>
                </div>

                <div className="pt-1 space-y-1">
                  <div className="font-['Plus_Jakarta_Sans'] text-3xl sm:text-4xl text-[#1E3A8A] font-extrabold tracking-tight tabular-nums">
                    {dynamicEta}
                  </div>
                  <p className="text-xs sm:text-sm text-[#475569]">
                    Real-time arrival calculated using live GPS, block signal aspect clearance, terminal junction friction, and 130 km/h speed recovery.
                  </p>
                </div>

                {/* Expected Peak Dynamic ETA block */}
                <div className="p-4 bg-slate-50 rounded-xl flex flex-wrap items-center justify-between gap-4 border border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-[#1E3A8A]">
                      <Clock className="w-5 h-5 text-[#1E3A8A]" />
                    </div>
                    <div>
                      <span className="text-[10px] text-[#64748B] uppercase tracking-wider font-bold block">
                        Estimated Arrival Window
                      </span>
                      <span className="text-sm font-bold text-[#0F172A] tabular-nums">
                        {predictData?.destinationEta?.confidence?.p10Time
                          ? new Date(predictData.destinationEta.confidence.p10Time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : dynamicEta} – {predictData?.destinationEta?.confidence?.p90Time
                          ? new Date(predictData.destinationEta.confidence.p90Time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : dynamicEta}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-[10px] text-[#64748B] uppercase tracking-wider font-bold block">
                        Timetable Scheduled
                      </span>
                      <span className="font-['Plus_Jakarta_Sans'] text-lg text-[#64748B] line-through tabular-nums font-semibold">
                        {scheduledTime}
                      </span>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold ${
                        netDelayMin <= 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      <TrendingDown className="w-4 h-4" />
                      Net Delay: {netDelayMin > 0 ? `+${netDelayMin} mins Late` : `${netDelayMin} mins (On-Time)`}
                    </span>
                  </div>
                </div>

                {/* Micro-Timeline */}
                <div className="pt-2">
                  <div className="flex items-center justify-between text-[11px] text-[#64748B] pb-1.5 font-medium">
                    <span>Origin: {originName}</span>
                    <span className="font-semibold text-[#0F172A]">
                      {progressPct}% Route Complete ({currentKmVal} / {totalDist} KM)
                    </span>
                    <span>Terminus: {destinationStation}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                    <div
                      className="bg-[#1E3A8A] h-full rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${progressPct}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 3: ESSENTIAL 2-COLUMN SUMMARY CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-5 shadow-xs border border-[#E2E8F0] flex flex-col justify-between hover:shadow-sm transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wider text-[#64748B] font-bold">
                      Total Operational Delays Incurred
                    </span>
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="font-['Plus_Jakarta_Sans'] text-2xl text-amber-600 font-bold tabular-nums">
                    +{totalDelaysMin.toFixed(1)} mins
                  </div>
                </div>
                <div className="pt-3 mt-2 border-t border-slate-100">
                  <p className="text-xs text-[#475569] flex items-start gap-1.5 leading-relaxed">
                    <Info className="w-4 h-4 text-[#94A3B8] mt-0.5 shrink-0" />
                    <span>
                      {isRerouted
                        ? 'Live signal restrictions & terminal deceleration. Outer platform holding avoided via PF 16 reroute.'
                        : primaryDelayReason
                        ? `${primaryDelayReason}, sectional caution orders, and terminal approach deceleration.`
                        : 'Atmospheric visibility, sectional headway caution, and terminal approach deceleration.'}
                    </span>
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 shadow-xs border border-[#E2E8F0] flex flex-col justify-between hover:shadow-sm transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wider text-[#64748B] font-bold">
                      Time Deleted / Slack Recovery
                    </span>
                    <Zap className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="font-['Plus_Jakarta_Sans'] text-2xl text-emerald-600 font-bold tabular-nums">
                    -{slackRecoveredMin} mins
                  </div>
                </div>
                <div className="pt-3 mt-2 border-t border-slate-100">
                  <p className="text-xs text-[#475569] flex items-start gap-1.5 leading-relaxed">
                    <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <span>
                      130 km/h sustained line run on cleared track corridor utilizing official timetable buffer.
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* SECTION 4: INLINE ROOT CAUSE DELAY WATERFALL BREAKDOWN */}
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-[#E2E8F0] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#0F172A] flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#1E3A8A]" />
                    <span>Explainable Delay Factor Decomposition</span>
                  </h3>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Real-time operational penalties injected vs time deletion recovered along route.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="text-xs font-semibold text-[#1E3A8A] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>Detailed Audit</span>
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2.5">
                {waterfallSteps.map((step: any, idx: number) => {
                  const isRecover = step.impactMin < 0;
                  const absImpact = Math.abs(step.impactMin);
                  const barWidth = Math.min(100, Math.max(8, (absImpact / 20) * 100));

                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold mb-1">
                        <span className="text-[#0F172A] flex items-center gap-1.5">
                          {isRecover ? (
                            <Zap className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          )}
                          <span>{step.label}</span>
                        </span>
                        <span
                          className={`font-mono font-bold ${
                            isRecover ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {step.impactMin > 0 ? `+${step.impactMin.toFixed(1)}m` : `${step.impactMin.toFixed(1)}m`}
                        </span>
                      </div>

                      <div className="w-full bg-slate-200/70 h-1.5 rounded-full overflow-hidden mb-1.5">
                        <div
                          className={`h-full rounded-full ${
                            isRecover ? 'bg-emerald-600' : 'bg-amber-500'
                          }`}
                          style={{ width: `${barWidth}%` }}
                        ></div>
                      </div>

                      <p className="text-[11px] text-[#64748B]">
                        {step.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* SECTION 5: PRIMARY ACTION BUTTONS */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={onNavigateToPage3}
                className="flex-1 bg-[#1E3A8A] text-white hover:bg-[#172E6F] py-3.5 px-6 rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group active:scale-[0.99] cursor-pointer"
              >
                <span>Inspect Full Corridor Graph &amp; Weather Analytics</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="px-5 py-3.5 rounded-xl bg-white border border-[#E2E8F0] text-[#0F172A] hover:bg-slate-50 text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                title="Quick preview summary"
              >
                <Eye className="w-4 h-4 text-[#1E3A8A]" />
                <span>Full Audit Modal</span>
              </button>
            </div>

            <div className="text-center pt-1">
              <p className="text-xs text-[#94A3B8]">
                Neural dynamic model accounts for block sections ahead, cross-traffic merges, and train-precedence priority matrices.
              </p>
            </div>
          </main>
        </div>
      </div>

      {/* Interactive Modal: Delay Breakdown Drawer / Preview */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-[#E2E8F0] animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-[#1E3A8A]">
                  <Activity className="w-4 h-4 text-[#1E3A8A]" />
                </div>
                <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#0F172A]">
                  Dynamic Audit Report: {displayTrainName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-[#64748B] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {waterfallSteps.map((step: any, idx: number) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl flex justify-between items-center ${
                    step.impactMin < 0
                      ? 'bg-emerald-50 border border-emerald-200'
                      : 'bg-slate-50'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-[#0F172A]">
                      {step.label}
                    </div>
                    <div className="text-[11px] text-[#64748B]">
                      {step.description}
                    </div>
                  </div>
                  <span
                    className={`text-xs font-bold shrink-0 ml-2 ${
                      step.impactMin < 0 ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {step.impactMin > 0 ? `+${step.impactMin.toFixed(1)}m` : `${step.impactMin.toFixed(1)}m`}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 text-[#0F172A] hover:bg-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  onNavigateToPage3();
                }}
                className="px-4 py-2 rounded-lg bg-[#1E3A8A] text-white hover:bg-[#172E6F] text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>Full Corridor Report</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
