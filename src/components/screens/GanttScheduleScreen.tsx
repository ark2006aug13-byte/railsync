import React, { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  Filter, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldCheck, 
  Layers, 
  Sliders, 
  ArrowRight,
  Zap,
  Check,
  RotateCcw
} from 'lucide-react';
import { AppView, PlatformGanttSlot } from '../../types';

interface GanttScheduleScreenProps {
  onNavigate: (view: AppView) => void;
  ganttSlots: PlatformGanttSlot[];
  onResolveConflict: (trainId: string, targetPlatform: string) => void;
  conflictResolved: boolean;
}

export const GanttScheduleScreen: React.FC<GanttScheduleScreenProps> = ({
  onNavigate,
  ganttSlots,
  onResolveConflict,
  conflictResolved
}) => {
  const [timeSpan, setTimeSpan] = useState<'2H' | '4H' | '8H' | '24H'>('4H');
  const [trackGroup, setTrackGroup] = useState<'all' | 'main' | 'suburban' | 'freight'>('all');
  const [autoRescheduler, setAutoRescheduler] = useState(true);

  const filterPlatform = (pfNum: number) => {
    if (trackGroup === 'main') return pfNum >= 1 && pfNum <= 8;
    if (trackGroup === 'suburban') return pfNum >= 9 && pfNum <= 14;
    if (trackGroup === 'freight') return pfNum >= 15 && pfNum <= 16;
    return true;
  };

  const filteredSlots = ganttSlots.filter(s => filterPlatform(s.platformNumber));

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
              Gantt Platform Berthing & Route Interlocking Schedule
            </span>
            <span className="text-xs font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              [Active Sync]
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            NDLS Master Berthing & Dynamic Turnaround Gantt
          </h1>
          <p className="text-xs md:text-sm text-slate-600 mt-0.5">
            Synchronized with Northern Railway Central Relay Interlocking (RRI) & RTIS Locomotive Beacon Feeds.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={() => onNavigate('operations-console')}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer shadow-xs"
          >
            ← Back to Live Dispatch
          </button>
        </div>
      </div>

      {/* Stats Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-0.5">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Active Platforms</span>
          <div className="text-lg font-bold text-slate-900 font-mono">16/16 (100%)</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-0.5">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Peak Inflow Headway</span>
          <div className="text-lg font-bold text-slate-900 font-mono">3m 45s <span className="text-xs text-emerald-600 font-normal">(-12s)</span></div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-0.5">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Pending Clearances</span>
          <div className="text-lg font-bold text-slate-900 font-mono">02 In Queue</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-0.5">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Buffer Health</span>
          <div className="text-lg font-bold text-emerald-600 font-mono">94% Optimal</div>
        </div>

        <div className={`p-3.5 rounded-xl border shadow-xs space-y-0.5 col-span-2 md:col-span-1 ${
          conflictResolved 
            ? 'bg-emerald-50 border-emerald-300' 
            : 'bg-red-50 border-red-300 ring-1 ring-red-300'
        }`}>
          <span className={`text-[10px] uppercase tracking-wider font-bold ${
            conflictResolved ? 'text-emerald-800' : 'text-red-800'
          }`}>
            Conflict Alert
          </span>
          <div className={`text-sm font-bold font-mono ${
            conflictResolved ? 'text-emerald-700' : 'text-red-700'
          }`}>
            {conflictResolved ? 'All Platforms Cleared' : 'PF 03 Overlap (+18m)'}
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Time Span Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Time Span:</span>
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            {(['2H', '4H', '8H', '24H'] as const).map((span) => (
              <button
                key={span}
                onClick={() => setTimeSpan(span)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                  timeSpan === span 
                    ? 'bg-slate-900 text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {span}
              </button>
            ))}
          </div>
        </div>

        {/* Track Groups */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tracks:</span>
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            {[
              { id: 'all', label: 'All (16)' },
              { id: 'main', label: 'Main (1-8)' },
              { id: 'suburban', label: 'Suburban (9-14)' },
              { id: 'freight', label: 'Bypass (15-16)' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setTrackGroup(tab.id as any)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  trackGroup === tab.id 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Auto Rescheduler Toggle */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 select-none">
            <input 
              type="checkbox" 
              checked={autoRescheduler} 
              onChange={() => setAutoRescheduler(!autoRescheduler)} 
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span>Auto-Rescheduler SIL-4 Auto Pilot</span>
          </label>

          <span className="px-2.5 py-1 bg-red-100 text-red-800 font-mono font-bold text-xs rounded border border-red-200">
            NOW 10:05
          </span>
        </div>
      </div>

      {/* Main Gantt Timeline Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 overflow-x-auto">
        {/* Timeline Axis Header */}
        <div className="min-w-[860px]">
          <div className="grid grid-cols-12 text-xs font-mono text-slate-400 border-b border-slate-200 pb-2">
            <div className="col-span-2 font-bold text-slate-700">PLATFORM / LINE</div>
            <div className="col-span-2 text-center">08:00</div>
            <div className="col-span-2 text-center">09:00</div>
            <div className="col-span-2 text-center text-red-600 font-bold">10:00 (NOW 10:05)</div>
            <div className="col-span-2 text-center">11:00</div>
            <div className="col-span-2 text-center">12:00 - 13:00</div>
          </div>

          {/* Platform Rows */}
          <div className="divide-y divide-slate-100 py-1 space-y-1 relative">
            {/* Vertical NOW Line */}
            <div className="absolute left-[54%] top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none opacity-80">
              <span className="bg-red-600 text-white font-mono text-[9px] px-1 py-0.5 rounded absolute -top-2 -translate-x-1/2">
                10:05
              </span>
            </div>

            {filteredSlots.map((slot) => {
              const isPf3Conflict = slot.platformNumber === 3 && slot.status === 'conflict' && !conflictResolved;
              const isDivertedPf5 = slot.platformNumber === 5 && conflictResolved;

              return (
                <div key={slot.id} className="grid grid-cols-12 items-center py-2 text-xs font-mono group hover:bg-slate-50/70 rounded">
                  {/* Platform Label */}
                  <div className="col-span-2 flex items-center gap-2 pr-2">
                    <span className={`px-2 py-1 rounded font-bold text-xs ${
                      isPf3Conflict 
                        ? 'bg-red-600 text-white' 
                        : isDivertedPf5
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-200'
                    }`}>
                      {slot.platformLabel}
                    </span>
                    <span className="text-[10px] text-slate-400 hidden sm:inline">24 LHB BG</span>
                  </div>

                  {/* Gantt Bar Area (Cols 3-12) */}
                  <div className="col-span-10 relative h-8 bg-slate-100/70 rounded-md border border-slate-200 overflow-hidden flex items-center px-2">
                    {isPf3Conflict ? (
                      <div className="w-full h-full bg-red-200/90 border border-red-400 rounded flex items-center justify-between px-3 text-red-950 font-bold">
                        <span className="flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-red-700 animate-pulse" />
                          Train 14056 Brahmaputra [CONFLICT] 12424 Dibrugarh Rajdhani Overlap
                        </span>
                        <button
                          onClick={() => onResolveConflict('12424', 'PF 5')}
                          className="px-2.5 py-1 rounded bg-red-700 hover:bg-red-800 text-white text-[11px] font-bold shadow-xs cursor-pointer"
                        >
                          Resolve → Route PF 5
                        </button>
                      </div>
                    ) : isDivertedPf5 ? (
                      <div className="w-full h-full bg-emerald-100 border border-emerald-400 rounded flex items-center justify-between px-3 text-emerald-950 font-bold">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                          12424 Dibrugarh Rajdhani Assigned (10:35 - 11:35) • Route 112B Locked
                        </span>
                        <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-mono">
                          SIL-4 APPROVED
                        </span>
                      </div>
                    ) : slot.platformNumber === 5 ? (
                      <div className="w-full h-full bg-emerald-50 border border-dashed border-emerald-300 rounded flex items-center justify-between px-3 text-emerald-800 font-semibold">
                        <span>🟢 Available Slot: 45m Headway Buffer (Ready for Inflow)</span>
                        <span className="text-[10px] text-slate-400">Apron Ready</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full text-slate-700">
                        <span className="font-bold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                          {slot.trainNumber} {slot.trainName}
                        </span>
                        <span className="text-[11px] text-slate-500">
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

      {/* 3 Bottom Analytical Panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Panel 1: Conflict Inspector */}
        <div className={`p-5 rounded-2xl border shadow-xs space-y-3 ${
          conflictResolved 
            ? 'bg-emerald-50/70 border-emerald-300' 
            : 'bg-red-50/70 border-red-300'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${
              conflictResolved ? 'text-emerald-800' : 'text-red-800'
            }`}>
              Conflict Inspector • PF 03
            </span>
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
              conflictResolved ? 'bg-emerald-200 text-emerald-900' : 'bg-red-200 text-red-900'
            }`}>
              {conflictResolved ? 'RESOLVED' : 'OVERLAP RISK'}
            </span>
          </div>

          <p className="text-xs text-slate-700 leading-relaxed">
            {conflictResolved ? (
              <span>
                12424 Dibrugarh Rajdhani successfully diverted to Platform 5. Platform 3 clear for 14056 departure at 11:15 IST without outer-signal stop.
              </span>
            ) : (
              <span>
                Inbound 12424 Rajdhani scheduled to enter PF 03 at 10:45 IST, while outgoing 14056 Brahmaputra Mail holds the berth until 11:15 IST.
              </span>
            )}
          </p>

          {!conflictResolved && (
            <div className="pt-2 flex flex-wrap gap-2">
              <button
                onClick={() => onResolveConflict('12424', 'PF 5')}
                className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Reassign 12424 to PF 05
              </button>
              <button
                onClick={() => onResolveConflict('12424', 'PF 7')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Hold at Outer
              </button>
            </div>
          )}
        </div>

        {/* Panel 2: Turnaround Margins */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Platform Turnaround Margins
          </span>
          <div className="space-y-1.5 text-xs text-slate-600 font-mono">
            <div className="flex justify-between">
              <span>Min Safe Buffer:</span>
              <strong className="text-slate-900">20 mins</strong>
            </div>
            <div className="flex justify-between">
              <span>Current Yard Average:</span>
              <strong className="text-emerald-700">42.5 mins</strong>
            </div>
            <div className="flex justify-between">
              <span>Apron Hydrant Pressure:</span>
              <strong className="text-slate-900">4.8 Bar</strong>
            </div>
            <div className="flex justify-between">
              <span>Catering Staging:</span>
              <strong className="text-emerald-700">Ready / Pre-packed</strong>
            </div>
          </div>
        </div>

        {/* Panel 3: Interlocking State */}
        <div className="bg-slate-900 text-slate-200 p-5 rounded-2xl border border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Electronic Interlocking (EI) State
            </span>
            <span className="text-[10px] font-mono text-emerald-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              CRC 0x9AF84
            </span>
          </div>

          <div className="space-y-1 text-xs font-mono text-slate-300">
            <div>Point Machine 42A/B: <strong className="text-emerald-400">Normal Locked</strong></div>
            <div>Cabin North Shunt: <strong className="text-amber-400">Holding S-19</strong></div>
            <div>Signal 14 (Inflow): <strong className="text-blue-400">Approach Yellow</strong></div>
          </div>

          <button
            onClick={() => onNavigate('interlocking-sim')}
            className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <span>Full Interlocking Matrix →</span>
          </button>
        </div>
      </div>
    </div>
  );
};
