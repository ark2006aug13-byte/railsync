import React, { useState, useEffect } from 'react';
import { 
  Train, 
  Activity, 
  Layers, 
  Clock, 
  Bell, 
  User, 
  Radio, 
  ShieldCheck, 
  Search,
  Cpu,
  BarChart3,
  Calendar,
  Zap,
  ChevronDown
} from 'lucide-react';
import { AppView } from '../types';

interface HeaderProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  unresolvedConflictCount: number;
}

export const Header: React.FC<HeaderProps> = ({ 
  currentView, 
  onNavigate, 
  unresolvedConflictCount 
}) => {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      const secs = String(now.getSeconds()).padStart(2, '0');
      setTimeStr(`${hours}:${mins}:${secs}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isOpsView = [
    'operations-console', 
    'gantt-schedule', 
    'telemetry-stream', 
    'interlocking-sim', 
    'turnaround-roster'
  ].includes(currentView);

  return (
    <header className="sticky top-0 z-50 bg-[#0c1829] text-white border-b border-[#1f2f47] shadow-lg select-none">
      {/* Top Telemetry Ticker Bar */}
      <div className="bg-[#070f1a] px-4 py-1.5 text-xs border-b border-[#142338] flex flex-wrap items-center justify-between gap-2 text-slate-400 font-mono">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            RTIS NAVIC: 99.98% LOCK
          </span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center gap-1 text-blue-400">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            KAVACH SIL-4: ENGAGED
          </span>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <span className="hidden sm:inline text-slate-300">
            CRIS FOIS-RTIS GATEWAY: ZONE NR-DLI
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-400">SECTOR:</span>
          <span className="bg-[#112239] text-slate-200 px-2 py-0.5 rounded border border-[#233a59] flex items-center gap-1 text-[11px]">
            NDLS (DLI-DIV) <ChevronDown className="w-3 h-3 text-slate-400" />
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-amber-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {timeStr || '14:28:42'} IST <span className="text-[10px] text-slate-500 hidden md:inline">+0.04s NTP Sync</span>
          </span>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Brand Logo & Switcher */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2.5 group cursor-pointer text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Train className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white flex items-center gap-1">
                  RailPulse <span className="text-blue-400">AI</span>
                </span>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  v4.8
                </span>
              </div>
              <p className="text-[10px] text-slate-400 tracking-wide font-medium">
                INDIAN RAILWAYS DYNAMIC ETA & OPS
              </p>
            </div>
          </button>

          {/* Mode Switcher Segmented Control */}
          <div className="hidden lg:flex items-center bg-[#112035] p-1 rounded-lg border border-[#1e3452]">
            <button
              onClick={() => onNavigate('home')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                !isOpsView 
                  ? 'bg-blue-600 text-white shadow' 
                  : 'text-slate-300 hover:text-white hover:bg-[#192f4e]'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              Passenger Pulse
            </button>
            <button
              onClick={() => onNavigate('operations-console')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 relative ${
                isOpsView 
                  ? 'bg-indigo-600 text-white shadow' 
                  : 'text-slate-300 hover:text-white hover:bg-[#192f4e]'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              NDLS Station Ops
              {unresolvedConflictCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping absolute -top-0.5 -right-0.5"></span>
              )}
            </button>
          </div>
        </div>

        {/* Quick Direct Screens Menu */}
        <nav className="flex items-center gap-1 overflow-x-auto py-1 max-w-[55vw]">
          <button
            onClick={() => onNavigate('home')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              currentView === 'home' 
                ? 'bg-[#1a3356] text-blue-300 border border-blue-400/40' 
                : 'text-slate-300 hover:text-white hover:bg-[#13253e]'
            }`}
          >
            <span>1. Home Search</span>
          </button>

          <button
            onClick={() => onNavigate('train-status')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              currentView === 'train-status' 
                ? 'bg-[#1a3356] text-blue-300 border border-blue-400/40' 
                : 'text-slate-300 hover:text-white hover:bg-[#13253e]'
            }`}
          >
            <span>2. Live Train Status</span>
          </button>

          <button
            onClick={() => onNavigate('dynamic-eta')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              currentView === 'dynamic-eta' 
                ? 'bg-[#1a3356] text-blue-300 border border-blue-400/40' 
                : 'text-slate-300 hover:text-white hover:bg-[#13253e]'
            }`}
          >
            <Zap className="w-3 h-3 text-amber-400" />
            <span>3. Explainable AI ETA</span>
          </button>

          <span className="text-slate-600 px-1">|</span>

          <button
            onClick={() => onNavigate('operations-console')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              currentView === 'operations-console' 
                ? 'bg-[#1e2a4a] text-indigo-300 border border-indigo-400/40' 
                : 'text-slate-300 hover:text-white hover:bg-[#13253e]'
            }`}
          >
            <Activity className="w-3 h-3 text-indigo-400" />
            <span>4. Live Dispatch</span>
            {unresolvedConflictCount > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
            )}
          </button>

          <button
            onClick={() => onNavigate('gantt-schedule')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              currentView === 'gantt-schedule' 
                ? 'bg-[#1e2a4a] text-indigo-300 border border-indigo-400/40' 
                : 'text-slate-300 hover:text-white hover:bg-[#13253e]'
            }`}
          >
            <Calendar className="w-3 h-3 text-emerald-400" />
            <span>5. Gantt Timeline</span>
          </button>

          <button
            onClick={() => onNavigate('telemetry-stream')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              currentView === 'telemetry-stream' 
                ? 'bg-[#1e2a4a] text-indigo-300 border border-indigo-400/40' 
                : 'text-slate-300 hover:text-white hover:bg-[#13253e]'
            }`}
          >
            <Radio className="w-3 h-3 text-cyan-400" />
            <span>6. Telemetry & Kavach</span>
          </button>

          <button
            onClick={() => onNavigate('interlocking-sim')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              currentView === 'interlocking-sim' 
                ? 'bg-[#1e2a4a] text-indigo-300 border border-indigo-400/40' 
                : 'text-slate-300 hover:text-white hover:bg-[#13253e]'
            }`}
          >
            <Layers className="w-3 h-3 text-amber-400" />
            <span>7. Synoptic Interlocking</span>
          </button>

          <button
            onClick={() => onNavigate('turnaround-roster')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              currentView === 'turnaround-roster' 
                ? 'bg-[#1e2a4a] text-indigo-300 border border-indigo-400/40' 
                : 'text-slate-300 hover:text-white hover:bg-[#13253e]'
            }`}
          >
            <BarChart3 className="w-3 h-3 text-purple-400" />
            <span>8. Turnaround Roster</span>
          </button>
        </nav>

        {/* Right Side Controller Profile & Status */}
        <div className="flex items-center gap-2.5">
          <div className="hidden xl:flex flex-col text-right">
            <span className="text-[11px] font-semibold text-slate-200">R. Sharma (IRTS-09)</span>
            <span className="text-[10px] text-slate-400">Chief Controller • NDLS Cabin</span>
          </div>

          <button 
            title="Notifications"
            className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-[#162740] relative"
          >
            <Bell className="w-4 h-4" />
            {unresolvedConflictCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500 absolute top-1 right-1"></span>
            )}
          </button>

          <div className="w-8 h-8 rounded-full bg-blue-700/60 border border-blue-400/50 flex items-center justify-center text-xs font-bold text-blue-200 shadow">
            RS
          </div>
        </div>
      </div>
    </header>
  );
};
