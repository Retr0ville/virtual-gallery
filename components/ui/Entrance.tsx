// Entrance overlay — real asset loading progress, click to enter (pointer-lock gesture).
// Bottom-right "Simi?" opens the private admin login.

import { useProgress } from '@react-three/drei';
import { FormEvent, useEffect, useState } from 'react';

interface EntranceProps {
  onEnter: () => void;
  onAdminLogin: () => void;
  adminAuthed: boolean;
}

export function Entrance({ onEnter, onAdminLogin, adminAuthed }: EntranceProps) {
  const { progress, active } = useProgress();
  const [settled, setSettled] = useState(false);
  const [closing, setClosing] = useState(false);
  const [done, setDone] = useState(false);

  const [loginOpen, setLoginOpen] = useState(false);
  const [username, setUsername] = useState('Simi');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  // Empty gallery loads zero tracked assets — loader never reaches 100.
  // Treat a quiet loader (no activity for a moment) as done.
  useEffect(() => {
    if (active) {
      setSettled(false);
      return;
    }
    const t = setTimeout(() => setSettled(true), 400);
    return () => clearTimeout(t);
  }, [active, progress]);

  useEffect(() => {
    if (!loginOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLoginOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [loginOpen]);

  const ready = !active && (progress >= 100 || settled);

  const handleClick = () => {
    if (!ready || closing) return;
    setClosing(true);
    onEnter();
    setTimeout(() => setDone(true), 750);
  };

  const closeLogin = () => {
    if (authBusy) return;
    setLoginOpen(false);
    setPassword('');
    setAuthError(null);
  };

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (authBusy) return;
    setAuthBusy(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Login failed');
      setLoginOpen(false);
      setPassword('');
      onAdminLogin();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setAuthBusy(false);
    }
  };

  if (done) return null;

  return (
    <div className={`entrance ${closing ? 'is-closing' : ''}`}>
      <div className="entrance-wordmark">SIMILOLUWA'S GALLERY</div>
      <div className="entrance-sub">A walk through the years</div>

      <div className="entrance-progress">
        <div className="entrance-progress-bar" style={{ width: `${Math.min(100, progress)}%` }} />
      </div>

      <button
        className="hud-chip entrance-enter no-magnetic"
        onClick={handleClick}
        disabled={!ready}
      >
        {ready ? 'Enter' : 'Loading'}
      </button>

      <div className="entrance-hint">
        Mouse look · WASD move · F to fly · Click to travel
      </div>

      <button
        className="entrance-admin no-magnetic"
        onClick={() => {
          if (adminAuthed) onAdminLogin();
          else setLoginOpen(true);
        }}
        aria-label="Private admin access"
      >
        Simi?
      </button>

      {loginOpen && (
        <div
          className="simi-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeLogin();
          }}
        >
          <form
            className="simi-modal"
            onSubmit={handleLogin}
            role="dialog"
            aria-modal="true"
            aria-label="Admin login"
          >
            <div className="simi-kicker">Private entrance</div>
            <div className="simi-title">Simi?</div>

            <label className="simi-field">
              <span>Name</span>
              <input
                type="text"
                value={username}
                autoComplete="username"
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>

            <label className="simi-field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                autoComplete="current-password"
                autoFocus
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            {authError && <div className="simi-error">{authError}</div>}

            <div className="simi-actions">
              <button type="button" className="simi-cancel" onClick={closeLogin}>
                Not yet
              </button>
              <button type="submit" className="simi-submit" disabled={authBusy || !password}>
                {authBusy ? 'Checking' : 'Open'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
