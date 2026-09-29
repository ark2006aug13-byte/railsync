'use client'

import React, { useState, useTransition, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Train,
  ShieldCheck,
  Radio,
  Zap,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  LockKeyhole,
  KeyRound,
  ExternalLink,
} from 'lucide-react'
import {
  login,
  signup,
  resetPassword,
  resendConfirmation,
  demoLogin,
  type AuthActionResult,
  type AuthRecoveryCode,
} from '@/app/auth/actions'

type AuthMode = 'signin' | 'signup' | 'recovery'

function LoginFormContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const redirectTarget = searchParams.get('redirect') || '/dashboard'
  const initialMode: AuthMode =
    searchParams.get('recovery') === 'true' || searchParams.get('mode') === 'recovery'
      ? 'recovery'
      : 'signin'

  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastActionCode, setLastActionCode] = useState<AuthRecoveryCode | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isResending, setIsResending] = useState(false)
  const [resendStatus, setResendStatus] = useState<{ error?: string; message?: string } | null>(null)

  // Real-time validation checks
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const cleanEmail = email.trim().toLowerCase()
  const isEmailValid = cleanEmail.length > 0 && emailRegex.test(cleanEmail)
  const isPasswordValid = password.length >= 6
  const doPasswordsMatch =
    mode !== 'signup' || (password === confirmPassword && confirmPassword.length > 0)

  const handleDemoAccess = () => {
    setErrorMessage(null)
    setSuccessMessage(null)
    startTransition(async () => {
      try {
        const res = await demoLogin()
        if (res?.error) {
          setErrorMessage(res.error)
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Demo sign in failed.'
        if (msg.includes('NEXT_REDIRECT')) {
          router.push(redirectTarget)
          return
        }
        setErrorMessage(msg)
      }
    })
  }

  const handleToggleMode = (newMode: AuthMode) => {
    setMode(newMode)
    setErrorMessage(null)
    setSuccessMessage(null)
    setResendStatus(null)
  }

  const handleDirectResendConfirmation = async () => {
    const targetEmail = email.trim().toLowerCase()
    if (!targetEmail || !emailRegex.test(targetEmail)) {
      setResendStatus({ error: 'Please enter a valid operator email address first.' })
      return
    }

    setIsResending(true)
    setResendStatus(null)

    try {
      const formData = new FormData()
      formData.append('email', targetEmail)
      const result = await resendConfirmation(formData)
      if (result.error) {
        setResendStatus({ error: result.error })
        if (result.code) setLastActionCode(result.code)
      } else if (result.success && result.message) {
        setResendStatus({ message: result.message })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resend confirmation email.'
      setResendStatus({ error: msg })
    } finally {
      setIsResending(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)
    setResendStatus(null)

    const targetEmail = email.trim().toLowerCase()

    if (!targetEmail || !emailRegex.test(targetEmail)) {
      setErrorMessage('Please enter a valid operator email address (e.g. controller@railsync.org).')
      return
    }

    // 1. Password Reset / Recovery Flow
    if (mode === 'recovery') {
      const formData = new FormData()
      formData.append('email', targetEmail)

      startTransition(async () => {
        try {
          const result = await resetPassword(formData)
          if (result.error) {
            setErrorMessage(result.error)
            setLastActionCode(result.code || null)
          } else if (result.success && result.message) {
            setSuccessMessage(result.message)
            setLastActionCode('reset_sent')
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'An unexpected error occurred while resetting password.'
          setErrorMessage(msg)
        }
      })
      return
    }

    // 2. Standard Credentials Flow (Sign In or Sign Up)
    if (password.length === 0) {
      setErrorMessage('Please enter your security passphrase.')
      return
    }

    if (mode === 'signup') {
      if (password.length < 6) {
        setErrorMessage('Security passphrase must be at least 6 characters long.')
        return
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passphrases do not match. Please re-enter.')
        return
      }
    }

    const formData = new FormData()
    formData.append('email', targetEmail)
    formData.append('password', password)
    formData.append('redirect', redirectTarget)

    startTransition(async () => {
      try {
        let result: AuthActionResult
        if (mode === 'signin') {
          result = await login(formData)
        } else {
          result = await signup(formData)
        }

        if (result?.error) {
          setErrorMessage(result.error)
          setLastActionCode(result.code || null)
        } else if (result?.success && result?.message) {
          setSuccessMessage(result.message)
          setLastActionCode(result.code || null)
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'An unexpected error occurred during authentication.'
        if (msg.includes('NEXT_REDIRECT')) {
          router.push(redirectTarget)
          return
        }
        setErrorMessage(msg)
      }
    })
  }

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-12 relative"
      style={{
        backgroundColor: '#F8FAFC',
        backgroundImage:
          'linear-gradient(to right, rgba(226, 232, 240, 0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(226, 232, 240, 0.6) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }}
    >
      {/* Soft Ambient Depth Background Glows */}
      <div
        className="pointer-events-none absolute top-10 left-1/2 -translate-x-1/2 w-[720px] h-[320px] rounded-full blur-3xl opacity-60"
        style={{ background: 'radial-gradient(ellipse at center, rgba(220, 225, 255, 0.45), transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute bottom-10 right-1/4 w-[480px] h-[240px] rounded-full blur-[100px] opacity-40"
        style={{ background: 'radial-gradient(ellipse at center, rgba(16, 185, 129, 0.15), transparent 70%)' }}
      />

      {/* Main Responsive Split-Screen 12-Column Grid */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center relative z-10">

        {/* ========================================================================= */}
        {/* A. LEFT COLUMN (7 COLS): BRAND & FLEET TELEMETRY SHOWCASE                */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 flex flex-col justify-center space-y-6">

          {/* Top Status & Brand Header */}
          <div className="space-y-4">
            
            {/* Live Operational Status Pill Badge */}
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.10)',
                color: '#047857',
                border: '1px solid rgba(16, 185, 129, 0.20)',
              }}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]"></span>
              </span>
              <span style={{ fontFamily: 'Inter, sans-serif' }}>
                CORE DISPATCH ONLINE • TRUNK: NDLS-HWH
              </span>
            </div>

            {/* Brand Header */}
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm"
                style={{ backgroundColor: '#1E3A8A' }}
              >
                <Train className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-2xl font-bold tracking-tight"
                    style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#0F172A' }}
                  >
                    RailSync
                  </span>
                  <span
                    className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-full font-bold"
                    style={{ backgroundColor: '#DCE1FF', color: '#00236F' }}
                  >
                    CORE 4.2
                  </span>
                </div>
                <p
                  className="text-xs font-medium"
                  style={{ fontFamily: 'Inter, sans-serif', color: '#64748B' }}
                >
                  Modern Rail Intelligence
                </p>
              </div>
            </div>
          </div>

          {/* Headline & Mission-Critical Copy */}
          <div className="space-y-3">
            <h1
              className="text-3xl sm:text-4xl lg:text-[40px] font-bold leading-tight tracking-tight"
              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#0F172A', letterSpacing: '-0.025em' }}
            >
              Mission-Critical Fleet Telemetry &amp; AI Dispatch Gateway
            </h1>
            <p
              className="text-sm sm:text-base leading-relaxed max-w-xl"
              style={{ fontFamily: 'Inter, sans-serif', color: '#475569' }}
            >
              Sub-second GPS telemetry, automated signal headway tracking, and neural delay mitigation across 7,300+ stations.
            </p>
          </div>

          {/* Feature Matrix: 3 Distinct White Containers */}
          <div className="space-y-3.5 pt-2">
            
            {/* Feature Card 1: Sub-Second RTIS Satellite Radar */}
            <div
              className="p-4 rounded-xl flex items-start gap-3.5 transition-all"
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                boxShadow: '0px 1px 3px rgba(15, 23, 42, 0.04)',
              }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ backgroundColor: 'rgba(16, 185, 129, 0.10)', color: '#047857' }}
              >
                <Radio className="w-5 h-5 text-[#047857]" />
              </div>
              <div className="space-y-0.5">
                <h4
                  className="text-sm font-bold"
                  style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#0F172A' }}
                >
                  Sub-Second RTIS Satellite Radar
                </h4>
                <p
                  className="text-xs leading-relaxed"
                  style={{ fontFamily: 'Inter, sans-serif', color: '#64748B' }}
                >
                  Live locomotive telemetry streaming directly from Kavach ATP transponders.
                </p>
              </div>
            </div>

            {/* Feature Card 2: Dynamic Time Deletion Engine */}
            <div
              className="p-4 rounded-xl flex items-start gap-3.5 transition-all"
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                boxShadow: '0px 1px 3px rgba(15, 23, 42, 0.04)',
              }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ backgroundColor: '#DCE1FF', color: '#1E3A8A' }}
              >
                <Zap className="w-5 h-5 text-[#1E3A8A]" />
              </div>
              <div className="space-y-0.5">
                <h4
                  className="text-sm font-bold"
                  style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#0F172A' }}
                >
                  Dynamic Time Deletion Engine
                </h4>
                <p
                  className="text-xs leading-relaxed"
                  style={{ fontFamily: 'Inter, sans-serif', color: '#64748B' }}
                >
                  Automated slack recovery modeling predicting high-speed corridor catchup.
                </p>
              </div>
            </div>

            {/* Feature Card 3: Cryptographic Security Envelope */}
            <div
              className="p-4 rounded-xl flex items-start gap-3.5 transition-all"
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                boxShadow: '0px 1px 3px rgba(15, 23, 42, 0.04)',
              }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ backgroundColor: '#F1F5F9', color: '#1E3A8A' }}
              >
                <ShieldCheck className="w-5 h-5 text-[#1E3A8A]" />
              </div>
              <div className="space-y-0.5">
                <h4
                  className="text-sm font-bold"
                  style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#0F172A' }}
                >
                  Cryptographic Security Envelope
                </h4>
                <p
                  className="text-xs leading-relaxed"
                  style={{ fontFamily: 'Inter, sans-serif', color: '#64748B' }}
                >
                  Supabase SSR authenticated sessions with HttpOnly edge token verification.
                </p>
              </div>
            </div>

          </div>

        </div>

        {/* ========================================================================= */}
        {/* B. RIGHT COLUMN (5 COLS): OPERATOR AUTHENTICATION COCKPIT CARD            */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 flex justify-center">
          <div
            className="w-full max-w-md p-6 sm:p-8 rounded-2xl relative"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              boxShadow: '0px 1px 2px rgba(15, 23, 42, 0.04), 0px 4px 16px rgba(15, 23, 42, 0.03)',
            }}
          >

            {/* Tab Segment Toggle: Sign In vs Create Account vs Account Recovery */}
            <div
              className="flex p-1 mb-6 rounded-lg gap-1"
              style={{ backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0' }}
            >
              <button
                type="button"
                onClick={() => handleToggleMode('signin')}
                className="flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer text-center"
                style={{
                  backgroundColor: mode === 'signin' ? '#1E3A8A' : 'transparent',
                  color: mode === 'signin' ? '#FFFFFF' : '#64748B',
                  boxShadow: mode === 'signin' ? '0 1px 2px rgba(30, 58, 138, 0.20)' : 'none',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => handleToggleMode('signup')}
                className="flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer text-center"
                style={{
                  backgroundColor: mode === 'signup' ? '#1E3A8A' : 'transparent',
                  color: mode === 'signup' ? '#FFFFFF' : '#64748B',
                  boxShadow: mode === 'signup' ? '0 1px 2px rgba(30, 58, 138, 0.20)' : 'none',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Sign Up
              </button>
              <button
                type="button"
                onClick={() => handleToggleMode('recovery')}
                className="flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer text-center"
                style={{
                  backgroundColor: mode === 'recovery' ? '#1E3A8A' : 'transparent',
                  color: mode === 'recovery' ? '#FFFFFF' : '#64748B',
                  boxShadow: mode === 'recovery' ? '0 1px 2px rgba(30, 58, 138, 0.20)' : 'none',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Recovery
              </button>
            </div>

            {/* Header Content */}
            <div className="mb-6 space-y-1">
              <h2
                className="text-xl sm:text-[22px] font-bold tracking-tight"
                style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#0F172A' }}
              >
                {mode === 'signin' && 'Operator Sign In'}
                {mode === 'signup' && 'Register Operator Account'}
                {mode === 'recovery' && 'Account Recovery & Access'}
              </h2>
              <p
                className="text-xs leading-relaxed"
                style={{ fontFamily: 'Inter, sans-serif', color: '#64748B' }}
              >
                {mode === 'signin' &&
                  'Enter your operational credentials to access real-time dispatch telemetry.'}
                {mode === 'signup' &&
                  'Register your authorized zonal rail email to join the national transit control grid.'}
                {mode === 'recovery' &&
                  'Recover access to your account via password reset or email verification re-dispatch.'}
              </p>
            </div>

            {/* Feedback Alert Banners with Instant Recovery Actions */}
            {errorMessage && (
              <div
                className="mb-5 p-4 rounded-xl flex flex-col gap-3 text-xs leading-relaxed font-medium animate-in fade-in"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.24)',
                  color: '#991B1B',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
                  <span className="flex-1 font-medium">{errorMessage}</span>
                </div>

                {/* Instant Recovery Actions Bar inside Error Banner */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-red-200/60">
                  {/* Reset Passphrase Option */}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('recovery')
                      setErrorMessage(null)
                      setSuccessMessage(null)
                      setResendStatus(null)
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer bg-white text-[#1E3A8A] border border-[#CBD5E1] hover:bg-[#F1F5F9] shadow-xs"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-[#1E3A8A]" />
                    <span>Reset Passphrase</span>
                  </button>

                  {/* Direct Resend Verification Option */}
                  <button
                    type="button"
                    disabled={isResending || !isEmailValid}
                    onClick={handleDirectResendConfirmation}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer bg-white text-[#047857] border border-[#A7F3D0] hover:bg-[#ECFDF5] shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isResending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#047857]" />
                    ) : (
                      <Mail className="w-3.5 h-3.5 text-[#047857]" />
                    )}
                    <span>{isResending ? 'Resending...' : 'Resend Verification'}</span>
                  </button>

                  {/* Switch to Sign In (if on Sign Up tab) */}
                  {mode === 'signup' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signin')
                        setErrorMessage(null)
                        setSuccessMessage(null)
                        setResendStatus(null)
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer bg-[#1E3A8A] text-white hover:bg-[#172E6F] shadow-xs"
                    >
                      <span>Switch to Sign In</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}

                  {/* Switch to Sign Up (if credentials failed on Sign In) */}
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signup')
                        setErrorMessage(null)
                        setSuccessMessage(null)
                        setResendStatus(null)
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer bg-white text-[#475569] border border-[#CBD5E1] hover:bg-[#F1F5F9] shadow-xs"
                    >
                      <span>Create Account</span>
                    </button>
                  )}
                </div>

                {/* Inline Resend Confirmation Status */}
                {resendStatus?.message && (
                  <div className="p-2.5 rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-[11px] flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
                    <span>{resendStatus.message}</span>
                  </div>
                )}
                {resendStatus?.error && (
                  <div className="p-2.5 rounded-lg bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-[11px] flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-[#EF4444] shrink-0" />
                    <span>{resendStatus.error}</span>
                  </div>
                )}

                {/* Instant Supabase Dashboard Guidance Card */}
                {(lastActionCode === 'unconfirmed' ||
                  lastActionCode === 'rate_limit' ||
                  errorMessage.toLowerCase().includes('rate limit') ||
                  errorMessage.toLowerCase().includes('confirm email') ||
                  errorMessage.toLowerCase().includes('unconfirmed') ||
                  errorMessage.toLowerCase().includes('not confirmed')) && (
                  <div
                    className="p-3 rounded-lg text-[11px] leading-relaxed mt-0.5"
                    style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}
                  >
                    <span className="font-bold text-[#1E3A8A] block mb-1">
                      💡 Account created but pending confirmation? Fix it in 10 seconds:
                    </span>
                    <div className="space-y-1 text-[#334155]">
                      <div>
                        1. Open{' '}
                        <a
                          href="https://supabase.com/dashboard/project/zxgfwcxabijmfmwbohpw/auth/providers"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#1E3A8A] underline font-bold inline-flex items-center gap-1"
                        >
                          Supabase Auth Providers Settings <ExternalLink className="w-2.5 h-2.5 inline" />
                        </a>
                      </div>
                      <div>2. Click on the <strong>Email</strong> provider row.</div>
                      <div>3. Toggle <strong>OFF &quot;Confirm email&quot;</strong> and click <strong>Save</strong>.</div>
                    </div>
                    <span className="text-[#047857] font-semibold block mt-1.5">
                      ✓ This activates all accounts immediately without email verification and bypasses all email limits!
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Success Message Banner */}
            {successMessage && (
              <div
                className="mb-5 p-3.5 rounded-xl flex items-start gap-2.5 text-xs leading-relaxed font-medium animate-in fade-in"
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.10)',
                  border: '1px solid rgba(16, 185, 129, 0.20)',
                  color: '#047857',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <span>{successMessage}</span>
                  {mode === 'recovery' && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => handleToggleMode('signin')}
                        className="text-[11px] font-bold text-[#1E3A8A] underline cursor-pointer"
                      >
                        Return to Sign In
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Authentication / Recovery Form */}
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Email Address Field */}
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="block text-[11px] font-semibold uppercase tracking-wider"
                  style={{ fontFamily: 'Inter, sans-serif', color: '#64748B', letterSpacing: '0.04em' }}
                >
                  Operator Email Address
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 pointer-events-none text-[#64748B]">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (errorMessage) setErrorMessage(null)
                    }}
                    onBlur={(e) => {
                      setEmail((prev) => prev.trim())
                      e.target.style.borderColor = '#E2E8F0'
                      e.target.style.boxShadow = 'none'
                    }}
                    placeholder="controller@railsync.org"
                    className="w-full text-xs font-normal focus:outline-none transition-all"
                    style={{
                      height: '42px',
                      paddingLeft: '38px',
                      paddingRight: '38px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      color: '#0F172A',
                      fontFamily: 'Inter, sans-serif',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#1E3A8A'
                      e.target.style.boxShadow = '0 0 0 3px rgba(30, 58, 138, 0.12)'
                    }}
                  />
                  {email.length > 0 && isEmailValid && (
                    <div className="absolute right-3 pointer-events-none text-[#10B981]">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </div>

              {/* Password Field (Shown in Sign In and Sign Up modes) */}
              {mode !== 'recovery' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="block text-[11px] font-semibold uppercase tracking-wider"
                      style={{ fontFamily: 'Inter, sans-serif', color: '#64748B', letterSpacing: '0.04em' }}
                    >
                      Security Passphrase
                    </label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => handleToggleMode('recovery')}
                        className="text-[11px] font-medium text-[#1E3A8A] hover:underline cursor-pointer"
                        style={{ fontFamily: 'Inter, sans-serif' }}
                      >
                        Forgot passphrase?
                      </button>
                    )}
                    {mode === 'signup' && (
                      <span
                        className="text-[11px]"
                        style={{ fontFamily: 'Inter, sans-serif', color: '#94A3B8' }}
                      >
                        Min. 6 chars
                      </span>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 pointer-events-none text-[#64748B]">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full text-xs font-normal focus:outline-none transition-all"
                      style={{
                        height: '42px',
                        paddingLeft: '38px',
                        paddingRight: '38px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                        color: '#0F172A',
                        fontFamily: 'Inter, sans-serif',
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#1E3A8A'
                        e.target.style.boxShadow = '0 0 0 3px rgba(30, 58, 138, 0.12)'
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#E2E8F0'
                        e.target.style.boxShadow = 'none'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer"
                      aria-label={showPassword ? 'Hide passphrase' : 'Show passphrase'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password strength requirement (Sign Up mode) */}
                  {mode === 'signup' && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: isPasswordValid ? '#10B981' : '#CBD5E1' }}
                      />
                      <span
                        className="text-[11px]"
                        style={{
                          fontFamily: 'Inter, sans-serif',
                          color: isPasswordValid ? '#047857' : '#64748B',
                        }}
                      >
                        At least 6 characters required
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Confirm Password Field (Sign Up mode only) */}
              {mode === 'signup' && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="confirmPassword"
                    className="block text-[11px] font-semibold uppercase tracking-wider"
                    style={{ fontFamily: 'Inter, sans-serif', color: '#64748B', letterSpacing: '0.04em' }}
                  >
                    Confirm Security Passphrase
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 pointer-events-none text-[#64748B]">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full text-xs font-normal focus:outline-none transition-all"
                      style={{
                        height: '42px',
                        paddingLeft: '38px',
                        paddingRight: '38px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                        color: '#0F172A',
                        fontFamily: 'Inter, sans-serif',
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#1E3A8A'
                        e.target.style.boxShadow = '0 0 0 3px rgba(30, 58, 138, 0.12)'
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#E2E8F0'
                        e.target.style.boxShadow = 'none'
                      }}
                    />
                    {confirmPassword.length > 0 && (
                      <div className="absolute right-3 pointer-events-none">
                        {doPasswordsMatch ? (
                          <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-[#EF4444]" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Hidden redirect target */}
              <input type="hidden" name="redirect" value={redirectTarget} />

              {/* Primary Actions based on Mode */}
              {mode !== 'recovery' ? (
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full flex items-center justify-center gap-2 font-medium text-sm transition-all cursor-pointer"
                    style={{
                      height: '44px',
                      borderRadius: '8px',
                      backgroundColor: isPending ? '#CBD5E1' : '#1E3A8A',
                      color: '#FFFFFF',
                      fontFamily: 'Inter, sans-serif',
                      boxShadow: '0 1px 2px rgba(30, 58, 138, 0.12)',
                      cursor: isPending ? 'not-allowed' : 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      if (!isPending) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#172E6F'
                    }}
                    onMouseLeave={(e) => {
                      if (!isPending) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1E3A8A'
                    }}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Authorizing Operator...</span>
                      </>
                    ) : (
                      <>
                        <span>
                          {mode === 'signin' ? 'Authenticate & Enter Cockpit' : 'Register Operator Credential'}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {/* Instant Operator Demo Access Divider & Button */}
                  <div className="pt-2">
                    <div className="relative my-3 flex items-center justify-center">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-[#E2E8F0]"></div>
                      </div>
                      <span className="relative bg-white px-2.5 text-[10px] uppercase font-bold tracking-wider text-[#94A3B8]">
                        Or Instant Testing
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={isPending}
                      onClick={handleDemoAccess}
                      className="w-full flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D] hover:bg-[#DCFCE7] shadow-xs active:scale-[0.99] py-2.5"
                    >
                      <Zap className="w-3.5 h-3.5 text-[#16A34A]" />
                      <span>⚡ 1-Click Instant Demo Access (Bypass Login)</span>
                    </button>
                    <p className="text-center text-[10px] text-[#64748B] mt-1.5">
                      Verified operator account: <code className="bg-[#F1F5F9] px-1 py-0.5 rounded font-mono text-[#1E3A8A]">railsync_admin@railsync.io</code>
                    </p>
                  </div>
                </div>
              ) : (
                /* Recovery Mode Multi-Action CTAs */
                <div className="space-y-2.5 pt-2">
                  <button
                    type="submit"
                    disabled={isPending || isResending}
                    className="w-full flex items-center justify-center gap-2 font-medium text-xs sm:text-sm transition-all cursor-pointer"
                    style={{
                      height: '44px',
                      borderRadius: '8px',
                      backgroundColor: isPending ? '#CBD5E1' : '#1E3A8A',
                      color: '#FFFFFF',
                      fontFamily: 'Inter, sans-serif',
                      boxShadow: '0 1px 2px rgba(30, 58, 138, 0.12)',
                      cursor: isPending ? 'not-allowed' : 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      if (!isPending) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#172E6F'
                    }}
                    onMouseLeave={(e) => {
                      if (!isPending) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1E3A8A'
                    }}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Dispatching Recovery Link...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        <span>Send Passphrase Reset Link</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isPending || isResending || !isEmailValid}
                    onClick={handleDirectResendConfirmation}
                    className="w-full flex items-center justify-center gap-2 font-medium text-xs sm:text-sm transition-all cursor-pointer"
                    style={{
                      height: '42px',
                      borderRadius: '8px',
                      backgroundColor: '#FFFFFF',
                      color: '#047857',
                      border: '1px solid #A7F3D0',
                      fontFamily: 'Inter, sans-serif',
                      cursor: isResending || !isEmailValid ? 'not-allowed' : 'pointer',
                      opacity: !isEmailValid ? 0.6 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isResending && isEmailValid) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#ECFDF5'
                    }}
                    onMouseLeave={(e) => {
                      if (!isResending && isEmailValid) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#FFFFFF'
                    }}
                  >
                    {isResending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#047857]" />
                        <span>Resending Verification...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 text-[#047857]" />
                        <span>Resend Account Confirmation</span>
                      </>
                    )}
                  </button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleToggleMode('signin')}
                      className="inline-flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#0F172A] font-semibold cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Return to Operator Sign In</span>
                    </button>
                  </div>
                </div>
              )}

            </form>

            {/* Cryptographic Security Footer */}
            <div
              className="mt-6 pt-5 flex items-center justify-center gap-2 text-center"
              style={{ borderTop: '1px solid #E2E8F0' }}
            >
              <LockKeyhole className="w-3.5 h-3.5 text-[#10B981]" />
              <span
                className="text-[11px]"
                style={{ fontFamily: 'Inter, sans-serif', color: '#64748B' }}
              >
                Supabase SSR Interlocked • 256-Bit Encrypted Session State
              </span>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen w-full flex items-center justify-center"
          style={{ backgroundColor: '#F8FAFC' }}
        >
          <div className="flex items-center gap-3 text-[#1E3A8A]">
            <Loader2 className="w-6 h-6 animate-spin text-[#1E3A8A]" />
            <span
              className="text-sm font-semibold tracking-wide"
              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              INITIALIZING RAILSYNC GATEWAY...
            </span>
          </div>
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  )
}
