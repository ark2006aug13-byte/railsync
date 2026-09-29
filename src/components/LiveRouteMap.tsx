'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
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
  CheckCircle,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Radio,
  Satellite,
  Crosshair,
  TrendingUp,
} from 'lucide-react';
import { DestinationEta } from '../services/api';

export interface LiveRouteMapProps {
  trainNo: string;
  trainName: string;
  origin: string;
  destination: string;
  currentKm: number;
  totalDistanceKm: number;
  currentSpeedKmph: number;
  currentSection: string;
  signalAspect: string;
  stations: DestinationEta[];
  currentLat?: number;
  currentLng?: number;
  bearing?: number;
  isLiveGround?: boolean;
  trackPath?: [number, number][];
  nearestStation?: string;
  nextStation?: string;
  nextStationDistanceKm?: number;
  exactLocationText?: string;
  telemetrySource?: string;
  selectedStationCode?: string | null;
  onSelectStation?: (stationCode: string) => void;
  leadingTrain?: {
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
  };
  weatherCondition?: string;
  signalStatus?: string;
  className?: string;
}

export const LiveRouteMap: React.FC<LiveRouteMapProps> = ({
  trainNo,
  trainName,
  origin,
  destination,
  currentKm,
  totalDistanceKm,
  currentSpeedKmph,
  currentSection,
  signalAspect,
  stations,
  currentLat,
  currentLng,
  bearing = 90,
  isLiveGround = false,
  trackPath = [],
  nearestStation,
  nextStation,
  nextStationDistanceKm,
  exactLocationText,
  telemetrySource,
  selectedStationCode,
  onSelectStation,
  leadingTrain,
  weatherCondition,
  signalStatus,
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const stationsLayerRef = useRef<any>(null);
  const trainLayerRef = useRef<any>(null);
  const leadingTrainLayerRef = useRef<any>(null);
  const trainMarkerRef = useRef<any>(null);
  const stationMarkersMapRef = useRef<Map<string, any>>(new Map());
  const hasInitialCenteredRef = useRef(false);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapStyle, setMapStyle] = useState<'street' | 'satellite'>('street');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [followingTrain, setFollowingTrain] = useState(false);

  // Filter valid stations with valid coordinates
  const validStations = useMemo(
    () => stations.filter((s) => s.lat !== undefined && s.lng !== undefined && !isNaN(s.lat) && !isNaN(s.lng)),
    [stations]
  );

  // Robust coordinate resolution: GPS -> trackPath -> stations -> fallback
  const resolvedCoords = useMemo((): [number, number] => {
    // 1. Direct valid GPS within India bounds (approx 6°N - 38°N, 68°E - 98°E)
    if (
      currentLat !== undefined &&
      currentLat !== null &&
      !isNaN(currentLat) &&
      currentLng !== undefined &&
      currentLng !== null &&
      !isNaN(currentLng) &&
      currentLat >= 6.0 &&
      currentLat <= 38.0 &&
      currentLng >= 68.0 &&
      currentLng <= 98.0
    ) {
      return [currentLat, currentLng];
    }

    // 2. Interpolate along trackPath based on currentKm / totalDistanceKm
    if (trackPath && trackPath.length > 1 && totalDistanceKm > 0 && currentKm > 0) {
      const ratio = Math.min(1, Math.max(0, currentKm / totalDistanceKm));
      const targetIdx = Math.min(
        trackPath.length - 1,
        Math.floor(ratio * (trackPath.length - 1))
      );
      const pt = trackPath[targetIdx];
      if (pt && !isNaN(pt[0]) && !isNaN(pt[1])) {
        return [pt[0], pt[1]];
      }
    }

    // 3. Fallback to station matching currentKm or first/current station
    if (validStations.length > 0) {
      if (currentKm > 0) {
        let closestStn = validStations[0];
        let minDiff = Infinity;
        for (const stn of validStations) {
          const diff = Math.abs((stn.distanceKm || 0) - currentKm);
          if (diff < minDiff && stn.lat && stn.lng) {
            minDiff = diff;
            closestStn = stn;
          }
        }
        if (closestStn.lat && closestStn.lng) {
          return [closestStn.lat, closestStn.lng];
        }
      }
      const cur = validStations.find((s) => (s.status || '').toUpperCase() === 'CURRENT');
      if (cur?.lat && cur?.lng) return [cur.lat, cur.lng];

      return [validStations[0].lat!, validStations[0].lng!];
    }

    // 4. Safe Default (Kanpur Central on main Delhi-Howrah Trunk Corridor)
    return [26.4547, 80.3507];
  }, [currentLat, currentLng, trackPath, totalDistanceKm, currentKm, validStations]);

  const [trainLat, trainLng] = resolvedCoords;

  // -------------------------------------------------------------------------
  // 1. Initialize Leaflet Map
  // -------------------------------------------------------------------------
  useEffect(() => {
    let isCancelled = false;

    const initMap = async () => {
      if (typeof window === 'undefined' || !mapContainerRef.current) return;
      if (mapInstanceRef.current) return;

      const L = (await import('leaflet')).default;
      if (isCancelled || !mapContainerRef.current) return;

      const centerCoords: [number, number] = [trainLat, trainLng];

      const map = L.map(mapContainerRef.current, {
        center: centerCoords,
        zoom: 10,
        zoomControl: false,
        attributionControl: false,
      });

      // Carto Voyager Street Map Layer
      const streetLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          maxZoom: 19,
          subdomains: 'abcd',
        }
      );

      // ArcGIS World Imagery Satellite Layer
      const satelliteLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 18,
        }
      );

      streetLayer.addTo(map);

      L.control
        .attribution({
          position: 'bottomright',
          prefix:
            '<span class="text-[10px] text-slate-500 font-sans">RailSync &bull; ISRO Satellite Real-Time Stream</span>',
        })
        .addTo(map);

      // Dedicated layer groups for high performance
      const routeGroup = L.layerGroup().addTo(map);
      const stationsGroup = L.layerGroup().addTo(map);
      const trainGroup = L.layerGroup().addTo(map);
      const leadingTrainGroup = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;
      (map as any)._streetLayer = streetLayer;
      (map as any)._satelliteLayer = satelliteLayer;
      routeLayerRef.current = routeGroup;
      stationsLayerRef.current = stationsGroup;
      trainLayerRef.current = trainGroup;
      leadingTrainLayerRef.current = leadingTrainGroup;

      map.on('dragstart', () => {
        setFollowingTrain(false);
      });

      // Fix Next.js dynamic Leaflet container dimensions
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 150);
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 500);

      setMapLoaded(true);
    };

    initMap();

    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      isCancelled = true;
      window.removeEventListener('resize', handleResize);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // -------------------------------------------------------------------------
  // 2. Toggle Street / Satellite layer
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const street = (map as any)._streetLayer;
    const satellite = (map as any)._satelliteLayer;

    if (mapStyle === 'satellite') {
      if (map.hasLayer(street)) map.removeLayer(street);
      if (!map.hasLayer(satellite)) map.addLayer(satellite);
    } else {
      if (map.hasLayer(satellite)) map.removeLayer(satellite);
      if (!map.hasLayer(street)) map.addLayer(street);
    }
  }, [mapStyle]);

  // -------------------------------------------------------------------------
  // 3. Render Curved Track Polylines & Station Halts
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;

    let isMounted = true;

    const renderTracksAndStations = async () => {
      const L = (await import('leaflet')).default;
      if (!isMounted || !mapInstanceRef.current) return;

      const map = mapInstanceRef.current;
      const routeGroup = routeLayerRef.current;
      const stationsGroup = stationsLayerRef.current;

      routeGroup.clearLayers();
      stationsGroup.clearLayers();
      stationMarkersMapRef.current.clear();

      if (validStations.length === 0 && trackPath.length === 0) return;

      // Authentic Curved Track Geometry from Indian Railways Dataset
      let fullTrackPoints: [number, number][] = [];
      if (trackPath && trackPath.length > 1) {
        fullTrackPoints = trackPath.map(([lat, lng]) => [lat, lng]);
      } else {
        validStations.forEach((stn) => {
          fullTrackPoints.push([stn.lat!, stn.lng!]);
          if (stn.intermediateStations && stn.intermediateStations.length > 0) {
            stn.intermediateStations.forEach((im) => {
              if (im.lat && im.lng) {
                fullTrackPoints.push([im.lat, im.lng]);
              }
            });
          }
        });
      }

      if (fullTrackPoints.length > 0) {
        // Find closest point to train GPS
        let closestIdx = 0;
        let minDistance = Infinity;
        for (let i = 0; i < fullTrackPoints.length; i++) {
          const [pLat, pLng] = fullTrackPoints[i];
          const dist = Math.hypot(pLat - trainLat, pLng - trainLng);
          if (dist < minDistance) {
            minDistance = dist;
            closestIdx = i;
          }
        }

        const passedPoints: [number, number][] = fullTrackPoints.slice(0, closestIdx + 1);
        passedPoints.push([trainLat, trainLng]);

        const upcomingPoints: [number, number][] = [
          [trainLat, trainLng],
          ...fullTrackPoints.slice(closestIdx + 1),
        ];

        // 1. Permanent Way Trackbed Ballast Casing
        L.polyline(fullTrackPoints, {
          color: mapStyle === 'satellite' ? '#CBD5E1' : '#94A3B8',
          weight: 7,
          opacity: mapStyle === 'satellite' ? 0.45 : 0.35,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(routeGroup);

        // 2. Traversed Track (Emerald Green with railway dashes)
        if (passedPoints.length > 1) {
          L.polyline(passedPoints, {
            color: '#10B981',
            weight: 4,
            opacity: 0.9,
            dashArray: '3, 6',
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(routeGroup);
        }

        // 3. Upcoming Track (Crisp Google Maps Transit Blue)
        if (upcomingPoints.length > 1) {
          L.polyline(upcomingPoints, {
            color: mapStyle === 'satellite' ? '#38BDF8' : '#1E3A8A',
            weight: 4.5,
            opacity: 0.95,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(routeGroup);
        }

        // Camera bounds: Only fit corridor bounds on initial render IF train hasn't centered yet
        if (!hasInitialCenteredRef.current && !followingTrain && fullTrackPoints.length > 0) {
          if (!trainLat || !trainLng) {
            const bounds = L.latLngBounds(fullTrackPoints);
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 11 });
          }
        }
      }

      // Station Pins with Platform Badges
      validStations.forEach((stn, idx) => {
        const isOrigin = idx === 0;
        const isDestination = idx === validStations.length - 1;
        const isPassed = (stn.status || '').toUpperCase() === 'PASSED';
        const isCurrent = (stn.status || '').toUpperCase() === 'CURRENT';
        const isLate = (stn.netDelayMin || 0) > 3;

        const pinHtml = `
          <div class="relative group cursor-pointer flex flex-col items-center">
            ${isCurrent ? `<div class="absolute -inset-2 rounded-full bg-blue-500/30 animate-ping"></div>` : ''}
            <div class="w-6 h-6 rounded-full flex items-center justify-center shadow-md transition-transform duration-200 hover:scale-125 border-2 ${
              isOrigin
                ? 'bg-emerald-600 border-white text-white'
                : isDestination
                ? 'bg-indigo-700 border-white text-white'
                : isCurrent
                ? 'bg-[#1E3A8A] border-white text-white ring-2 ring-blue-400'
                : isPassed
                ? 'bg-emerald-500 border-white text-white'
                : 'bg-white border-[#1E3A8A] text-[#1E3A8A]'
            }">
              ${
                isOrigin
                  ? '<span class="text-[9px] font-black">A</span>'
                  : isDestination
                  ? '<span class="text-[9px] font-black">B</span>'
                  : isPassed
                  ? '<svg class="w-3 h-3 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>'
                  : `<span class="w-1.5 h-1.5 rounded-full ${isCurrent ? 'bg-white' : 'bg-[#1E3A8A]'}"></span>`
              }
            </div>
            <div class="mt-1 px-1.5 py-0.5 rounded-md bg-white/95 backdrop-blur-xs border border-slate-200/80 shadow-xs whitespace-nowrap pointer-events-none">
              <span class="text-[10px] font-bold text-slate-800 tracking-tight">${stn.stationCode}</span>
            </div>
          </div>
        `;

        const customIcon = L.divIcon({
          html: pinHtml,
          className: 'custom-station-pin',
          iconSize: [40, 48],
          iconAnchor: [20, 24],
          popupAnchor: [0, -26],
        });

        const marker = L.marker([stn.lat!, stn.lng!], { icon: customIcon }).addTo(stationsGroup);
        stationMarkersMapRef.current.set(stn.stationCode, marker);

        const schedTime =
          stn.scheduledArrivalFmt || (stn.scheduledArrival ? stn.scheduledArrival.slice(11, 16) : '--:--');
        const dynTime =
          stn.dynamicEtaFmt || (stn.dynamicEta ? stn.dynamicEta.slice(11, 16) : '--:--');
        const delayVal = Math.round(stn.netDelayMin || 0);

        const popupContent = `
          <div class="p-3.5 min-w-[230px] max-w-[280px] font-sans">
            <div class="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <span class="text-[10px] uppercase font-bold tracking-wider ${
                  isPassed ? 'text-slate-400' : 'text-[#1E3A8A]'
                }">
                  ${isOrigin ? 'Origin Station' : isDestination ? 'Terminal Destination' : 'Halt Station'}
                </span>
                <h4 class="text-sm font-extrabold text-slate-900 leading-tight">
                  ${stn.stationName} <span class="font-mono text-xs text-slate-500">(${stn.stationCode})</span>
                </h4>
              </div>
              <span class="px-2 py-0.5 rounded-md bg-blue-50 text-[#1E3A8A] text-xs font-bold border border-blue-200/70">
                PF ${stn.platform || '1'}
              </span>
            </div>

            <div class="py-2.5 space-y-1.5 text-xs">
              <div class="flex items-center justify-between">
                <span class="text-slate-500">Scheduled:</span>
                <span class="font-mono ${isLate ? 'line-through text-slate-400' : 'font-semibold text-slate-700'}">${schedTime}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-slate-700 font-bold">Dynamic ETA:</span>
                <span class="font-mono font-black text-[#1E3A8A] text-sm">${dynTime}</span>
              </div>
              <div class="flex items-center justify-between pt-1">
                <span class="text-slate-500">Status:</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isPassed
                    ? 'bg-slate-100 text-slate-600'
                    : delayVal <= 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }">
                  ${isPassed ? 'Departed' : delayVal > 0 ? `+${delayVal}m Late` : 'On-Time'}
                </span>
              </div>
            </div>

            <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Distance: <strong>${Math.round(stn.distanceKm || 0)} KM</strong></span>
              <button 
                id="popup-btn-${stn.stationCode}"
                class="text-[#1E3A8A] font-bold hover:underline cursor-pointer"
              >
                Focus Details &rarr;
              </button>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent, { maxWidth: 300 });

        marker.on('popupopen', () => {
          const btn = document.getElementById(`popup-btn-${stn.stationCode}`);
          if (btn && onSelectStation) {
            btn.onclick = () => onSelectStation(stn.stationCode);
          }
        });

        marker.on('click', () => {
          if (onSelectStation) {
            onSelectStation(stn.stationCode);
          }
        });
      });
    };

    renderTracksAndStations();

    return () => {
      isMounted = false;
    };
  }, [mapLoaded, validStations, trackPath, mapStyle]);

  // -------------------------------------------------------------------------
  // 4. Render Live Moving Train Marker with Directional Bearing & Telemetry
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;

    let isMounted = true;

    const renderTrainMarker = async () => {
      const L = (await import('leaflet')).default;
      if (!isMounted || !mapInstanceRef.current) return;

      const trainHeadingDeg = Math.round(bearing || 90);

      const trainPinHtml = `
        <div class="relative group cursor-pointer flex flex-col items-center">
          <div class="absolute -inset-4 rounded-full bg-blue-500/25 animate-ping"></div>
          <div class="absolute -inset-2.5 rounded-full bg-blue-600/35 train-beacon-aura"></div>
          
          <div class="absolute -top-[34px] px-2.5 py-0.5 rounded-full bg-slate-900/95 text-white font-mono text-[10px] font-bold shadow-xl flex items-center gap-1.5 border border-slate-700/80 whitespace-nowrap z-30">
            <span class="w-1.5 h-1.5 rounded-full ${isLiveGround ? 'bg-emerald-400 animate-ping' : 'bg-blue-400 animate-pulse'}"></span>
            <span>${currentSpeedKmph} km/h</span>
            ${
              isLiveGround
                ? '<span class="text-[8px] uppercase tracking-wide text-emerald-300 font-sans font-black px-1 py-0.2 rounded bg-emerald-950/80 border border-emerald-500/40">GPS LIVE</span>'
                : ''
            }
          </div>

          <div class="w-10 h-10 rounded-full bg-[#1E3A8A] text-white flex items-center justify-center shadow-2xl border-2 border-white ring-2 ring-blue-500/90 transform hover:scale-115 transition-all z-20" style="box-shadow: 0 4px 16px rgba(30, 58, 138, 0.5);">
            <div style="transform: rotate(${trainHeadingDeg}deg); transition: transform 0.5s ease-out;" class="flex items-center justify-center">
              <svg class="w-5 h-5 fill-current text-white" viewBox="0 0 24 24">
                <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
              </svg>
            </div>
          </div>
        </div>
      `;

      const trainIcon = L.divIcon({
        html: trainPinHtml,
        className: 'custom-train-pin',
        iconSize: [48, 48],
        iconAnchor: [24, 24],
        popupAnchor: [0, -28],
      });

      const trainPopupContent = `
        <div class="p-4 min-w-[260px] max-w-[320px] font-sans">
          <div class="flex items-center gap-2.5 pb-2.5 border-b border-slate-100">
            <div class="w-8 h-8 rounded-lg bg-[#1E3A8A] text-white flex items-center justify-center shadow-xs shrink-0">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <span class="text-[10px] uppercase font-bold tracking-wider ${
                isLiveGround ? 'text-emerald-600' : 'text-blue-600'
              } block flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full ${
                  isLiveGround ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'
                }"></span>
                ${isLiveGround ? 'ISRO RTIS Ground GPS (Live 1s)' : 'Real-Time Telemetry Stream'}
              </span>
              <h4 class="text-xs font-black text-slate-900 leading-tight">
                ${trainNo} &bull; ${trainName}
              </h4>
            </div>
          </div>

          <div class="py-2.5 space-y-1.5 text-xs">
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Ground Speed:</span>
              <span class="font-mono font-extrabold text-[#1E3A8A] text-sm">${currentSpeedKmph} km/h</span>
            </div>
            ${
              nearestStation
                ? `
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Nearest Station:</span>
              <span class="font-semibold text-slate-800">${nearestStation}</span>
            </div>`
                : ''
            }
            ${
              nextStation
                ? `
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Next Station:</span>
              <span class="font-semibold text-blue-800">${nextStation} ${
                    nextStationDistanceKm ? `(${nextStationDistanceKm} km)` : ''
                  }</span>
            </div>`
                : ''
            }
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Active Section:</span>
              <span class="font-medium text-slate-700">${currentSection}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Route Progress:</span>
              <span class="font-mono font-bold text-slate-700">${Math.round(currentKm)} / ${Math.round(
          totalDistanceKm
        )} KM</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Signal Aspect:</span>
              <span class="px-2 py-0.5 rounded font-bold text-[10px] ${
                signalAspect.includes('GREEN')
                  ? 'bg-emerald-100 text-emerald-800'
                  : signalAspect.includes('YELLOW')
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-red-100 text-red-800'
              }">
                ${signalAspect.replace('_', ' ')}
              </span>
            </div>
          </div>

          <div class="pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-mono flex items-center justify-between">
            <span>GPS: ${trainLat.toFixed(5)}° N, ${trainLng.toFixed(5)}° E</span>
            <span>Bearing: ${trainHeadingDeg}°</span>
          </div>
        </div>
      `;

      const trainGroup = trainLayerRef.current;
      if (trainMarkerRef.current) {
        trainMarkerRef.current.setLatLng([trainLat, trainLng]);
        trainMarkerRef.current.setIcon(trainIcon);
        const popup = trainMarkerRef.current.getPopup();
        if (popup && popup.isOpen()) {
          popup.setContent(trainPopupContent);
        } else {
          trainMarkerRef.current.setPopupContent(trainPopupContent);
        }
      } else {
        const trainMarker = L.marker([trainLat, trainLng], {
          icon: trainIcon,
          zIndexOffset: 3000,
        }).addTo(trainGroup);
        trainMarker.bindPopup(trainPopupContent, { maxWidth: 320 });
        trainMarkerRef.current = trainMarker;
      }

      if (mapInstanceRef.current) {
        if (!hasInitialCenteredRef.current) {
          mapInstanceRef.current.setView([trainLat, trainLng], 10, { animate: false });
          hasInitialCenteredRef.current = true;
        } else if (followingTrain) {
          mapInstanceRef.current.panTo([trainLat, trainLng]);
        }
      }
    };

    renderTrainMarker();

    return () => {
      isMounted = false;
    };
  }, [
    mapLoaded,
    trainLat,
    trainLng,
    bearing,
    isLiveGround,
    currentSpeedKmph,
    currentKm,
    totalDistanceKm,
    currentSection,
    signalAspect,
    nearestStation,
    nextStation,
    nextStationDistanceKm,
    trainNo,
    trainName,
    followingTrain,
  ]);

  // -------------------------------------------------------------------------
  // 4b. Render Leading Train Convoy Marker & Dynamic Headway Radar Line
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !leadingTrainLayerRef.current) return;
    let isMounted = true;

    const renderLeadingTrain = async () => {
      const L = (await import('leaflet')).default;
      if (!isMounted || !mapInstanceRef.current || !leadingTrainLayerRef.current) return;

      const group = leadingTrainLayerRef.current;
      group.clearLayers();

      if (!leadingTrain) return;

      const leadLat = leadingTrain.lat;
      const leadLng = leadingTrain.lng;
      const leadNo = leadingTrain.trainNo || leadingTrain.train_no || '12876';
      const leadName = leadingTrain.name || 'Neelachal Express';
      const leadSpeed = leadingTrain.speedKmph || leadingTrain.speed_kmph || 95;
      const gapKm = leadingTrain.headwayGapKm || leadingTrain.headway_gap_km || 18.5;

      if (leadLat !== undefined && leadLng !== undefined && !isNaN(leadLat) && !isNaN(leadLng)) {
        // Headway Radar Line from our train to leading train
        const headwayPolyline = L.polyline(
          [[trainLat, trainLng], [leadLat, leadLng]],
          {
            color: signalAspect.includes('GREEN') ? '#10B981' : signalAspect.includes('YELLOW') ? '#F59E0B' : '#EF4444',
            weight: 3,
            opacity: 0.85,
            dashArray: '6, 8',
          }
        ).addTo(group);

        headwayPolyline.bindTooltip(`${gapKm.toFixed(1)} km Headway Gap`, {
          permanent: false,
          direction: 'center',
          className: 'bg-slate-900 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded shadow',
        });

        // Leading Train Ghost Marker
        const leadHtml = `
          <div class="relative group cursor-pointer flex flex-col items-center">
            <div class="absolute -inset-3 rounded-full bg-amber-500/20 animate-pulse"></div>
            <div class="w-8 h-8 rounded-full bg-slate-900 border-2 border-amber-400 text-amber-300 flex items-center justify-center shadow-lg transition-transform duration-200 hover:scale-125">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div class="mt-1 px-2 py-0.5 rounded-md bg-slate-900/90 text-amber-300 font-mono text-[9px] font-bold shadow-md whitespace-nowrap border border-amber-400/50">
              Leading: ${leadNo} (${gapKm.toFixed(1)} km ahead)
            </div>
          </div>
        `;

        const leadIcon = L.divIcon({
          html: leadHtml,
          className: 'custom-leading-train-icon',
          iconSize: [44, 48],
          iconAnchor: [22, 24],
          popupAnchor: [0, -26],
        });

        const leadMarker = L.marker([leadLat, leadLng], { icon: leadIcon }).addTo(group);

        const leadPopup = `
          <div class="p-3.5 min-w-[240px] max-w-[290px] font-sans">
            <div class="flex items-center gap-2 pb-2 border-b border-slate-100">
              <div class="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-700 flex items-center justify-center font-bold text-xs">
                LT
              </div>
              <div>
                <span class="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Leading Convoy Ahead</span>
                <h4 class="text-xs font-black text-slate-900">${leadNo} &bull; ${leadName}</h4>
              </div>
            </div>
            <div class="py-2 space-y-1.5 text-xs">
              <div class="flex justify-between">
                <span class="text-slate-500">Headway Buffer:</span>
                <span class="font-mono font-bold text-amber-600">${gapKm.toFixed(1)} KM</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Cruising Speed:</span>
                <span class="font-mono font-bold text-slate-700">${leadSpeed} km/h</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Impact on Trailing Train:</span>
                <span class="text-[11px] font-semibold text-slate-700">
                  ${gapKm > 15 ? 'Clear Green (No restriction)' : 'Double Yellow (Caution aspect)'}
                </span>
              </div>
            </div>
          </div>
        `;
        leadMarker.bindPopup(leadPopup);
      }
    };

    renderLeadingTrain();

    return () => {
      isMounted = false;
    };
  }, [mapLoaded, leadingTrain, trainLat, trainLng, signalAspect]);

  // -------------------------------------------------------------------------
  // 5. Synchronize Selected Station (Focus from Left Timetable Spine)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !selectedStationCode) return;
    const marker = stationMarkersMapRef.current.get(selectedStationCode);
    if (marker) {
      const latLng = marker.getLatLng();
      mapInstanceRef.current.flyTo(latLng, 12, {
        animate: true,
        duration: 1.2,
      });
      marker.openPopup();
    } else {
      const stn = validStations.find((s) => s.stationCode === selectedStationCode);
      if (stn?.lat && stn?.lng) {
        mapInstanceRef.current.flyTo([stn.lat, stn.lng], 12, {
          animate: true,
          duration: 1.2,
        });
      }
    }
  }, [selectedStationCode, mapLoaded, validStations]);

  // Controls
  const handleCenterTrain = () => {
    if (!mapInstanceRef.current) return;
    setFollowingTrain(true);
    mapInstanceRef.current.flyTo([trainLat, trainLng], 12, {
      animate: true,
      duration: 1.0,
    });
    if (trainMarkerRef.current) {
      trainMarkerRef.current.openPopup();
    }
  };

  const handleFitRoute = async () => {
    if (!mapInstanceRef.current) return;
    const L = (await import('leaflet')).default;
    const points: [number, number][] =
      trackPath && trackPath.length > 0 ? trackPath : validStations.map((s) => [s.lat!, s.lng!]);
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points);
    mapInstanceRef.current.fitBounds(bounds, {
      padding: [50, 50],
      animate: true,
      duration: 1.2,
    });
    setFollowingTrain(false);
  };

  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };

  return (
    <div
      className={`relative w-full h-full min-h-[500px] sm:min-h-[620px] rounded-2xl overflow-hidden border border-[#E2E8F0] shadow-sm bg-[#F5F3E9] ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-0 min-h-screen' : ''
      } ${className}`}
    >
      <div ref={mapContainerRef} className="w-full h-full min-h-[500px] sm:min-h-[620px] z-0" />

      {/* Google Maps Style Header Ribbon */}
      <div className="absolute top-3 left-3 right-14 sm:right-auto z-10 flex flex-col gap-1.5 max-w-lg">
        <div className="bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-xl shadow-lg border border-slate-200/90 flex items-center justify-between gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#1E3A8A] text-white flex items-center justify-center shadow-xs shrink-0">
              <Train className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-black text-slate-900 leading-none">
                  {trainNo} &bull; {origin} &rarr; {destination}
                </span>
                {isLiveGround && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-black tracking-tight border border-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    LIVE GPS
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500 font-medium leading-tight block mt-0.5">
                {exactLocationText || `Section ${currentSection} • ${nearestStation || 'Approaching Route'}`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-2.5 py-1 rounded-full text-xs font-black font-mono shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{currentSpeedKmph} KM/H</span>
          </div>
        </div>

        {nextStation && (
          <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-medium shadow-md border border-slate-800 self-start">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
            <span>
              Next Halt: <strong className="text-blue-300 font-bold">{nextStation}</strong>
              {nextStationDistanceKm ? ` (${nextStationDistanceKm} KM)` : ''}
            </span>
            <span className="text-slate-400">&bull;</span>
            <span className="text-slate-300">Bearing: {Math.round(bearing || 0)}°</span>
          </div>
        )}
      </div>

      {/* Floating Controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setMapStyle((s) => (s === 'street' ? 'satellite' : 'street'))}
          className={`w-9 h-9 rounded-xl shadow-md border flex items-center justify-center transition-all cursor-pointer ${
            mapStyle === 'satellite'
              ? 'bg-[#1E3A8A] text-white border-blue-600'
              : 'bg-white/95 backdrop-blur-md border-slate-200 text-slate-700 hover:text-[#1E3A8A] hover:bg-slate-50'
          }`}
          title={mapStyle === 'street' ? 'Switch to Satellite Imagery' : 'Switch to Street Daytime Map'}
        >
          <Layers className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleCenterTrain}
          className="w-9 h-9 rounded-xl bg-white/95 backdrop-blur-md shadow-md border border-slate-200 flex items-center justify-center text-[#1E3A8A] hover:bg-blue-50 transition-all cursor-pointer group"
          title="Center on Live Moving Train (GPS Focus)"
        >
          <Crosshair className="w-4 h-4 group-hover:scale-110 transition-transform" />
        </button>

        <button
          type="button"
          onClick={handleFitRoute}
          className="w-9 h-9 rounded-xl bg-white/95 backdrop-blur-md shadow-md border border-slate-200 flex items-center justify-center text-slate-700 hover:text-[#1E3A8A] hover:bg-slate-50 transition-all cursor-pointer"
          title="Fit Entire Corridor Route"
        >
          <Compass className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setIsFullscreen((f) => !f)}
          className="w-9 h-9 rounded-xl bg-white/95 backdrop-blur-md shadow-md border border-slate-200 flex items-center justify-center text-slate-700 hover:text-[#1E3A8A] hover:bg-slate-50 transition-all cursor-pointer"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        <div className="flex flex-col rounded-xl bg-white/95 backdrop-blur-md shadow-md border border-slate-200 overflow-hidden mt-1">
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-9 h-9 flex items-center justify-center text-slate-700 hover:text-[#1E3A8A] hover:bg-slate-50 transition-all cursor-pointer border-b border-slate-100"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-9 h-9 flex items-center justify-center text-slate-700 hover:text-[#1E3A8A] hover:bg-slate-50 transition-all cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tactical Railway HUD: Leading Train, Signal Aspect, Weather & Kavach */}
      <div className="absolute bottom-12 left-3 z-10 hidden sm:flex items-center gap-2 flex-wrap max-w-2xl pointer-events-none">
        {/* Signal Aspect Pill */}
        <div className="bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-lg border border-slate-700/80 text-white flex items-center gap-2 pointer-events-auto">
          <span className={`w-2.5 h-2.5 rounded-full ${
            signalAspect.includes('GREEN')
              ? 'bg-emerald-400 shadow-[0_0_8px_#10B981]'
              : signalAspect.includes('YELLOW')
              ? 'bg-amber-400 shadow-[0_0_8px_#F59E0B]'
              : 'bg-red-500 shadow-[0_0_8px_#EF4444]'
          }`}></span>
          <span className="text-[11px] font-bold font-mono">
            {signalStatus || `Signal: ${signalAspect.replace('_', ' ')}`}
          </span>
        </div>

        {/* Leading Train Pill */}
        {leadingTrain && (
          <div className="bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-lg border border-slate-700/80 text-white flex items-center gap-2 pointer-events-auto">
            <span className="text-amber-400 text-xs font-bold">Ahead:</span>
            <span className="text-[11px] font-medium text-slate-200">
              <strong className="text-amber-300 font-mono">{leadingTrain.trainNo || leadingTrain.train_no}</strong> ({Number(leadingTrain.headwayGapKm || leadingTrain.headway_gap_km || 18.5).toFixed(1)} km)
            </span>
          </div>
        )}

        {/* Weather Status Pill */}
        {weatherCondition && (
          <div className="bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-lg border border-slate-700/80 text-white flex items-center gap-2 pointer-events-auto">
            <span className="text-blue-400 text-xs font-bold">Weather:</span>
            <span className="text-[11px] font-medium text-slate-200 truncate max-w-[220px]">
              {weatherCondition}
            </span>
          </div>
        )}

        {/* Kavach ATP Active Badge */}
        <div className="bg-blue-950/95 backdrop-blur-md px-2.5 py-1.5 rounded-xl shadow-lg border border-blue-500/50 text-blue-200 flex items-center gap-1.5 pointer-events-auto">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
          <span className="text-[10px] font-mono font-bold tracking-tight">KAVACH ATP GUARD</span>
        </div>
      </div>

      {/* Floating Bottom Legend */}
      <div className="absolute bottom-3 left-3 z-10 hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-md text-[11px] text-slate-600">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span>Traversed Track</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#1E3A8A] ring-2 ring-blue-300"></span>
          <span>Train GPS ({trainLat.toFixed(4)}°, {trainLng.toFixed(4)}°)</span>
        </div>
        {leadingTrain && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-amber-200"></span>
            <span>Leading Convoy ({leadingTrain.trainNo || leadingTrain.train_no})</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-white border-2 border-[#1E3A8A]"></span>
          <span>Upcoming Halts</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-1 rounded-full bg-[#1E3A8A]"></span>
          <span>Curved Railway Corridor</span>
        </div>
      </div>
    </div>
  );
};
