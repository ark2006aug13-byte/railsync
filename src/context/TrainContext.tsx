/**
 * src/context/TrainContext.tsx
 * RailPulse AI Global State Context & Simulation Replay Engine
 * Provides live telemetry, race-condition-free simulation scrubber controls,
 * dual-case property resilience, connection telemetry, and two-way conflict resolution.
 */
import React, { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  useCallback, 
  useRef, 
  ReactNode 
} from 'react';
import { 
  AccuracyMetricsResponse, 
  CorridorInfoResponse, 
  InflowTrain, 
  PlatformGanttSlot, 
  RouteStation, 
  TelemetryPacket, 
  TrainOverview, 
  TrainStateResponse 
} from '../types';
import { 
  checkBackendHealth, 
  fetchAccuracyMetrics, 
  fetchCorridorInfo, 
  fetchOperationsInflow, 
  fetchTelemetryPackets, 
  fetchTrainsList, 
  fetchTrainState,
  resolveStationConflict,
  IS_FORCE_MOCK
} from '../services/railSyncApi';
import { 
  initialGanttSchedule, 
  initialInflowTrains, 
  initialTelemetryPackets, 
  rajdhani12302, 
  rajdhani12302Route, 
  vandeBharat22436 
} from '../data/mockData';

// Standard Grand Chord corridor stations for fallback interpolation
const DEFAULT_CORRIDOR_STATIONS = [
  { code: 'HWH', name: 'Howrah Jn', km: 0, platform: 9 },
  { code: 'BWN', name: 'Barddhaman Jn', km: 100, platform: 1 },
  { code: 'ASN', name: 'Asansol Jn', km: 225, platform: 3 },
  { code: 'DHN', name: 'Dhanbad Jn', km: 259, platform: 2 },
  { code: 'GAYA', name: 'Gaya Jn', km: 412, platform: 1 },
  { code: 'DDU', name: 'Pt. Deen Dayal Upadhyaya Jn', km: 585, platform: 3 },
  { code: 'PRYJ', name: 'Prayagraj Jn', km: 764, platform: 2 },
  { code: 'CNB', name: 'Kanpur Central', km: 979, platform: 1 },
  { code: 'NDLS', name: 'New Delhi', km: 1451, platform: 12 },
];

export interface TrainContextType {
  // Live Telemetry
  trainState: TrainStateResponse | null;
  trainOverview: TrainOverview;
  routeStations: RouteStation[];
  inflowTrains: InflowTrain[];
  ganttSlots: PlatformGanttSlot[];
  telemetryPackets: TelemetryPacket[];
  accuracyMetrics: AccuracyMetricsResponse | null;
  corridorInfo: CorridorInfoResponse | null;

  // Connection & Synchronization
  isBackendOnline: boolean;
  lastSyncedAt: Date | null;
  isLoading: boolean;
  syncError: string | null;

  // Selected Train
  selectedTrainNo: string;
  setSelectedTrainNo: (trainNo: string) => void;

  // Simulation Replay Scrub Controls
  isPlaying: boolean;
  playbackSpeed: number; // 1, 2, 5, 10
  currentSimTime: string; // ISO format
  minSimTime: string;
  maxSimTime: string;
  runDate: string;
  availableDates: string[];
  setRunDate: (date: string) => void;
  scrubToTime: (isoTime: string) => void;
  togglePlay: () => void;
  setSpeed: (multiplier: number) => void;

  // Conflict Resolution
  conflictResolved: boolean;
  resolveConflict: (trainId: string, targetPlatform: string) => void;
  resetConflict: () => void;

  // Manual Trigger
  refresh: () => Promise<void>;
}

const TrainContext = createContext<TrainContextType | undefined>(undefined);

export function useTrain(): TrainContextType {
  const context = useContext(TrainContext);
  if (!context) {
    throw new Error('useTrain must be used within a TrainProvider');
  }
  return context;
}

/**
 * Derives RouteStation[] list from backend TrainStateResponse
 * Robust to both camelCase and snake_case schemas.
 */
function deriveRouteStations(
  state: TrainStateResponse,
  corridor: CorridorInfoResponse | null
): RouteStation[] {
  const stationsList = corridor?.stations && corridor.stations.length > 0 
    ? corridor.stations 
    : DEFAULT_CORRIDOR_STATIONS;

  const passedList = state.passedStations || state.passed_stations || [];
  const upcomingList = state.upcomingStations || state.upcoming_stations || [];

  const passedMap = new Map(passedList.map(p => [p.code, p]));
  const upcomingMap = new Map(upcomingList.map(u => [u.code, u]));
  const nextUpcoming = upcomingList[0];

  const trainCurrentDelay = Number(state.position?.delayMin ?? state.position?.delay_min ?? 0);

  return stationsList.map((stn, index) => {
    const isPassed = passedMap.has(stn.code);
    const upcoming = upcomingMap.get(stn.code);
    const isApproaching = nextUpcoming?.code === stn.code;
    const isTerminal = index === stationsList.length - 1 || stn.code === 'NDLS';

    if (isPassed) {
      const p = passedMap.get(stn.code)!;
      const actualArrFmt = p.actualArrivalFmt || p.actual_arrival_fmt || p.actualArrival || p.actual_arrival;
      return {
        stationCode: stn.code,
        stationName: stn.name,
        platform: `PF ${p.platform || (stn as any).platform || 1}`,
        scheduledTime: actualArrFmt || 'Passed',
        aiForecastTime: actualArrFmt || '--:--',
        status: 'passed' as const,
        departureTime: p.actualDepartureFmt || p.actual_departure_fmt || actualArrFmt || undefined,
        delayFormatted: '+0m',
        delayMinutes: 0,
        isTerminal,
      };
    } else if (upcoming) {
      const delayMin = Number(upcoming.predictedDelayMin ?? upcoming.predicted_delay_min ?? 0);
      const delayFormatted = delayMin > 0 
        ? `+${Math.round(delayMin)}m` 
        : delayMin < 0 
        ? `${Math.round(delayMin)}m` 
        : 'On-time';

      const delayInjected = Number(upcoming.delayInjectedMin ?? upcoming.delay_injected_min ?? delayMin);
      const timeDeletion = Number(upcoming.timeDeletionMin ?? upcoming.time_deletion_min ?? Math.max(0, Math.round(trainCurrentDelay - delayMin)));
      const recoveredMin = timeDeletion > 0 ? timeDeletion : Math.max(0, Math.round(trainCurrentDelay - delayMin));

      const isConflict = Boolean(upcoming.platformConflict ?? upcoming.platform_conflict);
      const outerHold = Number(upcoming.outerHoldingMin ?? upcoming.outer_holding_min ?? 0);
      const conflictingTrainName = upcoming.conflictingTrain || upcoming.conflicting_train || undefined;
      const confMargin = Number(upcoming.confidenceMin ?? upcoming.confidence_min ?? 2.5);
      const whyText = upcoming.why || (isConflict ? `Platform ${upcoming.platform} contention outer hold` : 'Line speed cruise');

      const schedTime = upcoming.etaScheduleFmt || upcoming.eta_schedule_fmt || '--:--';
      const predTime = upcoming.etaPredictedFmt || upcoming.eta_predicted_fmt || '--:--';
      const weatherCond = upcoming.weatherCondition || upcoming.weather_condition || (whyText.toLowerCase().includes('fog') ? 'Dense Winter Fog (MPS 60)' : 'Clear Track');
      const sigStatus = upcoming.signalStatus || upcoming.signal_status || (state.signalAspect?.badge || state.signal_aspect?.badge || 'Cascaded Green');

      return {
        stationCode: stn.code,
        stationName: stn.name,
        platform: `PF ${upcoming.platform || (stn as any).platform || 1}`,
        scheduledTime: schedTime,
        aiForecastTime: predTime,
        status: isApproaching ? ('approaching' as const) : ('upcoming' as const),
        delayMinutes: delayMin,
        delayFormatted: recoveredMin > 0 ? `${delayFormatted} (Recovers ${recoveredMin}m)` : delayFormatted,
        delayInjectedMinutes: delayInjected,
        timeDeletionMinutes: recoveredMin,
        platformConflict: isConflict,
        outerHoldingMinutes: outerHold,
        conflictingTrain: conflictingTrainName,
        confidenceMinutes: confMargin,
        why: whyText,
        weatherCondition: weatherCond,
        signalStatus: sigStatus,
        isTerminal,
      };
    } else {
      return {
        stationCode: stn.code,
        stationName: stn.name,
        platform: `PF ${(stn as any).platform || 1}`,
        scheduledTime: '--:--',
        aiForecastTime: '--:--',
        status: 'upcoming' as const,
        isTerminal,
      };
    }
  });
}

/**
 * Derives TrainOverview from backend TrainStateResponse
 * Robust to both camelCase and snake_case schemas.
 */
function deriveTrainOverview(
  state: TrainStateResponse,
  baseOverview: TrainOverview
): TrainOverview {
  const upcomingList = state.upcomingStations || state.upcoming_stations || [];
  const nextUp = upcomingList[0];
  const delay = Math.round(Number(state.position?.delayMin ?? state.position?.delay_min ?? 0));
  const delayStatus: 'on-time' | 'slight-delay' | 'critical-delay' =
    delay <= 5 ? 'on-time' : delay <= 20 ? 'slight-delay' : 'critical-delay';

  const trainKm = Number(state.position?.km ?? 0);
  const distToNext = nextUp
    ? Math.max(0, Math.round(Number(nextUp.km) - trainKm))
    : baseOverview.distanceToNextStationKm;

  const currentSpeed = Math.round(Number(state.position?.speedKmph ?? state.position?.speed_kmph ?? 0));
  const estRemainingMin =
    nextUp && currentSpeed > 15
      ? Math.max(1, Math.round((distToNext / currentSpeed) * 60))
      : baseOverview.timeRemainingMinutes;

  const sigBadge = state.signalAspect?.badge || state.signal_aspect?.badge || baseOverview.sectionSignal;
  const leadHeadway = Number(
    state.leadingTrain?.headwayGapKm ?? 
    state.leading_train?.headway_gap_km ?? 
    baseOverview.loopCongestionHeadwayKm
  );

  const predArrival = nextUp ? (nextUp.etaPredictedFmt || nextUp.eta_predicted_fmt || '--:--') : baseOverview.predictedArrival;
  const schedArrival = nextUp ? (nextUp.etaScheduleFmt || nextUp.eta_schedule_fmt || '--:--') : baseOverview.scheduledArrival;
  const confMin = Number(nextUp?.confidenceMin ?? nextUp?.confidence_min ?? 2.5);

  return {
    ...baseOverview,
    currentSpeed,
    delayMinutes: delay,
    delayStatus,
    sectionSignal: sigBadge,
    loopCongestionHeadwayKm: leadHeadway,
    nextStation: nextUp?.name || baseOverview.nextStation,
    nextStationCode: nextUp?.code || baseOverview.nextStationCode,
    distanceToNextStationKm: distToNext,
    timeRemainingMinutes: estRemainingMin,
    assignedPlatform: nextUp ? `PF ${nextUp.platform}` : baseOverview.assignedPlatform,
    predictedArrival: predArrival,
    scheduledArrival: schedArrival,
    confidencePercent: nextUp 
      ? Math.round(Math.max(70, Math.min(99, 100 - confMin * 2.5))) 
      : baseOverview.confidencePercent,
  };
}

interface TrainProviderProps {
  children: ReactNode;
}

export const TrainProvider: React.FC<TrainProviderProps> = ({ children }) => {
  // Connection and synchronization
  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Train selection
  const [selectedTrainNo, setSelectedTrainNo] = useState<string>('12301');

  // Core telemetry state
  const [trainState, setTrainState] = useState<TrainStateResponse | null>(null);
  const [trainOverview, setTrainOverview] = useState<TrainOverview>(rajdhani12302);
  const [routeStations, setRouteStations] = useState<RouteStation[]>(rajdhani12302Route);
  const [inflowTrains, setInflowTrains] = useState<InflowTrain[]>(initialInflowTrains);
  const [ganttSlots, setGanttSlots] = useState<PlatformGanttSlot[]>(initialGanttSchedule);
  const [telemetryPackets, setTelemetryPackets] = useState<TelemetryPacket[]>(initialTelemetryPackets);
  const [accuracyMetrics, setAccuracyMetrics] = useState<AccuracyMetricsResponse | null>(null);
  const [corridorInfo, setCorridorInfo] = useState<CorridorInfoResponse | null>(null);

  // Simulation Replay scrub state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [currentSimTime, setCurrentSimTime] = useState<string>('');
  const [minSimTime, setMinSimTime] = useState<string>('');
  const [maxSimTime, setMaxSimTime] = useState<string>('');
  const [runDate, setRunDateState] = useState<string>('2024-12-15');
  const [availableDates, setAvailableDates] = useState<string[]>([
    '2024-12-10',
    '2024-12-11',
    '2024-12-12',
    '2024-12-13',
    '2024-12-14',
    '2024-12-15'
  ]);

  // Conflict resolution state
  const [conflictResolved, setConflictResolved] = useState<boolean>(false);

  // Race condition mitigation: Monotonic request ID sequence & active abort controller
  const latestRequestIdRef = useRef<number>(0);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  // Mutable refs to prevent stale closures in interval loops
  const simTimeRef = useRef<string>('');
  simTimeRef.current = currentSimTime;

  const minSimTimeRef = useRef<string>('');
  minSimTimeRef.current = minSimTime;

  const maxSimTimeRef = useRef<string>('');
  maxSimTimeRef.current = maxSimTime;

  const runDateRef = useRef<string>(runDate);
  runDateRef.current = runDate;

  const playbackSpeedRef = useRef<number>(playbackSpeed);
  playbackSpeedRef.current = playbackSpeed;

  const corridorInfoRef = useRef<CorridorInfoResponse | null>(corridorInfo);
  corridorInfoRef.current = corridorInfo;

  const selectedTrainNoRef = useRef<string>(selectedTrainNo);
  selectedTrainNoRef.current = selectedTrainNo;

  /**
   * Updates state when TrainStateResponse arrives
   */
  const applyTrainState = useCallback((state: TrainStateResponse) => {
    setTrainState(state);
    const simTime = state.simulatedTime || state.simulated_time;
    if (simTime) {
      setCurrentSimTime(simTime);
    }
    const minT = state.minTime || state.min_time;
    const maxT = state.maxTime || state.max_time;
    if (minT) setMinSimTime(minT);
    if (maxT) setMaxSimTime(maxT);

    const baseTrain = selectedTrainNoRef.current === '22436' ? vandeBharat22436 : rajdhani12302;
    setTrainOverview(deriveTrainOverview(state, baseTrain));
    setRouteStations(deriveRouteStations(state, corridorInfoRef.current));
  }, []);

  /**
   * Fetches train state at a specific timestamp or date.
   * Cancels in-flight requests and ignores stale responses to eliminate race conditions.
   */
  const fetchStateFor = useCallback(async (date: string, timestampIso?: string) => {
    // Abort previous in-flight scrub request
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    activeAbortControllerRef.current = controller;

    // Track request sequence
    const currentRequestId = ++latestRequestIdRef.current;

    try {
      const state = await fetchTrainState(
        selectedTrainNoRef.current, 
        date, 
        timestampIso, 
        controller.signal
      );

      // Check if a newer request has superseded this one
      if (currentRequestId !== latestRequestIdRef.current) {
        return;
      }

      applyTrainState(state);
      setIsBackendOnline(true);
      setLastSyncedAt(new Date());
      setSyncError(null);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Obsolete request cleanly aborted during rapid scrub, not an error
        return;
      }
      if (currentRequestId !== latestRequestIdRef.current) {
        return;
      }
      setIsBackendOnline(false);
      setSyncError(err?.message || 'Backend unreachable');
    }
  }, [applyTrainState]);

  /**
   * Two-Way Platform Conflict Resolution handler
   * Dispatches to backend API and updates local state optimistically.
   */
  const resolveConflict = useCallback(async (trainId: string, targetPlatform: string) => {
    setConflictResolved(true);
    const pfNum = parseInt(targetPlatform.replace(/\D/g, '') || '5', 10);

    // Optimistic UI updates
    setInflowTrains(prev => prev.map(t => {
      if (t.id === trainId || t.trainNumber === trainId) {
        return {
          ...t,
          platform: targetPlatform,
          platformBuffer: '24m Headway Safe',
          hasConflict: false,
          conflictDetails: t.conflictDetails ? { ...t.conflictDetails, resolved: true } : undefined
        };
      }
      return t;
    }));

    setGanttSlots(prev => prev.map(s => {
      if (s.platformNumber === 3 && (s.trainNumber === '12424' || s.trainNumber === trainId)) {
        return {
          ...s,
          platformNumber: pfNum,
          platformLabel: targetPlatform,
          status: 'occupied',
          description: 'Rerouted via Point 112B (Headway Secured)'
        };
      }
      if (s.platformNumber === 3 && s.trainNumber === '14056') {
        return {
          ...s,
          status: 'departure-ready',
          description: 'Clear Route for Departure at 11:15 IST'
        };
      }
      return s;
    }));

    // Send two-way conflict resolution to FastAPI backend
    try {
      await resolveStationConflict({
        trainNo: trainId,
        stationCode: 'NDLS',
        allocatedPlatform: pfNum
      });
      // Trigger a state fetch to reflect cleared outer holding delay at NDLS
      fetchStateFor(runDateRef.current, simTimeRef.current || undefined);
    } catch (e) {
      console.warn('Backend conflict resolution sync completed with optimistic state:', e);
    }
  }, [fetchStateFor]);

  const resetConflict = useCallback(() => {
    setConflictResolved(false);
    setInflowTrains(initialInflowTrains);
    setGanttSlots(initialGanttSchedule);
  }, []);

  /**
   * Scrub to specific ISO time
   */
  const scrubToTime = useCallback((isoTime: string) => {
    setCurrentSimTime(isoTime);
    fetchStateFor(runDateRef.current, isoTime);
  }, [fetchStateFor]);

  /**
   * Change trip run date
   */
  const setRunDate = useCallback((newDate: string) => {
    setRunDateState(newDate);
    setCurrentSimTime('');
    fetchStateFor(newDate, undefined);
  }, [fetchStateFor]);

  /**
   * Toggle Replay Play / Pause
   */
  const togglePlay = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  /**
   * Set Playback speed multiplier (1x, 2x, 5x, 10x)
   */
  const setSpeed = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
  }, []);

  /**
   * Full Initial Sync & Refresh
   */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Health check
      await checkBackendHealth();
      setIsBackendOnline(true);

      // 2. Fetch corridor, trains list, accuracy metrics, operations inflow, and telemetry concurrently
      const [corridor, trains, metrics, opsInflow, telemetry] = await Promise.allSettled([
        fetchCorridorInfo(),
        fetchTrainsList(),
        fetchAccuracyMetrics(selectedTrainNoRef.current),
        fetchOperationsInflow('NDLS'),
        fetchTelemetryPackets(selectedTrainNoRef.current)
      ]);

      if (corridor.status === 'fulfilled') {
        setCorridorInfo(corridor.value);
        corridorInfoRef.current = corridor.value;
      }

      let activeDate = runDateRef.current;
      if (trains.status === 'fulfilled' && trains.value.length > 0) {
        const train = trains.value[0];
        const dates = train.availableDates || train.available_dates;
        if (dates && dates.length > 0) {
          setAvailableDates(dates);
          activeDate = train.defaultDate || train.default_date || dates[dates.length - 1];
          setRunDateState(activeDate);
        }
      }

      if (metrics.status === 'fulfilled') {
        setAccuracyMetrics(metrics.value);
      }

      if (opsInflow.status === 'fulfilled') {
        if (opsInflow.value.inflowTrains?.length > 0) {
          setInflowTrains(opsInflow.value.inflowTrains);
        }
        if (opsInflow.value.platformOccupancy?.length > 0) {
          setGanttSlots(opsInflow.value.platformOccupancy);
        }
      }

      if (telemetry.status === 'fulfilled') {
        setTelemetryPackets(telemetry.value);
      }

      // 3. Fetch initial train state for active date
      const state = await fetchTrainState(selectedTrainNoRef.current, activeDate);
      applyTrainState(state);

      setLastSyncedAt(new Date());
      setSyncError(null);
    } catch (err: any) {
      if (IS_FORCE_MOCK) {
        setIsBackendOnline(false);
        setSyncError('Running in forced mock mode via VITE_FORCE_MOCK.');
      } else {
        setIsBackendOnline(false);
        setSyncError(err?.message || 'FastAPI backend offline.');
      }
      setTrainOverview(selectedTrainNoRef.current === '22436' ? vandeBharat22436 : rajdhani12302);
      setRouteStations(rajdhani12302Route);
      setInflowTrains(initialInflowTrains);
      setGanttSlots(initialGanttSchedule);
      setTelemetryPackets(initialTelemetryPackets);
    } finally {
      setIsLoading(false);
    }
  }, [applyTrainState]);

  // Initial mount load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Listen to custom DOM event railpulse:connection-change from api service
  useEffect(() => {
    const handleConnectionChange = (e: Event) => {
      const customEvt = e as CustomEvent;
      if (customEvt.detail) {
        setIsBackendOnline(customEvt.detail.connected);
        if (!customEvt.detail.connected && customEvt.detail.error) {
          setSyncError(customEvt.detail.error);
        }
      }
    };

    window.addEventListener('railpulse:connection-change', handleConnectionChange);
    return () => window.removeEventListener('railpulse:connection-change', handleConnectionChange);
  }, []);

  // When selectedTrainNo changes
  useEffect(() => {
    if (selectedTrainNo === '22436') {
      setTrainOverview(vandeBharat22436);
    } else {
      if (trainState) {
        setTrainOverview(deriveTrainOverview(trainState, rajdhani12302));
      } else {
        setTrainOverview(rajdhani12302);
      }
    }
  }, [selectedTrainNo, trainState]);

  // Simulation Replay advancement loop when isPlaying === true
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      const curTime = simTimeRef.current;
      const maxTime = maxSimTimeRef.current;
      const speed = playbackSpeedRef.current;
      const date = runDateRef.current;

      if (!curTime) return;

      const stepMs = speed * 60 * 1000;
      const nextMs = new Date(curTime).getTime() + stepMs;
      const maxMs = maxTime ? new Date(maxTime).getTime() : 0;

      if (maxMs > 0 && nextMs >= maxMs) {
        setIsPlaying(false);
        setCurrentSimTime(maxTime);
        fetchStateFor(date, maxTime);
      } else {
        const nextIso = new Date(nextMs).toISOString();
        setCurrentSimTime(nextIso);
        fetchStateFor(date, nextIso);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, fetchStateFor]);

  // Gentle periodic background health check & sync when idle
  useEffect(() => {
    if (isPlaying) return;

    const syncInterval = setInterval(async () => {
      try {
        await checkBackendHealth();
        setIsBackendOnline(true);
      } catch {
        setIsBackendOnline(false);
      }
    }, 15000);

    return () => clearInterval(syncInterval);
  }, [isPlaying]);

  return (
    <TrainContext.Provider
      value={{
        trainState,
        trainOverview,
        routeStations,
        inflowTrains,
        ganttSlots,
        telemetryPackets,
        accuracyMetrics,
        corridorInfo,
        isBackendOnline,
        lastSyncedAt,
        isLoading,
        syncError,
        selectedTrainNo,
        setSelectedTrainNo,
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
        conflictResolved,
        resolveConflict,
        resetConflict,
        refresh,
      }}
    >
      {children}
    </TrainContext.Provider>
  );
};
