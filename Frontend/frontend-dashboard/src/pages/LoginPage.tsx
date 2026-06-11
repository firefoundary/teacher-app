import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';

export function LoginPage() {
  const { login, isLoading } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalErr(null);
    if (!email || !password) {
      setLocalErr('Email and password are required.');
      return;
    }
    try {
      await login(email, password);
    } catch (err) {
      setLocalErr(err instanceof Error ? err.message : 'Login failed. Check credentials and try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">DIET Admin Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            District Institute of Education and Training
          </p>
        </div>

        {/* Card */}
        <div className="dashboard-card">
          <h2 className="text-lg font-semibold text-foreground mb-6">Sign in to your account</h2>

          {localErr && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-5">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{localErr}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-field"
                placeholder="admin@diet.gov.in"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input-field pr-10"
                  placeholder="••••••••"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPass(v => !v)}
                  tabIndex={-1}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © 2026 DIET Admin Dashboard. All rights reserved.
        </p>
      </div>
    </div>
  );
}

export default LoginPage;