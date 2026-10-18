import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export default async function HomePage() {
  if (process.env.NODE_ENV === 'development') {
    redirect('/dashboard')
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      redirect('/dashboard')
    } else {
      redirect('/login')
    }
  } catch {
    redirect('/dashboard')
  }
}
