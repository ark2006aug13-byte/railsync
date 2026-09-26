import React, { useState } from 'react';
import { 
  Search, 
  Zap, 
  Radio, 
  Clock, 
  MapPin, 
  Gauge, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle,
  Cpu,
  Compass,
  Train,
  Sliders,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { AppView } from '../../types';

interface HomeScreenProps {
  onNavigate: (view: AppView) => void;
  onSelectTrain: (trainNo: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate, onSelectTrain }) => {
  const [searchQuery, setSearchQuery] = useState('12302 Kolkata Rajdhani');
  const [activeSearchTab, setActiveSearchTab] = useState<'train' | 'station'>('train');

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.includes('22436') || searchQuery.toLowerCase().includes('vande')) {
      onSelectTrain('22436');
      onNavigate('train-status');
    } else {
      onSelectTrain('12302');
      onNavigate('train-status');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-10">
      {/* Hero Section */}
      <div className="text-center space-y-4 max-w-3xl mx-auto pt-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>AI Tracking Live</span>
          <span className="text-blue-300">•</span>
          <span>4,200+ Coaching Trains</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-extrabold text-[#0b1c30] tracking-tight">
          RailPulse <span className="text-blue-600">AI</span>
        </h1>

        <div className="inline-block">
          <span className="text-xs font-mono font-bold tracking-widest text-slate-500 uppercase bg-slate-100 px-3 py-1 rounded-md border border-slate-200">
            INDIAN RAILWAYS DYNAMIC ETA SYSTEM
          </span>
        </div>

        <p className="text-slate-600 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
          Real-time, neural-network powered arrival predictions that calculate speed gradients, track headway, and loop-line clearances instead of static timetables.
        </p>
      </div>

      {/* Main Search Component */}
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-200/90 p-5 md:p-6 transition-all hover:border-blue-300">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSearchTab('train')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                activeSearchTab === 'train' 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              By Train Number / Name
            </button>
            <button
              onClick={() => setActiveSearchTab('station')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                activeSearchTab === 'station' 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              By Station / PNR
            </button>
          </div>

          <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
            ISRO NavIC RTIS 30s Loop
          </span>
        </div>

        <form onSubmit={handleTrackSubmit} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. 12302 Kolkata Rajdhani or 22436 Vande Bharat"
                className="w-full pl-11 pr-4 py-3 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
              Track Dynamic ETA
            </button>
          </div>

          {/* Sub-metrics strip under search */}
          <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 font-mono">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1 text-slate-700 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                RTIS Locomotive Unit #31940
              </span>
              <span>Speed: <strong className="text-slate-800">128 km/h</strong></span>
            </div>
            <div className="text-emerald-700 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Neural Confidence 98.4%
            </div>
          </div>
        </form>

        {/* Trending Corridors */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="text-xs font-semibold text-slate-500 mb-2.5 uppercase tracking-wider">
            Trending Superfast Corridors
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                onSelectTrain('12302');
                onNavigate('train-status');
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-xs text-slate-700 font-medium flex items-center gap-2 transition-all cursor-pointer group"
            >
              <span className="font-bold text-slate-900 group-hover:text-blue-600">12302 Kolkata Rajdhani</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">+20m</span>
            </button>

            <button
              onClick={() => {
                onSelectTrain('22436');
                onNavigate('train-status');
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-xs text-slate-700 font-medium flex items-center gap-2 transition-all cursor-pointer group"
            >
              <span className="font-bold text-slate-900 group-hover:text-blue-600">22436 Vande Bharat</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">Live ⚡</span>
            </button>

            <button
              onClick={() => {
                onSelectTrain('12424');
                onNavigate('operations-console');
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-xs text-slate-700 font-medium flex items-center gap-2 transition-all cursor-pointer group"
            >
              <span className="font-bold text-slate-900 group-hover:text-blue-600">12424 Dibrugarh Rajdhani</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-800 font-semibold">Berth Overlap</span>
            </button>

            <button
              onClick={() => {
                onSelectTrain('12004');
                onNavigate('operations-console');
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-xs text-slate-700 font-medium flex items-center gap-2 transition-all cursor-pointer group"
            >
              <span className="font-bold text-slate-900 group-hover:text-blue-600">12004 Shatabdi</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">On Time</span>
            </button>

            <button
              onClick={() => {
                onSelectTrain('12952');
                onNavigate('operations-console');
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-xs text-slate-700 font-medium flex items-center gap-2 transition-all cursor-pointer group"
            >
              <span className="font-bold text-slate-900 group-hover:text-blue-600">12952 MMCT Rajdhani</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">Approaching</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Highlight Card: 22436 Vande Bharat Express */}
      <div className="max-w-4xl mx-auto bg-gradient-to-b from-[#0c1c33] to-[#081224] rounded-2xl shadow-xl text-white border border-[#1b3457] overflow-hidden">
        {/* Top bar */}
        <div className="px-6 py-4 border-b border-[#1b3457] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-tight text-white">22436 Vande Bharat Express</span>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/40 text-xs font-semibold">
              Semi-High Speed
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onSelectTrain('12302');
                onNavigate('train-status');
              }}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>View 12302 Rajdhani Live</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Route info */}
        <div className="px-6 pt-4 pb-2 text-slate-300 text-xs flex flex-wrap items-center justify-between gap-2">
          <div>
            Varanasi Jn (BSB) <span className="text-slate-500">→</span> New Delhi (NDLS) • <span className="text-slate-400">Rake Type: WAP-5 Twin V-16</span>
          </div>
          <div className="font-mono text-emerald-400 font-semibold bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-500/30">
            NEXT MAJOR STOP (NDLS) 13:42 hrs (9m ahead of schedule)
          </div>
        </div>

        {/* Dynamic Route Progress Bar */}
        <div className="px-6 py-5 bg-[#091528]/80 border-y border-[#162a47]">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-3 font-mono">
            <span>Passed: <strong>Kanpur Central (CNB)</strong></span>
            <span className="text-emerald-400 font-semibold">Current Block Clearance: Green Signal #84</span>
            <span>Approaching: <strong>Aligarh Jn (ALJN)</strong></span>
          </div>

          {/* Progress track */}
          <div className="relative py-4">
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-400 to-emerald-400 w-[72%] rounded-full shadow-lg shadow-blue-500/50"></div>
            </div>

            {/* Station nodes */}
            <div className="absolute top-1/2 -translate-y-1/2 w-full flex justify-between pointer-events-none px-1">
              {/* Node 1 */}
              <div className="flex flex-col items-center">
                <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow"></div>
                <span className="text-[11px] font-bold text-slate-300 mt-2">BSB</span>
                <span className="text-[9px] text-slate-500">06:00 Depart</span>
              </div>

              {/* Node 2 */}
              <div className="flex flex-col items-center">
                <div className="w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-white shadow"></div>
                <span className="text-[11px] font-medium text-slate-300 mt-2">PRYJ</span>
                <span className="text-[9px] text-slate-500">07:34</span>
              </div>

              {/* Node 3 */}
              <div className="flex flex-col items-center">
                <div className="w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-white shadow"></div>
                <span className="text-[11px] font-medium text-slate-300 mt-2">CNB</span>
                <span className="text-[9px] text-slate-500">09:30</span>
              </div>

              {/* Train Locomotive Beacon */}
              <div className="flex flex-col items-center -mt-1">
                <div className="relative">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 border-2 border-white shadow-lg flex items-center justify-center text-white">
                    <Train className="w-3.5 h-3.5" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping"></span>
                </div>
                <span className="text-[11px] font-bold text-emerald-400 mt-1 font-mono">128 km/h</span>
                <span className="text-[9px] text-slate-400">Km 412.8 • 12:10 Est</span>
              </div>

              {/* Node 5 Terminal */}
              <div className="flex flex-col items-center">
                <div className="w-4 h-4 rounded-full bg-slate-700 border-2 border-slate-500 shadow"></div>
                <span className="text-[11px] font-bold text-slate-300 mt-2">NDLS</span>
                <span className="text-[9px] text-emerald-400 font-semibold">13:42 AI ETA</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Stat Blocks */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-[#1b3457] text-slate-200">
          <div className="p-4 space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">Line Congestion</span>
            <div className="text-lg font-bold text-white flex items-center gap-1.5">
              <span className="text-emerald-400">Low 0.12</span>
            </div>
            <span className="text-[11px] text-slate-400 block">Clear run to Ghaziabad Outer</span>
          </div>

          <div className="p-4 space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">Atmospheric & Track</span>
            <div className="text-lg font-bold text-white flex items-center gap-1.5">
              <span>32°C Clear</span>
            </div>
            <span className="text-[11px] text-slate-400 block">Rail expansion index normal</span>
          </div>

          <div className="p-4 space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">Assigned Platform</span>
            <div className="text-lg font-bold text-amber-400 flex items-center gap-1.5">
              <span>PF 16 (NDLS)</span>
            </div>
            <span className="text-[11px] text-slate-400 block">Ajmeri Gate Side Entry</span>
          </div>

          <div className="p-4 space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">Telemetry Source</span>
            <div className="text-lg font-bold text-blue-400 flex items-center gap-1.5">
              <span>NavIC RTIS</span>
            </div>
            <span className="text-[11px] text-slate-400 block">Updated 14s ago</span>
          </div>
        </div>
      </div>

      {/* 3 Core Pillars Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <div className="bg-white rounded-xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all space-y-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <Cpu className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-base">Sectional Velocity Neural Net</h3>
          <p className="text-slate-600 text-xs leading-relaxed">
            Predicts decelerations across 12,000+ speed restriction caution zones (TSRs) dynamically rather than relying on fixed static averages.
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all space-y-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
            <Radio className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-base">NavIC Satellite Geo-Sync</h3>
          <p className="text-slate-600 text-xs leading-relaxed">
            Direct telemetry downlink from ISRO RTIS locos ensures real 30-second position resolution without cellular blackouts or GPS drift.
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all space-y-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <Sliders className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-base">Junction Clearance Predictor</h3>
          <p className="text-slate-600 text-xs leading-relaxed">
            Forecasts platform occupancy and interlocking conflicts at critical yards like NDLS and CNB up to 3 hours in advance.
          </p>
        </div>
      </div>

      {/* Footer System Verification Strip */}
      <div className="border-t border-slate-200 pt-6 text-center text-xs text-slate-500 space-y-2">
        <div className="flex flex-wrap items-center justify-center gap-3 font-semibold text-slate-700">
          <span>94.2% Precision Accuracy</span>
          <span>•</span>
          <span>Updates Every 30s</span>
          <span>•</span>
          <span>CRIS & NTES Direct Backbone</span>
        </div>
        <div className="flex items-center justify-center gap-2 font-mono text-[11px] text-slate-400">
          <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200">ISRO NavIC</span>
          <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200">RTIS LocoSense</span>
          <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200">CRIS Node v4.1</span>
        </div>
      </div>
    </div>
  );
};
