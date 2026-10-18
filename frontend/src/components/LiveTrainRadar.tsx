'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  Compass,
  Train,
  Maximize2,
  Minimize2,
  Navigation,
  Layers,
  MapPin,
  Clock,
  Gauge,
  Activity,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Radio,
  Satellite,
  Crosshair,
  TrendingUp,
  Search,
  Flame,
  Moon,
  Sun,
  ShieldAlert,
  Zap,
  ArrowRight,
  ExternalLink,
  X,
  RefreshCw,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import {
  RadarTrain,
  Chokepoint,
  StationLiveBoard,
  LocoCategory,
  SignalAspect,
} from '../types';

interface LiveTrainRadarProps {
  onSelectTrainForPredictor?: (trainNo: string) => void;
  onNavigateToTelemetry?: (trainNo: string) => void;
}

export const LiveTrainRadar: React.FC<LiveTrainRadarProps> = ({
  onSelectTrainForPredictor,
  onNavigateToTelemetry,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);
  const routePolylineRef = useRef<any>(null);
  const chokepointLayerGroupRef = useRef<any>(null);

  // Fleet state
  const [trains, setTrains] = useState<RadarTrain[]>([]);
  const trainsRef = useRef<RadarTrain[]>([]);
  const [selectedTrain, setSelectedTrain] = useState<RadarTrain | null>(null);
  const selectedTrainRef = useRef<RadarTrain | null>(null);
  const [followingTrain, setFollowingTrain] = useState(false);
  const followingTrainRef = useRef(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'VB' | 'RAJ' | 'FRT' | 'FAST' | 'DELAYED' | 'SIGNALS'>('ALL');
  const [isNightMode, setIsNightMode] = useState(true);
  const [showBottlenecks, setShowBottlenecks] = useState(false);
  const [showTracks, setShowTracks] = useState(true);
  const [baseMapStyle, setBaseMapStyle] = useState<'dark' | 'light' | 'satellite'>('dark');
  const [mapZoom, setMapZoom] = useState(5);
  const [isMapReady, setIsMapReady] = useState(false);

  // Chokepoints & FIDS state
  const [chokepoints, setChokepoints] = useState<Chokepoint[]>([]);
  const [selectedChokepoint, setSelectedChokepoint] = useState<Chokepoint | null>(null);
  const [fidsData, setFidsData] = useState<StationLiveBoard | null>(null);
  const [fidsLoading, setFidsLoading] = useState(false);
  const [showFidsModal, setShowFidsModal] = useState(false);

  // Telemetry sync status
  const [syncStatus, setSyncStatus] = useState<'STREAMING' | 'SYNCED' | 'CONNECTING'>('CONNECTING');
  const [secondsUntilSync, setSecondsUntilSync] = useState(120);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>('Just now');
  const [activeRoutePolyline, setActiveRoutePolyline] = useState<[number, number][] | null>(null);

  // Keep refs in sync
  useEffect(() => {
    trainsRef.current = trains;
  }, [trains]);

  useEffect(() => {
    selectedTrainRef.current = selectedTrain;
  }, [selectedTrain]);

  useEffect(() => {
    followingTrainRef.current = followingTrain;
  }, [followingTrain]);

  // ---------------------------------------------------------------------------
  // 1. FETCH INITIAL DATA & CONNECT SSE STREAM
  // ---------------------------------------------------------------------------
  const fetchFullFleet = useCallback(async () => {
    try {
      const res = await fetch('/api/trains/live-all-india');
      if (res.ok) {
        const data: RadarTrain[] = await res.json();
        setTrains(data);
        trainsRef.current = data;
        setSyncStatus('SYNCED');
        setSecondsUntilSync(120);
        setLastUpdatedTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch (err) {
      console.warn('Initial live trains fetch failed, falling back:', err);
    }
  }, []);

  const fetchChokepoints = useCallback(async () => {
    try {
      const res = await fetch('/api/chokepoints');
      if (res.ok) {
        const data: Chokepoint[] = await res.json();
        setChokepoints(data);
      }
    } catch (err) {
      console.warn('Failed to fetch chokepoints:', err);
    }
  }, []);

  useEffect(() => {
    fetchFullFleet();
    fetchChokepoints();

    // 2-minute sync countdown timer
    const countdownTimer = setInterval(() => {
      setSecondsUntilSync((prev) => {
        if (prev <= 1) {
          fetchFullFleet();
          fetchChokepoints();
          return 120;
        }
        return prev - 1;
      });
    }, 1000);

    // Setup Server-Sent Events (SSE) Delta Stream
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/trains/stream');

      eventSource.onopen = () => {
        setSyncStatus('STREAMING');
      };

      eventSource.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          if (packet.type === 'init' && packet.fleet) {
            setTrains(packet.fleet);
            trainsRef.current = packet.fleet;
            setSyncStatus('STREAMING');
            setLastUpdatedTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
          } else if (packet.type === 'delta' && packet.trains) {
            setSyncStatus('STREAMING');
            setTrains((prev) => {
              const deltaMap = new Map<string, any>(packet.trains.map((t: any) => [t.id, t]));
              const updated = prev.map((t) => {
                const delta = deltaMap.get(t.id);
                if (delta) {
                  return {
                    ...t,
                    lat: delta.lat ?? t.lat,
                    lng: delta.lng ?? t.lng,
                    spd: delta.spd ?? t.spd,
                    brg: delta.brg ?? t.brg,
                    signal: delta.sig ?? t.signal,
                    headway_km: delta.hdwy ?? t.headway_km,
                    dep_m: delta.dep_m ?? t.dep_m,
                  };
                }
                return t;
              });
              trainsRef.current = updated;
              return updated;
            });
            setLastUpdatedTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
          }
        } catch (e) {
          // ignore ping
        }
      };

      eventSource.onerror = () => {
        setSyncStatus('SYNCED');
        if (eventSource) eventSource.close();
      };
    } catch (e) {
      console.warn('SSE connection failed, relying on 2-minute cycle:', e);
    }

    return () => {
      clearInterval(countdownTimer);
      if (eventSource) eventSource.close();
    };
  }, [fetchFullFleet, fetchChokepoints]);

  // ---------------------------------------------------------------------------
  // 2. INITIALIZE LEAFLET MAP
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let isCancelled = false;

    const initMap = async () => {
      if (typeof window === 'undefined' || !mapContainerRef.current) return;
      if (mapInstanceRef.current) return;

      const L = (await import('leaflet')).default;
      if (isCancelled || !mapContainerRef.current) return;

      // India center coordinates
      const map = L.map(mapContainerRef.current, {
        center: [22.5, 79.5],
        zoom: 5,
        minZoom: 3,
        maxZoom: 18,
        zoomControl: false,
        attributionControl: false,
      });

      // Dark Gray base layer (ideal for radar)
      const darkLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 16 }
      );

      // Light base layer
      const lightLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        { maxZoom: 19, subdomains: 'abcd' }
      );

      // Satellite layer
      const satLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 18 }
      );

      // OpenRailwayMap standard physical rail tracks layer
      const railwayTracksLayer = L.tileLayer(
        'https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
        {
          maxZoom: 19,
          subdomains: ['a', 'b', 'c'],
          attribution: 'OpenRailwayMap',
          opacity: 0.85,
        }
      );

      darkLayer.addTo(map);
      railwayTracksLayer.addTo(map);

      (map as any)._layersDark = darkLayer;
      (map as any)._layersLight = lightLayer;
      (map as any)._layersSat = satLayer;
      (map as any)._railwayTracksLayer = railwayTracksLayer;

      mapInstanceRef.current = map;
      setIsMapReady(true);

      map.on('zoomend', () => {
        setMapZoom(map.getZoom());
      });

      // Stop following train on manual user drag
      map.on('dragstart', () => {
        setFollowingTrain(false);
        followingTrainRef.current = false;
      });

      // Click on map to select closest train or deselect
      map.on('click', (e: any) => {
        const pt = e.containerPoint;
        let closest: RadarTrain | null = null;
        let minDist = 24; // 24px click radius

        trainsRef.current.forEach((t) => {
          const tPt = map.latLngToContainerPoint([t.lat, t.lng]);
          const dist = Math.hypot(tPt.x - pt.x, tPt.y - pt.y);
          if (dist < minDist) {
            minDist = dist;
            closest = t;
          }
        });

        if (closest) {
          setSelectedTrain(closest);
          showTrainRoute((closest as RadarTrain).no);
        } else {
          setSelectedTrain(null);
          clearTrainRoute();
          setFollowingTrain(false);
          followingTrainRef.current = false;
        }
      });

      // Hover cursor feedback over trains
      map.on('mousemove', (e: any) => {
        const pt = e.containerPoint;
        let isNear = false;
        const currentFleet = trainsRef.current;
        for (let i = 0; i < currentFleet.length; i++) {
          const t = currentFleet[i];
          const tPt = map.latLngToContainerPoint([t.lat, t.lng]);
          if (Math.hypot(tPt.x - pt.x, tPt.y - pt.y) < 22) {
            isNear = true;
            break;
          }
        }
        map.getContainer().style.cursor = isNear ? 'pointer' : 'grab';
      });
    };

    initMap();

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update base map layer when style changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    if (map._layersDark) map.removeLayer(map._layersDark);
    if (map._layersLight) map.removeLayer(map._layersLight);
    if (map._layersSat) map.removeLayer(map._layersSat);

    if (baseMapStyle === 'dark' && map._layersDark) {
      map.addLayer(map._layersDark);
    } else if (baseMapStyle === 'light' && map._layersLight) {
      map.addLayer(map._layersLight);
    } else if (baseMapStyle === 'satellite' && map._layersSat) {
      map.addLayer(map._layersSat);
    }

    if (showTracks && map._railwayTracksLayer && map.hasLayer(map._railwayTracksLayer)) {
      map._railwayTracksLayer.bringToFront();
    }
  }, [baseMapStyle, showTracks]);

  // Update railway tracks layer visibility
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    if (map._railwayTracksLayer) {
      if (showTracks) {
        if (!map.hasLayer(map._railwayTracksLayer)) {
          map.addLayer(map._railwayTracksLayer);
        }
        map._railwayTracksLayer.bringToFront();
      } else {
        if (map.hasLayer(map._railwayTracksLayer)) {
          map.removeLayer(map._railwayTracksLayer);
        }
      }
    }
  }, [showTracks]);

  // ---------------------------------------------------------------------------
  // 3. CHOKEPOINTS LAYER OVERLAY
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!mapInstanceRef.current || typeof window === 'undefined') return;

    const renderChokepoints = async () => {
      const L = (await import('leaflet')).default;
      const map = mapInstanceRef.current;

      if (chokepointLayerGroupRef.current) {
        map.removeLayer(chokepointLayerGroupRef.current);
        chokepointLayerGroupRef.current = null;
      }

      if (!showBottlenecks || chokepoints.length === 0) return;

      const group = L.layerGroup();
      chokepoints.forEach((cp) => {
        const isCritical = cp.score >= 12;
        const isHeavy = cp.score >= 7;
        const color = isCritical ? '#ef4444' : isHeavy ? '#f97316' : '#eab308';

        // Outer pulsing ripple circle
        const circle = L.circleMarker([cp.lat, cp.lng], {
          radius: isCritical ? 24 : isHeavy ? 18 : 14,
          fillColor: color,
          fillOpacity: 0.25,
          color: color,
          weight: 2,
        });

        // Inner glowing core
        const core = L.circleMarker([cp.lat, cp.lng], {
          radius: 6,
          fillColor: color,
          fillOpacity: 0.9,
          color: '#ffffff',
          weight: 1.5,
        });

        const popupContent = `
          <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; color: #0f172a; padding: 4px;">
            <div style="font-weight: 800; font-size: 13px; color: ${color}; display: flex; align-items: center; gap: 4px;">
              🔥 ${cp.name} (${cp.code})
            </div>
            <div style="color: #64748b; font-size: 10px; margin-top: 2px;">${cp.desc}</div>
            <div style="margin-top: 6px; padding: 6px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                <span>Active Trains (25km):</span>
                <b>${cp.active_trains_count}</b>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                <span>Halted / Slow Trains:</span>
                <b style="color: #ea580c;">${cp.slow_halted_count}</b>
              </div>
              <div style="display: flex; justify-content: space-between; font-weight: 700;">
                <span>Congestion Status:</span>
                <span style="color: ${color};">${cp.status}</span>
              </div>
            </div>
          </div>
        `;
        circle.bindPopup(popupContent);
        core.bindPopup(popupContent);

        circle.on('click', () => {
          setSelectedChokepoint(cp);
          map.setView([cp.lat, cp.lng], 11, { animate: true });
        });

        group.addLayer(circle);
        group.addLayer(core);
      });

      group.addTo(map);
      chokepointLayerGroupRef.current = group;
    };

    renderChokepoints();
  }, [showBottlenecks, chokepoints]);

  // ---------------------------------------------------------------------------
  // 4. ROUTE POLYLINE OVERLAY
  // ---------------------------------------------------------------------------
  const showTrainRoute = async (trainNo: string) => {
    if (!mapInstanceRef.current || typeof window === 'undefined') return;
    const L = (await import('leaflet')).default;
    const map = mapInstanceRef.current;

    if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }

    try {
      const res = await fetch(`/api/train/${encodeURIComponent(trainNo)}/track`);
      if (res.ok) {
        const data = await res.json();
        if (data.found && data.polyline && data.polyline.length > 0) {
          const polyline = L.polyline(data.polyline, {
            color: '#38bdf8',
            weight: 3.5,
            opacity: 0.9,
            dashArray: '8, 8',
          }).addTo(map);

          routePolylineRef.current = polyline;
          setActiveRoutePolyline(data.polyline);
          map.fitBounds(polyline.getBounds(), { padding: [60, 60], maxZoom: 12 });
        }
      }
    } catch (err) {
      console.warn('Failed to load train track polyline:', err);
    }
  };

  const clearTrainRoute = () => {
    if (mapInstanceRef.current && routePolylineRef.current) {
      mapInstanceRef.current.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }
    setActiveRoutePolyline(null);
  };

  // ---------------------------------------------------------------------------
  // 5. AIRPORT FIDS LIVE BOARD MODAL
  // ---------------------------------------------------------------------------
  const openFidsModal = async (stationCode: string) => {
    setFidsLoading(true);
    setShowFidsModal(true);
    try {
      const res = await fetch(`/api/station/${encodeURIComponent(stationCode)}/live-board`);
      if (res.ok) {
        const data: StationLiveBoard = await res.json();
        setFidsData(data);
      }
    } catch (err) {
      console.warn('Failed to fetch station FIDS board:', err);
    } finally {
      setFidsLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 6. 60 FPS HTML5 CANVAS OVERLAY & LOCOMOTIVE RENDERING
  // ---------------------------------------------------------------------------
  const drawVectorLocomotive = (ctx: CanvasRenderingContext2D, t: RadarTrain, zoom: number) => {
    const cat = t.cat;
    const spd = t.spd;
    const isHalted = spd === 0;

    if (zoom >= 8) {
      if (cat === 'VB') {
        // Vande Bharat Aerodynamic Bullet Nose
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(5, -6);
        ctx.lineTo(5, 11);
        ctx.lineTo(-5, 11);
        ctx.lineTo(-5, -6);
        ctx.closePath();
        ctx.fillStyle = '#f8fafc';
        ctx.fill();
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Dark wrap-around aerodynamic windshield
        ctx.beginPath();
        ctx.moveTo(-3.5, -9);
        ctx.lineTo(0, -12);
        ctx.lineTo(3.5, -9);
        ctx.lineTo(3.5, -6);
        ctx.lineTo(-3.5, -6);
        ctx.closePath();
        ctx.fillStyle = '#0f172a';
        ctx.fill();

        // Cyan / Blue racing stripes
        ctx.fillStyle = '#00f5d4';
        ctx.fillRect(-4.5, -2, 2, 12);
        ctx.fillRect(2.5, -2, 2, 12);

        // Dual forward headlights
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-2, -12, 1, 0, Math.PI * 2);
        ctx.arc(2, -12, 1, 0, Math.PI * 2);
        ctx.fill();
      } else if (cat === 'RAJ' || cat === 'SHT') {
        // WAP-7 High-Speed Electric Locomotive (Red & Cream)
        ctx.beginPath();
        if ((ctx as any).roundRect) {
          (ctx as any).roundRect(-5, -11, 10, 22, 2);
        } else {
          ctx.rect(-5, -11, 10, 22);
        }
        ctx.fillStyle = cat === 'RAJ' ? '#dc2626' : '#0284c7';
        ctx.fill();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Cream center band
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(-5, -2, 10, 4);

        // Windows
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-3.5, -9.5, 7, 3);
        ctx.fillRect(-3.5, 7, 7, 2.5);

        // Roof Pantograph
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-3, -2);
        ctx.lineTo(3, 2);
        ctx.moveTo(3, -2);
        ctx.lineTo(-3, 2);
        ctx.stroke();

        // Twin round halogen headlights
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(-2.5, -10.5, 1, 0, Math.PI * 2);
        ctx.arc(2.5, -10.5, 1, 0, Math.PI * 2);
        ctx.fill();
      } else if (cat === 'FRT') {
        // WAG-9 Heavy Freight (Industrial Blue & Safety Orange)
        ctx.beginPath();
        if ((ctx as any).roundRect) {
          (ctx as any).roundRect(-6, -12, 12, 24, 2);
        } else {
          ctx.rect(-6, -12, 12, 24);
        }
        ctx.fillStyle = '#1d4ed8';
        ctx.fill();
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Front Safety Chevron
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.moveTo(-5, -11);
        ctx.lineTo(0, -6);
        ctx.lineTo(5, -11);
        ctx.lineTo(5, -8);
        ctx.lineTo(0, -3);
        ctx.lineTo(-5, -8);
        ctx.closePath();
        ctx.fill();

        // Roof cooling vents
        ctx.fillStyle = '#334155';
        ctx.fillRect(-4, 0, 8, 8);

        // High-power nose lamp
        ctx.fillStyle = '#fed7aa';
        ctx.beginPath();
        ctx.arc(0, -11, 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (cat === 'EMU') {
        // Commuter EMU Cab (Purple-White)
        ctx.beginPath();
        if ((ctx as any).roundRect) {
          (ctx as any).roundRect(-5, -10, 10, 20, 3);
        } else {
          ctx.rect(-5, -10, 10, 20);
        }
        ctx.fillStyle = '#7e22ce';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-4, -9, 8, 5);

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-3.5, -8, 2, 2.5);
        ctx.fillRect(-0.8, -8, 1.6, 2.5);
        ctx.fillRect(1.5, -8, 2, 2.5);
      } else {
        // Express / Superfast (IR Maroon)
        ctx.beginPath();
        if ((ctx as any).roundRect) {
          (ctx as any).roundRect(-4.5, -10, 9, 21, 2);
        } else {
          ctx.rect(-4.5, -10, 9, 21);
        }
        ctx.fillStyle = '#991b1b';
        ctx.fill();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-3, -8.5, 6, 3);
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(-2, -9.5, 0.9, 0, Math.PI * 2);
        ctx.arc(2, -9.5, 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Zoom <= 7: Aerodynamic chevron
      ctx.beginPath();
      if (zoom <= 5) {
        ctx.moveTo(0, -6);
        ctx.lineTo(4, 5);
        ctx.lineTo(0, 3);
        ctx.lineTo(-4, 5);
      } else {
        ctx.moveTo(0, -9);
        ctx.lineTo(6, 7);
        ctx.lineTo(0, 4);
        ctx.lineTo(-6, 7);
      }
      ctx.closePath();

      const color =
        cat === 'VB'
          ? '#00f5d4'
          : cat === 'RAJ'
          ? '#ef4444'
          : cat === 'FRT'
          ? '#f97316'
          : '#38bdf8';
      ctx.fillStyle = isHalted ? '#f59e0b' : color;
      ctx.fill();
      ctx.strokeStyle = '#0b1120';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  };

  const drawHeadlightBeam = (ctx: CanvasRenderingContext2D, t: RadarTrain, zoom: number) => {
    if (!isNightMode || t.spd === 0) return;

    const beamLength = zoom >= 10 ? 70 : zoom >= 7 ? 48 : 32;
    const spreadHalfAngle = 0.28; // ~16 deg
    const noseY = zoom >= 8 ? -11 : -7;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, noseY);
    const leftX = -Math.sin(spreadHalfAngle) * beamLength;
    const leftY = noseY - Math.cos(spreadHalfAngle) * beamLength;
    const rightX = Math.sin(spreadHalfAngle) * beamLength;
    const rightY = noseY - Math.cos(spreadHalfAngle) * beamLength;
    ctx.lineTo(leftX, leftY);
    ctx.arc(0, noseY, beamLength, -Math.PI / 2 - spreadHalfAngle, -Math.PI / 2 + spreadHalfAngle);
    ctx.lineTo(rightX, rightY);
    ctx.closePath();

    // Radiant conical beam gradient
    const grad = ctx.createRadialGradient(0, noseY, 2, 0, noseY, beamLength);
    grad.addColorStop(0, 'rgba(255, 255, 240, 0.85)');
    grad.addColorStop(0.2, 'rgba(254, 240, 138, 0.45)');
    grad.addColorStop(0.65, 'rgba(253, 224, 71, 0.16)');
    grad.addColorStop(1, 'rgba(250, 204, 21, 0)');

    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  };

  const drawSignalPill = (ctx: CanvasRenderingContext2D, t: RadarTrain, zoom: number) => {
    if (zoom < 8) return;
    const sig = t.signal || 'GREEN';
    const sigColor =
      sig === 'RED'
        ? '#ef4444'
        : sig === 'YELLOW'
        ? '#eab308'
        : sig === 'DOUBLE_YELLOW'
        ? '#f59e0b'
        : '#10b981';

    ctx.beginPath();
    ctx.arc(8, -12, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = sigColor;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (sig === 'RED' || sig === 'YELLOW') {
      ctx.beginPath();
      ctx.arc(8, -12, 6, 0, Math.PI * 2);
      ctx.strokeStyle = sigColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  };

  // Main canvas render loop
  const renderCanvas = useCallback(() => {
    if (!canvasRef.current || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const zoom = map.getZoom();
    const bounds = map.getBounds();
    const currentFleet = trainsRef.current;
    const selected = selectedTrainRef.current;

    // Follow train camera logic
    if (followingTrainRef.current && selected) {
      map.panTo([selected.lat, selected.lng], { animate: false, duration: 0.1 });
    }

    currentFleet.forEach((train) => {
      // Bounding box culling
      if (
        train.lat < bounds.getSouth() - 0.2 ||
        train.lat > bounds.getNorth() + 0.2 ||
        train.lng < bounds.getWest() - 0.2 ||
        train.lng > bounds.getEast() + 0.2
      ) {
        return;
      }

      // Filter matching
      if (activeFilter === 'VB' && train.cat !== 'VB') return;
      if (activeFilter === 'RAJ' && train.cat !== 'RAJ' && train.cat !== 'SHT') return;
      if (activeFilter === 'FRT' && train.cat !== 'FRT') return;
      if (activeFilter === 'FAST' && train.spd <= 100) return;
      if (activeFilter === 'DELAYED' && train.delay_m <= 30) return;
      if (activeFilter === 'SIGNALS' && train.signal === 'GREEN') return;

      const pt = map.latLngToContainerPoint([train.lat, train.lng]);
      const rad = (train.brg * Math.PI) / 180;

      ctx.save();
      ctx.translate(pt.x, pt.y);

      // Night headlight cone
      drawHeadlightBeam(ctx, train, zoom);

      // Rotate to track bearing heading
      ctx.rotate(rad);

      // Selected ring highlight
      if (selected && selected.id === train.id) {
        ctx.beginPath();
        ctx.arc(0, 0, zoom >= 8 ? 20 : 14, 0, Math.PI * 2);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw vector locomotive
      drawVectorLocomotive(ctx, train, zoom);

      // Signal aspect indicator
      drawSignalPill(ctx, train, zoom);

      ctx.restore();

      // Train labels when zoomed in
      if (zoom >= 9) {
        ctx.save();
        ctx.font = '700 10px Plus Jakarta Sans, sans-serif';
        const label = `${train.no} ${train.spd}k`;
        const textWidth = ctx.measureText(label).width;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        if ((ctx as any).roundRect) {
          (ctx as any).roundRect(pt.x - textWidth / 2 - 3, pt.y + 14, textWidth + 6, 14, 3);
        } else {
          ctx.rect(pt.x - textWidth / 2 - 3, pt.y + 14, textWidth + 6, 14);
        }
        ctx.fill();

        ctx.fillStyle = train.delay_m > 30 ? '#fca5a5' : '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(label, pt.x, pt.y + 24);
        ctx.restore();
      }
    });

    animFrameRef.current = requestAnimationFrame(renderCanvas);
  }, [activeFilter, isNightMode, drawHeadlightBeam, drawVectorLocomotive, drawSignalPill]);

  // Canvas size sync with map container
  useEffect(() => {
    if (!mapContainerRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const container = mapContainerRef.current;

    const handleResize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    animFrameRef.current = requestAnimationFrame(renderCanvas);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [renderCanvas]);

  // Click handler on canvas to select trains
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !mapInstanceRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const map = mapInstanceRef.current;

    let closest: RadarTrain | null = null;
    let minDist = 22; // click radius in pixels

    trainsRef.current.forEach((t) => {
      const pt = map.latLngToContainerPoint([t.lat, t.lng]);
      const dist = Math.hypot(pt.x - clickX, pt.y - clickY);
      if (dist < minDist) {
        minDist = dist;
        closest = t;
      }
    });

    if (closest) {
      setSelectedTrain(closest);
      showTrainRoute((closest as RadarTrain).no);
    } else {
      setSelectedTrain(null);
      clearTrainRoute();
      setFollowingTrain(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 7. FILTERED TRAINS & SEARCH RESULTS
  // ---------------------------------------------------------------------------
  const filteredSearchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    const matches = trains.filter(
      (t) => t.no.includes(q) || t.name.toLowerCase().includes(q) || t.stn.toLowerCase().includes(q)
    );
    const seen = new Set<string>();
    const unique: typeof trains = [];
    for (const t of matches) {
      const key = `${t.no}_${t.stn}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(t);
      }
      if (unique.length >= 10) break;
    }
    return unique;
  }, [trains, searchQuery]);

  const fleetStats = useMemo(() => {
    const total = trains.length;
    const active = trains.filter((t) => t.spd > 0).length;
    const speeds = trains.map((t) => t.spd).filter((s) => s > 0);
    const avgSpd = speeds.length > 0 ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length) : 0;
    const delayed = trains.filter((t) => t.delay_m > 30).length;
    const cautionSignals = trains.filter((t) => t.signal === 'RED' || t.signal === 'YELLOW' || t.signal === 'DOUBLE_YELLOW').length;

    return { total, active, avgSpd, delayed, cautionSignals };
  }, [trains]);

  // Fly to location helper
  const flyTo = (lat: number, lng: number, zoom: number) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], zoom, { duration: 1.5 });
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] flex overflow-hidden bg-[#060913]">
      {/* -----------------------------------------------------------------------
          TOP HUD BAR: Telemetry status, active trains, signaling, filters
          ----------------------------------------------------------------------- */}
      <div className="absolute top-3 left-3 right-3 z-30 pointer-events-none flex flex-wrap items-center justify-between gap-3">
        {/* Left Telemetry HUD Card */}
        <div className="pointer-events-auto flex items-center gap-4 px-4 py-2 rounded-2xl bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-xl text-slate-800 dark:text-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#1e3a8a] text-white flex items-center justify-center shadow-md shrink-0">
              <Radio className="w-4 h-4 animate-pulse text-cyan-300" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-['Plus_Jakarta_Sans'] font-black text-sm tracking-tight text-[#1e3a8a] dark:text-sky-400">
                  RailRadar 24
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  ALL-INDIA
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                {fleetStats.total.toLocaleString()} Trains Snapped to Track
              </p>
            </div>
          </div>

          <div className="hidden sm:block h-7 w-[1px] bg-slate-200 dark:bg-slate-700"></div>

          {/* Average Speed & Delays */}
          <div className="hidden md:flex items-center gap-4 text-xs font-semibold">
            <div>
              <span className="text-[10px] text-slate-400 block font-normal uppercase tracking-wider">Avg Speed</span>
              <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">{fleetStats.avgSpd} km/h</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-normal uppercase tracking-wider">Active Kinematics</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{fleetStats.active} Moving</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-normal uppercase tracking-wider">Signals (ABS)</span>
              <span className="font-mono text-amber-500 font-bold">{fleetStats.cautionSignals} Caution</span>
            </div>
          </div>
        </div>

        {/* Center Spotlight Search Bar */}
        <div className="pointer-events-auto relative w-72 sm:w-80 md:w-96">
          <div className="flex items-center px-3.5 py-2 rounded-2xl bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-xl text-xs">
            <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search train (e.g. 12301, Vande Bharat, NDLS)..."
              className="bg-transparent text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none w-full font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs px-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {filteredSearchResults.length > 0 && (
            <div className="absolute top-12 left-0 right-0 max-h-64 overflow-y-auto rounded-2xl bg-white/98 dark:bg-[#0f172a]/98 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-2 z-50 space-y-1">
              {filteredSearchResults.map((t, idx) => (
                <div
                  key={`${t.id || t.no}_${t.stn}_${idx}`}
                  onClick={() => {
                    setSelectedTrain(t);
                    setSearchQuery('');
                    flyTo(t.lat, t.lng, 11);
                    showTrainRoute(t.no);
                  }}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-xs transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#1e3a8a] dark:text-sky-400">{t.no}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[160px]">
                      {t.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-cyan-600 dark:text-cyan-400">{t.spd} km/h</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        t.delay_m > 30 ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/20 text-emerald-500'
                      }`}
                    >
                      {t.delay_m === 0 ? 'RT' : `+${t.delay_m}m`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Tactical Action Pills */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Rail Tracks Toggle */}
          <button
            onClick={() => setShowTracks(!showTracks)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl border text-xs font-bold transition shadow-lg ${
              showTracks
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                : 'bg-white/90 border-slate-200 text-slate-700'
            }`}
            title="Toggle Authentic Indian Rail Tracks Layer (OpenRailwayMap)"
          >
            <Compass className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">{showTracks ? 'Tracks: ON' : 'Tracks: OFF'}</span>
          </button>

          {/* Night Mode Toggle */}
          <button
            onClick={() => setIsNightMode(!isNightMode)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl border text-xs font-bold transition shadow-lg ${
              isNightMode
                ? 'bg-indigo-950/80 border-indigo-500/50 text-indigo-300'
                : 'bg-white/90 border-slate-200 text-slate-700'
            }`}
            title="Toggle Tactical Night Mode & Headlight Beams"
          >
            {isNightMode ? <Moon className="w-3.5 h-3.5 text-amber-300" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
            <span className="hidden sm:inline">{isNightMode ? 'Night Beam: ON' : 'Day Mode'}</span>
          </button>

          {/* Bottlenecks Radar Toggle */}
          <button
            onClick={() => setShowBottlenecks(!showBottlenecks)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl border text-xs font-bold transition shadow-lg ${
              showBottlenecks
                ? 'bg-orange-950/80 border-orange-500/50 text-orange-300'
                : 'bg-white/90 border-slate-200 text-slate-700'
            }`}
            title="Toggle India Junction Bottlenecks Radar"
          >
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            <span className="hidden sm:inline">Bottlenecks</span>
          </button>

          {/* Sync Status Badge */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-xl text-xs font-bold text-slate-700 dark:text-slate-200">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="hidden sm:inline font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
              {syncStatus === 'STREAMING' ? '⚡ SSE LIVE' : `Sync ${secondsUntilSync}s`}
            </span>
            <button
              onClick={() => {
                fetchFullFleet();
                fetchChokepoints();
              }}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-[#1e3a8a] transition"
              title="Force Refresh Live Telemetry"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Tactical Zoom & View Controls */}
      <div className="absolute right-4 top-20 z-30 flex flex-col gap-2 pointer-events-auto">
        <button
          onClick={() => mapInstanceRef.current?.zoomIn()}
          className="w-10 h-10 rounded-xl bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-xl flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-[#1e3a8a] dark:hover:text-sky-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-95"
          title="Zoom In (+)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => mapInstanceRef.current?.zoomOut()}
          className="w-10 h-10 rounded-xl bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-xl flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-[#1e3a8a] dark:hover:text-sky-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-95"
          title="Zoom Out (−)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            mapInstanceRef.current?.setView([22.5, 79.5], 5);
            setFollowingTrain(false);
            followingTrainRef.current = false;
          }}
          className="w-10 h-10 rounded-xl bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-xl flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-[#1e3a8a] dark:hover:text-sky-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-95"
          title="Center All-India (🎯)"
        >
          <Crosshair className="w-4 h-4 text-sky-500" />
        </button>
      </div>

      {/* -----------------------------------------------------------------------
          MAP CONTAINER & HTML5 CANVAS OVERLAY
          ----------------------------------------------------------------------- */}
      <div ref={mapContainerRef} className="absolute inset-0 z-0 w-full h-full bg-[#060913]" />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-10 w-full h-full pointer-events-none"
      />

      {/* -----------------------------------------------------------------------
          BOTTOM CONTROL BAR: Filter Chips, Map Layers, Hub Jumps
          ----------------------------------------------------------------------- */}
      <div className="absolute bottom-4 left-4 right-4 z-30 pointer-events-none flex flex-wrap items-center justify-between gap-3">
        {/* Locomotive Category Filter Chips */}
        <div className="pointer-events-auto flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeFilter === 'ALL'
                ? 'bg-[#1e3a8a] text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            All Trains ({fleetStats.total})
          </button>
          <button
            onClick={() => setActiveFilter('VB')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
              activeFilter === 'VB'
                ? 'bg-[#0284c7] text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            ⚡ Vande Bharat
          </button>
          <button
            onClick={() => setActiveFilter('RAJ')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
              activeFilter === 'RAJ'
                ? 'bg-[#dc2626] text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            👑 Rajdhani / Shatabdi
          </button>
          <button
            onClick={() => setActiveFilter('FRT')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
              activeFilter === 'FRT'
                ? 'bg-[#f97316] text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            📦 Freight (WAG-9)
          </button>
          <button
            onClick={() => setActiveFilter('FAST')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
              activeFilter === 'FAST'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            🚀 High Speed (&gt;100)
          </button>
          <button
            onClick={() => setActiveFilter('SIGNALS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
              activeFilter === 'SIGNALS'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            🚦 Red/Yellow ({fleetStats.cautionSignals})
          </button>
        </div>

        {/* Right Tools: Map Style & Jump to Hubs */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Base Map Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-xl text-xs">
            <button
              onClick={() => setBaseMapStyle('dark')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition ${
                baseMapStyle === 'dark' ? 'bg-[#1e3a8a] text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Dark
            </button>
            <button
              onClick={() => setBaseMapStyle('light')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition ${
                baseMapStyle === 'light' ? 'bg-[#1e3a8a] text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Light
            </button>
            <button
              onClick={() => setBaseMapStyle('satellite')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition ${
                baseMapStyle === 'satellite' ? 'bg-[#1e3a8a] text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Sat
            </button>
          </div>

          {/* Quick Hub Jump Selector */}
          <select
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'ALL') flyTo(22.5, 79.5, 5);
              else if (val === 'NDLS') flyTo(28.6423, 77.22, 12);
              else if (val === 'HWH') flyTo(22.583, 88.3426, 12);
              else if (val === 'CSMT') flyTo(18.944, 72.836, 12);
              else if (val === 'CNB') flyTo(26.4547, 80.3507, 12);
              else if (val === 'DDU') flyTo(25.2818, 83.1234, 12);
              else if (val === 'BZA') flyTo(16.5186, 80.62, 12);
            }}
            className="px-3 py-1.5 rounded-2xl bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
          >
            <option value="ALL">🌐 All-India (z5)</option>
            <option value="NDLS">🏛️ New Delhi (NDLS)</option>
            <option value="HWH">🌉 Howrah Jn (HWH)</option>
            <option value="CSMT">🌊 Mumbai (CSMT)</option>
            <option value="CNB">🚂 Kanpur Central (CNB)</option>
            <option value="DDU">🏭 Mughalsarai / DDU</option>
            <option value="BZA">💎 Vijayawada (BZA)</option>
          </select>
        </div>
      </div>

      {/* -----------------------------------------------------------------------
          TRAIN COCKPIT DRAWER (When a Train is Selected)
          ----------------------------------------------------------------------- */}
      {selectedTrain && (
        <div className="absolute top-20 right-4 z-40 w-96 max-w-[calc(100vw-2rem)] rounded-3xl bg-white/98 dark:bg-[#0f172a]/98 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl p-5 text-slate-800 dark:text-slate-100 animate-in slide-in-from-right-4 duration-200 space-y-4">
          {/* Header with Train Identity */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-extrabold text-base shadow-lg ${
                  selectedTrain.cat === 'VB'
                    ? 'bg-gradient-to-br from-cyan-500 to-blue-600'
                    : selectedTrain.cat === 'RAJ'
                    ? 'bg-gradient-to-br from-red-500 to-amber-600'
                    : selectedTrain.cat === 'FRT'
                    ? 'bg-gradient-to-br from-blue-600 to-orange-500'
                    : 'bg-gradient-to-br from-[#1e3a8a] to-indigo-700'
                }`}
              >
                {selectedTrain.cat}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-lg text-[#1e3a8a] dark:text-sky-400">
                    {selectedTrain.no}
                  </span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    {selectedTrain.cat === 'VB'
                      ? 'Vande Bharat 2.0'
                      : selectedTrain.cat === 'RAJ'
                      ? 'Rajdhani Express'
                      : selectedTrain.cat === 'FRT'
                      ? 'Freight Heavy Rake'
                      : 'Express Fleet'}
                  </span>
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">
                  {selectedTrain.name}
                </h3>
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedTrain(null);
                clearTrainRoute();
                setFollowingTrain(false);
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Locomotive Livery & Traction Spec */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850/80 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1">
            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
              <span>Locomotive Traction:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{selectedTrain.loco}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
              <span>Authentic Livery:</span>
              <span className="font-mono font-semibold text-cyan-600 dark:text-cyan-400">
                {selectedTrain.livery}
              </span>
            </div>
          </div>

          {/* Gauges Grid: Speed, Delay, Signal Aspect */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {/* Speedometer */}
            <div className="p-3 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200/60 dark:border-cyan-800/60">
              <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold uppercase block">Speed</span>
              <div className="font-mono font-black text-xl text-cyan-700 dark:text-cyan-300">
                {selectedTrain.spd}
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">km/h</span>
            </div>

            {/* Delay Status */}
            <div
              className={`p-3 rounded-2xl border ${
                selectedTrain.delay_m === 0
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/60 dark:border-emerald-800/60'
                  : 'bg-red-50 dark:bg-red-950/40 border-red-200/60 dark:border-red-800/60'
              }`}
            >
              <span
                className={`text-[10px] font-bold uppercase block ${
                  selectedTrain.delay_m === 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                Punctuality
              </span>
              <div
                className={`font-mono font-black text-xl ${
                  selectedTrain.delay_m === 0
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-red-700 dark:text-red-300'
                }`}
              >
                {selectedTrain.delay_m === 0 ? 'RT' : `+${selectedTrain.delay_m}m`}
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {selectedTrain.delay_m === 0 ? 'Right Time' : 'Delay'}
              </span>
            </div>

            {/* Signal Aspect */}
            <div
              className={`p-3 rounded-2xl border ${
                selectedTrain.signal === 'GREEN'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/60 text-emerald-600'
                  : selectedTrain.signal === 'RED'
                  ? 'bg-red-50 dark:bg-red-950/40 border-red-200/60 text-red-600'
                  : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200/60 text-amber-600'
              }`}
            >
              <span className="text-[10px] font-bold uppercase block">Signal (ABS)</span>
              <div className="font-mono font-black text-base truncate">{selectedTrain.signal}</div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Gap {selectedTrain.headway_km} km
              </span>
            </div>
          </div>

          {/* Automatic Block Headway Advisory */}
          <div
            className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 ${
              selectedTrain.signal === 'RED'
                ? 'bg-red-50 dark:bg-red-950/30 border-red-300 text-red-800 dark:text-red-300'
                : selectedTrain.signal === 'YELLOW'
                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 text-amber-800 dark:text-amber-300'
                : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 text-emerald-800 dark:text-emerald-300'
            }`}
          >
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[11px]">{selectedTrain.headway_msg}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Automatic Block Signaling calculated across adjacent trains on physical rails.
              </p>
            </div>
          </div>

          {/* Dynamic Time Deletion & Timetable Slack Recovery Card */}
          {selectedTrain.slack_rec && (
            <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/40 border border-indigo-200/80 dark:border-indigo-800/80 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-indigo-700 dark:text-indigo-300 text-[11px]">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>DYNAMIC SLACK RECOVERY ENGINE</span>
              </div>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium">
                {selectedTrain.slack_rec.message}
              </p>
            </div>
          )}

          {/* Route Sector: Current Station -> Next Station */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850/80 border border-slate-200/80 dark:border-slate-800 text-xs">
            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Active Route Sector</span>
            <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
              <span className="truncate max-w-[120px]">{selectedTrain.stn}</span>
              <ArrowRight className="w-3.5 h-3.5 text-cyan-500 shrink-0 mx-2" />
              <span className="truncate max-w-[120px]">{selectedTrain.nstn}</span>
            </div>
          </div>

          {/* Action Buttons: Follow Camera, View FIDS, Predictor */}
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setFollowingTrain(!followingTrain)}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                  followingTrain
                    ? 'bg-sky-500 border-sky-400 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200'
                }`}
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>{followingTrain ? 'Following Lock' : 'Follow Train'}</span>
              </button>

              <button
                onClick={() => openFidsModal(selectedTrain.stn || 'NDLS')}
                className="py-2 px-3 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center justify-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5 text-[#1e3a8a] dark:text-sky-400" />
                <span>Station FIDS</span>
              </button>
            </div>

            {/* Open in Dynamic ETA Predictor */}
            {onSelectTrainForPredictor && (
              <button
                onClick={() => onSelectTrainForPredictor(selectedTrain.no)}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-extrabold bg-[#1e3a8a] hover:bg-[#172554] text-white shadow-lg shadow-blue-900/30 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>⚡ Deep Predict in Dynamic ETA Engine</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* -----------------------------------------------------------------------
          AIRPORT-STYLE STATION LIVE BOARD (FIDS) MODAL
          ----------------------------------------------------------------------- */}
      {showFidsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-4xl max-h-[85vh] rounded-3xl bg-[#0b1120] border border-slate-700 shadow-2xl p-6 text-white flex flex-col space-y-4 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-black text-lg tracking-tight text-white">
                      {fidsData?.station_name || 'Railway Station'} ({fidsData?.station_code || 'NDLS'})
                    </h2>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      LIVE FIDS BOARD
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Airport-Style Digital Departure & Platform Operations Visualizer
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFidsModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Platform Track Schematic (PF 1 to 16) */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                <span>Platform Yard Tracks Layout</span>
                <span>Total Platforms: {fidsData?.total_platforms || 16}</span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {Array.from({ length: fidsData?.total_platforms || 16 }, (_, i) => i + 1).map((pf) => {
                  const docked = fidsData?.platform_occupancy?.[pf];
                  return (
                    <div
                      key={pf}
                      className={`p-2 rounded-xl text-center border transition ${
                        docked
                          ? 'bg-rose-950/60 border-rose-500/60 text-rose-300'
                          : 'bg-slate-800/60 border-slate-700 text-slate-400'
                      }`}
                    >
                      <div className="text-[10px] font-bold text-slate-400">PF {pf}</div>
                      <div className="font-mono font-bold text-xs truncate">
                        {docked ? docked.train_no : 'CLEAR'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Upcoming Trains Table */}
            <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-900 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Train</th>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">Sector</th>
                    <th className="py-2.5 px-3 text-center">PF</th>
                    <th className="py-2.5 px-3 text-center">Exp. Time</th>
                    <th className="py-2.5 px-3 text-center">Delay</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {fidsLoading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Loading station operational feed...
                      </td>
                    </tr>
                  ) : fidsData?.arrivals && fidsData.arrivals.length > 0 ? (
                    fidsData.arrivals.map((arr, i) => (
                      <tr key={i} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3 font-mono font-bold text-sky-400">{arr.no}</td>
                        <td className="py-2.5 px-3 font-semibold text-white max-w-[180px] truncate">{arr.name}</td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px] truncate max-w-[120px]">
                          {arr.from} &rarr; {arr.to}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="font-bold px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            PF {arr.platform}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-white">{arr.expected_time}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`font-bold px-1.5 py-0.5 rounded ${
                              arr.delay_mins === 0
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            {arr.delay_mins === 0 ? 'RT' : `+${arr.delay_mins}m`}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[11px] font-bold text-slate-300">{arr.status}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No active incoming trains within 150 km of this station.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
