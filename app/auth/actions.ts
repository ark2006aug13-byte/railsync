'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

export type AuthRecoveryCode =
  | 'unconfirmed'
  | 'invalid_credentials'
  | 'already_registered'
  | 'rate_limit'
  | 'reset_sent'

export interface AuthActionResult {
  error?: string
  success?: boolean
  message?: string
  code?: AuthRecoveryCode
  email?: string
}

function cleanEmailString(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.trim().toLowerCase()
}

function isValidEmail(email: string): boolean {
  const cleaned = cleanEmailString(email)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(cleaned)
}

export async function demoLogin(): Promise<AuthActionResult> {
  const supabase = await createClient()
  let redirectDestination: string | null = null

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'railsync_admin@railsync.io',
      password: 'AdminPassword2026!',
    })

    if (error || !data.session) {
      return { error: 'Demo sign-in temporary error: ' + (error?.message || 'No session created') }
    }

    redirectDestination = '/dashboard'
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred during demo login.'
    return { error: message }
  }

  if (redirectDestination) {
    revalidatePath('/', 'layout')
    redirect(redirectDestination)
  }

  return {}
}

export async function login(formData: FormData): Promise<AuthActionResult> {
  const email = cleanEmailString(formData.get('email'))
  const password = (formData.get('password') as string) || ''
  const redirectTo = (formData.get('redirect') as string) || '/dashboard'

  if (!email || !isValidEmail(email)) {
    return { error: 'Please enter a valid email address (e.g. controller@railsync.org).' }
  }

  if (!password || password.length === 0) {
    return { error: 'Please enter your password.' }
  }

  const supabase = await createClient()

  let redirectDestination: string | null = null

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      const errMsg = error.message.toLowerCase()
      const errCode = (error as { code?: string })?.code || ''

      // 1. Direct unconfirmed email status
      if (errMsg.includes('email not confirmed') || errCode === 'email_not_confirmed') {
        return {
          error: 'Your account was created, but email confirmation is pending in Supabase. Please check your email for the confirmation link, or toggle OFF "Confirm email" in your Supabase Dashboard (Authentication > Providers > Email) to sign in immediately.',
          code: 'unconfirmed',
          email,
        }
      }

      // 2. Email rate limit
      if (errMsg.includes('rate limit') || errCode === 'over_email_send_rate_limit') {
        return {
          error: 'Supabase email rate limit exceeded (3 emails/hr). Please turn OFF "Confirm email" in your Supabase Dashboard under Authentication > Providers > Email to bypass all email limits.',
          code: 'rate_limit',
          email,
        }
      }

      // 3. Invalid login credentials
      // In Supabase, this can happen if the passphrase is wrong, if the user doesn't exist,
      // or if email confirmation is required and the account is unconfirmed.
      if (errMsg.includes('invalid login credentials') || errCode === 'invalid_credentials') {
        return {
          error: 'Invalid login credentials. If you recently registered, your account might still be awaiting email confirmation in Supabase. Otherwise, please check your security passphrase or reset your password.',
          code: 'invalid_credentials',
          email,
        }
      }

      return { error: error.message, email }
    }

    redirectDestination = redirectTo.startsWith('/') ? redirectTo : '/dashboard'
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred during login.'
    return { error: message, email }
  }

  if (redirectDestination) {
    revalidatePath('/', 'layout')
    redirect(redirectDestination)
  }

  return {}
}

export async function signup(formData: FormData): Promise<AuthActionResult> {
  const email = cleanEmailString(formData.get('email'))
  const password = (formData.get('password') as string) || ''

  if (!email || !isValidEmail(email)) {
    return { error: 'Please enter a valid email address (e.g. controller@railsync.org).' }
  }

  if (!password || password.length < 6) {
    return { error: 'Password must be at least 6 characters long.' }
  }

  const supabase = await createClient()

  let redirectDestination: string | null = null

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      const errMsg = error.message.toLowerCase()
      const errCode = (error as { code?: string })?.code || ''

      // 1. If user already registered, immediately attempt sign-in
      if (errMsg.includes('user already registered') || errCode === 'user_already_exists') {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        // If the password matches and email is confirmed, log them in automatically and redirect to /dashboard!
        if (!signInError && signInData?.session) {
          redirectDestination = '/dashboard'
        } else if (signInError?.message.toLowerCase().includes('email not confirmed')) {
          return {
            error: 'An account with this email already exists, but its email is not confirmed yet. To activate it immediately: go to your Supabase Dashboard (Authentication > Providers > Email) and turn OFF "Confirm email", or click Resend Verification below.',
            code: 'unconfirmed',
            email,
          }
        } else if (signInError?.message.toLowerCase().includes('invalid login credentials')) {
          return {
            error: 'An account with this email already exists. If this is your account, please enter the password you created it with on the Sign In tab, or reset your password.',
            code: 'invalid_credentials',
            email,
          }
        } else {
          return {
            error: signInError?.message || 'An account with this email already exists. Please switch to "Sign In" with your password, or reset your password.',
            code: 'already_registered',
            email,
          }
        }
      }

      // 2. If rate limit exceeded
      if (errMsg.includes('rate limit') || errCode === 'over_email_send_rate_limit') {
        // Check if the user was already created and can simply log in
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (!signInError && signInData?.session) {
          redirectDestination = '/dashboard'
        } else if (signInError?.message.toLowerCase().includes('email not confirmed')) {
          return {
            error: 'Supabase email rate limit exceeded (3 emails/hr). Your account exists, but confirmation email could not be sent. To fix: in your Supabase Dashboard, go to Authentication > Providers > Email and turn OFF "Confirm email". You can then log in instantly.',
            code: 'unconfirmed',
            email,
          }
        } else if (signInError?.message.toLowerCase().includes('invalid login credentials')) {
          return {
            error: 'An account with this email already exists. If this is your account, please enter the password you created it with on the Sign In tab, or reset your password.',
            code: 'invalid_credentials',
            email,
          }
        } else {
          return {
            error: 'Supabase free email rate limit exceeded (maximum 3-4 emails/hour). To fix this immediately: open your Supabase Dashboard (project zxgfwcxabijmfmwbohpw), go to Authentication > Providers > Email, and turn OFF "Confirm email". This enables instant signup without sending emails.',
            code: 'rate_limit',
            email,
          }
        }
      }

      return { error: error.message, email }
    }

    // 3. Supabase email enumeration defense: when user already exists, signUp can succeed with empty identities array
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (!signInError && signInData?.session) {
        redirectDestination = '/dashboard'
      } else if (signInError?.message.toLowerCase().includes('email not confirmed')) {
        return {
          error: 'An account with this email already exists, but its email is not confirmed yet. To activate it immediately: go to your Supabase Dashboard (Authentication > Providers > Email) and turn OFF "Confirm email", or click Resend Verification below.',
          code: 'unconfirmed',
          email,
        }
      } else if (signInError?.message.toLowerCase().includes('invalid login credentials')) {
        return {
          error: 'An account with this email already exists. If this is your account, please enter the password you created it with on the Sign In tab, or reset your password.',
          code: 'invalid_credentials',
          email,
        }
      } else {
        return {
          error: 'An account with this email already exists. Please switch to "Sign In" with your password, or reset your password.',
          code: 'already_registered',
          email,
        }
      }
    }

    // If email confirmation is required, Supabase returns a user but no session
    if (data.user && !data.session) {
      return {
        success: true,
        message: 'Account created! Please check your email to confirm your account, or turn OFF "Confirm email" in Supabase settings to log in immediately.',
        code: 'unconfirmed',
        email,
      }
    }

    if (data.session) {
      redirectDestination = '/dashboard'
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred during signup.'
    return { error: message, email }
  }

  if (redirectDestination) {
    revalidatePath('/', 'layout')
    redirect(redirectDestination)
  }

  return {
    success: true,
    message: 'Account created successfully! You are now logged in.',
  }
}

export async function resetPassword(formData: FormData): Promise<AuthActionResult> {
  const email = cleanEmailString(formData.get('email'))

  if (!email || !isValidEmail(email)) {
    return { error: 'Please enter a valid operator email address.' }
  }

  const supabase = await createClient()

  try {
    const headerList = await headers()
    const host = headerList.get('host') || 'localhost:3000'
    const protocol = headerList.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
    const redirectTo = `${protocol}://${host}/login?recovery=true`

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })

    if (error) {
      const errMsg = error.message.toLowerCase()
      if (errMsg.includes('rate limit') || (error as { code?: string })?.code === 'over_email_send_rate_limit') {
        return {
          error: 'Supabase email rate limit exceeded (3 emails/hr). Please turn OFF "Confirm email" in your Supabase Dashboard or wait before requesting another recovery email.',
          code: 'rate_limit',
          email,
        }
      }
      return { error: error.message, email }
    }

    return {
      success: true,
      message: `Password recovery link dispatched to ${email}! Please check your inbox (and spam folder) to set a new password.`,
      code: 'reset_sent',
      email,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred while requesting password reset.'
    return { error: message, email }
  }
}

export async function resendConfirmation(formData: FormData): Promise<AuthActionResult> {
  const email = cleanEmailString(formData.get('email'))

  if (!email || !isValidEmail(email)) {
    return { error: 'Please enter a valid operator email address.' }
  }

  const supabase = await createClient()

  try {
    const headerList = await headers()
    const host = headerList.get('host') || 'localhost:3000'
    const protocol = headerList.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
    const emailRedirectTo = `${protocol}://${host}/dashboard`

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo,
      },
    })

    if (error) {
      const errMsg = error.message.toLowerCase()
      if (errMsg.includes('rate limit') || (error as { code?: string })?.code === 'over_email_send_rate_limit') {
        return {
          error: 'Supabase email rate limit exceeded (3 emails/hr). To bypass email confirmation completely: in your Supabase Dashboard (project zxgfwcxabijmfmwbohpw), go to Authentication > Providers > Email and turn OFF "Confirm email". You can then log in instantly without waiting for an email.',
          code: 'rate_limit',
          email,
        }
      }
      if (errMsg.includes('already confirmed')) {
        return {
          error: 'This email is already confirmed! Please enter your security passphrase on the Sign In tab.',
          code: 'invalid_credentials',
          email,
        }
      }
      return { error: error.message, email }
    }

    return {
      success: true,
      message: `Account verification email dispatched to ${email}! Please check your inbox and click the link to confirm your account.`,
      email,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred while resending confirmation email.'
    return { error: message, email }
  }
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
