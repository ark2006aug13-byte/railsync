import React, { useState, useRef, useEffect } from 'react';
import { User, Train, LogOut, ShieldCheck, ChevronDown, Menu, X } from 'lucide-react';
import { PageId } from '../types';

interface HeaderProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  userEmail?: string;
  onSignOut?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPage,
  onNavigate,
  userEmail,
  onSignOut,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#ffffff]/95 backdrop-blur-xl border-b border-[#c5c5d3]/40 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <div className="h-16 w-full px-4 sm:px-8 flex items-center justify-between gap-4 sm:gap-6">
        {/* Logo & Brand */}
        <div 
          className="flex items-center gap-3 cursor-pointer select-none"
          onClick={() => onNavigate('search')}
          title="Go to Network Overview"
        >
          {!logoFailed ? (
            <img
              alt="RailSync Logo"
              className="h-8 w-auto object-contain"
              src="https://lh3.googleusercontent.com/aida/AEtjO1XmmDFX5aZk67_N3wkNzJfLPrmY_WTQAs1faj0sYyNlcvaWWkk97qZD7KHXCosWuhvaxWxq6mT76UKtktIHG3XxaU5p3mYCnA0YkBZavUk0Dm781ndBGVEiTBeBdKcfZjNS_Z5SwsQdDTxKNlauyw3MsZ_1IkYDY2XkTb0VZGhxJyq8bV2Y1mQjllx9_ktoXRgxZRf7Tp1bA1iKTYHkgH7aWov2bCjkNUBmSILUebTfU51-NYA7yvU8rxc"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-[#1E3A8A] flex items-center justify-center shadow-sm shrink-0">
              <Train className="w-5 h-5 text-white" />
            </div>
          )}
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
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              currentPage === 'diagnostics'
                ? 'bg-[#1e3a8a] text-[#ffffff] shadow-sm'
                : 'text-[#444651] hover:text-[#131b2e] hover:bg-[#eaedff]/60'
            }`}
          >
            Corridor Analytics
          </button>
        </nav>

        {/* Right Action & User Profile */}
        <div className="flex items-center gap-2 sm:gap-3 relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => onNavigate('platform-resolver')}
            className={`hidden sm:inline-flex text-xs px-3.5 py-1.5 rounded-lg font-medium border transition-all cursor-pointer ${
              currentPage === 'platform-resolver'
                ? 'bg-[#1e3a8a] text-[#ffffff] border-[#1e3a8a] shadow-sm'
                : 'bg-[#f2f3ff] text-[#131b2e] hover:bg-[#eaedff] border-[#c5c5d3]/40'
            }`}
          >
            Station Ops Console
          </button>

          {/* User Profile Avatar Pill */}
          <div
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-full border border-[#e2e8f0] bg-white hover:bg-slate-50 shadow-sm cursor-pointer select-none transition-all active:scale-[0.98]"
            title="Dispatch Operator Account"
          >
            <div className="w-7 h-7 rounded-full bg-[#1E3A8A] flex items-center justify-center text-white shadow-sm font-semibold text-xs">
              {userEmail ? userEmail.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5 text-white" />}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
          </div>

          {/* Mobile Hamburger Navigation Button */}
          <button
            type="button"
            onClick={() => setShowMobileNav(!showMobileNav)}
            className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
            title="Toggle Navigation Menu"
          >
            {showMobileNav ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* User Menu Dropdown */}
          {showUserMenu && (
            <div className="absolute right-0 top-12 w-64 bg-white rounded-xl shadow-xl border border-[#E2E8F0] p-3 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="flex items-center gap-3 pb-3 border-b border-[#F1F5F9]">
                <div className="w-9 h-9 rounded-full bg-[#1E3A8A] flex items-center justify-center text-white font-bold text-sm shadow-sm">
                  {userEmail ? userEmail.charAt(0).toUpperCase() : 'O'}
                </div>
                <div className="overflow-hidden flex-1">
                  <p className="text-xs font-semibold text-[#0F172A] truncate">
                    {userEmail || 'operator@railsync.org'}
                  </p>
                  <p className="text-[11px] text-[#10B981] font-medium flex items-center gap-1 mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>Authorized Dispatcher</span>
                  </p>
                </div>
              </div>

              <div className="py-2 text-[11px] text-[#64748B] space-y-1">
                <div className="flex justify-between items-center py-1">
                  <span>Zone Jurisdiction:</span>
                  <span className="font-semibold text-[#0F172A]">Northern Railway (NR)</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span>Telemetry State:</span>
                  <span className="font-semibold text-[#10B981] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span>
                    Live Sync 280ms
                  </span>
                </div>
              </div>

              {onSignOut && (
                <div className="pt-2 border-t border-[#F1F5F9]">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      onSignOut();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out from RailSync</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Navigation Dropdown Bar */}
      {showMobileNav && (
        <div className="lg:hidden border-t border-slate-200/80 bg-white/98 backdrop-blur-md px-4 py-3 space-y-2 shadow-lg animate-in slide-in-from-top-2 duration-150">
          <button
            type="button"
            onClick={() => {
              onNavigate('search');
              setShowMobileNav(false);
            }}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              currentPage === 'search'
                ? 'bg-[#1E3A8A] text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            🔍 Network Overview (Search Train)
          </button>
          <button
            type="button"
            onClick={() => {
              onNavigate('live-arrival');
              setShowMobileNav(false);
            }}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              currentPage === 'live-arrival'
                ? 'bg-[#1E3A8A] text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            🚆 Live Telemetry & Transit Map
          </button>
          <button
            type="button"
            onClick={() => {
              onNavigate('diagnostics');
              setShowMobileNav(false);
            }}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              currentPage === 'diagnostics'
                ? 'bg-[#1E3A8A] text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            📊 Corridor Analytics (Waterfall ETA)
          </button>
          <button
            type="button"
            onClick={() => {
              onNavigate('platform-resolver');
              setShowMobileNav(false);
            }}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              currentPage === 'platform-resolver'
                ? 'bg-[#1E3A8A] text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            🚉 Station Ops Console (Platform Resolver)
          </button>
        </div>
      )}
    </header>
  );
};
