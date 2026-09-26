export type PageId = 'search' | 'live-arrival' | 'diagnostics' | 'platform-resolver';

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
