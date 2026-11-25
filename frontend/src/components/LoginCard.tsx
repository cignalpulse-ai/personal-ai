'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { ShieldCheck, CalendarClock, BrainCircuit, Loader2 } from 'lucide-react';

export default function LoginCard() {
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsRedirecting(true);
    try {
      await signIn('google', { callbackUrl: '/' });
    } catch (err) {
      console.error('Google sign-in failed:', err);
      setIsRedirecting(false);
    }
  };

  return (
    <div className="min-h-dvh w-full bg-[#131314] text-[#e3e3e3] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[280px] rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, #a8c7fa 0%, #004a77 55%, transparent 75%)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 right-1/4 w-[380px] h-[240px] rounded-full opacity-10 blur-3xl"
        style={{ background: 'radial-gradient(circle, #8ab4f8 0%, transparent 70%)' }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-[#333537] bg-[#1e1f20] shadow-2xl p-7 space-y-6">
        {/* Top Badge + Heading */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#3b424c] bg-[#28292a] px-3 py-1 text-[11px] font-medium text-[#a8c7fa]">
            <span>Personal AI Workspace</span>
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Welcome back
            </h1>
            <p className="text-sm text-[#c4c7c5] leading-relaxed">
              Sign in with your Google account to access your routines, vector memory, and reminders.
            </p>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="rounded-xl border border-[#2f3134] bg-[#171819] p-2.5 text-center space-y-1">
            <BrainCircuit className="w-4 h-4 mx-auto text-[#a8c7fa]" />
            <p className="text-[11px] font-medium text-[#e3e3e3]">Memory</p>
          </div>
          <div className="rounded-xl border border-[#2f3134] bg-[#171819] p-2.5 text-center space-y-1">
            <CalendarClock className="w-4 h-4 mx-auto text-[#a8c7fa]" />
            <p className="text-[11px] font-medium text-[#e3e3e3]">Smart Alerts</p>
          </div>
          <div className="rounded-xl border border-[#2f3134] bg-[#171819] p-2.5 text-center space-y-1">
            <ShieldCheck className="w-4 h-4 mx-auto text-[#a8c7fa]" />
            <p className="text-[11px] font-medium text-[#e3e3e3]">Private Sync</p>
          </div>
        </div>

        {/* Google-Only Action */}
        <div className="space-y-3 pt-1">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isRedirecting}
            className="w-full h-11 rounded-xl bg-white hover:bg-[#eef2f6] disabled:opacity-70 text-[#131314] font-medium text-sm flex items-center justify-center gap-3 shadow-sm transition cursor-pointer"
          >
            {isRedirecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#131314]" />
                <span>Redirecting to Google...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.54-1.14 2.85-2.4 3.72v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.97z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                  />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-center text-[#8e918f]">
            Google sign-in only • Powered by CignalPulse
          </p>
        </div>
      </div>
    </div>
  );
}