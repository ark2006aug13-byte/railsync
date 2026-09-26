import React, { useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Train, 
  ArrowRight, 
  ShieldCheck, 
  Search, 
  Sliders, 
  Zap, 
  Layers, 
  Check, 
  X,
  Sparkles,
  ChevronRight,
  Radio
} from 'lucide-react';
import { AppView, InflowTrain, PlatformGanttSlot } from '../../types';

interface OperationsConsoleScreenProps {
  onNavigate: (view: AppView) => void;
  inflowTrains: InflowTrain[];
  ganttSlots: PlatformGanttSlot[];
  onResolveConflict: (trainId: string, targetPlatform: string) => void;
  conflictResolved: boolean;
}

export const OperationsConsoleScreen: React.FC<OperationsConsoleScreenProps> = ({
  onNavigate,
  inflowTrains,
  ganttSlots,
  onResolveConflict,
  conflictResolved
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'priority' | 'rajdhani'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [resolutionExecuted, setResolutionExecuted] = useState(false);

  const filteredTrains = inflowTrains.filter(t => {
    if (searchTerm && !t.trainName.toLowerCase().includes(searchTerm.toLowerCase()) && !t.trainNumber.includes(searchTerm)) {
      return false;
    }
    if (filterTab === 'priority') return t.speedKmH >= 110;
    if (filterTab === 'rajdhani') return t.trainName.includes('Rajdhani') || t.trainName.includes('Vande');
    return true;
  });

  const handleExecuteResolution = () => {
    onResolveConflict('12424', 'PF 5');
    setResolutionExecuted(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Console Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
              Station Operations Console: New Delhi (NDLS)
            </span>
            <span className="text-xs font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Interlocking Loop: 1.2s
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Real-Time Station Headway & Inflow Dispatch
          </h1>
          <p className="text-xs md:text-sm text-slate-600 mt-0.5">
            Real-time AI headway coordination, interlocking slot optimization, and automated platform conflict detection.
          </p>
        </div>

        {/* Action quick links */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate('gantt-schedule')}
            className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <span>Full 24H Gantt</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onNavigate('interlocking-sim')}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Yard Synoptic Sim</span>
          </button>
        </div>
      </div>

      {/* 4 Quick Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs text-slate-500 font-semibold uppercase">Incoming Trains (2H)</span>
          <div className="text-2xl font-black text-slate-900 font-mono">14</div>
          <span className="text-[11px] text-slate-400 font-medium">8 Mainline • 6 Express</span>
        </div>

        <div className={`rounded-xl p-4 border shadow-xs space-y-1 transition-all ${
          conflictResolved || resolutionExecuted
            ? 'bg-emerald-50/70 border-emerald-200' 
            : 'bg-red-50/80 border-red-300 ring-2 ring-red-200'
        }`}>
          <span className={`text-xs font-bold uppercase ${
            conflictResolved || resolutionExecuted ? 'text-emerald-800' : 'text-red-800'
          }`}>
            Platform Conflict
          </span>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-black font-mono ${
              conflictResolved || resolutionExecuted ? 'text-emerald-700' : 'text-red-700'
            }`}>
              {conflictResolved || resolutionExecuted ? '0 Active' : '1 Active • PF 03'}
            </span>
            {!conflictResolved && !resolutionExecuted && (
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping"></span>
            )}
          </div>
          <span className="text-[11px] text-slate-600 font-medium">
            {conflictResolved || resolutionExecuted ? 'All berths cleared SIL-4' : 'Overlap risk: 14056 vs 12424'}
          </span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs text-slate-500 font-semibold uppercase">Avg Platform Turnaround</span>
          <div className="text-2xl font-black text-slate-900 font-mono">28 mins</div>
          <span className="text-[11px] text-emerald-600 font-semibold">-4m delta vs 30d baseline</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs text-slate-500 font-semibold uppercase">Active Yard Capacity</span>
          <div className="text-2xl font-black text-slate-900 font-mono">81% Occupied</div>
          <span className="text-[11px] text-slate-500 font-medium">13 of 16 Platforms Berthed</span>
        </div>
      </div>

      {/* Main 2-Column Split: Inflow Queue (Left) & Platform Berthing Grid (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Inflow Queue (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-900 text-base">Incoming Inflow Queue</h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {filteredTrains.length} active
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setFilterTab('all')}
                className={`px-2 py-1 text-[11px] font-bold rounded ${
                  filterTab === 'all' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterTab('rajdhani')}
                className={`px-2 py-1 text-[11px] font-bold rounded ${
                  filterTab === 'rajdhani' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                Rajdhani / VB
              </button>
            </div>
          </div>

          {/* Quick Search in Queue */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search incoming train or rake..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            />
          </div>

          {/* Train Cards List */}
          <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
            {filteredTrains.map((train) => {
              const isConflicted = train.hasConflict && !conflictResolved && !resolutionExecuted;
              const isResolved = train.hasConflict && (conflictResolved || resolutionExecuted);

              return (
                <div
                  key={train.id}
                  className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                    isConflicted
                      ? 'bg-red-50/90 border-red-300 ring-2 ring-red-200 shadow-sm'
                      : isResolved
                      ? 'bg-emerald-50/80 border-emerald-300 shadow-sm'
                      : 'bg-slate-50/60 border-slate-200 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-slate-900 text-sm">{train.trainNumber}</span>
                        <span className="font-bold text-slate-800 text-xs">{train.trainName}</span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {train.sourceCode} → {train.destinationCode} • {train.rakesCoaches}
                      </span>
                    </div>

                    <div className="text-right font-mono">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        isConflicted
                          ? 'bg-red-200 text-red-900'
                          : isResolved
                          ? 'bg-emerald-200 text-emerald-900'
                          : 'bg-slate-200 text-slate-800'
                      }`}>
                        {isResolved ? 'PF 5 (Diverted)' : train.platform}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">{train.platformBuffer}</span>
                    </div>
                  </div>

                  {/* Telemetry Strip for train */}
                  <div className="flex items-center justify-between text-[11px] font-mono border-t border-slate-200/60 pt-2 text-slate-600">
                    <div>
                      ETA: <strong className="text-slate-900">{train.dynamicEta}</strong> ({train.varianceFormatted})
                    </div>
                    <div className="text-slate-500 truncate max-w-[170px]">
                      {train.locationDescription}
                    </div>
                    <div className="text-slate-800 font-semibold">
                      {train.speedKmH} km/h
                    </div>
                  </div>

                  {/* Critical Conflict Box for 12424 */}
                  {isConflicted && (
                    <div className="p-3 bg-red-100/90 rounded-lg border border-red-300 text-xs space-y-2 text-red-950">
                      <div className="flex items-center gap-1.5 font-bold text-red-900">
                        <AlertTriangle className="w-4 h-4 text-red-700" />
                        <span>CRITICAL CONFLICT: Overlap with 14056</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-red-900">
                        {train.conflictDetails?.description}
                      </p>
                      <div className="pt-1 flex items-center justify-between">
                        <button
                          onClick={handleExecuteResolution}
                          className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-bold shadow transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Zap className="w-3.5 h-3.5 text-amber-300" />
                          <span>Auto-Resolve: Route to PF 5</span>
                        </button>
                        <button
                          onClick={() => onNavigate('interlocking-sim')}
                          className="text-[11px] font-semibold text-red-800 underline hover:text-red-950"
                        >
                          Inspect Route Lock
                        </button>
                      </div>
                    </div>
                  )}

                  {isResolved && (
                    <div className="p-2.5 bg-emerald-100/80 rounded-lg border border-emerald-300 text-xs text-emerald-900 flex items-center justify-between font-mono">
                      <span className="flex items-center gap-1 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        Rerouted to PF 5 via 112B (Headway: 24m)
                      </span>
                      <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-emerald-300 font-bold">
                        SIL-4 LOCKED
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Platform Berthing Schedule 16 Platforms (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 gap-2">
            <div>
              <h2 className="font-bold text-slate-900 text-base">Platform Berthing Schedule (16 Platforms)</h2>
              <span className="text-xs text-slate-500 font-mono">3-Hour Window: 10:00 - 13:00 IST • NOW: 10:05</span>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium text-slate-600">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-blue-600"></span> Occupied
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-indigo-500"></span> Dynamic Inflow
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500"></span> Ready / Dep
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-red-500"></span> Conflict
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-emerald-100 border border-emerald-400"></span> Recommended
              </span>
            </div>
          </div>

          {/* Time Ruler Header */}
          <div className="flex items-center text-[11px] font-mono text-slate-400 border-b border-slate-100 pb-1.5 px-16">
            <span className="w-1/3 text-left">10:00</span>
            <span className="w-1/3 text-center">11:00</span>
            <span className="w-1/3 text-right">12:00 - 13:00</span>
          </div>

          {/* Platforms List (PF 01 to PF 16) */}
          <div className="space-y-1.5 max-h-[560px] overflow-y-auto pr-1">
            {ganttSlots.map((slot) => {
              const isPf3Conflict = slot.platformNumber === 3 && slot.status === 'conflict' && !conflictResolved && !resolutionExecuted;
              const isPf5Slot = slot.platformNumber === 5;
              const isDivertedPf5 = isPf5Slot && (conflictResolved || resolutionExecuted);

              return (
                <div 
                  key={slot.id} 
                  className={`flex items-center gap-2 p-1.5 rounded-lg border text-xs font-mono transition-all ${
                    isPf3Conflict 
                      ? 'bg-red-50/70 border-red-300' 
                      : isDivertedPf5
                      ? 'bg-emerald-50 border-emerald-300'
                      : 'bg-slate-50/50 border-slate-200/80 hover:bg-slate-100/60'
                  }`}
                >
                  {/* Platform Tag */}
                  <span className={`w-14 px-1.5 py-1 rounded text-center font-bold text-[11px] shrink-0 ${
                    isPf3Conflict 
                      ? 'bg-red-600 text-white' 
                      : isDivertedPf5 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-slate-800 text-slate-200'
                  }`}>
                    {slot.platformLabel}
                  </span>

                  {/* Visual Slot Bar */}
                  <div className="flex-1 h-7 bg-white rounded border border-slate-200 relative overflow-hidden flex items-center px-2">
                    {/* Render different platform states */}
                    {isPf3Conflict ? (
                      <div className="w-full h-full bg-red-100 flex items-center justify-between px-2 text-red-900 font-bold text-[11px]">
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                          14056 Brahmaputra [CONFLICT] 12424 Dibrugarh
                        </span>
                        <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded">
                          Overlap Halt Risk
                        </span>
                      </div>
                    ) : isDivertedPf5 ? (
                      <div className="w-full h-full bg-emerald-100 flex items-center justify-between px-2 text-emerald-900 font-bold text-[11px]">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          12424 Dibrugarh Rajdhani Assigned (10:35 - 11:35)
                        </span>
                        <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded">
                          Route Locked 112B
                        </span>
                      </div>
                    ) : isPf5Slot ? (
                      <div className="w-full h-full bg-emerald-50/80 border border-emerald-300 border-dashed rounded flex items-center justify-between px-2 text-emerald-800 font-semibold text-[11px]">
                        <span>🟢 AI Slot Available: 45m Headway Window</span>
                        <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded">Ready for 12424</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full text-[11px]">
                        <span className="font-bold text-slate-800">
                          {slot.trainNumber} {slot.trainName}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {slot.startTime} - {slot.endTime} • {slot.description}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Resolution Suggestion Banner */}
      <div className={`p-5 rounded-2xl border transition-all ${
        conflictResolved || resolutionExecuted
          ? 'bg-emerald-900 text-emerald-100 border-emerald-700'
          : 'bg-gradient-to-r from-[#17253d] to-[#0f1b2d] text-white border-[#273c5c] shadow-lg'
      }`}>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${
                conflictResolved || resolutionExecuted
                  ? 'bg-emerald-700 text-white'
                  : 'bg-amber-400 text-slate-950'
              }`}>
                {conflictResolved || resolutionExecuted ? 'RESOLVED • ROUTE RELAY LOCKED' : 'AI Interlocking Conflict Resolution Suggestion • Priority 1'}
              </span>
              <span className="text-xs font-mono text-slate-300">
                Electronic Interlocking Route Locking Matrix (RRI/EI Cabin DLI): Validated SIL-4
              </span>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed">
              {conflictResolved || resolutionExecuted ? (
                <span>
                  Successfully dispatched electronic route relay commands to Field Marshalling Box #CSB-4. Point Machine 112B set to REVERSE. Train 12424 admitted smoothly to Platform 5 with 24 min safety margin.
                </span>
              ) : (
                <span>
                  Re-allocation recommended for <strong>Train 12424 (Dibrugarh Rajdhani) to Platform 5</strong> to prevent outer-signal halt of Train 12424 at Yamuna Bridge. Preserves 24 min minimum buffer headway and eliminates passenger bottleneck at FOB-1.
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {conflictResolved || resolutionExecuted ? (
              <div className="flex items-center gap-2">
                <span className="px-4 py-2 rounded-xl bg-emerald-800 text-white text-xs font-bold flex items-center gap-2 border border-emerald-600">
                  <Check className="w-4 h-4 text-emerald-300" />
                  Diversion Live in Interlocking
                </span>
                <button
                  onClick={() => onNavigate('interlocking-sim')}
                  className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                >
                  View Digital Twin
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => onNavigate('interlocking-sim')}
                  className="px-3.5 py-2 rounded-xl bg-[#1f314d] hover:bg-[#284166] text-xs font-semibold text-slate-200 transition-all border border-[#2d466b] cursor-pointer"
                >
                  Simulate Route
                </button>
                <button
                  onClick={handleExecuteResolution}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-md shadow-blue-600/30 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                  Execute Re-allocation (Route Relay)
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
