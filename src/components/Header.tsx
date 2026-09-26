import React from 'react';
import { PageId } from '../types';

interface HeaderProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentPage, onNavigate }) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#ffffff]/90 backdrop-blur-xl border-b border-[#c5c5d3]/40">
      <div className="h-16 w-full px-4 sm:px-8 flex items-center justify-between gap-6">
        {/* Logo & Brand */}
        <div 
          className="flex items-center gap-3 cursor-pointer select-none"
          onClick={() => onNavigate('search')}
          title="Go to Search"
        >
          <img
            alt="RailSync Logo"
            className="h-8 w-auto object-contain"
            src="https://lh3.googleusercontent.com/aida/AEtjO1XmmDFX5aZk67_N3wkNzJfLPrmY_WTQAs1faj0sYyNlcvaWWkk97qZD7KHXCosWuhvaxWxq6mT76UKtktIHG3XxaU5p3mYCnA0YkBZavUk0Dm781ndBGVEiTBeBdKcfZjNS_Z5SwsQdDTxKNlauyw3MsZ_1IkYDY2XkTb0VZGhxJyq8bV2Y1mQjllx9_ktoXRgxZRf7Tp1bA1iKTYHkgH7aWov2bCjkNUBmSILUebTfU51-NYA7yvU8rxc"
          />
          <span className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#131b2e] tracking-tight">
            RailSync
          </span>
          <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#6ffbbe]/30 border border-[#006c49]/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#006c49] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#006c49]"></span>
            </span>
            <span className="text-[11px] text-[#006c49] font-semibold tracking-normal">
              Neural ETA Engine Active
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden lg:flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('search')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              currentPage === 'search'
                ? 'bg-[#1e3a8a] text-[#ffffff] shadow-sm'
                : 'text-[#444651] hover:text-[#131b2e] hover:bg-[#eaedff]/60'
            }`}
          >
            Network Overview
          </button>
          <button
            type="button"
            onClick={() => onNavigate('live-arrival')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              currentPage === 'live-arrival'
                ? 'bg-[#1e3a8a] text-[#ffffff] shadow-sm'
                : 'text-[#444651] hover:text-[#131b2e] hover:bg-[#eaedff]/60'
            }`}
          >
            Live Telemetry
          </button>
          <button
            type="button"
            onClick={() => onNavigate('diagnostics')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              currentPage === 'diagnostics'
                ? 'bg-[#1e3a8a] text-[#ffffff] shadow-sm'
                : 'text-[#444651] hover:text-[#131b2e] hover:bg-[#eaedff]/60'
            }`}
          >
            Corridor Analytics
          </button>
        </nav>

        {/* Right Action & User Profile */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('platform-resolver')}
            className={`text-xs px-3.5 py-1.5 rounded-lg font-medium border transition-all ${
              currentPage === 'platform-resolver'
                ? 'bg-[#1e3a8a] text-[#ffffff] border-[#1e3a8a] shadow-sm'
                : 'bg-[#f2f3ff] text-[#131b2e] hover:bg-[#eaedff] border-[#c5c5d3]/40'
            }`}
          >
            Station Ops Console
          </button>
          <div
            className="w-8 h-8 rounded-full bg-[#00236f] flex items-center justify-center text-white shadow-sm cursor-pointer select-none hover:opacity-90"
            title="Dispatch Operator"
          >
            <span className="material-symbols-outlined text-[18px]">person</span>
          </div>
        </div>
      </div>
    </header>
  );
};
