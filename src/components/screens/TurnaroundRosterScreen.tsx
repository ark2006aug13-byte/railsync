import React, { useState } from 'react';
import { 
  BarChart3, 
  Clock, 
  Filter, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Train, 
  Droplet, 
  Check, 
  Sparkles, 
  Zap, 
  Layers, 
  ArrowRight,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { AppView, TurnaroundRosterItem } from '../../types';
import { initialTurnaroundRoster } from '../../data/mockData';

interface TurnaroundRosterScreenProps {
  onNavigate: (view: AppView) => void;
}

export const TurnaroundRosterScreen: React.FC<TurnaroundRosterScreenProps> = ({ onNavigate }) => {
  const [activeShift, setActiveShift] = useState<'A' | 'B' | 'C' | '24H'>('B');
  const [platformRange, setPlatformRange] = useState<'all' | '1-4' | '5-8' | '9-12' | '13-16'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [divertedVb, setDivertedVb] = useState(false);

  const filteredItems = initialTurnaroundRoster.filter(item => {
    if (searchTerm && !item.trainName.toLowerCase().includes(searchTerm.toLowerCase()) && !item.trainNumber.includes(searchTerm)) {
      return false;
    }
    if (platformRange === '1-4') return item.platformNumber >= 1 && item.platformNumber <= 4;
    if (platformRange === '5-8') return item.platformNumber >= 5 && item.platformNumber <= 8;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
              Platform Berthing & Terminal Turnaround Roster
            </span>
            <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              NDLS Yard • Division DLI
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            24-Hour Rake Allotment & Pit-Line Servicing Roster
          </h1>
          <p className="text-xs md:text-sm text-slate-600 mt-0.5">
            Water hydrant pressures, bio-toilet evacuation cycles, OBHS linen restocking, and mechanical TXR clearances.
          </p>
        </div>

        {/* Shift Selectors */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
          {[
            { id: 'A', label: 'Shift A (06:00 - 14:00)' },
            { id: 'B', label: 'Shift B (14:00 - 22:00)' },
            { id: 'C', label: 'Shift C (22:00 - 06:00)' },
            { id: '24H', label: 'Full 24H' }
          ].map(shift => (
            <button
              key={shift.id}
              onClick={() => setActiveShift(shift.id as any)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeShift === shift.id 
                  ? 'bg-purple-700 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {shift.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs text-slate-500 font-semibold uppercase">Scheduled Rakes</span>
          <div className="text-2xl font-black text-slate-900 font-mono">148 Total</div>
          <span className="text-[11px] text-slate-500">92 Terminal • 56 Ingress</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs text-slate-500 font-semibold uppercase">Platform Occupancy</span>
          <div className="text-2xl font-black text-slate-900 font-mono">13 / 16 (81.2%)</div>
          <span className="text-[11px] text-slate-500">PF 5, 11, 14 Idle/Clear</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs text-slate-500 font-semibold uppercase">Yard Stabling Rakes</span>
          <div className="text-2xl font-black text-slate-900 font-mono">18 Stabled</div>
          <span className="text-[11px] text-slate-500">TKD & DLI South Sidings</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs text-slate-500 font-semibold uppercase">Pit-Line Maintenance</span>
          <div className="text-2xl font-black text-purple-700 font-mono">06 Lines Active</div>
          <span className="text-[11px] text-emerald-600">All hydrants at 4.8 Bar</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase">Platforms:</span>
          <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-medium">
            {[
              { id: 'all', label: 'All' },
              { id: '1-4', label: 'PF 1 - 4' },
              { id: '5-8', label: 'PF 5 - 8' },
              { id: '9-12', label: 'PF 9 - 12' },
              { id: '13-16', label: 'PF 13 - 16' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setPlatformRange(tab.id as any)}
                className={`px-3 py-1 rounded transition-all ${
                  platformRange === tab.id ? 'bg-slate-900 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search train or rake ID..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* Standard Turnaround Sequence Protocol (TAT) 5-Phase Pipeline */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Standard Turnaround Sequence Protocol (TAT Pipeline) • 90-Minute Protocol
          </span>
          <span className="text-xs font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded font-semibold">
            Northern Railway SOP
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs font-mono">
          <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 space-y-1">
            <span className="text-[10px] text-blue-700 font-bold block">00 - 15m</span>
            <div className="font-bold text-slate-900">1. Deboarding</div>
            <span className="text-[10px] text-slate-500 block">Pax egress & parcel baggage offload</span>
          </div>

          <div className="p-3 rounded-xl bg-cyan-50/70 border border-cyan-200 space-y-1">
            <span className="text-[10px] text-cyan-700 font-bold block">15 - 45m</span>
            <div className="font-bold text-slate-900">2. Hydrant Watering</div>
            <span className="text-[10px] text-slate-500 block">High-press carriage water & bio-flush</span>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1">
            <span className="text-[10px] text-amber-700 font-bold block">45 - 65m</span>
            <div className="font-bold text-slate-900">3. Rolling Stock TXR</div>
            <span className="text-[10px] text-slate-500 block">Brake pad, air pipe & axle check</span>
          </div>

          <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-1">
            <span className="text-[10px] text-indigo-700 font-bold block">65 - 75m</span>
            <div className="font-bold text-slate-900">4. Pantry & Linens</div>
            <span className="text-[10px] text-slate-500 block">Catering loading & dry mop OBHS</span>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1">
            <span className="text-[10px] text-emerald-700 font-bold block">75 - 90m</span>
            <div className="font-bold text-slate-900">5. Boarding & Starter</div>
            <span className="text-[10px] text-slate-500 block">Pilot handoff, BPC certificate & green</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Platform Servicing Cards (Left) & Shunting / Wash Pit (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Platform Roster Cards (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-base">Active Platform Turnarounds</h2>
            <span className="text-xs text-slate-500 font-mono">Displaying {filteredItems.length} active lines</span>
          </div>

          <div className="space-y-3">
            {filteredItems.map((item) => (
              <div 
                key={item.platformNumber}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 hover:border-purple-300 transition-all"
              >
                {/* Top Info */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-12 py-1 rounded bg-slate-900 text-white font-mono font-bold text-center text-xs">
                      PF 0{item.platformNumber}
                    </span>
                    <div>
                      <span className="text-sm font-bold text-slate-900">{item.trainNumber} {item.trainName}</span>
                      <span className="text-xs text-slate-500 block">{item.sourceStation}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-slate-500">Arr: <strong className="text-slate-800">{item.inwardArrivalTime}</strong></span>
                    <span className={`px-2 py-0.5 rounded font-bold ${item.statusBadgeColor}`}>
                      {item.inwardDelayStatus}
                    </span>
                  </div>
                </div>

                {/* Infrastructure Details */}
                <div className="text-xs text-slate-600 font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <span>{item.infraDetail}</span>
                  <span className="text-purple-700 font-bold">{item.rakeId}</span>
                </div>

                {/* Progress Bar & Status */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-600">{item.gangAssigned}</span>
                    <span className="font-bold text-slate-900">{item.statusProgress} ({item.statusPercent}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        item.statusPercent === 100 
                          ? 'bg-emerald-500' 
                          : item.statusPercent > 50 
                          ? 'bg-purple-600' 
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${item.statusPercent}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Wash-Pit Lines & Shunting Queue (4 Cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Wash Pit Lines */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="font-bold text-slate-900 text-sm">NDLS Wash-Pit Lines (4 Active)</span>
              <span className="text-xs font-mono text-emerald-600 font-bold">● Pits Clear</span>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex justify-between font-bold text-slate-800">
                  <span>Bay 01: 12952 MMCT Rake</span>
                  <span className="text-emerald-700">82% Complete</span>
                </div>
                <span className="text-[11px] text-slate-500 block">Underframe pressure jetting & BPC testing</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex justify-between font-bold text-slate-800">
                  <span>Bay 03: 20818 BBS Rake</span>
                  <span className="text-blue-700">Scheduled 15:10</span>
                </div>
                <span className="text-[11px] text-slate-500 block">Awaiting shunting loco from Tilak Bridge neck</span>
              </div>
            </div>
          </div>

          {/* Active Shunting Movements */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <span className="font-bold text-slate-900 text-sm block">Active Yard Shunting Queue</span>
            
            <div className="space-y-2 text-xs font-mono text-slate-700">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                <span>Pit 1 → PF 3 Push-Back</span>
                <span className="text-emerald-700 font-bold">WDS-6 Loco</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                <span>PF 4 → Yard Siding 8</span>
                <span className="text-blue-700 font-bold">Clear Signal</span>
              </div>
            </div>
          </div>

          {/* 1-Click Conflict Engine Diversion Card */}
          <div className={`p-4 rounded-2xl border space-y-3 transition-all ${
            divertedVb 
              ? 'bg-emerald-50 border-emerald-300' 
              : 'bg-purple-50/80 border-purple-200 shadow-xs'
          }`}>
            <div className="flex items-center gap-1.5 font-bold text-xs text-purple-900">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>Turnaround Buffer Optimizer</span>
            </div>

            <p className="text-xs text-purple-950 leading-relaxed">
              {divertedVb ? (
                <span>
                  ✓ Auto Diversion Approved: Incoming VB 22436 rerouted to PF 7 with zero turnaround penalty.
                </span>
              ) : (
                <span>
                  Detected potential 18-minute critical pinch on PF 2 (VB 22436 incoming). Recommend instant platform diversion to PF 7 with zero interlocking delay.
                </span>
              )}
            </p>

            {!divertedVb && (
              <button
                onClick={() => setDivertedVb(true)}
                className="w-full py-2 px-3 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Approve Auto Diversion (PF 2 → PF 7)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
