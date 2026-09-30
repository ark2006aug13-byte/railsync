/**
 * RailSync API Client Layer
 * Connects frontend directly to FastAPI backend and SQLite database endpoints.
 */

export interface TrainOverview {
  trainNo?: string;
  train_no?: string;
  name: string;
  type: string;
  origin: string;
  destination: string;
  totalDistanceKm?: number;
  total_distance_km?: number;
  mps?: number;
  priority?: number;
  stationsCount?: number;
  availableDates?: string[];
  defaultDate?: string;
}

export interface TrainStatePosition {
  lat: number;
  lng: number;
  km: number;
  speedKmph?: number;
  speed_kmph?: number;
  delayMin?: number;
  delay_min?: number;
  currentSection?: string;
  current_section?: string;
  sectionId?: string;
  section_id?: string;
  currentMps?: number;
  current_mps?: number;
  ts?: string;
  status?: string;
}

export interface LeadingTrainState {
  trainNo?: string;
  train_no?: string;
  name: string;
  km: number;
  lat?: number;
  lng?: number;
  speedKmph?: number;
  speed_kmph?: number;
  delayMin?: number;
  delay_min?: number;
  headwayGapKm?: number;
  headway_gap_km?: number;
}

export interface SignalAspect {
  code: string;
  name?: string;
  badge: string;
  color: string;
  speedCap?: string;
  speed_cap?: number | string;
  headwayGapKm?: number;
  headway_gap_km?: number;
}

export interface StationStop {
  code: string;
  name: string;
  km: number;
  platform: string | number;
  scheduled_arrival?: string;
  scheduled_departure?: string;
  etaPredicted?: string;
  eta_predicted?: string;
  etaPredictedFmt?: string;
  eta_predicted_fmt?: string;
  etaSchedule?: string;
  eta_schedule?: string;
  etaScheduleFmt?: string;
  eta_schedule_fmt?: string;
  predictedDelayMin?: number;
  predicted_delay_min?: number;
  delayInjectedMin?: number;
  delay_injected_min?: number;
  timeDeletionMin?: number;
  time_deletion_min?: number;
  platformConflict?: boolean;
  platform_conflict?: boolean;
  outerHoldingMin?: number;
  outer_holding_min?: number;
  conflictingTrain?: string | null;
  conflicting_train?: string | null;
  why?: string;
  weatherCondition?: string;
  weather_condition?: string;
  signalStatus?: string;
  signal_status?: string;
  status?: string;
}

export interface TrainStateResponse {
  trainNo?: string;
  train_no?: string;
  trainName?: string;
  train_name?: string;
  runDate?: string;
  run_date?: string;
  simulatedTime?: string;
  simulated_time?: string;
  simulatedTimeFmt?: string;
  simulated_time_fmt?: string;
  minTime?: string;
  min_time?: string;
  maxTime?: string;
  max_time?: string;
  position: TrainStatePosition;
  activeSection?: {
    sectionId?: string;
    section_id?: string;
    from_stn?: string;
    to_stn?: string;
    length_km?: number;
    mps?: number;
  };
  active_section?: {
    section_id?: string;
    from_stn?: string;
    to_stn?: string;
    length_km?: number;
    mps?: number;
  };
  leadingTrain?: LeadingTrainState;
  leading_train?: LeadingTrainState;
  signalAspect?: SignalAspect;
  signal_aspect?: SignalAspect;
  upcomingStations?: StationStop[];
  upcoming_stations?: StationStop[];
  passedStations?: StationStop[];
  passed_stations?: StationStop[];
  isComplete?: boolean;
  is_complete?: boolean;
  lastUpdated?: string;
  last_updated?: string;
}

export interface WaterfallStep {
  label: string;
  impactMin: number;
  category: string;
  description: string;
}

export interface ConfidenceBounds {
  p10Time: string;
  p50Time: string;
  p90Time: string;
  confidencePercentage: number;
}

export interface IntermediateStation {
  stationCode: string;
  stationName: string;
  distanceKm: number;
  scheduledTime?: string;
  dynamicTime?: string;
  status?: string;
  speedKmph?: number;
  delayMin?: number;
  lat?: number;
  lng?: number;
}

export interface DestinationEta {
  stationCode: string;
  stationName: string;
  scheduledArrival: string;
  scheduledArrivalFmt?: string;
  dynamicEta: string;
  dynamicEtaFmt?: string;
  netDelayMin: number;
  confidence?: ConfidenceBounds;
  waterfall?: WaterfallStep[];
  activeWarnings?: string[];
  tsrDelayMin?: number;
  platformHoldMin?: number;
  slackRecoveredMin?: number;
  platform?: string | number;
  distanceKm?: number;
  status?: string;
  scheduledDeparture?: string;
  scheduledDepartureFmt?: string;
  haltMin?: number;
  intermediateStations?: IntermediateStation[];
  lat?: number;
  lng?: number;
}

export interface TrainPredictionResponse {
  trainNo: string;
  trainName: string;
  status?: string;
  trainType?: string;
  origin?: string;
  originName?: string;
  destination?: string;
  destinationName?: string;
  scheduledDeparture?: string;
  scheduledDepartureFmt?: string;
  scheduledArrival?: string;
  scheduledArrivalFmt?: string;
  totalDistanceKm?: number;
  mps?: number;
  currentKm: number;
  currentSpeedKmph: number;
  currentSection: string;
  currentStation?: string;
  currentDelayMin?: number;
  signalAspect: string;
  headwayGapKm: number;
  destinationEta: DestinationEta;
  upcomingStations: DestinationEta[];
  allStations?: DestinationEta[];
  telemetrySource?: string;
  deadReckonedKm?: number;
  exactLocationText?: string;
  currentLat?: number;
  currentLng?: number;
  bearing?: number;
  isLiveGround?: boolean;
  trackPath?: [number, number][];
  nearestStation?: string;
  nextStation?: string;
  nextStationDistanceKm?: number;
  leadingTrain?: LeadingTrainState;
  weatherCondition?: string;
  signalStatus?: string;
}


export interface InflowTrain {
  id?: string;
  train_id?: string;
  trainNumber?: string;
  train_no?: string;
  trainName?: string;
  train_name?: string;
  assigned_platform?: string;
  platform?: string;
  target_platform?: string;
  eta_minutes?: number;
  varianceMinutes?: number;
  conflict?: boolean;
  hasConflict?: boolean;
  priority_tier?: number;
  lead_train_id?: string;
  status?: string;
}

export interface PlatformOccupancy {
  platform: string;
  occupied: boolean;
  train_no?: string;
  train_name?: string;
  scheduled_departure?: string;
}

export interface InflowResponse {
  timestamp?: string;
  station: string;
  inflow_queue?: InflowTrain[];
  inflowTrains?: InflowTrain[];
  platform_occupancy?: Record<string, PlatformOccupancy>;
  platformOccupancy?: Record<string, PlatformOccupancy>;
  conflict_count?: number;
  headway_buffer_min?: number;
}

export interface EnhancedEtaResponse {
  train_number: string;
  timestamp: string;
  current_section: string;
  eta_predictions: {
    p10_early_min: number;
    p50_expected_min: number;
    p90_worst_case_min: number;
    confidence_interval_min: number;
  };
  delay_factors: {
    weather_delay_min: number;
    signal_delay_min: number;
    throat_delay_min: number;
    slack_recovery_min: number;
    net_delay_min: number;
  };
}

export const api = {
  /**
   * Health Check
   */
  async checkHealth(): Promise<{ status: string; service: string }> {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error(`Health check failed: HTTP ${res.status}`);
    return await res.json();
  },

  /**
   * Get List of Supported Trains directly from backend API / Database
   */
  async getTrains(): Promise<TrainOverview[]> {
    const res = await fetch('/api/trains');
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || `Failed to fetch trains list: HTTP ${res.status}`);
    }
    return await res.json();
  },

  /**
   * Fetch Live Train State (from Database / Replay Engine)
   */
  async getTrainState(trainNo: string, runDate?: string, atTime?: string): Promise<TrainStateResponse> {
    if (!trainNo) {
      throw new Error('trainNo is required to fetch train state');
    }
    let url = `/api/train/${encodeURIComponent(trainNo)}/state`;
    const params = new URLSearchParams();
    if (runDate) params.append('run_date', runDate);
    if (atTime) params.append('at', atTime);
    const qs = params.toString();
    if (qs) url += `?${qs}`;

    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || `Failed to fetch live train state for ${trainNo} (HTTP ${res.status})`);
    }
    return await res.json();
  },

  /**
   * Fetch Enhanced Neural ETA & Delay Waterfall Breakdown
   */
  async getEnhancedETA(trainNo: string): Promise<EnhancedEtaResponse> {
    if (!trainNo) {
      throw new Error('trainNo is required to fetch enhanced ETA');
    }
    const res = await fetch(`/api/train/${encodeURIComponent(trainNo)}/enhanced-eta`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || `Failed to fetch enhanced ETA for ${trainNo} (HTTP ${res.status})`);
    }
    return await res.json();
  },

  /**
   * Fetch Live Station Operations & Inflow Queue
   */
  async getInflow(station: string = 'NDLS'): Promise<InflowResponse> {
    const res = await fetch(`/api/operations/inflow?station=${encodeURIComponent(station)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || `Failed to fetch operations inflow for ${station} (HTTP ${res.status})`);
    }
    return await res.json();
  },

  /**
   * Resolve Platform Contention via 2-way RPC
   */
  async resolveConflict(trainNo: string, targetPlatform: string, stationCode: string = 'NDLS'): Promise<boolean> {
    const pfNum = parseInt(targetPlatform.replace(/\D/g, ''), 10) || 16;
    const res = await fetch('/api/operations/resolve-conflict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        train_no: trainNo,
        station_code: stationCode,
        allocated_platform: pfNum,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || `Failed to resolve conflict for train ${trainNo}`);
    }
    return true;
  },

  /**
   * Fetch Live Incidents (Database Table)
   */
  async getLiveIncidents(trainNo: string): Promise<any> {
    if (!trainNo) {
      throw new Error('trainNo is required to fetch live incidents');
    }
    const res = await fetch(`/api/train/${encodeURIComponent(trainNo)}/live-incidents`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || `Failed to fetch live incidents for ${trainNo}`);
    }
    return await res.json();
  },

  /**
   * Fetch RailRadar Live Map (2,400+ India-wide trains)
   */
  async getRailRadarLiveMap(): Promise<any[]> {
    const res = await fetch('/api/railradar/live-map');
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || 'Failed to fetch RailRadar live map');
    }
    return await res.json();
  },

  /**
   * Predict and Analyze ANY Train by Number or Name dynamically from backend ML models
   */
  async predictTrain(query: string, runDate?: string, apiKey?: string): Promise<TrainPredictionResponse> {
    if (!query) {
      throw new Error('Search query is required');
    }
    const resolvedKey = apiKey || (typeof window !== 'undefined' ? localStorage.getItem('indian_rail_api_key') : null);
    let url = `/api/train/predict?query=${encodeURIComponent(query)}`;
    if (runDate) {
      url += `&run_date=${encodeURIComponent(runDate)}`;
    }
    if (resolvedKey) {
      url += `&api_key=${encodeURIComponent(resolvedKey)}`;
    }
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail || `Failed to predict train for query "${query}" (HTTP ${res.status})`);
    }
    return await res.json();
  },

  async getTrainPredict(query: string, runDate?: string, apiKey?: string): Promise<TrainPredictionResponse> {
    return this.predictTrain(query, runDate, apiKey);
  },

  /**
   * Fetch Static Corridor Waypoints & Stations
   */
  async getCorridor(): Promise<any> {
    const res = await fetch('/api/corridor');
    if (!res.ok) {
      throw new Error(`Failed to fetch corridor data: HTTP ${res.status}`);
    }
    return await res.json();
  },
};
