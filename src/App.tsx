import React, { useState } from 'react';
import { Header } from './components/Header';
import { ReplayControlBar } from './components/ReplayControlBar';
import { HomeScreen } from './components/screens/HomeScreen';
import { TrainStatusScreen } from './components/screens/TrainStatusScreen';
import { DynamicETAScreen } from './components/screens/DynamicETAScreen';
import { OperationsConsoleScreen } from './components/screens/OperationsConsoleScreen';
import { GanttScheduleScreen } from './components/screens/GanttScheduleScreen';
import { TelemetryStreamScreen } from './components/screens/TelemetryStreamScreen';
import { InterlockingVisualizerScreen } from './components/screens/InterlockingVisualizerScreen';
import { TurnaroundRosterScreen } from './components/screens/TurnaroundRosterScreen';
import { LiveRadarScreen } from './components/screens/LiveRadarScreen';
import { AppView } from './types';
import { TrainProvider, useTrain } from './context/TrainContext';

function AppContent() {
  const [currentView, setCurrentView] = useState<AppView>('home');
  const { 
    selectedTrainNo, 
    setSelectedTrainNo, 
    conflictResolved, 
    resolveConflict, 
    inflowTrains, 
    ganttSlots,
    trainOverview 
  } = useTrain();

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafd] text-[#0c1c30]">
      {/* Universal Top Header Navigation */}
      <Header
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        unresolvedConflictCount={conflictResolved ? 0 : 1}
      />

      {/* Global Simulation Replay & FastAPI Sync Bar */}
      <ReplayControlBar />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {currentView === 'home' && (
          <HomeScreen
            onNavigate={(view) => setCurrentView(view)}
            onSelectTrain={(no) => setSelectedTrainNo(no)}
          />
        )}

        {currentView === 'live-radar' && (
          <LiveRadarScreen
            onNavigate={(view) => setCurrentView(view)}
            onSelectTrain={(no) => setSelectedTrainNo(no)}
          />
        )}

        {currentView === 'train-status' && (
          <TrainStatusScreen
            onNavigate={(view) => setCurrentView(view)}
            trainData={trainOverview}
          />
        )}

        {currentView === 'dynamic-eta' && (
          <DynamicETAScreen
            onNavigate={(view) => setCurrentView(view)}
          />
        )}

        {currentView === 'operations-console' && (
          <OperationsConsoleScreen
            onNavigate={(view) => setCurrentView(view)}
            inflowTrains={inflowTrains}
            ganttSlots={ganttSlots}
            onResolveConflict={resolveConflict}
            conflictResolved={conflictResolved}
          />
        )}

        {currentView === 'gantt-schedule' && (
          <GanttScheduleScreen
            onNavigate={(view) => setCurrentView(view)}
            ganttSlots={ganttSlots}
            onResolveConflict={resolveConflict}
            conflictResolved={conflictResolved}
          />
        )}

        {currentView === 'telemetry-stream' && (
          <TelemetryStreamScreen
            onNavigate={(view) => setCurrentView(view)}
          />
        )}

        {currentView === 'interlocking-sim' && (
          <InterlockingVisualizerScreen
            onNavigate={(view) => setCurrentView(view)}
            conflictResolved={conflictResolved}
            onResolveConflict={resolveConflict}
          />
        )}

        {currentView === 'turnaround-roster' && (
          <TurnaroundRosterScreen
            onNavigate={(view) => setCurrentView(view)}
          />
        )}
      </main>

      {/* Floating Screen Navigator for instant testing */}
      <aside aria-label="Demo Screens Navigator" className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 bg-[#0c1829]/95 backdrop-blur-md text-white px-4 py-2 rounded-full border border-[#1f324d] shadow-xl flex items-center gap-1 text-xs">
        <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold mr-1 hidden sm:inline">
          Screens:
        </span>
        <div className="flex items-center gap-1 overflow-x-auto max-w-[85vw]">
          {[
            { id: 'home', label: '1. Home' },
            { id: 'train-status', label: '2. Status' },
            { id: 'dynamic-eta', label: '3. Explainable AI' },
            { id: 'operations-console', label: '4. Dispatch' },
            { id: 'gantt-schedule', label: '5. Gantt' },
            { id: 'telemetry-stream', label: '6. Telemetry' },
            { id: 'interlocking-sim', label: '7. Interlocking' },
            { id: 'turnaround-roster', label: '8. Roster' }
          ].map(screen => (
            <button
              key={screen.id}
              onClick={() => setCurrentView(screen.id as AppView)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                currentView === screen.id 
                  ? 'bg-blue-600 text-white font-bold shadow' 
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              {screen.label}
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}

export default function App() {
  return (
    <TrainProvider>
      <AppContent />
    </TrainProvider>
  );
}
