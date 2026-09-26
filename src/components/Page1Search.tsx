import React, { useState } from 'react';
import { Search, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

interface Page1SearchProps {
  currentTrain: string;
  onSelectTrain: (trainName: string) => void;
  onNavigateToPage2: () => void;
}

export const Page1Search: React.FC<Page1SearchProps> = ({
  currentTrain,
  onSelectTrain,
  onNavigateToPage2,
}) => {
  const [query, setQuery] = useState(currentTrain || '12301 Howrah Rajdhani');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const performSearch = async (targetQuery: string) => {
    const q = targetQuery.trim();
    if (!q) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const result = await api.predictTrain(q);
      if (result && result.trainNo) {
        onSelectTrain(`${result.trainNo} / ${result.trainName}`);
        onNavigateToPage2();
      } else {
        onSelectTrain(q);
        onNavigateToPage2();
      }
    } catch (e) {
      console.warn('Search error:', e);
      onSelectTrain(q);
      onNavigateToPage2();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
  };

  const handleChipClick = (trainName: string) => {
    setQuery(trainName);
    performSearch(trainName);
  };

  return (
    <div className="relative w-full overflow-hidden px-4 sm:px-8 py-10 md:py-20 min-h-[calc(100vh-6.75rem)] flex items-center justify-center">
      {/* Ambient Depth Background Glows */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[720px] h-[360px] bg-gradient-to-b from-[#b6c4ff]/25 via-[#dae2fd]/15 to-transparent blur-3xl rounded-full"></div>
      <div className="pointer-events-none absolute top-1/3 left-1/4 w-[400px] h-[280px] bg-[#6ffbbe]/15 blur-[100px] rounded-full"></div>

      <div className="relative max-w-5xl mx-auto flex flex-col items-center w-full">
        {isLoading ? (
          /* LOADING PULSE OVERLAY */
          <div className="w-full flex flex-col items-center justify-center py-20 min-h-[420px] animate-fadeIn">
            <div className="relative flex items-center justify-center mb-6">
              {/* Animated Concentric Rings */}
              <div className="absolute w-28 h-28 rounded-full bg-[#dce1ff]/40 animate-ping"></div>
              <div className="absolute w-20 h-20 rounded-full bg-[#6ffbbe]/40 animate-pulse"></div>
              <div className="relative z-10 w-16 h-16 rounded-2xl bg-[#00236f] flex items-center justify-center shadow-lg">
                <RefreshCw className="w-8 h-8 text-white animate-spin" />
              </div>
            </div>
            <h3 className="font-['Plus_Jakarta_Sans'] text-xl text-[#131b2e] font-semibold mb-2 text-center">
              Analyzing track clearance &amp; running telemetry...
            </h3>
            <p className="text-sm text-[#444651] text-center max-w-md">
              Interrogating automatic block signalling zones and gradient velocity matrices.
            </p>
            {/* Step Progress Indicators */}
            <div className="flex items-center gap-2 mt-6">
              <div className="h-1.5 w-8 rounded-full bg-[#006c49] animate-pulse"></div>
              <div className="h-1.5 w-8 rounded-full bg-[#1e3a8a] animate-pulse delay-100"></div>
              <div className="h-1.5 w-8 rounded-full bg-[#dae2fd]"></div>
            </div>
          </div>
        ) : (
          /* HERO & INTELLIGENCE SEARCH INTERFACE */
          <div className="w-full flex flex-col items-center animate-fadeIn">
            {/* Status Overline Pill */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#ffffff] shadow-sm mb-6 border border-[#c5c5d3]/40">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#006c49] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#006c49]"></span>
              </span>
              <span className="text-[11px] text-[#006c49] tracking-wider uppercase font-bold">
                RailSync Matrix Core 4.2
              </span>
              <span className="text-[#c5c5d3]">•</span>
              <span className="text-[11px] text-[#444651] font-medium">
                Live Dispatch Stream
              </span>
            </div>

            {/* Hero Headline & Subtitle */}
            <h1 className="font-['Plus_Jakarta_Sans'] text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#131b2e] text-center max-w-3xl mb-3 tracking-tight leading-tight">
              Track Dynamic Arrival &amp; Delay Intelligence
            </h1>
            <p className="text-base sm:text-lg text-[#444651] text-center max-w-2xl mb-8 leading-relaxed">
              Live neural arrival predictions accounting for track congestion, signaling, and speed recovery.
            </p>

            {/* Floating Central Search Card */}
            <div className="w-full max-w-2xl bg-[#ffffff] rounded-2xl p-2 sm:p-2.5 shadow-xl border border-[#c5c5d3]/30 transition-all hover:shadow-2xl">
              <form
                onSubmit={handleSubmit}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
              >
                <div className="flex items-center flex-1 px-3 py-2">
                  <Search className="w-5 h-5 text-[#757682] mr-3 shrink-0" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Enter Train Number or Name (e.g. 12301, 22436, 12367, Rajdhani)..."
                    className="w-full bg-transparent text-sm sm:text-base text-[#131b2e] placeholder:text-[#757682] focus:outline-none tracking-normal font-medium"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 bg-[#1e3a8a] hover:bg-[#00236f] text-white text-sm font-semibold px-6 py-3.5 rounded-xl shadow-md transition-all whitespace-nowrap active:scale-[0.98] cursor-pointer"
                >
                  <span>Analyze Dynamic Arrival</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
              </form>
            </div>

            {errorMsg && (
              <div className="mt-3 flex items-center gap-2 text-xs text-[#ba1a1a] bg-[#ffdad6]/50 px-3 py-1.5 rounded-lg border border-[#ba1a1a]/20">
                <AlertCircle className="w-4 h-4" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Quick Suggestion Badges */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4 max-w-2xl">
              <span className="text-xs text-[#444651] mr-1 font-medium">Frequent:</span>
              <button
                type="button"
                onClick={() => handleChipClick('12301 Howrah Rajdhani')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#ffffff] border border-[#c5c5d3]/40 shadow-sm text-[#131b2e] hover:bg-[#e2e7ff] transition-all text-xs font-medium cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#006c49]"></span>
                12301 Howrah Rajdhani
              </button>
              <button
                type="button"
                onClick={() => handleChipClick('12004 Shatabdi Exp')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#ffffff] border border-[#c5c5d3]/40 shadow-sm text-[#131b2e] hover:bg-[#e2e7ff] transition-all text-xs font-medium cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#1e3a8a]"></span>
                12004 Shatabdi Exp
              </button>
              <button
                type="button"
                onClick={() => handleChipClick('22436 Vande Bharat')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#ffffff] border border-[#c5c5d3]/40 shadow-sm text-[#131b2e] hover:bg-[#e2e7ff] transition-all text-xs font-medium cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#006c49]"></span>
                22436 Vande Bharat
              </button>
              <button
                type="button"
                onClick={() => handleChipClick('12367 Vikramshila')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#ffffff] border border-[#c5c5d3]/40 shadow-sm text-[#131b2e] hover:bg-[#e2e7ff] transition-all text-xs font-medium cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]"></span>
                12367 Vikramshila
              </button>
            </div>

            {/* Minimal High-Trust Telemetry Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-14 pt-6 w-full max-w-3xl border-t border-[#c5c5d3]/20">
              <div className="flex flex-col items-center text-center p-2">
                <span className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl text-[#131b2e] font-bold tracking-tight">
                  99.4%
                </span>
                <span className="text-xs text-[#444651] mt-1 font-medium">
                  Signal Congestion Accuracy
                </span>
              </div>
              <div className="flex flex-col items-center text-center p-2">
                <span className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl text-[#131b2e] font-bold tracking-tight">
                  14,200+
                </span>
                <span className="text-xs text-[#444651] mt-1 font-medium">
                  Active Corridors Synced
                </span>
              </div>
              <div className="flex flex-col items-center text-center p-2">
                <span className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl text-[#131b2e] font-bold tracking-tight">
                  &lt; 280ms
                </span>
                <span className="text-xs text-[#444651] mt-1 font-medium">
                  Sub-second GPS/OHE Telemetry
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
