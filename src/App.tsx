import { useState, useEffect } from 'react';
import { PageId } from './types';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Page1Search } from './components/Page1Search';
import { Page2LiveArrival } from './components/Page2LiveArrival';
import { Page3Diagnostics } from './components/Page3Diagnostics';
import { Page4PlatformResolver } from './components/Page4PlatformResolver';

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageId>('search');
  const [currentTrain, setCurrentTrain] = useState<string>('12301 / Howrah – New Delhi Rajdhani Express');
  const [isRerouted, setIsRerouted] = useState<boolean>(false);

  // Sync hash routing for browser back/forward and deep linking
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'network-overview' || hash === 'search') {
        setCurrentPage('search');
      } else if (hash === 'live-telemetry' || hash === 'live-arrival') {
        setCurrentPage('live-arrival');
      } else if (hash === 'corridor-analytics' || hash === 'diagnostics') {
        setCurrentPage('diagnostics');
      } else if (hash === 'station-ops-console' || hash === 'platform-resolver') {
        setCurrentPage('platform-resolver');
      }
    };

    if (window.location.hash) {
      handleHashChange();
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (page: PageId) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    let hash = '';
    if (page === 'search') hash = 'network-overview';
    else if (page === 'live-arrival') hash = 'live-telemetry';
    else if (page === 'diagnostics') hash = 'corridor-analytics';
    else if (page === 'platform-resolver') hash = 'station-ops-console';

    window.history.pushState(null, '', `#${hash}`);
  };

  const handleSelectTrain = (name: string) => {
    if (name.includes('Rajdhani')) {
      setCurrentTrain('12301 / Howrah – New Delhi Rajdhani Express');
    } else if (name.includes('Shatabdi')) {
      setCurrentTrain('12004 / New Delhi – Lucknow Swarna Shatabdi Express');
    } else if (name.includes('Vande Bharat')) {
      setCurrentTrain('22436 / New Delhi – Varanasi Vande Bharat Express');
    } else {
      setCurrentTrain(name);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#faf8ff] text-[#131b2e] antialiased selection:bg-[#dce1ff] selection:text-[#00236f]">
      {/* Header with Navigation */}
      <Header currentPage={currentPage} onNavigate={navigateTo} />

      {/* Main Content Area */}
      <main className="flex-1 w-full pt-16">
        {currentPage === 'search' && (
          <Page1Search
            currentTrain={currentTrain}
            onSelectTrain={handleSelectTrain}
            onNavigateToPage2={() => navigateTo('live-arrival')}
          />
        )}

        {currentPage === 'live-arrival' && (
          <Page2LiveArrival
            trainName={currentTrain}
            isRerouted={isRerouted}
            onNavigateToPage1={() => navigateTo('search')}
            onNavigateToPage3={() => navigateTo('diagnostics')}
          />
        )}

        {currentPage === 'diagnostics' && (
          <Page3Diagnostics
            trainName={currentTrain}
            isRerouted={isRerouted}
            onNavigateToPage2={() => navigateTo('live-arrival')}
            onNavigateToPage4={() => navigateTo('platform-resolver')}
          />
        )}

        {currentPage === 'platform-resolver' && (
          <Page4PlatformResolver
            trainName={currentTrain}
            isRerouted={isRerouted}
            onConfirmReroute={() => setIsRerouted(true)}
            onNavigateToPage2={() => navigateTo('live-arrival')}
            onNavigateToPage3={() => navigateTo('diagnostics')}
          />
        )}
      </main>

      {/* Footer with Telemetry Status & Live UTC Clock */}
      <Footer />
    </div>
  );
}
