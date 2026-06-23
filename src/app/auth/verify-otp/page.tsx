'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { KeyRound, ShieldAlert, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function VerifyOtpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || 'your-email@agency.com';
  const agencyName = searchParams.get('agency') || 'Your Agency';
  const { users, setCurrentUser, logAction } = useStore();

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(59);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer(timer - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const handleChange = (element: HTMLInputElement, index: number) => {
    if (isNaN(Number(element.value))) return;

    setOtp([...otp.map((d, idx) => (idx === index ? element.value : d))]);

    // Focus next input
    if (element.nextSibling && element.value !== '') {
      (element.nextSibling as HTMLInputElement).focus();
    }
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const otpCode = otp.join('');
    
    setTimeout(() => {
      // Allow any 6-digit code or default 123456
      if (otpCode.length === 6) {
        const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (foundUser) {
          setCurrentUser(foundUser);
          logAction('LOGIN', 'User', `OTP verified successfully for ${foundUser.name}`);
          router.push('/dashboard');
        } else {
          // If a new agency was registered, we might have added a user
          const lastUser = users[users.length - 1];
          if (lastUser && lastUser.email.toLowerCase() === email.toLowerCase()) {
            setCurrentUser(lastUser);
            logAction('LOGIN', 'User', `OTP verified successfully for registered user ${lastUser.name}`);
            router.push('/dashboard');
          } else {
            setError('User profile not found in active session.');
            setLoading(false);
          }
        }
      } else {
        setError('Please enter a valid 6-digit verification code.');
        setLoading(false);
      }
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[60%] rounded-full bg-indigo-900/20 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[60%] rounded-full bg-teal-900/10 blur-[120px]" />

      <div className="w-full max-w-md bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 p-8 rounded-2xl shadow-2xl relative z-10">
        <div className="mb-6">
          <Link href="/auth/login" className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors inline-flex items-center space-x-2 text-xs">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </Link>
        </div>

        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-3 shadow-lg shadow-indigo-600/30">
            <KeyRound className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-indigo-200 to-indigo-400 bg-clip-text text-transparent">
            Verify Email
          </h1>
          <p className="text-xs text-zinc-400 mt-2 px-4">
            We sent a verification code to <span className="font-semibold text-zinc-200">{email}</span> to secure your <span className="font-semibold text-zinc-200">{agencyName}</span> account.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/50 border border-red-800/40 text-red-200 text-xs flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-6">
          <div className="flex justify-between gap-2 px-2">
            {otp.map((data, index) => (
              <input
                key={index}
                type="text"
                maxLength={1}
                value={data}
                onChange={(e) => handleChange(e.target, index)}
                onFocus={(e) => e.target.select()}
                className="w-12 h-12 text-center text-lg font-bold rounded-lg bg-zinc-800/60 border border-zinc-700/50 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium text-xs tracking-wider uppercase transition-colors shadow-lg shadow-indigo-600/20 flex items-center justify-center"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              'Verify & Launch Workspace'
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-xs">
          {timer > 0 ? (
            <span className="text-zinc-500">
              Resend verification code in <span className="font-semibold text-zinc-400">{timer}s</span>
            </span>
          ) : (
            <button
              onClick={() => setTimer(59)}
              className="text-indigo-400 hover:underline flex items-center space-x-1.5 mx-auto font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Resend verification email</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
