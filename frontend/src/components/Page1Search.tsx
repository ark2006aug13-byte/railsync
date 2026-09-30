import React, { useState, useMemo } from 'react';
import { Search, ArrowRight, RefreshCw, AlertCircle, Calendar } from 'lucide-react';
import { api } from '../services/api';

interface Page1SearchProps {
  currentTrain: string;
  selectedDate?: string;
  onSelectTrain: (trainName: string, runDate?: string) => void;
  onNavigateToPage2: () => void;
}

export const Page1Search: React.FC<Page1SearchProps> = ({
  currentTrain,
  selectedDate: initialSelectedDate,
  onSelectTrain,
  onNavigateToPage2,
}) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Compute standard relative dates (YYYY-MM-DD)
  const { todayStr, yesterdayStr, tomorrowStr } = useMemo(() => {
    const format = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const now = new Date();
    const today = format(now);

    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const yesterday = format(y);

    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    const tomorrow = format(t);

    return { todayStr: today, yesterdayStr: yesterday, tomorrowStr: tomorrow };
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(initialSelectedDate || todayStr);

  const formatShortDay = (isoDate: string) => {
    try {
      const [year, month, day] = isoDate.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch {
      return isoDate;
    }
  };

  const formatDisplayDate = (isoDate: string) => {
    try {
      const [year, month, day] = isoDate.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoDate;
    }
  };

  const performSearch = async (targetQuery: string) => {
    const q = targetQuery.trim();
    if (!q) {
      setErrorMsg('Please enter a train number or name (e.g. 12301, 22436, 12004, Rajdhani) to analyze.');
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const result = await api.predictTrain(q, selectedDate);
      if (result && result.trainNo) {
        onSelectTrain(`${result.trainNo} / ${result.trainName}`, selectedDate);
        onNavigateToPage2();
      } else {
        onSelectTrain(q, selectedDate);
        onNavigateToPage2();
      }
    } catch (e: any) {
      console.warn('Search error:', e);
      setErrorMsg(e.message || 'Train not found. Please enter a valid train number or name.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
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
              <div className="absolute w-28 h-28 rounded-full bg-[#dce1ff]/40 animate-ping"></div>
              <div className="absolute w-20 h-20 rounded-full bg-[#6ffbbe]/40 animate-pulse"></div>
              <div className="relative z-10 w-16 h-16 rounded-2xl bg-[#00236f] flex items-center justify-center shadow-lg">
                <RefreshCw className="w-8 h-8 text-white animate-spin" />
              </div>
            </div>
            <h3 className="font-['Plus_Jakarta_Sans'] text-xl text-[#131b2e] font-semibold mb-2 text-center">
              Analyzing track clearance &amp; running telemetry for {formatShortDay(selectedDate)}...
            </h3>
            <p className="text-sm text-[#444651] text-center max-w-md">
              Interrogating automatic block signalling zones, dynamic delay matrices, and weather conditions.
            </p>
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
            <p className="text-base sm:text-lg text-[#444651] text-center max-w-2xl mb-7 leading-relaxed">
              Live neural arrival predictions accounting for journey date, signaling bottlenecks, and speed recovery.
            </p>

            {/* ========================================================================= */}
            {/* JOURNEY DATE SELECTION BAR (Located Directly Above Train Number Input)    */}
            {/* ========================================================================= */}
            <div className="w-full max-w-2xl mb-3 bg-white/95 backdrop-blur-md rounded-2xl p-3 sm:px-4 sm:py-3 shadow-md border border-[#c5c5d3]/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#1e3a8a]/10 flex items-center justify-center text-[#1e3a8a] shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#444651] block leading-tight">
                    Journey Date
                  </span>
                  <span className="text-xs font-black text-[#131b2e] leading-tight">
                    {formatDisplayDate(selectedDate)}
                  </span>
                </div>
              </div>

              {/* Date Switcher Chips + Date Picker */}
              <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap justify-start sm:justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedDate(yesterdayStr)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedDate === yesterdayStr
                      ? 'bg-[#1e3a8a] text-white shadow-xs'
                      : 'bg-[#faf8ff] text-[#444651] hover:bg-[#eaedff] border border-[#c5c5d3]/30'
                  }`}
                >
                  Yesterday ({formatShortDay(yesterdayStr)})
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedDate(todayStr)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedDate === todayStr
                      ? 'bg-[#1e3a8a] text-white shadow-xs'
                      : 'bg-[#faf8ff] text-[#444651] hover:bg-[#eaedff] border border-[#c5c5d3]/30'
                  }`}
                >
                  Today ({formatShortDay(todayStr)})
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedDate(tomorrowStr)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedDate === tomorrowStr
                      ? 'bg-[#1e3a8a] text-white shadow-xs'
                      : 'bg-[#faf8ff] text-[#444651] hover:bg-[#eaedff] border border-[#c5c5d3]/30'
                  }`}
                >
                  Tomorrow ({formatShortDay(tomorrowStr)})
                </button>

                {/* Custom Native Date Picker */}
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                  className="px-2 py-1 rounded-xl text-xs font-semibold bg-[#f2f3ff] text-[#131b2e] border border-[#c5c5d3]/50 focus:outline-none focus:ring-1 focus:ring-[#1e3a8a] cursor-pointer"
                  title="Choose custom date"
                />
              </div>
            </div>

            {/* ========================================================================= */}
            {/* FLOATING CENTRAL TRAIN NUMBER INPUT CARD                                  */}
            {/* ========================================================================= */}
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
                    placeholder="Enter Train Number or Name (e.g. 12301, 22436, 12004, Rajdhani)..."
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
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

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
