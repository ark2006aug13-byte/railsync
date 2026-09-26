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

export interface DestinationEta {
  stationCode: string;
  stationName: string;
  scheduledArrival: string;
  dynamicEta: string;
  netDelayMin: number;
  confidence?: ConfidenceBounds;
  waterfall?: WaterfallStep[];
  activeWarnings?: string[];
  tsrDelayMin?: number;
  platformHoldMin?: number;
  slackRecoveredMin?: number;
}

export interface TrainPredictionResponse {
  trainNo: string;
  trainName: string;
  currentKm: number;
  currentSpeedKmph: number;
  currentSection: string;
  signalAspect: string;
  headwayGapKm: number;
  destinationEta: DestinationEta;
  upcomingStations: DestinationEta[];
  telemetrySource?: string;
  deadReckonedKm?: number;
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
    try {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return { status: 'offline', service: 'RailSync API' };
    }
  },

  /**
   * Get List of Supported Trains
   */
  async getTrains(): Promise<TrainOverview[]> {
    try {
      const res = await fetch('/api/trains');
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('API getTrains fallback:', e);
    }
    return [
      {
        train_no: '12301',
        name: 'Howrah – New Delhi Rajdhani Express',
        type: 'Rajdhani Express',
        origin: 'HWH',
        destination: 'NDLS',
        total_distance_km: 1451,
        mps: 130,
        priority: 1,
      },
      {
        train_no: '12004',
        name: 'New Delhi – Lucknow Swarna Shatabdi Express',
        type: 'Shatabdi Express',
        origin: 'NDLS',
        destination: 'LKO',
        total_distance_km: 512,
        mps: 130,
        priority: 1,
      },
      {
        train_no: '22436',
        name: 'New Delhi – Varanasi Vande Bharat Express',
        type: 'Vande Bharat Express',
        origin: 'NDLS',
        destination: 'BSB',
        total_distance_km: 759,
        mps: 130,
        priority: 1,
      },
    ];
  },

  /**
   * Fetch Live Train State (from Database / Replay Engine)
   */
  async getTrainState(trainNo: string = '12301', runDate?: string, atTime?: string): Promise<TrainStateResponse | null> {
    try {
      let url = `/api/train/${encodeURIComponent(trainNo)}/state`;
      const params = new URLSearchParams();
      if (runDate) params.append('run_date', runDate);
      if (atTime) params.append('at', atTime);
      const qs = params.toString();
      if (qs) url += `?${qs}`;

      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('API getTrainState fallback:', e);
    }
    return null;
  },

  /**
   * Fetch Enhanced Neural ETA & Delay Waterfall Breakdown
   */
  async getEnhancedETA(trainNo: string = '12301'): Promise<EnhancedEtaResponse | null> {
    try {
      const res = await fetch(`/api/train/${encodeURIComponent(trainNo)}/enhanced-eta`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('API getEnhancedETA fallback:', e);
    }
    return null;
  },

  /**
   * Fetch Live Station Operations & Inflow Queue
   */
  async getInflow(station: string = 'NDLS'): Promise<InflowResponse | null> {
    try {
      const res = await fetch(`/api/operations/inflow?station=${encodeURIComponent(station)}`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('API getInflow fallback:', e);
    }
    return null;
  },

  /**
   * Resolve Platform Contention via 2-way RPC
   */
  async resolveConflict(trainNo: string, targetPlatform: string): Promise<boolean> {
    try {
      const res = await fetch('/api/operations/resolve-conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          train_no: trainNo,
          target_platform: targetPlatform,
        }),
      });
      if (res.ok) return true;
    } catch (e) {
      console.error('Resolve conflict error:', e);
    }
    return false;
  },

  /**
   * Fetch Live Incidents (Database Table)
   */
  async getLiveIncidents(trainNo: string = '12301'): Promise<any> {
    try {
      const res = await fetch(`/api/train/${encodeURIComponent(trainNo)}/live-incidents`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('API getLiveIncidents fallback:', e);
    }
    return { detected_incidents: [], reported_incidents: { incidents: [] }, total_incidents: 0 };
  },

  /**
   * Fetch RailRadar Live Map (2,400+ India-wide trains)
   */
  async getRailRadarLiveMap(): Promise<any[]> {
    try {
      const res = await fetch('/api/railradar/live-map');
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('API getRailRadarLiveMap fallback:', e);
    }
    return [];
  },

  /**
   * Predict and Analyze ANY Train by Number or Name dynamically from backend ML models
   */
  async predictTrain(query: string): Promise<TrainPredictionResponse | null> {
    try {
      const res = await fetch(`/api/train/predict?query=${encodeURIComponent(query)}`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('API predictTrain error:', e);
    }
    return null;
  },
};
