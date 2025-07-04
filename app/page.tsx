'use client';

import React, { useState } from 'react';

export default function HomePage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleLogin = async () => {
    setMessage('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        throw new Error('Login failed');
      }
      setMessage('Login successful!');
    } catch (err) {
      setMessage('An error occurred during login.');
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '400px', margin: '0 auto' }}>
      <h1>Welcome to Finance App</h1>

      <h2>Login</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        style={{ display: 'block', width: '100%', marginBottom: '1rem' }}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        style={{ display: 'block', width: '100%', marginBottom: '1rem' }}
      />
      <button onClick={handleLogin} style={{ width: '100%', padding: '0.5rem' }}>
        Login
      </button>

      {message && (
        <p style={{ color: 'red', marginTop: '1rem' }}>{message}</p>
      )}

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <span>Don't have an account? </span>
        <a href="/auth" style={{ color: 'green', textDecoration: 'underline' }}>
          Sign Up
        </a>
      </div>
    </div>
  );
}
