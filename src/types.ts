export type AppView = 
  | 'home' 
  | 'live-radar'
  | 'train-status' 
  | 'dynamic-eta' 
  | 'operations-console' 
  | 'gantt-schedule' 
  | 'telemetry-stream' 
  | 'interlocking-sim' 
  | 'turnaround-roster';

export interface TrainOverview {
  trainNumber: string;
  trainName: string;
  type: string;
  source: string;
  sourceCode: string;
  destination: string;
  destinationCode: string;
  rakeType: string;
  locoNumber: string;
  locoClass: string;
  schedule: string;
  scheduledArrival: string;
  predictedArrival: string;
  delayMinutes: number;
  delayStatus: 'on-time' | 'slight-delay' | 'critical-delay';
  confidencePercent: number;
  currentSpeed: number;
  mps: number;
  nextStation: string;
  nextStationCode: string;
  distanceToNextStationKm: number;
  timeRemainingMinutes: number;
  assignedPlatform: string;
  platformDetail: string;
  sectionSignal: string;
  loopCongestionHeadwayKm: number;
  navicSatLockCount: number;
  rakeComposition: string[];
}

export interface RouteStation {
  stationCode: string;
  stationName: string;
  platform: string;
  scheduledTime: string;
  aiForecastTime: string;
  status: 'passed' | 'approaching' | 'upcoming';
  departureTime?: string;
  delayFormatted?: string;
  delayMinutes?: number;
  notes?: string;
  isTerminal?: boolean;
  delayInjectedMinutes?: number;
  timeDeletionMinutes?: number;
  platformConflict?: boolean;
  outerHoldingMinutes?: number;
  conflictingTrain?: string;
  confidenceMinutes?: number;
  why?: string;
  weatherCondition?: string;
  signalStatus?: string;
}

export interface InflowTrain {
  id: string;
  trainNumber: string;
  trainName: string;
  source: string;
  sourceCode: string;
  destination: string;
  destinationCode: string;
  platform: string;
  platformBuffer: string;
  dynamicEta: string;
  scheduledEta: string;
  varianceFormatted: string;
  varianceMinutes: number;
  speedKmH: number;
  locationDescription: string;
  rakesCoaches: string;
  signalStatus: string;
  hasConflict?: boolean;
  conflictDetails?: {
    conflictingTrain: string;
    description: string;
    recommendedPlatform: string;
    resolved?: boolean;
  };
}

export interface PlatformGanttSlot {
  id: string;
  platformNumber: number;
  platformLabel: string;
  trainNumber: string;
  trainName: string;
  startTime: string; // e.g. "10:15"
  endTime: string;   // e.g. "11:00"
  status: 'occupied' | 'inflow' | 'departure-ready' | 'conflict' | 'maintenance' | 'available';
  description?: string;
  actionRequired?: boolean;
}

export interface TelemetryPacket {
  id: string;
  timestamp: string;
  locoId: string;
  blockSignalMile: string;
  subsystem: 'RTIS Position Pulse' | 'Kavach ATP Speed Profile' | 'Axle In/Out Count Pulse' | 'EI Route Lock State';
  telemetryValue: string;
  speedKmH?: number;
  details: {
    channel?: string;
    fec?: string;
    crc?: string;
    snrDb?: number;
    rawHex?: string;
    payloadJson?: Record<string, any>;
  };
}

export interface TurnaroundRosterItem {
  platformNumber: number;
  lengthCoaches: string;
  infraDetail: string;
  trainNumber: string;
  trainName: string;
  sourceStation: string;
  inwardArrivalTime: string;
  inwardDelayStatus: string;
  rakeId: string;
  serviceType: string;
  maintenanceType: string;
  maintenanceDuration: string;
  gangAssigned: string;
  statusProgress: string;
  statusPercent: number;
  statusBadgeColor: string;
  isOriginating?: boolean;
  shuntInTime?: string;
}

// Backend API & Replay Simulation Types (Dual-case safe: supports both camelCase & snake_case)

export interface TrainPosition {
  lat: number;
  lng: number;
  km: number;
  speed_kmph?: number;
  speedKmph?: number;
  delay_min?: number;
  delayMin?: number;
  current_section?: string;
  currentSection?: string;
  current_mps?: number;
  currentMps?: number;
  section_id?: string;
  sectionId?: string;
}

export interface LeadingTrainInfo {
  train_no?: string;
  trainNo?: string;
  name: string;
  km: number;
  lat: number;
  lng: number;
  speed_kmph?: number;
  speedKmph?: number;
  delay_min?: number;
  delayMin?: number;
  headway_gap_km?: number;
  headwayGapKm?: number;
}

export interface SignalAspectInfo {
  code: string;
  name: string;
  badge: string;
  color: string;
  speed_cap?: string;
  speedCap?: string;
  headway_gap_km?: number;
  headwayGapKm?: number;
}

export interface UpcomingStationInfo {
  code: string;
  name: string;
  km: number;
  platform: number | string;
  platform_conflict?: boolean;
  platformConflict?: boolean;
  outer_holding_min?: number;
  outerHoldingMin?: number;
  conflicting_train?: string | null;
  conflictingTrain?: string | null;
  eta_predicted?: string;
  etaPredicted?: string;
  eta_predicted_fmt?: string;
  etaPredictedFmt?: string;
  eta_schedule?: string;
  etaSchedule?: string;
  eta_schedule_fmt?: string;
  etaScheduleFmt?: string;
  predicted_delay_min?: number;
  predictedDelayMin?: number;
  delay_injected_min?: number;
  delayInjectedMin?: number;
  time_deletion_min?: number;
  timeDeletionMin?: number;
  recovery_min?: number;
  recoveryMin?: number;
  confidence_min?: number;
  confidenceMin?: number;
  why: string;
  weather_condition?: string;
  weatherCondition?: string;
  signal_status?: string;
  signalStatus?: string;
  horizon: number;
  status?: 'approaching' | 'upcoming';
  actual_arrival?: string | null;
  actualArrival?: string | null;
  actual_arrival_fmt?: string | null;
  actualArrivalFmt?: string | null;
}

export interface PassedStationInfo {
  code: string;
  name: string;
  km: number;
  platform: number | string;
  actual_arrival?: string | null;
  actualArrival?: string | null;
  actual_arrival_fmt?: string | null;
  actualArrivalFmt?: string | null;
  actual_departure?: string | null;
  actualDeparture?: string | null;
  actual_departure_fmt?: string | null;
  actualDepartureFmt?: string | null;
  exit_delay?: number;
  exitDelay?: number;
  status?: string;
}

export interface PlaybackInfo {
  progress_pct?: number;
  progressPct?: number;
  min_time?: string;
  minTime?: string;
  max_time?: string;
  maxTime?: string;
  current_time?: string;
  currentTime?: string;
  prev_time?: string;
  prevTime?: string;
  next_time?: string;
  nextTime?: string;
  has_prev?: boolean;
  hasPrev?: boolean;
  has_next?: boolean;
  hasNext?: boolean;
  step_seconds?: number;
  stepSeconds?: number;
}

export interface TrainStateResponse {
  train_no?: string;
  trainNo?: string;
  train_name?: string;
  trainName?: string;
  run_date?: string;
  runDate?: string;
  simulated_time?: string;
  simulatedTime?: string;
  simulated_time_fmt?: string;
  simulatedTimeFmt?: string;
  min_time?: string;
  minTime?: string;
  max_time?: string;
  maxTime?: string;
  position: TrainPosition;
  leading_train?: LeadingTrainInfo;
  leadingTrain?: LeadingTrainInfo;
  signal_aspect?: SignalAspectInfo;
  signalAspect?: SignalAspectInfo;
  upcoming_stations?: UpcomingStationInfo[];
  upcomingStations?: UpcomingStationInfo[];
  passed_stations?: PassedStationInfo[];
  passedStations?: PassedStationInfo[];
  playback?: PlaybackInfo;
  is_complete?: boolean;
  isComplete?: boolean;
  last_updated?: string;
  lastUpdated?: string;
}

export interface HorizonAccuracyItem {
  horizon: string;
  schedule_mae?: number;
  scheduleMae?: number;
  railsync_mae?: number;
  railsyncMae?: number;
  reduction: string;
  confidence: string;
}

export interface AccuracyMetricsResponse {
  train_no?: string;
  trainNo?: string;
  train_name?: string;
  trainName?: string;
  overall_section_mae_min?: number;
  overallSectionMaeMin?: number;
  schedule_baseline_mae_min?: number;
  scheduleBaselineMaeMin?: number;
  error_reduction_pct?: number;
  errorReductionPct?: number;
  tested_runs_count?: number;
  testedRunsCount?: number;
  badge: string;
  horizon_breakdown?: HorizonAccuracyItem[];
  horizonBreakdown?: HorizonAccuracyItem[];
}

export interface CorridorStation {
  code: string;
  name: string;
  km: number;
  halt_min?: number;
  haltMin?: number;
  lat: number;
  lng: number;
  mps: number;
  platform?: number;
}

export interface CorridorSection {
  section_id?: string;
  sectionId?: string;
  from_code?: string;
  fromCode?: string;
  to_code?: string;
  toCode?: string;
  distance_km?: number;
  distanceKm?: number;
  scheduled_runtime_min?: number;
  scheduledRuntimeMin?: number;
  mps: number;
}

export interface CorridorInfoResponse {
  train_no?: string;
  trainNo?: string;
  train_name?: string;
  trainName?: string;
  stations: CorridorStation[];
  sections: CorridorSection[];
  route_coordinates?: [number, number][];
  routeCoordinates?: [number, number][];
  detailed_track_geometry?: [number, number][];
  detailedTrackGeometry?: [number, number][];
}

export interface TrainListItem {
  train_no?: string;
  trainNo?: string;
  name: string;
  origin: string;
  destination: string;
  total_distance_km?: number;
  totalDistanceKm?: number;
  stations_count?: number;
  stationsCount?: number;
  available_dates?: string[];
  availableDates?: string[];
  default_date?: string;
  defaultDate?: string;
}

export interface ResolveConflictRequest {
  trainNo: string;
  stationCode: string;
  allocatedPlatform: number;
}

export interface ResolveConflictResponse {
  success: boolean;
  trainNo: string;
  stationCode: string;
  allocatedPlatform: number;
  message: string;
}

export interface OperationsInflowResponse {
  station: string;
  inflowTrains: InflowTrain[];
  platformOccupancy: PlatformGanttSlot[];
  conflictStatus: {
    hasActiveConflict: boolean;
    activeConflictsCount: number;
    conflicts: any[];
  };
  headwayBuffer: {
    station: string;
    bottleneckCleared: boolean;
    effectiveHeadwayKm: number;
    trailingTrainsAhead: number;
    blockClearance: string;
    interlockingLoopCycleSec: number;
  };
}

export interface RadarTrain {
  trainNumber: string;
  trainName: string;
  type: 'Vande Bharat' | 'Rajdhani' | 'Shatabdi' | 'Superfast' | 'Mail/Express' | 'Freight' | 'Special';
  source: string;
  sourceCode: string;
  destination: string;
  destinationCode: string;
  currentLat: number;
  currentLng: number;
  bearing: number;
  speedKmph: number;
  maxSpeedKmph: number;
  delayMinutes: number;
  status: 'on-time' | 'slight-delay' | 'heavy-delay';
  currentStation: string;
  currentStationCode: string;
  nextStation: string;
  nextStationCode: string;
  nextStationDistanceKm: number;
  nextStationEta: string;
  timeDeletionMinutes: number;
  weatherSummary: string;
  locoClass: string;
  locoNumber: string;
  zone: string;
  distanceCoveredKm: number;
  totalDistanceKm: number;
  routeCoordinates?: [number, number][];
  upcomingStations?: {
    code: string;
    name: string;
    scheduledArrival: string;
    dynamicEta: string;
    platform: string;
    delayDeltaMin: number;
  }[];
}

export interface RadarJunctionHalo {
  code: string;
  name: string;
  lat: number;
  lng: number;
  activeTrainsCount: number;
  congestionLevel: 'low' | 'moderate' | 'high' | 'severe';
  throatSpeedLimitKmph: number;
}
