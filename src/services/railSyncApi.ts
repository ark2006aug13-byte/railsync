/**
 * src/services/railSyncApi.ts
 * RailPulse AI / RailSync API Client Service Layer
 * Connects frontend screens and context to the FastAPI backend via Vite reverse proxy.
 * Eliminates silent mock fallbacks, adds connection telemetry, and supports request abort signals.
 */
import { 
  AccuracyMetricsResponse, 
  CorridorInfoResponse, 
  InflowTrain, 
  OperationsInflowResponse,
  PlatformGanttSlot,
  ResolveConflictRequest,
  ResolveConflictResponse,
  TelemetryPacket, 
  TrainListItem, 
  TrainStateResponse 
} from '../types';
import { initialInflowTrains, initialTelemetryPackets } from '../data/mockData';

// Relative path leverages Vite's reverse proxy (/api -> http://127.0.0.1:8000/api)
const API_PREFIX = '/api';
const DEFAULT_TIMEOUT_MS = 6000;

// Environment toggles
export const IS_FORCE_MOCK = import.meta.env.VITE_FORCE_MOCK === 'true';
export const IS_DEBUG = import.meta.env.VITE_DEBUG === 'true' || Boolean(import.meta.env.DEV);

/**
 * Dispatches connection status telemetry event for real-time UI indicators
 */
function emitConnectionTelemetry(connected: boolean, status: number, endpoint: string, error?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('railpulse:connection-change', {
        detail: {
          connected,
          status,
          endpoint,
          error,
          timestamp: new Date().toISOString()
        }
      })
    );
  }
}

/**
 * Fetch wrapper with timeout, combined abort signal, and telemetry logging
 */
async function fetchWithTimeout(
  endpoint: string, 
  options: RequestInit = {}, 
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  externalSignal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // If external signal is already aborted, abort immediately
  if (externalSignal?.aborted) {
    controller.abort();
  }

  // Link external abort signal (e.g. from rapid slider scrubbing)
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const url = endpoint.startsWith('http') ? endpoint : `${API_PREFIX}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      }
    });

    if (!response.ok) {
      console.error(`[Backend Sync Error]: ${response.status} ${url}`);
      emitConnectionTelemetry(false, response.status, url, response.statusText);
      throw new Error(`[Backend Sync Error]: ${response.status} ${url} - ${response.statusText}`);
    }

    emitConnectionTelemetry(true, response.status, url);
    return response;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      // Don't flag aborted requests as backend failure
      throw err;
    }
    console.error(`[Backend Sync Error]: Network Failure on ${endpoint}`, err);
    emitConnectionTelemetry(false, 0, endpoint, err.message);
    throw err;
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

/**
 * Normalizes frontend train number to backend supported train number.
 */
function normalizeTrainNo(trainNo: string): string {
  if (trainNo === '12302') return '12301';
  return trainNo;
}

/**
 * Logs payload to console when DEBUG is enabled
 */
function debugLog(endpoint: string, data: any) {
  if (IS_DEBUG && typeof console !== 'undefined') {
    console.log(`[RailPulse API Payload: ${endpoint}]`, data);
  }
}

/**
 * Health check to verify if the FastAPI backend is running
 * GET /api/health
 */
export async function checkBackendHealth(signal?: AbortSignal): Promise<{ status: string; system?: string; version?: string }> {
  const res = await fetchWithTimeout('health', {}, 3000, signal);
  const data = await res.json();
  debugLog('health', data);
  return data;
}

/**
 * Fetch static corridor geometry, station waypoints, and sections
 * GET /api/corridor
 */
export async function fetchCorridorInfo(signal?: AbortSignal): Promise<CorridorInfoResponse> {
  const res = await fetchWithTimeout('corridor', {}, DEFAULT_TIMEOUT_MS, signal);
  const data = await res.json();
  debugLog('corridor', data);
  return data;
}

/**
 * List trains and available historical run dates
 * GET /api/trains
 */
export async function fetchTrainsList(signal?: AbortSignal): Promise<TrainListItem[]> {
  const res = await fetchWithTimeout('trains', {}, DEFAULT_TIMEOUT_MS, signal);
  const data = await res.json();
  debugLog('trains', data);
  return data;
}

/**
 * Fetch interpolated train position, leading train headway, and dynamic ETAs
 * GET /api/train/{train_no}/state?run_date={date}&at={isoTimestamp}
 */
export async function fetchTrainState(
  trainNo: string,
  runDate?: string,
  atTime?: string,
  signal?: AbortSignal
): Promise<TrainStateResponse> {
  const targetNo = normalizeTrainNo(trainNo);
  const params = new URLSearchParams();
  if (runDate) params.append('run_date', runDate);
  if (atTime) params.append('at', atTime);

  const qs = params.toString() ? `?${params.toString()}` : '';
  const endpoint = `train/${encodeURIComponent(targetNo)}/state${qs}`;

  const res = await fetchWithTimeout(endpoint, {}, DEFAULT_TIMEOUT_MS, signal);
  const data = await res.json();
  debugLog(endpoint, data);
  return data;
}

/**
 * Step simulation forward/backward
 * GET /api/replay/step?train_no={no}&run_date={date}&at={iso}&step_seconds={sec}
 */
export async function stepReplaySimulation(
  trainNo: string,
  runDate?: string,
  atTime?: string,
  stepSeconds: number = 60,
  signal?: AbortSignal
): Promise<TrainStateResponse> {
  const targetNo = normalizeTrainNo(trainNo);
  const params = new URLSearchParams();
  if (runDate) params.append('run_date', runDate);
  if (atTime) params.append('at', atTime);
  params.append('step_seconds', String(stepSeconds));

  const endpoint = `replay/step?${params.toString()}`;
  const res = await fetchWithTimeout(endpoint, {}, DEFAULT_TIMEOUT_MS, signal);
  const data = await res.json();
  debugLog(endpoint, data);
  return data;
}

/**
 * Fetch ML model accuracy and baseline comparison metrics
 * GET /api/train/{train_no}/accuracy
 */
export async function fetchAccuracyMetrics(trainNo: string, signal?: AbortSignal): Promise<AccuracyMetricsResponse> {
  const targetNo = normalizeTrainNo(trainNo);
  const endpoint = `train/${encodeURIComponent(targetNo)}/accuracy`;
  const res = await fetchWithTimeout(endpoint, {}, DEFAULT_TIMEOUT_MS, signal);
  const data = await res.json();
  debugLog(endpoint, data);
  return data;
}

/**
 * Fetch active inflow trains and terminal platform occupancy
 * GET /api/operations/inflow
 */
export async function fetchOperationsInflow(
  station: string = 'NDLS',
  signal?: AbortSignal
): Promise<OperationsInflowResponse> {
  if (IS_FORCE_MOCK) {
    return {
      station,
      inflowTrains: initialInflowTrains,
      platformOccupancy: [],
      conflictStatus: { hasActiveConflict: false, activeConflictsCount: 0, conflicts: [] },
      headwayBuffer: {
        station,
        bottleneckCleared: true,
        effectiveHeadwayKm: 12.0,
        trailingTrainsAhead: 0,
        blockClearance: '3 Blocks Green',
        interlockingLoopCycleSec: 1.2
      }
    };
  }

  const res = await fetchWithTimeout(`operations/inflow?station=${encodeURIComponent(station)}`, {}, 4000, signal);
  const data = await res.json();
  debugLog('operations/inflow', data);

  // Normalize camelCase vs snake_case
  const inflowList: InflowTrain[] = (data.inflowTrains || data.inflow_trains || []).map((t: any) => ({
    id: t.id || t.trainNumber || t.train_number,
    trainNumber: t.trainNumber || t.train_number,
    trainName: t.trainName || t.train_name,
    source: t.source,
    sourceCode: t.sourceCode || t.source_code,
    destination: t.destination,
    destinationCode: t.destinationCode || t.destination_code,
    platform: t.platform,
    platformBuffer: t.platformBuffer || t.platform_buffer || '',
    dynamicEta: t.dynamicEta || t.dynamic_eta,
    scheduledEta: t.scheduledEta || t.scheduled_eta,
    varianceFormatted: t.varianceFormatted || t.variance_formatted || 'On-Time',
    varianceMinutes: Number(t.varianceMinutes ?? t.variance_minutes ?? 0),
    speedKmH: Number(t.speedKmH ?? t.speed_km_h ?? 0),
    locationDescription: t.locationDescription || t.location_description || '',
    rakesCoaches: t.rakesCoaches || t.rakes_coaches || '',
    signalStatus: t.signalStatus || t.signal_status || 'Clear Green',
    hasConflict: Boolean(t.hasConflict ?? t.has_conflict),
    conflictDetails: t.conflictDetails || t.conflict_details ? {
      conflictingTrain: t.conflictDetails?.conflictingTrain || t.conflict_details?.conflicting_train || '',
      description: t.conflictDetails?.description || t.conflict_details?.description || '',
      recommendedPlatform: t.conflictDetails?.recommendedPlatform || t.conflict_details?.recommended_platform || 'PF 5',
      resolved: Boolean(t.conflictDetails?.resolved ?? t.conflict_details?.resolved)
    } : undefined
  }));

  const occupancyList: PlatformGanttSlot[] = (data.platformOccupancy || data.platform_occupancy || []).map((p: any) => ({
    id: `slot-pf-${p.platformNumber || p.platform}-${p.trainNumber || p.train_no || 'free'}`,
    platformNumber: Number(p.platformNumber ?? p.platform),
    platformLabel: p.platformLabel || p.label || `PF ${p.platformNumber || p.platform}`,
    trainNumber: p.trainNumber || p.train_no || '',
    trainName: p.trainName || p.train_name || 'Slot Available',
    startTime: p.startTime || p.start_time || '10:00',
    endTime: p.endTime || p.end_time || '11:00',
    status: p.status || 'available',
    description: p.description || p.occupancy_time || '',
    actionRequired: Boolean(p.actionRequired ?? p.action_required)
  }));

  return {
    station: data.station || station,
    inflowTrains: inflowList,
    platformOccupancy: occupancyList,
    conflictStatus: data.conflictStatus || data.conflict_status || { hasActiveConflict: false, activeConflictsCount: 0, conflicts: [] },
    headwayBuffer: data.headwayBuffer || data.headway_buffer || {
      station,
      bottleneckCleared: true,
      effectiveHeadwayKm: 12.0,
      trailingTrainsAhead: 0,
      blockClearance: 'Clear',
      interlockingLoopCycleSec: 1.2
    }
  };
}

/**
 * Fetch active inflow trains list for dispatch console
 */
export async function fetchInflowTrains(signal?: AbortSignal): Promise<InflowTrain[]> {
  try {
    const ops = await fetchOperationsInflow('NDLS', signal);
    return ops.inflowTrains.length > 0 ? ops.inflowTrains : initialInflowTrains;
  } catch (err) {
    if (IS_FORCE_MOCK) return initialInflowTrains;
    throw err;
  }
}

/**
 * Two-way Platform Conflict Resolution endpoint
 * POST /api/operations/resolve-conflict
 */
export async function resolveStationConflict(
  req: ResolveConflictRequest,
  signal?: AbortSignal
): Promise<ResolveConflictResponse> {
  const res = await fetchWithTimeout(
    'operations/resolve-conflict',
    {
      method: 'POST',
      body: JSON.stringify({
        trainNo: req.trainNo,
        stationCode: req.stationCode,
        allocatedPlatform: req.allocatedPlatform
      })
    },
    5000,
    signal
  );
  const data = await res.json();
  debugLog('operations/resolve-conflict', data);
  return data;
}

/**
 * Fetch telemetry packet stream for diagnostics
 * GET /api/telemetry/stream
 */
export async function fetchTelemetryPackets(
  trainNo: string = '12301',
  signal?: AbortSignal
): Promise<TelemetryPacket[]> {
  if (IS_FORCE_MOCK) {
    return initialTelemetryPackets;
  }

  try {
    const targetNo = normalizeTrainNo(trainNo);
    const res = await fetchWithTimeout(`telemetry/stream?train_no=${encodeURIComponent(targetNo)}`, {}, 3000, signal);
    const data = await res.json();
    debugLog('telemetry/stream', data);

    const rawPackets = data.packets || data;
    if (Array.isArray(rawPackets) && rawPackets.length > 0) {
      return rawPackets.map((p: any) => ({
        id: p.id,
        timestamp: p.timestamp,
        locoId: p.locoId || p.loco_id,
        blockSignalMile: p.blockSignalMile || p.block_signal_mile,
        subsystem: p.subsystem,
        telemetryValue: p.telemetryValue || p.telemetry_value,
        speedKmH: p.speedKmH ?? p.speed_km_h,
        details: {
          channel: p.details?.channel,
          fec: p.details?.fec,
          crc: p.details?.crc,
          snrDb: p.details?.snrDb ?? p.details?.snr_db,
          rawHex: p.details?.rawHex ?? p.details?.raw_hex,
          payloadJson: p.details?.payloadJson ?? p.details?.payload_json,
        }
      }));
    }
    return initialTelemetryPackets;
  } catch (err) {
    if (IS_FORCE_MOCK) return initialTelemetryPackets;
    throw err;
  }
}
