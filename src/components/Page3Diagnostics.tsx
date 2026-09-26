import React, { useState, useEffect } from 'react';
import { api, EnhancedEtaResponse, TrainStateResponse } from '../services/api';

interface Page3DiagnosticsProps {
  trainName: string;
  isRerouted: boolean;
  onNavigateToPage2: () => void;
  onNavigateToPage4: () => void;
}

export const Page3Diagnostics: React.FC<Page3DiagnosticsProps> = ({
  trainName,
  isRerouted,
  onNavigateToPage2,
  onNavigateToPage4,
}) => {
  const [enhancedData, setEnhancedData] = useState<EnhancedEtaResponse | null>(null);
  const [liveData, setLiveData] = useState<TrainStateResponse | null>(null);

  const trainNoMatch = trainName.match(/\b\d{5}\b/);
  const trainNo = trainNoMatch ? trainNoMatch[0] : '12301';

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      api.getEnhancedETA(trainNo),
      api.getTrainState(trainNo)
    ]).then(([eta, state]) => {
      if (isMounted) {
        if (eta) setEnhancedData(eta);
        if (state) setLiveData(state);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [trainNo, isRerouted]);
  return (
    <div className="w-full min-h-[calc(100vh-6.75rem)] px-4 sm:px-8 py-6 md:py-10 animate-fadeIn">
      <div className="w-full max-w-[940px] mx-auto flex flex-col gap-6">
        {/* 1. Context Navigation Bar */}
        <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onNavigateToPage2}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ffffff] text-[#131b2e] hover:bg-[#eaedff] transition-all shadow-xs border border-[#c5c5d3]/30 text-xs font-semibold group cursor-pointer"
            >
              <span className="material-symbols-outlined text-[#757682] group-hover:text-[#00236f] transition-colors text-[18px]">
                arrow_back
              </span>
              <span>Back to Live Arrival</span>
            </button>
            <div className="hidden sm:flex items-center gap-2 pl-2">
              <img
                alt="RailSync"
                className="w-5 h-5 object-contain rounded-md"
                src="https://lh3.googleusercontent.com/aida/AEtjO1XmmDFX5aZk67_N3wkNzJfLPrmY_WTQAs1faj0sYyNlcvaWWkk97qZD7KHXCosWuhvaxWxq6mT76UKtktIHG3XxaU5p3mYCnA0YkBZavUk0Dm781ndBGVEiTBeBdKcfZjNS_Z5SwsQdDTxKNlauyw3MsZ_1IkYDY2XkTb0VZGhxJyq8bV2Y1mQjllx9_ktoXRgxZRf7Tp1bA1iKTYHkgH7aWov2bCjkNUBmSILUebTfU51-NYA7yvU8rxc"
              />
              <span className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-[#00236f]">
                RailSync
              </span>
              <span className="text-[#c5c5d3] text-xs">/</span>
              <span className="text-xs text-[#444651] font-medium">Diagnostics</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#ffffff] border border-[#c5c5d3]/30 shadow-xs self-start sm:self-auto">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#006c49] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#006c49]"></span>
            </span>
            <span className="text-[11px] text-[#006c49] font-bold">
              Telemetry Synced (0.8s)
            </span>
            <span className="text-[#c5c5d3]">•</span>
            <span className="text-[11px] text-[#444651] font-medium">Block KM 1014.2</span>
          </div>
        </div>

        {/* 2. Header & Decomposition Meta */}
        <div className="flex flex-col gap-2">
          <div className="inline-flex items-center gap-1.5 self-start px-3 py-1 rounded-full bg-[#dce1ff] text-[#00236f] border border-[#1e3a8a]/20">
            <span className="material-symbols-outlined text-[15px]">analytics</span>
            <span className="text-[10px] tracking-wider uppercase font-bold">
              TRAIN 12301 TELEMETRY DECOMPOSITION
            </span>
          </div>
          <h1 className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#131b2e] tracking-tight">
            How Train 12301’s ETA Was Calculated{' '}
            <span className="text-[#444651] font-normal">(NDLS Arrival)</span>
          </h1>
          <p className="text-sm sm:text-base text-[#444651] max-w-2xl leading-relaxed">
            Dynamic neural breakdown explaining live signal caution vectors, terminal clearance constraints, and continuous line-speed velocity recovery offsets.
          </p>

          {/* Comprehensive Quick Summary Card */}
          <div className="mt-3 bg-[#ffffff] rounded-2xl p-5 shadow-xs border border-[#c5c5d3]/30">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
              {/* Scheduled */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] uppercase tracking-wider text-[#757682] font-bold">
                  Scheduled Target
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#131b2e]">
                    09:55
                  </span>
                  <span className="text-xs font-semibold text-[#444651]">AM</span>
                </div>
                <span className="text-[11px] text-[#757682]">Timetable Baseline</span>
              </div>

              {/* Delay Added */}
              <div className="flex flex-col gap-0.5 relative md:pl-4 md:border-l md:border-[#c5c5d3]/30">
                <span className="text-[10px] uppercase tracking-wider text-[#773205] font-bold">
                  Delay Incurred
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#773205]">
                    {isRerouted ? '+21.7' : '+30.7'}
                  </span>
                  <span className="text-xs font-semibold text-[#773205]">min</span>
                </div>
                <span className="text-[11px] text-[#757682]">
                  {isRerouted ? '3 caution events' : '4 caution events'}
                </span>
              </div>

              {/* Time Recovered */}
              <div className="flex flex-col gap-0.5 relative md:pl-4 md:border-l md:border-[#c5c5d3]/30">
                <span className="text-[10px] uppercase tracking-wider text-[#006c49] font-bold">
                  Velocity Recovery
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#006c49]">
                    {isRerouted ? '-19.7' : '-10.7'}
                  </span>
                  <span className="text-xs font-semibold text-[#006c49]">min</span>
                </div>
                <span className="text-[11px] text-[#006c49] font-medium">
                  {isRerouted ? 'Corridor + PF 16' : 'High-speed corridor'}
                </span>
              </div>

              {/* Final ETA */}
              <div className="flex flex-col gap-0.5 bg-[#f2f3ff] rounded-xl p-3 border border-[#c5c5d3]/30 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-[#00236f] font-bold">
                    Dynamic ETA
                  </span>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#006c49] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#006c49]"></span>
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#00236f]">
                    {isRerouted ? '10:06' : '10:15'}
                  </span>
                  <span className="text-xs font-bold text-[#00236f]">AM</span>
                </div>
                <span className="text-[11px] text-[#444651] font-semibold">
                  {isRerouted ? 'Delayed by 11.0 mins' : 'Delayed by 20.0 mins'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Two Clean Modular Panels (Delays vs Recoveries) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Card A: Delay Injections */}
          <div className="bg-[#ffffff] rounded-2xl p-5 sm:p-6 shadow-xs border border-[#c5c5d3]/30 flex flex-col gap-4">
            {/* Panel Header */}
            <div className="flex items-center justify-between pb-1 border-b border-[#c5c5d3]/20">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#ffdbcb] flex items-center justify-center text-[#773205]">
                  <span className="material-symbols-outlined text-[18px]">warning</span>
                </div>
                <div>
                  <h2 className="font-['Plus_Jakarta_Sans'] text-sm sm:text-base font-bold text-[#131b2e]">
                    Delay Incurred
                  </h2>
                  <p className="text-[11px] text-[#757682]">Signal &amp; terminal bottlenecks</p>
                </div>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#ffdbcb] text-[#773205]">
                {isRerouted ? '+21.7 mins' : '+30.7 mins'}
              </span>
            </div>

            {/* Delay Items */}
            <div className="flex flex-col gap-2.5">
              {/* Item 1 */}
              <div className="p-3.5 rounded-xl bg-[#f2f3ff]/70 hover:bg-[#f2f3ff] transition-colors flex flex-col gap-1 border border-[#c5c5d3]/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#131b2e]">Winter Fog Caution</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#ffdbcb] text-[#773205]">
                    +6.5 mins
                  </span>
                </div>
                <p className="text-xs text-[#444651]">
                  Speed clamped to 60 km/h across Gangetic Plain automatic block sections (KM 620–680).
                </p>
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="material-symbols-outlined text-[14px] text-[#757682]">
                    foggy
                  </span>
                  <span className="text-[11px] text-[#757682]">
                    Visibility &lt; 250m • Section CNB-TDL
                  </span>
                </div>
              </div>

              {/* Item 2 */}
              <div className="p-3.5 rounded-xl bg-[#f2f3ff]/70 hover:bg-[#f2f3ff] transition-colors flex flex-col gap-1 border border-[#c5c5d3]/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#131b2e]">
                    Trailing Signal Caution
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#ffdbcb] text-[#773205]">
                    +4.2 mins
                  </span>
                </div>
                <p className="text-xs text-[#444651]">
                  Double yellow aspect observed trailing Train 12876 (Neelachal Exp, headway margin 7.4 km).
                </p>
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="material-symbols-outlined text-[14px] text-[#757682]">
                    traffic
                  </span>
                  <span className="text-[11px] text-[#757682]">
                    Inter-train spacing governed by automatic block
                  </span>
                </div>
              </div>

              {/* Item 3: Alert High Priority (Resolvable) */}
              <div
                className={`p-3.5 rounded-xl transition-all flex flex-col gap-1 relative overflow-hidden border ${
                  isRerouted
                    ? 'bg-[#6ffbbe]/15 border-[#006c49]/30 opacity-80'
                    : 'bg-[#ffdbcb]/30 border-[#f39461]/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`material-symbols-outlined text-[18px] ${
                        isRerouted ? 'text-[#006c49]' : 'text-[#773205]'
                      }`}
                    >
                      {isRerouted ? 'check_circle' : 'error'}
                    </span>
                    <span className="text-xs font-bold text-[#131b2e]">
                      {isRerouted
                        ? 'Platform 12 Outer Hold (Resolved via PF 16)'
                        : 'Platform 12 Outer Hold'}
                    </span>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      isRerouted
                        ? 'bg-[#6ffbbe]/40 text-[#006c49]'
                        : 'bg-[#ffdbcb] text-[#773205]'
                    }`}
                  >
                    {isRerouted ? '0.0 mins (Deleted)' : '+9.0 mins'}
                  </span>
                </div>
                <p className="text-xs text-[#131b2e] font-medium leading-relaxed">
                  {isRerouted
                    ? 'Point 42B reversed. Train 12301 admitted straight to empty Platform 16 without halt.'
                    : 'Train 12876 currently occupying Platform 12 at New Delhi. Train held at Yamuna Bridge outer.'}
                </p>
                <div className="flex items-center justify-between pt-1">
                  <span
                    className={`text-[11px] font-semibold ${
                      isRerouted ? 'text-[#006c49]' : 'text-[#773205]'
                    }`}
                  >
                    {isRerouted ? 'Station Throat Clear' : 'Station Throat Bottleneck'}
                  </span>
                  <button
                    type="button"
                    onClick={onNavigateToPage4}
                    className="text-[11px] text-[#00236f] font-bold underline hover:text-[#1e3a8a] cursor-pointer"
                  >
                    {isRerouted ? 'View platform allocation →' : 'Resolve platform →'}
                  </button>
                </div>
              </div>

              {/* Item 4 */}
              <div className="p-3.5 rounded-xl bg-[#f2f3ff]/70 hover:bg-[#f2f3ff] transition-colors flex flex-col gap-1 border border-[#c5c5d3]/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#131b2e]">
                    Junction Throat Restriction
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#ffdbcb] text-[#773205]">
                    +11.0 mins
                  </span>
                </div>
                <p className="text-xs text-[#444651]">
                  Mandatory 25 km/h terminal diamond turnout speed limit on NDLS southern approaches.
                </p>
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="material-symbols-outlined text-[14px] text-[#757682]">
                    alt_route
                  </span>
                  <span className="text-[11px] text-[#757682]">
                    Turnout speed regulation permanent constraint
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card B: Velocity Recovery */}
          <div className="bg-[#ffffff] rounded-2xl p-5 sm:p-6 shadow-xs border border-[#c5c5d3]/30 flex flex-col gap-4">
            {/* Panel Header */}
            <div className="flex items-center justify-between pb-1 border-b border-[#c5c5d3]/20">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#6ffbbe]/40 flex items-center justify-center text-[#006c49]">
                  <span className="material-symbols-outlined text-[18px]">bolt</span>
                </div>
                <div>
                  <h2 className="font-['Plus_Jakarta_Sans'] text-sm sm:text-base font-bold text-[#131b2e]">
                    Velocity Recovery
                  </h2>
                  <p className="text-[11px] text-[#757682]">Corridor optimization gains</p>
                </div>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#6ffbbe]/40 text-[#006c49]">
                {isRerouted ? '-19.7 mins' : '-10.7 mins'}
              </span>
            </div>

            {/* Recovery Items */}
            <div className="flex flex-col gap-2.5">
              {/* Item 1 */}
              <div className="p-3.5 rounded-xl bg-[#f2f3ff]/70 hover:bg-[#f2f3ff] transition-colors flex flex-col gap-1 border border-[#c5c5d3]/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#131b2e]">
                    130 km/h Clear Track Sprint
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#6ffbbe]/40 text-[#006c49]">
                    -7.5 mins
                  </span>
                </div>
                <p className="text-xs text-[#444651]">
                  WAP-7 dual-cab locomotive exploited high-density green corridor between Kanpur (CNB) and Aligarh (ALJN).
                </p>
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="material-symbols-outlined text-[14px] text-[#006c49]">
                    speed
                  </span>
                  <span className="text-[11px] text-[#006c49] font-medium">
                    Sustained MPS 130 km/h for 142 km stretch
                  </span>
                </div>
              </div>

              {/* Item 2 */}
              <div className="p-3.5 rounded-xl bg-[#f2f3ff]/70 hover:bg-[#f2f3ff] transition-colors flex flex-col gap-1 border border-[#c5c5d3]/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#131b2e]">
                    Priority Looping Advantage
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#6ffbbe]/40 text-[#006c49]">
                    -3.2 mins
                  </span>
                </div>
                <p className="text-xs text-[#444651]">
                  Freight rake #8841 looped at Khurja loop siding, providing Train 12301 uninterrupted green aspects.
                </p>
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="material-symbols-outlined text-[14px] text-[#006c49]">
                    low_priority
                  </span>
                  <span className="text-[11px] text-[#006c49] font-medium">
                    Dispatched without stopping on main line
                  </span>
                </div>
              </div>

              {/* Extra Reroute bonus item if rerouted */}
              {isRerouted && (
                <div className="p-3.5 rounded-xl bg-[#6ffbbe]/25 transition-colors flex flex-col gap-1 border border-[#006c49]/30 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#006c49]">
                      Platform 16 Diversion Clearance
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#6ffbbe] text-[#005236]">
                      -9.0 mins
                    </span>
                  </div>
                  <p className="text-xs text-[#005236]">
                    Avoided Yamuna signal danger halt completely by diverting via Switch 42B to Platform 16.
                  </p>
                </div>
              )}

              {/* Visual Corridor Efficiency Graph / Gauge */}
              <div className="p-3.5 rounded-xl bg-[#f2f3ff] flex flex-col gap-2 border border-[#c5c5d3]/20">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-[#757682] font-bold">
                    Corridor Slack Efficiency
                  </span>
                  <span className="text-xs font-bold text-[#006c49]">
                    {isRerouted ? '96% Optimal' : '88% Optimal'}
                  </span>
                </div>
                {/* Progress Track */}
                <div className="w-full bg-[#eaedff] h-2.5 rounded-full overflow-hidden flex">
                  <div
                    className="bg-[#006c49] h-full rounded-full transition-all duration-500"
                    style={{ width: isRerouted ? '96%' : '88%' }}
                  ></div>
                </div>
                <div className="flex items-center justify-between text-[#757682] text-[10px] pt-0.5 font-medium">
                  <span>Dynamic Cushion Reserve</span>
                  <span>{isRerouted ? '6.8 min buffer remaining' : '4.1 min buffer remaining'}</span>
                </div>
              </div>

              {/* Neural Model Note */}
              <div className="p-2.5 rounded-lg bg-[#ffffff] border border-[#c5c5d3]/30 flex items-start gap-2 text-[#444651]">
                <span className="material-symbols-outlined text-[16px] text-[#00236f] mt-0.5">
                  neurology
                </span>
                <span className="text-xs leading-relaxed">
                  Calculated using RailSync Neural Engine v4.2 with 3-year historical corridor velocity patterns.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Formula Summary Bar */}
        <div className="w-full bg-[#ffffff] rounded-2xl p-5 sm:p-6 shadow-xs border border-[#c5c5d3]/30 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-[#757682] font-bold">
              Live Operational Equation
            </span>
            <span className="text-xs text-[#006c49] font-bold">Confidence Score: 94%</span>
          </div>

          {/* Mathematical Flow */}
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4 py-2">
            {/* Step 1: Base */}
            <div className="flex-1 min-w-[120px] bg-[#f2f3ff] p-3.5 rounded-xl text-center border border-[#c5c5d3]/20">
              <span className="text-[10px] text-[#757682] uppercase block font-semibold">
                Baseline
              </span>
              <span className="font-['Plus_Jakarta_Sans'] text-xl sm:text-2xl font-bold text-[#131b2e]">
                09:55 AM
              </span>
              <span className="text-xs text-[#444651] block font-medium">Schedule</span>
            </div>

            {/* Operator Plus */}
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[#eaedff] text-[#757682] font-['Plus_Jakarta_Sans'] font-bold text-sm">
              +
            </div>

            {/* Step 2: Delay */}
            <div className="flex-1 min-w-[120px] bg-[#ffdbcb]/30 p-3.5 rounded-xl text-center border border-[#f39461]/20">
              <span className="text-[10px] text-[#773205] uppercase font-bold block">
                Delays
              </span>
              <span className="font-['Plus_Jakarta_Sans'] text-xl sm:text-2xl font-bold text-[#773205]">
                {isRerouted ? '+21.7 m' : '+30.7 m'}
              </span>
              <span className="text-xs text-[#773205] block font-medium">
                {isRerouted ? '3 Injections' : '4 Injections'}
              </span>
            </div>

            {/* Operator Minus */}
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[#eaedff] text-[#757682] font-['Plus_Jakarta_Sans'] font-bold text-sm">
              −
            </div>

            {/* Step 3: Recovery */}
            <div className="flex-1 min-w-[120px] bg-[#6ffbbe]/20 p-3.5 rounded-xl text-center border border-[#006c49]/20">
              <span className="text-[10px] text-[#006c49] uppercase font-bold block">
                Recovered
              </span>
              <span className="font-['Plus_Jakarta_Sans'] text-xl sm:text-2xl font-bold text-[#006c49]">
                {isRerouted ? '-19.7 m' : '-10.7 m'}
              </span>
              <span className="text-xs text-[#006c49] block font-medium">
                Velocity Gain
              </span>
            </div>

            {/* Operator Equals */}
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[#1e3a8a] text-white font-['Plus_Jakarta_Sans'] font-bold text-sm">
              =
            </div>

            {/* Step 4: Final ETA */}
            <div className="flex-1 min-w-[140px] bg-[#1e3a8a] p-3.5 rounded-xl text-center text-white shadow-md">
              <span className="text-[10px] text-[#dce1ff] uppercase font-bold block">
                Dynamic ETA
              </span>
              <span className="font-['Plus_Jakarta_Sans'] text-xl sm:text-2xl font-bold text-white">
                {isRerouted ? '10:06 AM' : '10:15 AM'}
              </span>
              <span className="text-xs text-[#dce1ff] block font-medium">
                {isRerouted ? '+11.0m Net Delay' : '+20.0m Net Delay'}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between text-[#757682] text-[11px] pt-1 gap-2 border-t border-[#c5c5d3]/20">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-[#006c49]">
                check_circle
              </span>
              <span>
                Verified against live automatic block section track circuits between CNB and NDLS.
              </span>
            </div>
            <span className="text-[#444651] font-semibold">Refreshed: Live Precision</span>
          </div>
        </div>

        {/* 5. Interactive Resolution Banner */}
        <div className="w-full bg-[#ffffff] rounded-2xl p-5 sm:p-6 shadow-sm border border-[#c5c5d3]/30 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 max-w-xl">
            <div className="w-10 h-10 rounded-xl bg-[#ffdbcb] shrink-0 flex items-center justify-center text-[#773205]">
              <span className="material-symbols-outlined text-[24px]">call_split</span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#131b2e]">
                  Platform 12 Conflict Detected
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#ffdbcb] text-[#773205] font-bold uppercase">
                  Actionable
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#444651] leading-relaxed">
                Platform 12 conflict is causing{' '}
                <strong className="text-[#773205] font-bold">+9.0m unnecessary outer hold</strong>.
                Diverting Train 12301 to vacant Platform 16 will recover 9 minutes instantly.
              </p>
            </div>
          </div>

          <div className="shrink-0 w-full md:w-auto">
            <button
              type="button"
              onClick={onNavigateToPage4}
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#00236f] hover:bg-[#1e3a8a] text-white text-xs sm:text-sm font-bold transition-all shadow-md group cursor-pointer"
            >
              <span>Open Station Platform Resolver</span>
              <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
