"use client";

import { useState } from "react";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleLogin = async () => {
    setMessage(""); // clear previous

    try {
      const res = await fetch("https://ykxaimwvkitcrgclikej.functions.supabase.co/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`, // or your key
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unexpected error");
      }

      setMessage(`✅ Success: ${data.message}`);
    } catch (err) {
      console.error(err);
      setMessage(`❌ ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-3xl mb-6 font-bold">Login Demo</h1>

      <div className="flex flex-col gap-4 w-full max-w-sm">
        <input
          className="p-2 border rounded"
          type="email"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="p-2 border rounded"
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={handleLogin}
          className="bg-green-600 text-white py-2 rounded hover:bg-green-700"
        >
          Login
        </button>

        {message && (
          <div className="mt-2 text-center">
            {message}
          </div>
        )}
      </div>
    </main>
  );
}

