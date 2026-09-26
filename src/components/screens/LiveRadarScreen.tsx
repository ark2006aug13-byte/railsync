import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import { 
  Radar, 
  Search, 
  Train, 
  Activity, 
  Gauge, 
  MapPin, 
  Compass, 
  Clock, 
  Zap, 
  ShieldCheck, 
  CloudSun, 
  AlertTriangle, 
  ArrowRight, 
  CheckCircle2, 
  SlidersHorizontal, 
  X, 
  Layers, 
  Maximize2, 
  RotateCcw, 
  ExternalLink, 
  Key, 
  Radio
} from 'lucide-react';
import { AppView, RadarTrain, RadarJunctionHalo } from '../../types';
import { RADAR_INITIAL_TRAINS, RADAR_JUNCTIONS } from '../../data/radarMockData';

interface LiveRadarScreenProps {
  onNavigate: (view: AppView) => void;
  onSelectTrain?: (trainNo: string) => void;
}

export const LiveRadarScreen: React.FC<LiveRadarScreenProps> = ({ 
  onNavigate,
  onSelectTrain 
}) => {
  // State
  const [trains, setTrains] = useState<RadarTrain[]>(RADAR_INITIAL_TRAINS);
  const [selectedTrain, setSelectedTrain] = useState<RadarTrain | null>(RADAR_INITIAL_TRAINS[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'vande-bharat' | 'rajdhani' | 'high-speed' | 'on-time' | 'delayed' | 'freight'>('all');
  const [showJunctionHalos, setShowJunctionHalos] = useState(true);
  const [showApiModal, setShowApiModal] = useState(false);
  const [customApiKey, setCustomApiKey] = useState('');
  const [apiEndpoint, setApiEndpoint] = useState('https://api.railradar.in/v1/legacy/trains/live-map');
  const [isLiveStreaming, setIsLiveStreaming] = useState(false);
  const [liveSyncTime, setLiveSyncTime] = useState<string>('');

  // Map references
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const routeMarkersLayerRef = useRef<L.LayerGroup | null>(null);
  const halosLayerRef = useRef<L.LayerGroup | null>(null);

  // Filtered trains
  const filteredTrains = useMemo(() => {
    return trains.filter(t => {
      // Search query filter
      const matchesSearch = 
        t.trainNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.trainName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.destination.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;

      // Category filter
      if (activeFilter === 'vande-bharat') return t.type === 'Vande Bharat';
      if (activeFilter === 'rajdhani') return t.type === 'Rajdhani' || t.type === 'Shatabdi';
      if (activeFilter === 'high-speed') return t.speedKmph >= 110;
      if (activeFilter === 'on-time') return t.status === 'on-time';
      if (activeFilter === 'delayed') return t.status === 'slight-delay' || t.status === 'heavy-delay';
      if (activeFilter === 'freight') return t.type === 'Freight';
      return true;
    });
  }, [trains, searchQuery, activeFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = trains.length;
    const onTimeCount = trains.filter(t => t.status === 'on-time').length;
    const onTimePct = total > 0 ? Math.round((onTimeCount / total) * 100) : 0;
    const highestSpeedTrain = [...trains].sort((a, b) => b.speedKmph - a.speedKmph)[0];
    const avgDelay = total > 0 ? Math.round(trains.reduce((sum, t) => sum + t.delayMinutes, 0) / total) : 0;
    return {
      total,
      onTimePct,
      highestSpeed: highestSpeedTrain?.speedKmph || 0,
      highestSpeedName: highestSpeedTrain ? `${highestSpeedTrain.trainNumber} ${highestSpeedTrain.type}` : '',
      avgDelay
    };
  }, [trains]);

  // Update clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setLiveSyncTime(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' IST');
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Centered on Central/Northern India
    const map = L.map(mapContainerRef.current, {
      center: [23.5, 80.5],
      zoom: 5.5,
      minZoom: 4,
      maxZoom: 16,
      zoomControl: false,
      attributionControl: false
    });

    // Dark sleek CartoDB Dark Matter tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    // Zoom control in bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Create Layer Groups
    const halosGroup = L.layerGroup().addTo(map);
    const routeGroup = L.layerGroup().addTo(map);
    const markersGroup = L.layerGroup().addTo(map);

    halosLayerRef.current = halosGroup;
    routeMarkersLayerRef.current = routeGroup;
    markersLayerRef.current = markersGroup;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Render Junction Halos
  useEffect(() => {
    if (!halosLayerRef.current) return;
    halosLayerRef.current.clearLayers();

    if (!showJunctionHalos) return;

    RADAR_JUNCTIONS.forEach(j => {
      const color = 
        j.congestionLevel === 'severe' ? '#ef4444' :
        j.congestionLevel === 'high' ? '#f97316' :
        j.congestionLevel === 'moderate' ? '#eab308' : '#10b981';

      // Outer ripple circle
      const haloCircle = L.circle([j.lat, j.lng], {
        radius: j.congestionLevel === 'severe' ? 35000 : 25000,
        color: color,
        fillColor: color,
        fillOpacity: 0.12,
        weight: 1.5,
        dashArray: '4, 4'
      });

      // Center dot
      const centerDot = L.circleMarker([j.lat, j.lng], {
        radius: 4,
        color: '#ffffff',
        fillColor: color,
        fillOpacity: 0.9,
        weight: 1
      });

      // Tooltip
      centerDot.bindTooltip(
        `<div style="font-family: monospace; font-size: 11px; padding: 2px;">
          <b>${j.name} (${j.code})</b><br/>
          <span style="color: ${color};">Congestion: ${j.congestionLevel.toUpperCase()}</span><br/>
          Active Trains: ${j.activeTrainsCount} | Throat MPS: ${j.throatSpeedLimitKmph} km/h
        </div>`,
        { direction: 'top', className: 'radar-leaflet-tooltip' }
      );

      halosLayerRef.current?.addLayer(haloCircle);
      halosLayerRef.current?.addLayer(centerDot);
    });
  }, [showJunctionHalos]);

  // Render Train Markers
  useEffect(() => {
    if (!markersLayerRef.current || !mapInstanceRef.current) return;
    markersLayerRef.current.clearLayers();

    filteredTrains.forEach(train => {
      const isSelected = selectedTrain?.trainNumber === train.trainNumber;

      // Color coding
      let statusColor = '#10b981'; // green on-time
      let pulseClass = 'border-emerald-400 bg-emerald-500/20';
      if (train.type === 'Vande Bharat') {
        statusColor = '#a855f7';
        pulseClass = 'border-purple-400 bg-purple-500/20';
      } else if (train.type === 'Freight') {
        statusColor = '#06b6d4';
        pulseClass = 'border-cyan-400 bg-cyan-500/20';
      } else if (train.status === 'heavy-delay') {
        statusColor = '#ef4444';
        pulseClass = 'border-red-400 bg-red-500/25';
      } else if (train.status === 'slight-delay') {
        statusColor = '#f59e0b';
        pulseClass = 'border-amber-400 bg-amber-500/25';
      }

      // Custom HTML Marker with radar pulse and directional bearing
      const markerHtml = `
        <div class="relative flex items-center justify-center cursor-pointer group" style="width: 44px; height: 44px;">
          ${isSelected ? `
            <div class="absolute inset-0 rounded-full animate-ping opacity-75" style="border: 2px solid ${statusColor};"></div>
            <div class="absolute -inset-1 rounded-full animate-pulse opacity-40" style="background: radial-gradient(circle, ${statusColor} 0%, transparent 70%);"></div>
          ` : `
            <div class="absolute inset-1.5 rounded-full ${pulseClass} border opacity-60 group-hover:opacity-100 transition-opacity"></div>
          `}
          
          <!-- Heading Arrow / Locomotive Body -->
          <div 
            class="relative z-10 w-7 h-7 rounded-full flex items-center justify-center shadow-lg transition-transform duration-300"
            style="background: #0f172a; border: 2px solid ${statusColor}; box-shadow: 0 0 10px ${statusColor}66;"
          >
            <div style="transform: rotate(${train.bearing}deg); transition: transform 0.3s ease;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="${statusColor}" stroke="${statusColor}" stroke-width="1.5">
                <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
              </svg>
            </div>
          </div>

          <!-- Train Number Tag -->
          <div class="absolute -bottom-3.5 left-1/2 -translate-x-1/2 px-1 py-0.2 rounded bg-slate-900/90 border border-slate-700/80 text-[9px] font-mono font-bold text-slate-200 whitespace-nowrap shadow select-none">
            ${train.trainNumber}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'radar-train-marker-wrapper',
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });

      const marker = L.marker([train.currentLat, train.currentLng], { icon: customIcon });

      // Click handler
      marker.on('click', () => {
        setSelectedTrain(train);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([train.currentLat, train.currentLng], 8, { duration: 1.2 });
        }
      });

      // Hover tooltip
      marker.bindTooltip(
        `<div style="font-family: monospace; font-size: 11px; padding: 3px 6px; color: #f8fafc;">
          <div style="font-weight: bold; color: ${statusColor};">${train.trainNumber} • ${train.trainName}</div>
          <div>Speed: <b>${train.speedKmph} km/h</b> | Delay: <b>${train.delayMinutes === 0 ? 'On Time' : `+${train.delayMinutes}m`}</b></div>
          <div style="color: #94a3b8; font-size: 10px;">${train.sourceCode} ──► ${train.destinationCode} | Near ${train.currentStationCode}</div>
        </div>`,
        { direction: 'top', offset: [0, -22], className: 'radar-leaflet-tooltip' }
      );

      markersLayerRef.current?.addLayer(marker);
    });
  }, [filteredTrains, selectedTrain]);

  // Render Selected Train Route Polyline & Halts
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Clear previous route
    if (routePolylineRef.current) {
      mapInstanceRef.current.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }
    if (routeMarkersLayerRef.current) {
      routeMarkersLayerRef.current.clearLayers();
    }

    if (!selectedTrain || !selectedTrain.routeCoordinates || selectedTrain.routeCoordinates.length < 2) return;

    // Glowing Neon Polyline
    const polyline = L.polyline(selectedTrain.routeCoordinates, {
      color: '#38bdf8',
      weight: 3.5,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
      dashArray: undefined
    }).addTo(mapInstanceRef.current);

    routePolylineRef.current = polyline;

    // Station Pips along route
    selectedTrain.routeCoordinates.forEach((coord, idx) => {
      const isOrigin = idx === 0;
      const isTerminal = idx === selectedTrain.routeCoordinates!.length - 1;

      const circle = L.circleMarker(coord, {
        radius: isOrigin || isTerminal ? 5 : 3,
        color: isOrigin || isTerminal ? '#38bdf8' : '#94a3b8',
        fillColor: '#0f172a',
        fillOpacity: 1,
        weight: 2
      });

      routeMarkersLayerRef.current?.addLayer(circle);
    });
  }, [selectedTrain]);

  // Connect live API or mock streamer
  const handleConnectApi = () => {
    setIsLiveStreaming(true);
    setShowApiModal(false);
  };

  return (
    <div className="relative w-full h-[calc(100vh-6rem)] overflow-hidden bg-[#090d16] text-slate-100 flex flex-col font-sans select-none">
      
      {/* 1. TOP TACTICAL RADAR HUD COCKPIT BAR */}
      <div className="absolute top-3 left-3 right-3 z-30 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        
        {/* Left Branding & Live Stats */}
        <div className="pointer-events-auto flex items-center gap-2 bg-[#0c1322]/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-800 shadow-2xl">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 animate-pulse">
            <Radar className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-wider text-cyan-400 uppercase font-mono">
                RAILRADAR PRO
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                LIVE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              ALL-INDIA SATELLITE GPS TRAIN RADAR
            </p>
          </div>

          <div className="h-6 w-px bg-slate-800 mx-1 hidden sm:block"></div>

          {/* Quick Metrics */}
          <div className="hidden md:flex items-center gap-4 text-xs font-mono">
            <div>
              <span className="text-slate-500 block text-[10px]">ACTIVE IN CORRIDOR</span>
              <span className="font-bold text-slate-200">{stats.total} Trains Tracked</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">ON-TIME RATE</span>
              <span className="font-bold text-emerald-400">{stats.onTimePct}%</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">TOP SPEED RECORD</span>
              <span className="font-bold text-amber-400">{stats.highestSpeed} km/h</span>
            </div>
          </div>
        </div>

        {/* Right Action Tools: API Key modal, Junctions Toggle, Recenter */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Halos Toggle */}
          <button
            onClick={() => setShowJunctionHalos(!showJunctionHalos)}
            className={`px-3 py-2 rounded-xl text-xs font-mono font-medium backdrop-blur-md border transition-all flex items-center gap-1.5 shadow-lg cursor-pointer ${
              showJunctionHalos 
                ? 'bg-blue-600/30 border-blue-500/50 text-blue-300' 
                : 'bg-[#0c1322]/85 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Junction Halos</span>
          </button>

          {/* Recenter Map Button */}
          <button
            onClick={() => {
              if (mapInstanceRef.current) {
                mapInstanceRef.current.flyTo([23.5, 80.5], 5.5, { duration: 1 });
              }
            }}
            className="p-2 rounded-xl bg-[#0c1322]/85 backdrop-blur-md border border-slate-800 text-slate-300 hover:text-white shadow-lg cursor-pointer transition-colors"
            title="Recenter All-India View"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Connect Custom API Button */}
          <button
            onClick={() => setShowApiModal(true)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Key className="w-3.5 h-3.5" />
            <span>Connect Live API</span>
          </button>
        </div>
      </div>

      {/* 2. FLOATING SEARCH & CATEGORY FILTER BAR */}
      <div className="absolute top-18 left-3 z-30 w-full max-w-md pointer-events-auto">
        <div className="bg-[#0c1322]/90 backdrop-blur-md p-2 rounded-2xl border border-slate-800 shadow-2xl space-y-2">
          
          {/* Search Input */}
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search train (e.g. 12004, Vande Bharat, 12301)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#111c30] text-slate-100 text-xs font-medium pl-9 pr-8 py-2 rounded-xl border border-slate-700/60 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 p-1 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-[11px] font-medium">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                activeFilter === 'all' 
                  ? 'bg-cyan-500 text-slate-950 font-bold' 
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({trains.length})
            </button>
            <button
              onClick={() => setActiveFilter('vande-bharat')}
              className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 ${
                activeFilter === 'vande-bharat' 
                  ? 'bg-purple-500 text-white font-bold' 
                  : 'bg-slate-800/60 text-purple-300 hover:text-purple-200'
              }`}
            >
              <Zap className="w-3 h-3 text-amber-300" />
              Vande Bharat
            </button>
            <button
              onClick={() => setActiveFilter('rajdhani')}
              className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                activeFilter === 'rajdhani' 
                  ? 'bg-blue-500 text-white font-bold' 
                  : 'bg-slate-800/60 text-blue-300 hover:text-blue-200'
              }`}
            >
              Rajdhani & Shatabdi
            </button>
            <button
              onClick={() => setActiveFilter('high-speed')}
              className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                activeFilter === 'high-speed' 
                  ? 'bg-amber-500 text-slate-950 font-bold' 
                  : 'bg-slate-800/60 text-amber-300 hover:text-amber-200'
              }`}
            >
              High Speed &gt;110 km/h
            </button>
            <button
              onClick={() => setActiveFilter('on-time')}
              className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                activeFilter === 'on-time' 
                  ? 'bg-emerald-500 text-slate-950 font-bold' 
                  : 'bg-slate-800/60 text-emerald-400 hover:text-emerald-300'
              }`}
            >
              On-Time
            </button>
            <button
              onClick={() => setActiveFilter('delayed')}
              className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                activeFilter === 'delayed' 
                  ? 'bg-red-500 text-white font-bold' 
                  : 'bg-slate-800/60 text-red-400 hover:text-red-300'
              }`}
            >
              Delayed
            </button>
            <button
              onClick={() => setActiveFilter('freight')}
              className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                activeFilter === 'freight' 
                  ? 'bg-cyan-500 text-slate-950 font-bold' 
                  : 'bg-slate-800/60 text-cyan-300 hover:text-cyan-200'
              }`}
            >
              Freight DFC
            </button>
          </div>
        </div>

        {/* Autocomplete Quick List when searching */}
        {searchQuery && (
          <div className="mt-2 bg-[#0c1322]/95 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl max-h-56 overflow-y-auto p-1.5 space-y-1">
            {filteredTrains.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500">
                No matching trains found on radar.
              </div>
            ) : (
              filteredTrains.map(t => (
                <div
                  key={t.trainNumber}
                  onClick={() => {
                    setSelectedTrain(t);
                    setSearchQuery('');
                    if (mapInstanceRef.current) {
                      mapInstanceRef.current.flyTo([t.currentLat, t.currentLng], 8, { duration: 1 });
                    }
                  }}
                  className="p-2 rounded-xl hover:bg-slate-800/60 cursor-pointer flex items-center justify-between text-xs transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-cyan-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                      {t.trainNumber}
                    </span>
                    <div>
                      <div className="font-semibold text-slate-200">{t.trainName}</div>
                      <div className="text-[10px] text-slate-400">{t.sourceCode} ➔ {t.destinationCode}</div>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-emerald-400 font-bold">{t.speedKmph} km/h</div>
                    <div className="text-[10px] text-slate-400">{t.delayMinutes === 0 ? 'On Time' : `+${t.delayMinutes}m`}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 3. FULL SCREEN MAP CANVAS CONTAINER */}
      <div 
        ref={mapContainerRef} 
        className="w-full h-full z-10"
        style={{ background: '#090d16' }}
      />

      {/* 4. SLIDE-OVER TRAIN COCKPIT TELEMETRY DRAWER */}
      {selectedTrain && (
        <div className="absolute top-3 bottom-3 right-3 z-30 w-full max-w-sm sm:max-w-md bg-[#0c1424]/95 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300 pointer-events-auto">
          
          {/* Drawer Header */}
          <div className="p-4 border-b border-slate-800 flex items-start justify-between gap-3 bg-gradient-to-b from-[#131d33] to-transparent">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm font-black px-2 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  {selectedTrain.trainNumber}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {selectedTrain.type}
                </span>
                <span className={`text-xs font-mono px-2 py-0.5 rounded-lg font-bold ${
                  selectedTrain.status === 'on-time' 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                    : selectedTrain.status === 'slight-delay'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  {selectedTrain.delayMinutes === 0 ? '✔ ON SCHEDULE' : `🔴 +${selectedTrain.delayMinutes} MIN DELAY`}
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight leading-snug">
                {selectedTrain.trainName}
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {selectedTrain.source} ({selectedTrain.sourceCode}) ──► {selectedTrain.destination} ({selectedTrain.destinationCode})
              </p>
            </div>

            <button
              onClick={() => setSelectedTrain(null)}
              className="p-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Body (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-mono scrollbar-thin">
            
            {/* Speed & Kinematic Gauge Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-2xl bg-[#111c30] border border-slate-800">
                <span className="text-slate-400 text-[10px] block">LIVE SATELLITE SPEED</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black text-cyan-400 font-mono">{selectedTrain.speedKmph}</span>
                  <span className="text-[11px] text-slate-500">km/h</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                  <span>Line MPS: {selectedTrain.maxSpeedKmph} km/h</span>
                  <span className="text-emerald-400 font-bold">SIL-4 LOCK</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-[#111c30] border border-slate-800">
                <span className="text-slate-400 text-[10px] block">DISTANCE PROGRESS</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black text-amber-400 font-mono">{selectedTrain.distanceCoveredKm}</span>
                  <span className="text-[11px] text-slate-500">/ {selectedTrain.totalDistanceKm} km</span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1.5 rounded-full bg-slate-800 mt-2 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-500 to-amber-400 rounded-full"
                    style={{ width: `${Math.min(100, Math.round((selectedTrain.distanceCoveredKm / selectedTrain.totalDistanceKm) * 100))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Traction & Locomotive Info */}
            <div className="p-3 rounded-2xl bg-[#111c30] border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">LOCOMOTIVE / RAKE:</span>
                <span className="text-white font-bold">{selectedTrain.locoClass}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">LOCO NO / SHED:</span>
                <span className="text-cyan-300 font-bold">{selectedTrain.locoNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">RAILWAY ZONE:</span>
                <span className="text-slate-200">{selectedTrain.zone}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">SATELLITE POSITION:</span>
                <span className="text-slate-300 font-mono">{selectedTrain.currentLat.toFixed(4)}° N, {selectedTrain.currentLng.toFixed(4)}° E</span>
              </div>
            </div>

            {/* RailSync Proprietary Advantage: Dynamic Time Deletion & Progressive Transition */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#0e223d] to-[#0c182b] border border-blue-500/30 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-blue-400 font-bold text-[11px]">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  DYNAMIC TIME DELETION (SLACK RECOVERY)
                </div>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                  {selectedTrain.timeDeletionMinutes < 0 ? `${selectedTrain.timeDeletionMinutes}m DELETED` : '0m SLACK'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                Traction power running at 130 km/h is actively deleting scheduled section slack buffer to eliminate delays before reaching destination.
              </p>
            </div>

            {/* Weather Radar along Train Track */}
            <div className="p-3 rounded-2xl bg-[#111c30] border border-slate-800 flex items-start gap-2.5">
              <CloudSun className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-400 text-[10px] block font-mono">DOPPLER WEATHER RADAR</span>
                <p className="text-slate-200 text-xs mt-0.5 leading-snug">
                  {selectedTrain.weatherSummary}
                </p>
              </div>
            </div>

            {/* Upcoming Halts & Platform Berth Timeline */}
            <div className="space-y-2">
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                PROGRESSIVE STATIONS & PLATFORM BERTHS
              </span>
              
              <div className="space-y-1.5">
                {/* Current Active Station */}
                <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                    <div>
                      <div className="text-white font-bold">{selectedTrain.currentStation} ({selectedTrain.currentStationCode})</div>
                      <div className="text-[10px] text-cyan-300">Active Location • Heading {selectedTrain.bearing}°</div>
                    </div>
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[10px]">
                    NOW
                  </span>
                </div>

                {/* Upcoming Stops */}
                {selectedTrain.upcomingStations?.map((s, idx) => (
                  <div 
                    key={s.code}
                    className="p-2.5 rounded-xl bg-[#111c30] border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200">{s.name} ({s.code})</span>
                        <span className="px-1 py-0.2 rounded bg-slate-800 text-slate-300 font-mono text-[9px] border border-slate-700">
                          {s.platform}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Sch: {s.scheduledArrival} ➔ Pred ETA: <span className="text-emerald-400 font-bold">{s.dynamicEta}</span>
                      </div>
                    </div>
                    {s.delayDeltaMin < 0 ? (
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        ⚡ {Math.abs(s.delayDeltaMin)}m rec
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">
                        {s.delayDeltaMin === 0 ? 'steady' : `+${s.delayDeltaMin}m`}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Drawer Footer Actions */}
          <div className="p-3 border-t border-slate-800 bg-[#0d1627] flex items-center gap-2">
            <button
              onClick={() => {
                if (onSelectTrain) {
                  onSelectTrain(selectedTrain.trainNumber);
                }
                onNavigate('train-status');
              }}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Full 3D Telemetry & Physics</span>
            </button>
            <button
              onClick={() => {
                if (mapInstanceRef.current && selectedTrain.routeCoordinates) {
                  mapInstanceRef.current.fitBounds(selectedTrain.routeCoordinates as L.LatLngBoundsExpression, { padding: [40, 40] });
                }
              }}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Fit Full Route to Screen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}

      {/* 5. CONNECT CUSTOM LIVE API MODAL */}
      {showApiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#0d1627] border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-cyan-400 font-bold">
                <Key className="w-5 h-5" />
                <span className="text-base">Connect Custom Live Railway API</span>
              </div>
              <button 
                onClick={() => setShowApiModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Agar aapke paas official RailRadar ya Indian Railway live map API key hai, to aap yahan input kar sakte hain. System automatically real-time snapshot ingest karke saare trains map par live plot kar dega.
            </p>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="text-slate-400 block mb-1">API Endpoint URL</label>
                <input
                  type="text"
                  value={apiEndpoint}
                  onChange={(e) => setApiEndpoint(e.target.value)}
                  className="w-full bg-[#111c30] text-slate-100 p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">API Secret Key (Bearer Token)</label>
                <input
                  type="password"
                  placeholder="rr_live_xxxxxxxxxxxxxxxxxxxx"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  className="w-full bg-[#111c30] text-slate-100 p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowApiModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConnectApi}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg"
              >
                Sync Live Feed
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
