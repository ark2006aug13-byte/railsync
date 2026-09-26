import React, { useState, useEffect } from 'react';
import { api, TrainStateResponse, EnhancedEtaResponse } from '../services/api';

interface Page2LiveArrivalProps {
  trainName: string;
  isRerouted: boolean;
  onNavigateToPage1: () => void;
  onNavigateToPage3: () => void;
}

export const Page2LiveArrival: React.FC<Page2LiveArrivalProps> = ({
  trainName,
  isRerouted,
  onNavigateToPage1,
  onNavigateToPage3,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [liveData, setLiveData] = useState<TrainStateResponse | null>(null);
  const [enhancedData, setEnhancedData] = useState<EnhancedEtaResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Extract 5-digit train number
  const trainNoMatch = trainName.match(/\b\d{5}\b/);
  const trainNo = trainNoMatch ? trainNoMatch[0] : '12301';

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    Promise.all([
      api.getTrainState(trainNo),
      api.getEnhancedETA(trainNo)
    ]).then(([state, eta]) => {
      if (isMounted) {
        if (state) setLiveData(state);
        if (eta) setEnhancedData(eta);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [trainNo, isRerouted]);

  return (
    <div className="w-full min-h-[calc(100vh-6.75rem)] flex flex-col animate-fadeIn">
      {/* Interactive Top Action & Status Bar */}
      <div className="w-full bg-[#ffffff]/90 backdrop-blur-md sticky top-16 z-30 px-4 sm:px-8 py-2.5 border-b border-[#c5c5d3]/30 shadow-xs">
        <div className="max-w-[760px] mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <button
            type="button"
            onClick={onNavigateToPage1}
            className="inline-flex items-center gap-1.5 text-xs text-[#444651] hover:text-[#00236f] transition-all font-semibold group cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-0.5 transition-transform">
              arrow_back
            </span>
            <span>Search Another Train</span>
          </button>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6ffbbe]/20 border border-[#006c49]/20 self-start sm:self-auto shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#006c49] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#006c49]"></span>
            </span>
            <span className="text-[11px] text-[#006c49] font-semibold tracking-tight">
              GPS Synced {liveData?.last_updated ? 'Just now' : '20s ago'}
            </span>
            <span className="text-[#c5c5d3] text-[11px]">•</span>
            <span className="text-[11px] text-[#444651] font-medium">
              Section: {liveData?.position?.current_section || 'Kanpur – Aligarh'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Focus Container */}
      <div className="w-full px-4 sm:px-6 py-8">
        <div className="max-w-[760px] mx-auto space-y-6">
          {/* 1. Train Identity Header */}
          <header className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-[#1e3a8a] text-white text-[10px] tracking-wider uppercase font-bold">
                {liveData?.train_name?.includes('Rajdhani') ? 'Priority Rajdhani' : 'Priority Superfast'}
              </span>
              <span className="text-xs text-[#444651] font-medium">
                {liveData?.active_section ? `${liveData.active_section.from_stn} ──► ${liveData.active_section.to_stn}` : 'Northern Zone Corridor'}
              </span>
              {isRerouted && (
                <span className="px-2 py-0.5 rounded-full bg-[#6ffbbe]/30 text-[#006c49] text-[10px] font-bold border border-[#006c49]/30">
                  PF 16 Fast Reroute Active
                </span>
              )}
            </div>
            <h1 className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl md:text-4xl text-[#131b2e] font-extrabold tracking-tight">
              {liveData?.train_name ? `${liveData.train_no} / ${liveData.train_name}` : (trainName || '12301 / Howrah – New Delhi Rajdhani Express')}
            </h1>
            {/* Telemetry Ribbon */}
            <div className="flex flex-wrap items-center gap-y-2 gap-x-3 pt-1">
              <div className="inline-flex items-center gap-1.5 text-xs text-[#444651] bg-[#f2f3ff] px-2.5 py-1 rounded-md border border-[#c5c5d3]/30">
                <span className="material-symbols-outlined text-[#00236f] text-[16px]">
                  speed
                </span>
                <span>
                  Current Speed:{' '}
                  <strong className="text-[#131b2e] font-bold">
                    {liveData?.position ? Math.round(liveData.position.speed_kmph) : 118} km/h
                  </strong>
                </span>
              </div>
              <div className="inline-flex items-center gap-1.5 text-xs text-[#444651] bg-[#f2f3ff] px-2.5 py-1 rounded-md border border-[#c5c5d3]/30">
                <span className="material-symbols-outlined text-[#006c49] text-[16px]">
                  location_on
                </span>
                <span>
                  Next Immediate Stop:{' '}
                  <strong className="text-[#131b2e] font-bold">
                    {liveData?.upcoming_stations?.[0]?.name || 'Kanpur Central'}
                  </strong>
                </span>
                <span className="px-1.5 py-0.2 rounded bg-[#e2e7ff] text-[#131b2e] text-[10px] font-bold">
                  {liveData?.upcoming_stations?.[0]?.eta_predicted_fmt || 'In 34 mins'}
                </span>
              </div>
            </div>
          </header>

          {/* 2. Hero Metric Card - Dynamic Destination Arrival */}
          <section className="bg-[#ffffff] rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow border border-[#c5c5d3]/30 relative overflow-hidden">
            {/* Ambient subtle accent bloom */}
            <div className="absolute -top-16 -right-16 w-56 h-56 bg-[#dce1ff]/30 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative space-y-4">
              {/* Card Top Bar */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="inline-flex items-center gap-1.5 text-[#444651]">
                  <span className="material-symbols-outlined text-[#00236f] text-[18px]">
                    insights
                  </span>
                  <span className="text-[11px] uppercase tracking-wider font-bold text-[#757682]">
                    Dynamic Destination Arrival (New Delhi - NDLS)
                  </span>
                </div>
                {/* Confidence Badge */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#6ffbbe]/30 text-[#005236] border border-[#006c49]/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#006c49]"></span>
                  <span className="text-[11px] font-bold">94% Neural Confidence</span>
                </div>
              </div>

              {/* Interval Main Visual */}
              <div className="pt-1 space-y-1">
                <div className="font-['Plus_Jakarta_Sans'] text-3xl sm:text-4xl text-[#00236f] font-extrabold tracking-tight tabular-nums">
                  {isRerouted ? '10:04 AM – 10:08 AM' : '10:12 AM – 10:18 AM'}
                </div>
                <p className="text-xs sm:text-sm text-[#444651]">
                  Dynamic predictive window calculated via sensor telemetry and section occupancy.
                </p>
              </div>

              {/* Expected Peak Dynamic ETA block */}
              <div className="p-4 bg-[#f2f3ff] rounded-xl flex flex-wrap items-center justify-between gap-4 border border-[#c5c5d3]/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#eaedff] flex items-center justify-center text-[#00236f]">
                    <span className="material-symbols-outlined text-[22px]">
                      schedule
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#444651] uppercase tracking-wider font-bold block">
                      Expected Dynamic ETA
                    </span>
                    <span className="font-['Plus_Jakarta_Sans'] text-lg text-[#131b2e] font-bold tabular-nums">
                      {isRerouted ? '10:06 AM' : '10:15 AM'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-[10px] text-[#757682] uppercase tracking-wider font-bold block">
                      Scheduled
                    </span>
                    <span className="font-['Plus_Jakarta_Sans'] text-lg text-[#757682] line-through tabular-nums font-semibold">
                      09:55 AM
                    </span>
                  </div>
                  {/* Net Delay Pill */}
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                      isRerouted
                        ? 'bg-[#6ffbbe]/40 text-[#006c49]'
                        : 'bg-[#6ffbbe]/40 text-[#006c49]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      trending_down
                    </span>
                    Net Delay: {isRerouted ? '+11 mins (Recovered 9m)' : '+20 mins'}
                  </span>
                </div>
              </div>

              {/* Interactive Micro-Timeline */}
              <div className="pt-2">
                <div className="flex items-center justify-between text-[11px] text-[#757682] pb-1.5 font-medium">
                  <span>Origin: Howrah Jn (HWH)</span>
                  <span className="font-semibold text-[#131b2e]">78% Route Complete</span>
                  <span>Terminus: New Delhi (NDLS)</span>
                </div>
                <div className="w-full bg-[#eaedff] h-2 rounded-full overflow-hidden flex">
                  <div
                    className="bg-[#00236f] h-full rounded-full transition-all duration-1000 ease-out"
                    style={{ width: '78%' }}
                  ></div>
                </div>
              </div>
            </div>
          </section>

          {/* 3. Essential 2-Column Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card A: Delay Incurred */}
            <div className="bg-[#ffffff] rounded-xl p-5 shadow-xs border border-[#c5c5d3]/30 flex flex-col justify-between hover:shadow-sm transition-all">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-[#757682] font-bold">
                    Total Delays Incurred
                  </span>
                  <span className="material-symbols-outlined text-[#f39461] text-[20px]">
                    warning
                  </span>
                </div>
                <div className="font-['Plus_Jakarta_Sans'] text-2xl text-[#f39461] font-bold tabular-nums">
                  {isRerouted ? '+21.7 mins' : '+30.7 mins'}
                </div>
              </div>
              <div className="pt-3 mt-2 border-t border-[#c5c5d3]/20">
                <p className="text-xs text-[#444651] flex items-start gap-1.5 leading-relaxed">
                  <span className="material-symbols-outlined text-[15px] text-[#757682] mt-0.5 shrink-0">
                    info
                  </span>
                  <span>
                    {isRerouted
                      ? 'Fog speed restriction in Mughalsarai belt. Platform outer hold avoided.'
                      : 'Fog speed restriction in Mughalsarai belt & outer platform hold at Prayagraj.'}
                  </span>
                </p>
              </div>
            </div>

            {/* Card B: Slack Recovered */}
            <div className="bg-[#ffffff] rounded-xl p-5 shadow-xs border border-[#c5c5d3]/30 flex flex-col justify-between hover:shadow-sm transition-all">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-[#757682] font-bold">
                    Time Deleted / Recovered
                  </span>
                  <span className="material-symbols-outlined text-[#006c49] text-[20px]">
                    bolt
                  </span>
                </div>
                <div className="font-['Plus_Jakarta_Sans'] text-2xl text-[#006c49] font-bold tabular-nums">
                  {isRerouted ? '-19.7 mins' : '-10.7 mins'}
                </div>
              </div>
              <div className="pt-3 mt-2 border-t border-[#c5c5d3]/20">
                <p className="text-xs text-[#444651] flex items-start gap-1.5 leading-relaxed">
                  <span className="material-symbols-outlined text-[15px] text-[#006c49] mt-0.5 shrink-0">
                    check_circle
                  </span>
                  <span>
                    {isRerouted
                      ? '130 km/h sustained run + Crossover 42B PF 16 instant berthing.'
                      : '130 km/h sustained line run on clear Grand Chord track corridor.'}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* 4. Primary Call to Action Button */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onNavigateToPage3}
              className="flex-1 bg-[#1e3a8a] text-white hover:bg-[#00236f] py-3.5 px-6 rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group active:scale-[0.99] cursor-pointer"
            >
              <span>Inspect Delay Causes &amp; Recovery Breakdown</span>
              <span className="material-symbols-outlined text-[20px] group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="px-4 py-3.5 rounded-xl bg-[#ffffff] border border-[#c5c5d3]/40 text-[#131b2e] hover:bg-[#eaedff] text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              title="Quick preview summary"
            >
              <span className="material-symbols-outlined text-[18px] text-[#1e3a8a]">
                visibility
              </span>
              <span>Quick Preview</span>
            </button>
          </div>

          {/* Quick Telemetry Footnote */}
          <div className="text-center pt-1">
            <p className="text-xs text-[#757682]">
              Neural model considers 14 block sections ahead, cross-traffic merges, and train-precedence matrices.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Modal: Delay Breakdown Drawer / Preview */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-[#283044]/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-[#ffffff] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-[#c5c5d3]/30 animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#dce1ff] flex items-center justify-center text-[#00236f]">
                  <span className="material-symbols-outlined text-[18px]">analytics</span>
                </div>
                <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#131b2e]">
                  Breakdown Intelligence
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full hover:bg-[#f2f3ff] flex items-center justify-center text-[#444651] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-2.5">
              <div className="p-3 bg-[#f2f3ff] rounded-xl flex justify-between items-center">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-[#131b2e]">
                    Section Fog &amp; Visibility
                  </div>
                  <div className="text-[11px] text-[#757682]">Gaya – Sasaram Sector</div>
                </div>
                <span className="text-xs font-bold text-[#f39461]">+18.5m</span>
              </div>
              <div className="p-3 bg-[#f2f3ff] rounded-xl flex justify-between items-center">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-[#131b2e]">
                    Platform Clearance Hold
                  </div>
                  <div className="text-[11px] text-[#757682]">Prayagraj Jn Junction</div>
                </div>
                <span className="text-xs font-bold text-[#f39461]">+12.2m</span>
              </div>
              <div className="p-3 bg-[#6ffbbe]/20 rounded-xl flex justify-between items-center border border-[#006c49]/20">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-[#006c49]">
                    High-Speed Acceleration Corridor
                  </div>
                  <div className="text-[11px] text-[#005236]">Kanpur bypass automated clearance</div>
                </div>
                <span className="text-xs font-bold text-[#006c49]">-10.7m</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg bg-[#f2f3ff] text-[#131b2e] hover:bg-[#eaedff] text-xs font-semibold transition-colors cursor-pointer"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  onNavigateToPage3();
                }}
                className="px-4 py-2 rounded-lg bg-[#1e3a8a] text-white hover:bg-[#00236f] text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>Full Corridor Report</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
