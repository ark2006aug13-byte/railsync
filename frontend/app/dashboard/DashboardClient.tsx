'use client'

import { useState, useEffect } from 'react'
import { PageId } from '@/src/types'
import { Header } from '@/src/components/Header'
import { Footer } from '@/src/components/Footer'
import { Page1Search } from '@/src/components/Page1Search'
import { Page2LiveArrival } from '@/src/components/Page2LiveArrival'
import { Page3Diagnostics } from '@/src/components/Page3Diagnostics'
import { Page4PlatformResolver } from '@/src/components/Page4PlatformResolver'
import { signOut } from '@/app/auth/actions'

interface DashboardClientProps {
  userEmail?: string
}

export default function DashboardClient({ userEmail }: DashboardClientProps) {
  // Page 1 (search) is the default screen after login as requested
  const [currentPage, setCurrentPage] = useState<PageId>('search')
  const [currentTrain, setCurrentTrain] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  })
  const [isRerouted, setIsRerouted] = useState<boolean>(false)

  // Sync hash routing for browser navigation and deep linking
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '')
      if (hash === 'network-overview' || hash === 'search') {
        setCurrentPage('search')
      } else if (hash === 'live-telemetry' || hash === 'live-arrival') {
        setCurrentPage('live-arrival')
      } else if (hash === 'corridor-analytics' || hash === 'diagnostics') {
        setCurrentPage('diagnostics')
      } else if (hash === 'station-ops-console' || hash === 'platform-resolver') {
        setCurrentPage('platform-resolver')
      }
    }

    if (window.location.hash) {
      handleHashChange()
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const navigateTo = (page: PageId) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })

    let hash = ''
    if (page === 'search') hash = 'network-overview'
    else if (page === 'live-arrival') hash = 'live-telemetry'
    else if (page === 'diagnostics') hash = 'corridor-analytics'
    else if (page === 'platform-resolver') hash = 'station-ops-console'

    window.history.pushState(null, '', `#${hash}`)
  }

  const handleSelectTrain = (name: string, date?: string) => {
    setCurrentTrain(name)
    if (date) setSelectedDate(date)
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#faf8ff] text-[#131b2e] antialiased selection:bg-[#dce1ff] selection:text-[#00236f]">
      {/* Top Header with Navigation, Brand, and User Profile Menu */}
      <Header
        currentPage={currentPage}
        onNavigate={navigateTo}
        userEmail={userEmail}
        onSignOut={signOut}
      />

      {/* Main Screen Content */}
      <main className="flex-1 w-full pt-16">
        {currentPage === 'search' && (
          <Page1Search
            currentTrain={currentTrain}
            selectedDate={selectedDate}
            onSelectTrain={handleSelectTrain}
            onNavigateToPage2={() => navigateTo('live-arrival')}
          />
        )}

        {currentPage === 'live-arrival' && (
          <Page2LiveArrival
            trainName={currentTrain}
            runDate={selectedDate}
            isRerouted={isRerouted}
            onNavigateToPage1={() => navigateTo('search')}
            onNavigateToPage3={() => navigateTo('diagnostics')}
          />
        )}

        {currentPage === 'diagnostics' && (
          <Page3Diagnostics
            trainName={currentTrain}
            runDate={selectedDate}
            isRerouted={isRerouted}
            onNavigateToPage2={() => navigateTo('live-arrival')}
            onNavigateToPage4={() => navigateTo('platform-resolver')}
          />
        )}

        {currentPage === 'platform-resolver' && (
          <Page4PlatformResolver
            trainName={currentTrain}
            runDate={selectedDate}
            isRerouted={isRerouted}
            onConfirmReroute={() => setIsRerouted(true)}
            onNavigateToPage2={() => navigateTo('live-arrival')}
            onNavigateToPage3={() => navigateTo('diagnostics')}
          />
        )}
      </main>

      {/* Operational Footer with UTC time & Telemetry Latency */}
      <Footer />
    </div>
  )
}
