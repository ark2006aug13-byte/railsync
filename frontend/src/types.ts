export type PageId = 'radar' | 'search' | 'live-arrival' | 'diagnostics' | 'platform-resolver' | 'eta-predictor';

export type SignalAspect = 'GREEN' | 'DOUBLE_YELLOW' | 'YELLOW' | 'RED';
export type LocoCategory = 'VB' | 'RAJ' | 'SHT' | 'FRT' | 'EMU' | 'SF' | 'EXP';

export interface SlackRecoveryInfo {
  delayed_mins: number;
  recoverable_mins: number;
  net_delay: number;
  corridor: string;
  message: string;
}

export interface RadarTrain {
  id: string;
  no: string;
  name: string;
  cat: LocoCategory;
  loco: string;
  livery: string;
  lat: number;
  lng: number;
  nlat: number;
  nlng: number;
  brg: number;
  spd: number;
  delay_m: number;
  stn: string;
  nstn: string;
  signal: SignalAspect;
  headway_km: number;
  headway_msg: string;
  slack_rec: SlackRecoveryInfo;
  dep_m?: number;
}

export interface Chokepoint {
  code: string;
  name: string;
  lat: number;
  lng: number;
  desc: string;
  active_trains_count: number;
  slow_halted_count: number;
  status: string;
  color: string;
  score: number;
}

export interface FidsArrivalItem {
  no: string;
  name: string;
  cat: LocoCategory;
  loco: string;
  livery: string;
  from: string;
  to: string;
  distance_km: number;
  speed: number;
  platform: number;
  eta_mins: number;
  expected_time: string;
  delay_mins: number;
  status: string;
  signal: SignalAspect;
}

export interface PlatformOccupancyMap {
  [pfNumber: number]: {
    train_no: string;
    train_name: string;
    cat: LocoCategory;
    status: string;
  };
}

export interface StationLiveBoard {
  station_code: string;
  station_name: string;
  lat: number;
  lng: number;
  total_platforms: number;
  active_incoming_count: number;
  arrivals: FidsArrivalItem[];
  platform_occupancy: PlatformOccupancyMap;
}

export interface RadarStats {
  active_trains: number;
  avg_speed: number;
  on_time_pct: number;
  signals: {
    green: number;
    double_yellow: number;
    yellow: number;
    red: number;
  };
  last_updated: number;
}

export interface TrainData {
  id: string;
  number: string;
  name: string;
  type: string;
  corridor: string;
  origin: string;
  originCode: string;
  destination: string;
  destinationCode: string;
  routeVia: string;
  scheduledArrival: string;
  normalPredictedArrival: string;
  optimizedArrival: string;
  currentSpeed: string;
  nextStop: string;
  nextStopEta: string;
  routeProgress: number;
  totalDelayMins: number;
  recoveredMins: number;
  netDelayMins: number;
  optimizedNetDelayMins: number;
}

export interface DelayBreakdown {
  ground_delay_min: number;
  weather_fog_delay_min: number;
  signal_headway_delay_min: number;
  throat_delay_min: number;
  platform_holding_delay_min: number;
  dwell_extension_delay_min: number;
  incident_delay_min: number;
  bounded_recovery_min: number;
  net_projected_delay_min: number;
}

export interface DelayFactorLedgerItem {
  factor_id: string;
  prediction_id: string;
  factor_type: string;
  minutes: number;
  source: string;
  confidence: number;
  applied_to_segment?: string;
  applied_to_station?: string;
  overlap_group: string;
  reason_text: string;
  valid_from_ist: string;
  valid_to_ist: string;
}

export interface UpcomingStationPrediction {
  sequence: number;
  station_code: string;
  station_name: string;
  km: number;
  platform: string;
  scheduled_arrival_ist: string;
  scheduled_departure_ist: string;
  eta_p10_ist: string;
  eta_p50_ist: string;
  eta_p90_ist: string;
  projected_delay_min: number;
  confidence_score: number;
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  uncertainty_window_min: number;
  delay_breakdown: DelayBreakdown;
  explainability_text: string;
  is_manual_override: boolean;
  platform_conflict: boolean;
  double_count_validation: {
    status: string;
    issues: string[];
  };
  factor_ledger: DelayFactorLedgerItem[];
}

export interface DynamicETAResponse {
  meta: {
    train_number: string;
    train_name: string;
    train_type: string;
    origin_station: string;
    destination_station: string;
    run_date: string;
    evaluated_at_ist: string;
    timezone: string;
    disclaimer: string;
  };
  live_status: {
    current_km: number;
    current_speed_kmph: number;
    max_permitted_speed_kmph: number;
    current_delay_minutes: number;
    current_section: string;
    signal_aspect: string;
    headway_gap_km: number;
    telemetry_source: string;
    data_staleness_seconds: number;
    is_stale: boolean;
    run_lifecycle: string;
  };
  passed_stations: any[];
  upcoming_stations: UpcomingStationPrediction[];
  system_health: {
    double_count_integrity: string;
    recovery_engine_status: string;
    early_arrival_policy: string;
    active_incidents_count: number;
  };
}
