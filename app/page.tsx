'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleLogin = async () => {
    try {
      const response = await fetch('/api/login', { // adjust if you have direct Supabase client here
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) throw new Error('Login failed');

      setMessage('Login successful!');
    } catch (err) {
      setMessage('An unexpected error occurred.');
    }
  };

  return (
    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '50px' }}>
      <h1>Welcome to My Finance Tracker</h1>

      <div style={{ marginTop: '30px', display: 'flex', flexDirection: 'column', width: '300px' }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: '10px', marginBottom: '10px' }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: '10px', marginBottom: '10px' }}
        />
        <button
          onClick={handleLogin}
          style={{ padding: '10px', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Login
        </button>
        {message && <p style={{ color: 'red', marginTop: '10px' }}>{message}</p>}
      </div>

      <div style={{ marginTop: '20px' }}>
        <span>Don't have an account? </span>
        <Link href="/signup" style={{ color: 'green', textDecoration: 'underline' }}>
          Sign Up
        </Link>
      </div>
    </main>
  );
}
