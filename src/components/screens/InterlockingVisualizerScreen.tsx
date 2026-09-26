import React, { useState } from 'react';
import { 
  Layers, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  RotateCw, 
  Sliders, 
  Radio, 
  Zap, 
  Check, 
  X,
  Play,
  Lock,
  Unlock,
  CornerDownRight,
  Train
} from 'lucide-react';
import { AppView } from '../../types';

interface InterlockingVisualizerScreenProps {
  onNavigate: (view: AppView) => void;
  conflictResolved: boolean;
  onResolveConflict: (trainId: string, targetPlatform: string) => void;
}

export const InterlockingVisualizerScreen: React.FC<InterlockingVisualizerScreenProps> = ({
  onNavigate,
  conflictResolved,
  onResolveConflict
}) => {
  const [point112BReverse, setPoint112BReverse] = useState(conflictResolved);
  const [point104AReverse, setPoint104AReverse] = useState(false);
  const [point108BReverse, setPoint108BReverse] = useState(false);
  const [simStep, setSimStep] = useState<number>(conflictResolved ? 3 : 1);
  const [isExecuting, setIsExecuting] = useState(false);
  const [eStopTriggered, setEStopTriggered] = useState(false);
  const [showEStopModal, setShowEStopModal] = useState(false);

  const handleExecuteRouteLock = () => {
    setIsExecuting(true);
    setTimeout(() => {
      setPoint112BReverse(true);
      setSimStep(3);
      setIsExecuting(false);
      onResolveConflict('12424', 'PF 5');
    }, 1200);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
              Synoptic Electronic Interlocking (EI) Visualizer
            </span>
            <span className="text-xs font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              EI West Cabin SIL-4 Nominal
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            NDLS Yard Throat Digital Twin & Point Interlocking
          </h1>
          <p className="text-xs md:text-sm text-slate-600 mt-0.5">
            Shivaji Bridge (CSB) / Tilak Bridge (TKJ) / Yamuna Bridge East Approach Interlocking Matrix.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('operations-console')}
            className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer shadow-xs"
          >
            ← Live Dispatch Console
          </button>
        </div>
      </div>

      {/* Stats Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-xs">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-0.5">
          <span className="text-slate-400 block text-[10px]">TURNOUTS LOCKED</span>
          <strong className="text-slate-900 text-base">142 / 142 Locked</strong>
          <span className="text-emerald-600 block text-[11px]">0 Crank Manual Override</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-0.5">
          <span className="text-slate-400 block text-[10px]">AXLE COUNTERS</span>
          <strong className="text-slate-900 text-base">88 Active Heads</strong>
          <span className="text-slate-500 block text-[11px]">Dual Microcontroller 2oo2</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-0.5">
          <span className="text-slate-400 block text-[10px]">RELAY BANK</span>
          <strong className="text-blue-600 text-base">2,410 Solid-State Bits</strong>
          <span className="text-slate-500 block text-[11px]">Latency: 12ms to CSB Box</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-0.5">
          <span className="text-slate-400 block text-[10px]">YARD PSR LIMIT</span>
          <strong className="text-slate-900 text-base">30 km/h</strong>
          <span className="text-slate-500 block text-[11px]">Turnout Crossover Speed</span>
        </div>
      </div>

      {/* Main Visualizer Diagram & Route Simulator Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Synoptic Track Layout (7 Cols) */}
        <div className="lg:col-span-7 bg-[#0b1626] text-slate-200 rounded-2xl border border-[#1d304a] shadow-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1b2f4a] pb-3 text-xs font-mono">
            <span className="text-white font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              YARD SCHEMATIC (WEST CABIN)
            </span>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-300">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-red-500"></span> Occupied (TR)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-amber-400"></span> Route Locked
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-slate-600"></span> Idle Track
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-emerald-400"></span> Shunt Move
              </span>
            </div>
          </div>

          {/* Interactive SVG Synoptic Diagram */}
          <div className="p-2 bg-[#070f1a] rounded-xl border border-[#142338] overflow-x-auto">
            <svg viewBox="0 0 700 360" className="w-full min-w-[620px] h-auto select-none font-mono">
              <defs>
                <linearGradient id="trackGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#334155" />
                  <stop offset="100%" stopColor="#475569" />
                </linearGradient>
              </defs>

              {/* Background Grid Lines */}
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#101e33" strokeWidth="1" />
              </pattern>
              <rect width="700" height="360" fill="url(#grid)" />

              {/* Track 1: UP MAIN (TKJ Inflow) */}
              <text x="20" y="45" fill="#94a3b8" fontSize="10" fontWeight="bold">UP MAIN (TKJ)</text>
              <line x1="20" y1="55" x2="680" y2="55" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
              
              {/* Signal S-12 */}
              <circle cx="160" cy="55" r="5" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />
              <text x="145" y="40" fill="#ef4444" fontSize="9">S-12 (R)</text>

              {/* Track 2: DN MAIN (12424 Rajdhani Approach) */}
              <text x="20" y="115" fill="#94a3b8" fontSize="10" fontWeight="bold">DN MAIN (12424 APP)</text>
              {/* Occupied Red Line */}
              <line x1="20" y1="125" x2="280" y2="125" stroke="#ef4444" strokeWidth="5" strokeLinecap="round" />
              {/* If Point 112B is reversed, path branches down into Platform 5 */}
              {point112BReverse ? (
                <>
                  {/* Divergent route to PF 5 in Yellow/Green */}
                  <path d="M 280 125 L 420 265 L 680 265" fill="none" stroke="#10b981" strokeWidth="4" strokeDasharray="6 3" />
                  <line x1="280" y1="125" x2="680" y2="125" stroke="#475569" strokeWidth="3" />
                </>
              ) : (
                <>
                  {/* Normal route into PF 3 */}
                  <line x1="280" y1="125" x2="680" y2="125" stroke="#f59e0b" strokeWidth="4" strokeDasharray="4 2" />
                </>
              )}

              {/* Train 12424 Marker */}
              <rect x="180" y="117" width="55" height="16" rx="4" fill="#991b1b" stroke="#fca5a5" strokeWidth="1" />
              <text x="185" y="129" fill="#ffffff" fontSize="9" fontWeight="bold">12424 RAJ</text>

              {/* Point Machine #112B Interactive Node */}
              <g 
                onClick={() => setPoint112BReverse(!point112BReverse)}
                className="cursor-pointer group"
              >
                <circle cx="280" cy="125" r="9" fill={point112BReverse ? "#10b981" : "#f59e0b"} stroke="#ffffff" strokeWidth="2" />
                <text x="280" y="105" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">
                  PT #112B [{point112BReverse ? 'REV' : 'NORM'}]
                </text>
              </g>

              {/* Track 3: WASH PIT LEAD */}
              <text x="20" y="185" fill="#94a3b8" fontSize="10" fontWeight="bold">WASH PIT LEAD</text>
              <line x1="20" y1="195" x2="680" y2="195" stroke="#10b981" strokeWidth="4" />
              <rect x="360" y="187" width="65" height="16" rx="4" fill="#065f46" stroke="#6ee7b7" strokeWidth="1" />
              <text x="368" y="199" fill="#ffffff" fontSize="9" fontWeight="bold">SHUNT WDS-6</text>

              {/* Point Machine #108B */}
              <g 
                onClick={() => setPoint108BReverse(!point108BReverse)}
                className="cursor-pointer"
              >
                <circle cx="460" cy="195" r="7" fill={point108BReverse ? "#10b981" : "#475569"} stroke="#ffffff" strokeWidth="1.5" />
                <text x="460" y="180" textAnchor="middle" fill="#94a3b8" fontSize="9">
                  PT #108B
                </text>
              </g>

              {/* Platforms Output Lines */}
              <text x="630" y="45" fill="#38bdf8" fontSize="10" fontWeight="bold">PF 01</text>
              <text x="630" y="115" fill="#f87171" fontSize="10" fontWeight="bold">PF 03 (CLASH)</text>
              <text x="630" y="185" fill="#38bdf8" fontSize="10" fontWeight="bold">PF 04</text>
              <text x="630" y="255" fill="#4ade80" fontSize="10" fontWeight="bold">PF 05 (AI SLOT)</text>
              <text x="630" y="325" fill="#38bdf8" fontSize="10" fontWeight="bold">PF 06</text>

              {/* Track 5: PLATFORM 5 ENTRY */}
              <line x1="420" y1="265" x2="680" y2="265" stroke={point112BReverse ? "#10b981" : "#475569"} strokeWidth="4" />

              {/* Track 6: PLATFORM 6 */}
              <line x1="200" y1="335" x2="680" y2="335" stroke="#475569" strokeWidth="4" />

              {/* Signals */}
              <circle cx="410" cy="125" r="5" fill={point112BReverse ? "#facc15" : "#ef4444"} stroke="#ffffff" strokeWidth="1" />
              <text x="400" y="110" fill="#facc15" fontSize="9">S-14 (YY)</text>
            </svg>
          </div>

          {/* Point State Controller Toggle Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono pt-2 border-t border-[#1b2f4a]">
            <div className="flex items-center gap-3">
              <span>Point Machines:</span>
              <button
                onClick={() => setPoint112BReverse(!point112BReverse)}
                className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-all cursor-pointer ${
                  point112BReverse
                    ? 'bg-emerald-600 text-white border-emerald-400'
                    : 'bg-[#15273e] text-slate-300 border-[#233f66] hover:bg-[#1d3759]'
                }`}
              >
                112B: {point112BReverse ? 'REVERSE (PF 5)' : 'NORMAL (PF 3)'}
              </button>

              <button
                onClick={() => setPoint104AReverse(!point104AReverse)}
                className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-all cursor-pointer ${
                  point104AReverse
                    ? 'bg-emerald-600 text-white border-emerald-400'
                    : 'bg-[#15273e] text-slate-300 border-[#233f66] hover:bg-[#1d3759]'
                }`}
              >
                104A: {point104AReverse ? 'REVERSE' : 'NORMAL'}
              </button>
            </div>

            <span className="text-slate-400 text-[11px]">Click point circles to toggle state</span>
          </div>
        </div>

        {/* Right Column: Active Route Simulator & Controls (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Active Route Simulator Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-bold text-slate-900 text-base">Active Route Simulator</h2>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                SIL-4 Validator
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-xs">
              <div className="font-bold text-slate-800">
                Diversion Target: Train 12424 Dibrugarh Rajdhani
              </div>
              <p className="text-slate-500 font-mono">
                Current: PF 3 (Locked) → Target: <strong className="text-emerald-700">PF 5 (Free Headway)</strong>
              </p>
            </div>

            {/* Step-by-Step Interlocking Sequence */}
            <div className="space-y-3 text-xs">
              <div className={`p-3 rounded-xl border transition-all ${
                point112BReverse ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <div className="flex items-center justify-between font-bold">
                  <span>Step 1: Set Point #112B to Reverse</span>
                  {point112BReverse ? <Check className="w-4 h-4 text-emerald-600" /> : <Lock className="w-3.5 h-3.5 text-slate-400" />}
                </div>
                <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">
                  Motor detected in Reverse within 4.2 sec limit.
                </span>
              </div>

              <div className={`p-3 rounded-xl border transition-all ${
                point112BReverse ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <div className="flex items-center justify-between font-bold">
                  <span>Step 2: Track Circuit 48TC Clearance</span>
                  {point112BReverse ? <Check className="w-4 h-4 text-emerald-600" /> : <Lock className="w-3.5 h-3.5 text-slate-400" />}
                </div>
                <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">
                  Axle counter delta: 0 (No stray wagons or pushback).
                </span>
              </div>

              <div className={`p-3 rounded-xl border transition-all ${
                point112BReverse ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <div className="flex items-center justify-between font-bold">
                  <span>Step 3: Signal S-14 Aspect → Diverge (YY)</span>
                  {point112BReverse ? <Check className="w-4 h-4 text-emerald-600" /> : <Lock className="w-3.5 h-3.5 text-slate-400" />}
                </div>
                <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">
                  Aspect double yellow primed for 30 km/h turnout entry.
                </span>
              </div>
            </div>

            {/* Execute Route Lock Action Button */}
            <button
              onClick={handleExecuteRouteLock}
              disabled={isExecuting || point112BReverse}
              className={`w-full py-3 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                point112BReverse
                  ? 'bg-emerald-600 text-white cursor-default'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
              }`}
            >
              {isExecuting ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Relaying Points & Interlocking Circuit...</span>
                </>
              ) : point112BReverse ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Route Locked to Platform 5</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                  <span>Execute Route Lock (SIL-4 Relay)</span>
                </>
              )}
            </button>
          </div>

          {/* Manual Safety Overrides & E-STOP */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Manual Dispatch Overrides
            </span>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => alert('Crank call sent to Tilak Bridge Ground Station Master')}
                className="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-all cursor-pointer text-center"
              >
                Point Crank Call
              </button>

              <button
                onClick={() => setShowEStopModal(true)}
                className="py-2.5 px-3 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-xs font-bold text-red-700 transition-all cursor-pointer text-center"
              >
                Cabin E-STOP
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Stop Modal */}
      {showEStopModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-red-200">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-slate-900">Confirm Cabin Emergency Stop (E-STOP)?</h3>
              <p className="text-xs text-slate-600">
                This will automatically de-energize all signal relays across NDLS Throat (CSB to TKJ) to RED aspects and trip track power breakers.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowEStopModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setEStopTriggered(true);
                  setShowEStopModal(false);
                  alert('CABIN E-STOP ENGAGED. All signals dropped to DANGER.');
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow cursor-pointer"
              >
                Engage E-STOP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
