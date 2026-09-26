import { 
  TrainOverview, 
  RouteStation, 
  InflowTrain, 
  PlatformGanttSlot, 
  TelemetryPacket, 
  TurnaroundRosterItem 
} from '../types';

export const rajdhani12302: TrainOverview = {
  trainNumber: '12302',
  trainName: 'Kolkata Rajdhani Express',
  type: 'Superfast Special Rake',
  source: 'Howrah Jn',
  sourceCode: 'HWH',
  destination: 'New Delhi',
  destinationCode: 'NDLS',
  rakeType: '22 Coaches (LHB Rake)',
  locoNumber: '#30214 (SRC)',
  locoClass: 'WAP-7',
  schedule: 'Daily Schedule',
  scheduledArrival: '09:55 AM',
  predictedArrival: '10:15 AM',
  delayMinutes: 20,
  delayStatus: 'slight-delay',
  confidencePercent: 95,
  currentSpeed: 118,
  mps: 130,
  nextStation: 'Kanpur Central',
  nextStationCode: 'CNB',
  distanceToNextStationKm: 48,
  timeRemainingMinutes: 38,
  assignedPlatform: 'PF 1',
  platformDetail: 'Direct FOB Access • Escalator (CNB Div Control Telemetry)',
  sectionSignal: 'Green Corridor (Auto)',
  loopCongestionHeadwayKm: 8.4,
  navicSatLockCount: 4,
  rakeComposition: ['EOG', 'H1', 'A1', 'A2', 'A3', 'PC', 'B1', 'B2', 'B3', 'B4', 'B5', 'EOG']
};

export const vandeBharat22436: TrainOverview = {
  trainNumber: '22436',
  trainName: 'Vande Bharat Express',
  type: 'Semi-High Speed',
  source: 'Varanasi Jn',
  sourceCode: 'BSB',
  destination: 'New Delhi',
  destinationCode: 'NDLS',
  rakeType: 'WAP-5 Twin V-16',
  locoNumber: '#31940',
  locoClass: 'Train-18 EMU V-16',
  schedule: 'Mon, Tue, Thu, Fri, Sat, Sun',
  scheduledArrival: '13:51 hrs',
  predictedArrival: '13:42 hrs',
  delayMinutes: -9,
  delayStatus: 'on-time',
  confidencePercent: 98.4,
  currentSpeed: 128,
  mps: 130,
  nextStation: 'New Delhi',
  nextStationCode: 'NDLS',
  distanceToNextStationKm: 142,
  timeRemainingMinutes: 68,
  assignedPlatform: 'PF 16 (NDLS)',
  platformDetail: 'Ajmeri Gate Side Entry • Escalator Direct',
  sectionSignal: 'Green Signal #84',
  loopCongestionHeadwayKm: 12.4,
  navicSatLockCount: 7,
  rakeComposition: ['DTC-1', 'NDTC-1', 'MC-1', 'TC-1', 'MC-2', 'TC-2', 'NDTC-2', 'EC-1', 'DTC-2']
};

export const rajdhani12302Route: RouteStation[] = [
  {
    stationCode: 'DDU',
    stationName: 'Pt. Deen Dayal Upadhyaya Jn',
    platform: 'PF 2',
    scheduledTime: '06:05 AM',
    aiForecastTime: '06:30 AM',
    status: 'passed',
    departureTime: '06:30 AM',
    delayFormatted: '+25m'
  },
  {
    stationCode: 'PRYJ',
    stationName: 'Prayagraj Jn',
    platform: 'PF 1',
    scheduledTime: '07:55 AM',
    aiForecastTime: '08:15 AM',
    status: 'passed',
    departureTime: '08:15 AM',
    delayFormatted: '+20m'
  },
  {
    stationCode: 'CNB',
    stationName: 'Kanpur Central',
    platform: 'PF 1',
    scheduledTime: '10:45 AM',
    aiForecastTime: '11:05 AM',
    status: 'upcoming',
    delayFormatted: '+20m',
    notes: 'Est. Halt Duration: 5 minutes (Crew change & check)'
  },
  {
    stationCode: 'ALJN',
    stationName: 'Aligarh Jn',
    platform: 'PF 3',
    scheduledTime: '14:20 PM',
    aiForecastTime: '14:32 PM',
    status: 'upcoming',
    delayFormatted: '+12m (Recovers 8 mins)'
  },
  {
    stationCode: 'NDLS',
    stationName: 'New Delhi',
    platform: 'PF 1',
    scheduledTime: '16:50 PM',
    aiForecastTime: '17:02 PM',
    status: 'upcoming',
    delayFormatted: '+12m net delay',
    isTerminal: true
  }
];

export const initialInflowTrains: InflowTrain[] = [
  {
    id: '12302',
    trainNumber: '12302',
    trainName: 'Kolkata Rajdhani Express',
    source: 'Howrah',
    sourceCode: 'HWH',
    destination: 'New Delhi',
    destinationCode: 'NDLS',
    platform: 'PF 1',
    platformBuffer: 'FOB / Escalator',
    dynamicEta: '10:15 AM',
    scheduledEta: '09:55 AM',
    varianceFormatted: '+20m',
    varianceMinutes: 20,
    speedKmH: 118,
    locationDescription: 'Shivaji Bridge Outer',
    rakesCoaches: '22 LHB',
    signalStatus: 'Cascaded Green'
  },
  {
    id: '12004',
    trainNumber: '12004',
    trainName: 'Lucknow Swarna Shatabdi',
    source: 'Lucknow',
    sourceCode: 'LKO',
    destination: 'New Delhi',
    destinationCode: 'NDLS',
    platform: 'PF 2',
    platformBuffer: 'Buffer: 16m',
    dynamicEta: '10:22 AM',
    scheduledEta: '10:20 AM',
    varianceFormatted: '+2m',
    varianceMinutes: 2,
    speedKmH: 95,
    locationDescription: 'Tilak Bridge Line 3',
    rakesCoaches: '18 LHB • Loco: WAP-7 #30481',
    signalStatus: 'Clear Approach'
  },
  {
    id: '12424',
    trainNumber: '12424',
    trainName: 'Dibrugarh Rajdhani',
    source: 'Dibrugarh',
    sourceCode: 'DBRT',
    destination: 'New Delhi',
    destinationCode: 'NDLS',
    platform: 'PF 3 (Locked)',
    platformBuffer: '13m Overlap',
    dynamicEta: '10:35 AM',
    scheduledEta: '10:30 AM',
    varianceFormatted: '+5m',
    varianceMinutes: 5,
    speedKmH: 82,
    locationDescription: 'Yamuna River Bridge Outer',
    rakesCoaches: '22 LHB',
    signalStatus: 'Yellow Inflow Block',
    hasConflict: true,
    conflictDetails: {
      conflictingTrain: 'Train 14056 Brahmaputra Mail',
      description: 'Train 14056 occupies PF 3 until 10:48 AM due to delayed rake shunting. 12424 arrival at 10:35 AM incurs a 13m outer-signal halt at Yamuna Bridge.',
      recommendedPlatform: 'PF 5',
      resolved: false
    }
  },
  {
    id: '22436',
    trainNumber: '22436',
    trainName: 'Vande Bharat Express',
    source: 'Varanasi',
    sourceCode: 'BSB',
    destination: 'New Delhi',
    destinationCode: 'NDLS',
    platform: 'PF 16',
    platformBuffer: 'Paharganj Dedicated',
    dynamicEta: '10:45 AM',
    scheduledEta: '10:45 AM',
    varianceFormatted: 'On-Time',
    varianceMinutes: 0,
    speedKmH: 130,
    locationDescription: 'Sahibabad Crossover',
    rakesCoaches: '16 VB Trainset',
    signalStatus: 'High-Speed Green'
  },
  {
    id: '12952',
    trainNumber: '12952',
    trainName: 'Mumbai Rajdhani Express',
    source: 'Mumbai Central',
    sourceCode: 'MMCT',
    destination: 'New Delhi',
    destinationCode: 'NDLS',
    platform: 'PF 4',
    platformBuffer: 'Ajmeri Gate Entry',
    dynamicEta: '11:05 AM',
    scheduledEta: '10:50 AM',
    varianceFormatted: '+15m',
    varianceMinutes: 15,
    speedKmH: 104,
    locationDescription: 'Overtake at Okhla Corridor',
    rakesCoaches: '22 LHB Tejas',
    signalStatus: 'Double Yellow'
  }
];

export const initialGanttSchedule: PlatformGanttSlot[] = [
  { id: 'g-1', platformNumber: 1, platformLabel: 'PF 01', trainNumber: '12302', trainName: 'Kolkata Rajdhani', startTime: '10:15', endTime: '11:00', status: 'occupied', description: 'Pit Clean Scheduled' },
  { id: 'g-1b', platformNumber: 1, platformLabel: 'PF 01', trainNumber: '12015', trainName: 'Ajmer Shatabdi', startTime: '11:45', endTime: '12:55', status: 'departure-ready', description: 'Catering Complete' },
  { id: 'g-2', platformNumber: 2, platformLabel: 'PF 02', trainNumber: '12004', trainName: 'Swarna Shtb', startTime: '10:22', endTime: '11:15', status: 'occupied', description: 'Inbound Passenger Flow' },
  { id: 'g-2b', platformNumber: 2, platformLabel: 'PF 02', trainNumber: '12443', trainName: 'ANVT Express', startTime: '12:10', endTime: '13:00', status: 'inflow', description: 'Approaching Sahibabad' },
  { id: 'g-3a', platformNumber: 3, platformLabel: 'PF 03', trainNumber: '14056', trainName: 'Brahmaputra Mail', startTime: '09:40', endTime: '11:15', status: 'conflict', description: 'Delayed Departure Est 11:15' },
  { id: 'g-3b', platformNumber: 3, platformLabel: 'PF 03', trainNumber: '12424', trainName: 'Dibrugarh Rajdhani', startTime: '10:35', endTime: '11:35', status: 'conflict', description: 'OVERLAP CONFLICT: Berth Clashing' },
  { id: 'g-4', platformNumber: 4, platformLabel: 'PF 04', trainNumber: '12616', trainName: 'GT Express', startTime: '09:15', endTime: '10:45', status: 'departure-ready', description: 'Dep Ready' },
  { id: 'g-4b', platformNumber: 4, platformLabel: 'PF 04', trainNumber: '12952', trainName: 'Mumbai Rajdhani', startTime: '11:05', endTime: '12:20', status: 'inflow', description: 'Overtake Clear' },
  { id: 'g-5', platformNumber: 5, platformLabel: 'PF 05', trainNumber: 'AI Slot', trainName: 'AI Slot Available', startTime: '10:00', endTime: '11:30', status: 'available', description: '45m Headway Window (Ready for 14056 or 12424)' },
  { id: 'g-6', platformNumber: 6, platformLabel: 'PF 06', trainNumber: '12260', trainName: 'Sealdah Duronto', startTime: '10:10', endTime: '11:20', status: 'occupied', description: 'Watering In Progress' },
  { id: 'g-7', platformNumber: 7, platformLabel: 'PF 07', trainNumber: '12417', trainName: 'Prayagraj Express', startTime: '09:30', endTime: '10:50', status: 'departure-ready', description: 'Dep 10:50' },
  { id: 'g-8', platformNumber: 8, platformLabel: 'PF 08', trainNumber: '12582', trainName: 'Banaras Superfast', startTime: '10:45', endTime: '11:50', status: 'inflow', description: 'At TKJ Approach' },
  { id: 'g-9', platformNumber: 9, platformLabel: 'PF 09', trainNumber: 'EMU 64005', trainName: 'GZB-NDLS EMU', startTime: '09:50', endTime: '10:20', status: 'occupied', description: 'Suburban Rapid Boarding' },
  { id: 'g-10', platformNumber: 10, platformLabel: 'PF 10', trainNumber: '14206', trainName: 'Delhi Mail', startTime: '11:15', endTime: '12:30', status: 'inflow', description: 'Old Delhi Tur' },
  { id: 'g-11', platformNumber: 11, platformLabel: 'PF 11', trainNumber: 'Freight', trainName: 'Freight Transit (Bypass)', startTime: '10:00', endTime: '10:40', status: 'occupied', description: 'Container rake pass' },
  { id: 'g-12', platformNumber: 12, platformLabel: 'PF 12', trainNumber: '12398', trainName: 'Mahabodhi Express', startTime: '11:30', endTime: '12:45', status: 'inflow', description: 'Clear Corridor' },
  { id: 'g-13', platformNumber: 13, platformLabel: 'PF 13', trainNumber: '20802', trainName: 'Magadh Express', startTime: '10:50', endTime: '12:05', status: 'occupied', description: 'On time' },
  { id: 'g-14', platformNumber: 14, platformLabel: 'PF 14', trainNumber: 'Shunt-03', trainName: 'Wash-Pit Shunt Rake', startTime: '09:30', endTime: '10:40', status: 'maintenance', description: 'WDS-6 loco shunting' },
  { id: 'g-15', platformNumber: 15, platformLabel: 'PF 15', trainNumber: '12401', trainName: 'Nanda Devi AC Express', startTime: '11:40', endTime: '12:50', status: 'inflow', description: 'Approaching Dehradun link' },
  { id: 'g-16', platformNumber: 16, platformLabel: 'PF 16', trainNumber: '22436', trainName: 'Vande Bharat Express', startTime: '10:45', endTime: '11:55', status: 'inflow', description: 'Ajmeri Gate Side Fast Turnaround' }
];

export const initialTelemetryPackets: TelemetryPacket[] = [
  {
    id: 'pkt-01',
    timestamp: '17:06:37.801',
    locoId: '12424 WAP-7 #30412 DBRG Rajdhani',
    blockSignalMile: 'Block 968 Shivaji Approach • DN FAST • Track 2',
    subsystem: 'RTIS Position Pulse',
    telemetryValue: '117.3 km/h',
    speedKmH: 117.3,
    details: {
      channel: 'DLI-UHF-CH4 (433.250 MHz) • NavIC L5',
      fec: 'Reed-Solomon RS(255, 223)',
      crc: 'CRC-CCITT (0x1021) Verified',
      snrDb: 44.2,
      rawHex: '02 4A 12 36 22 43 00 20 57 41 50 37 33 30 32 31 34 03 C4 01 28 40 1E 0F 00 00 2C 10 07 E8 09 64 00 20 02 53 49 4C 34 56 4D 53 41 43 4B 99 98 10 21',
      payloadJson: {
        trainId: 12424,
        locoClass: 'WAP-7',
        navicFix: '3D_RTK_FIX',
        latitude: 28.6448,
        longitude: 77.2167,
        instantaneousSpeed: 117.3,
        kavachAspect: 'DOUBLE_YELLOW_APPROACH',
        brakePipePressureBar: 5.02,
        catenaryVoltageKV: 24.8
      }
    }
  },
  {
    id: 'pkt-02',
    timestamp: '17:06:35.001',
    locoId: '12012 WAP-5 #30018 KLK Shatabdi',
    blockSignalMile: 'Sig S-42 Tilak Bridge In • UP MAIN • Platform Throat',
    subsystem: 'Kavach ATP Speed Profile',
    telemetryValue: '100.5 km/h',
    speedKmH: 100.5,
    details: {
      channel: 'Kavach SIL-4 UHF RFID',
      snrDb: 42.8,
      rawHex: '02 3B 10 12 57 41 50 35 00 18 01 42 0A 0B 0C 0D 0E 0F 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39',
      payloadJson: {
        trainId: 12012,
        locoClass: 'WAP-5',
        kavachStatus: 'SUPERVISED_SPEED_CEILING',
        ceilingMps: 110,
        distanceToBaliseMeters: 384,
        rfidTagId: 'BG-482-T04'
      }
    }
  },
  {
    id: 'pkt-03',
    timestamp: '17:06:32.290',
    locoId: '20818 VB-Trainset #14 Vande Bharat Exp',
    blockSignalMile: 'Block 962 Nizamuddin North • UP REVERSE • High Speed',
    subsystem: 'RTIS Position Pulse',
    telemetryValue: '129.8 km/h',
    speedKmH: 129.8,
    details: {
      channel: 'ISRO GSAT-7A MSS S-Band',
      snrDb: 45.6,
      rawHex: '02 4A 20 81 81 40 00 20 56 42 31 34 00 00 00 00 00 03 82 01 29 80 1E 0F 00 00 2C 10 07 E8 09 64 00 20 02 53 49 4C 34 56 4D 53 41 43 4B 99 98 10 21',
      payloadJson: {
        trainId: 20818,
        trainsetUnit: 14,
        navicConstellationSats: 8,
        speedKmH: 129.8,
        motorCurrentAmps: 640,
        pantographHealth: 'OPTIMAL_PRESSURE_80N'
      }
    }
  },
  {
    id: 'pkt-04',
    timestamp: '17:06:29.404',
    locoId: 'AXLE-98A SSDAC Axle Sensor 98',
    blockSignalMile: 'Cross-Over 52B / TKD Yard Section Sectional',
    subsystem: 'Axle In/Out Count Pulse',
    telemetryValue: 'OCCUPIED / 88 AXLES',
    details: {
      channel: 'Dual-Channel Microcontroller 2oo2',
      snrDb: 48.0,
      rawHex: '01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F 10 11 12 13 14 15 16 17 18 19 1A 1B 1C 1D 1E 1F 20 21 22 23 24 25 26 27 28 29 2A 2B 2C 2D 2E 2F 30',
      payloadJson: {
        sensorId: 'SSDAC-98A',
        wheelCountIn: 88,
        wheelCountOut: 88,
        driftCount: 0,
        circuitState: 'TRACK_CIRCUIT_HEALTHY'
      }
    }
  },
  {
    id: 'pkt-05',
    timestamp: '17:06:21.004',
    locoId: '12424 WAP-7 #30412 DBRG Rajdhani',
    blockSignalMile: 'Block 968 Shivaji Approach DN FAST Track 2',
    subsystem: 'RTIS Position Pulse',
    telemetryValue: '118.4 km/h',
    speedKmH: 118.4,
    details: {
      channel: 'DLI-UHF-CH4 (433.250 MHz) • NavIC L5',
      fec: 'Reed-Solomon RS(255, 223)',
      crc: 'CRC-CCITT (0x1021) Verified',
      snrDb: 44.1,
      rawHex: '02 4A 12 36 22 43 00 20 57 41 50 37 33 30 32 31 34 03 C4 01 28 40 1E 0F 00 00 2C 10 07 E8 09 64 00 20 02 53 49 4C 34 56 4D 53 41 43 4B 99 98 10 21',
      payloadJson: {
        trainId: 12424,
        locoSpeed: 118.4,
        headwayMeters: 4210,
        gradientDegrees: -0.12
      }
    }
  }
];

export const initialTurnaroundRoster: TurnaroundRosterItem[] = [
  {
    platformNumber: 1,
    lengthCoaches: '24 LHB',
    infraDetail: 'Dual Cab 25kV • FOB-2 / Esc-1 • WATERING: HIGH-PRESS HYDRANT',
    trainNumber: '12004',
    trainName: 'LKO SHATABDI',
    sourceStation: 'Lucknow Charbagh (LKO)',
    inwardArrivalTime: '13:50',
    inwardDelayStatus: 'RT +0',
    rakeId: '#LKO-2408-C',
    serviceType: 'Turnaround Rake',
    maintenanceType: 'Quick Water (30m)',
    maintenanceDuration: 'Done 14:20',
    gangAssigned: 'Gang #4 (OBHS) • Bio-Vacuum Evac',
    statusProgress: 'VERIFIED 100% Lock',
    statusPercent: 100,
    statusBadgeColor: 'bg-emerald-100 text-emerald-800'
  },
  {
    platformNumber: 2,
    lengthCoaches: '22 LHB',
    infraDetail: 'Dual End Hydrants • Escalator Central • TIGHT TURN-IN',
    trainNumber: '22436',
    trainName: 'VANDE BHARAT',
    sourceStation: 'Varanasi Jn (BSB)',
    inwardArrivalTime: '14:22',
    inwardDelayStatus: '+18m DELAY',
    rakeId: '#VB-SET-18',
    serviceType: 'Rapid Turnaround',
    maintenanceType: 'Fast Servicing (25m)',
    maintenanceDuration: 'Gang Ready',
    gangAssigned: 'Rapid Turn Gang B-1 • High-Speed Pantograph Check',
    statusProgress: 'DEPLOYED Pending Dep',
    statusPercent: 45,
    statusBadgeColor: 'bg-amber-100 text-amber-800'
  },
  {
    platformNumber: 3,
    lengthCoaches: '24 LHB',
    infraDetail: 'Dual Cab 25kV • Parcel Ramps • TRACK EMPTY',
    trainNumber: 'Originating Service',
    trainName: 'Originating Service',
    sourceStation: 'Rake via Wash Pit Line 2',
    inwardArrivalTime: '--:--',
    inwardDelayStatus: 'Shunt In: 14:35 IST',
    rakeId: '#DLI-ORIG-44',
    serviceType: 'New Rake Placement',
    maintenanceType: 'Pit Pre-Cleared',
    maintenanceDuration: 'FIT-TO-RUN',
    gangAssigned: 'Catering Loading (Pantry) • 14:40 - 15:10',
    statusProgress: 'Awaiting Shunt Ingress',
    statusPercent: 15,
    statusBadgeColor: 'bg-blue-100 text-blue-800',
    isOriginating: true,
    shuntInTime: '14:35 IST'
  },
  {
    platformNumber: 4,
    lengthCoaches: '24 LHB',
    infraDetail: 'Dual Cab 25kV • FOB North Access • STANDARD FLOW',
    trainNumber: '12424',
    trainName: 'DBRG RAJDHANI',
    sourceStation: 'Dibrugarh (DBRG)',
    inwardArrivalTime: '13:10',
    inwardDelayStatus: 'ARRIVED',
    rakeId: '#DBRG-2401-A',
    serviceType: 'Terminal Destination',
    maintenanceType: 'To Yard Stabling',
    maintenanceDuration: 'Dep 14:48',
    gangAssigned: 'Passenger Deboarded • Brake Power Certificate (BPC)',
    statusProgress: 'COMPLETE Ready Yard',
    statusPercent: 100,
    statusBadgeColor: 'bg-emerald-100 text-emerald-800'
  },
  {
    platformNumber: 5,
    lengthCoaches: '24 Car BG',
    infraDetail: 'Vande Bharat / Rajdhani Compatible • High Clearance',
    trainNumber: '22439',
    trainName: 'SVDK VB EXP',
    sourceStation: 'Katra (SVDK)',
    inwardArrivalTime: '14:05',
    inwardDelayStatus: 'RT +0',
    rakeId: '#VB-SET-09',
    serviceType: 'Turnaround',
    maintenanceType: 'Apron Wash & Line Check',
    maintenanceDuration: '40m',
    gangAssigned: 'NR Carriage & Wagon Gang D-3',
    statusProgress: 'ACTIVE Servicing',
    statusPercent: 70,
    statusBadgeColor: 'bg-emerald-100 text-emerald-800'
  },
  {
    platformNumber: 6,
    lengthCoaches: '24 Car BG',
    infraDetail: 'Shatabdi Line • Dual High-Flow Hydrant',
    trainNumber: '12002',
    trainName: 'BHOPAL SHTB',
    sourceStation: 'Rani Kamlapati (RKMP)',
    inwardArrivalTime: '14:30',
    inwardDelayStatus: 'Dep: 11:15 | Loco WAP-7 #30211',
    rakeId: '#RKMP-12002',
    serviceType: 'Turnaround',
    maintenanceType: 'Full Interior Sanitization',
    maintenanceDuration: 'Ready in 20m',
    gangAssigned: 'Northern Railway Cleaning Ops',
    statusProgress: 'READY For Boarding',
    statusPercent: 90,
    statusBadgeColor: 'bg-emerald-100 text-emerald-800'
  }
];
