import React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import DashboardClient from './DashboardClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  return <DashboardClient userEmail={user.email || undefined} />
}
