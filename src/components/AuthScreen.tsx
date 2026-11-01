import { useState, type FormEvent } from 'react';
import { GraduationCap, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { errorBoxClass, inputClass, labelClass, primaryButtonClass, successBoxClass } from '@/lib/ui';

type Mode = 'signin' | 'signup';

function friendlyError(message: string): string {
  if (message === 'Invalid login credentials') return 'The email or password is incorrect.';
  if (message === 'User already registered') return 'An account with this email already exists. Switch to sign in.';
  return message;
}

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isSignIn = mode === 'signin';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    const credentials = { email: email.trim(), password };
    const result = isSignIn
      ? await supabase.auth.signInWithPassword(credentials)
      : await supabase.auth.signUp(credentials);

    setSubmitting(false);

    if (result.error) {
      setError(friendlyError(result.error.message));
      return;
    }
    if (!isSignIn && !result.data.session) {
      setMode('signin');
      setPassword('');
      setNotice('Account created. Sign in with the same email and password.');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-50 via-white to-slate-100 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-lg shadow-teal-700/20">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">NSS Points Desk</h1>
          <p className="mt-2 text-sm text-slate-600">
            {isSignIn ? 'Sign in to manage events and points.' : 'Create your account to get started.'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className={labelClass}>Email</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
                placeholder="you@college.edu"
              />
            </div>
            <div>
              <label htmlFor="password" className={labelClass}>Password</label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={isSignIn ? 'current-password' : 'new-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputClass}
                placeholder="At least 6 characters"
              />
            </div>

            {error && <p className={errorBoxClass}>{error}</p>}
            {notice && <p className={successBoxClass}>{notice}</p>}

            <button type="submit" disabled={submitting} className={`${primaryButtonClass} w-full`}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSignIn ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            {isSignIn ? 'First time here?' : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => {
                setMode(isSignIn ? 'signup' : 'signin');
                setError(null);
                setNotice(null);
              }}
              className="font-semibold text-teal-700 hover:text-teal-800"
            >
              {isSignIn ? 'Create account' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
