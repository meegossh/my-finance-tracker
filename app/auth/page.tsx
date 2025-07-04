"use client";
import { useState } from "react";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSignup = async () => {
    setMessage(""); // clear previous

    try {
      const res = await fetch("https://ykxaimwvkitcrgclikej.functions.supabase.co/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unexpected error");
      }

      setMessage(`✅ User created: ${JSON.stringify(data.user)}`);
    } catch (err) {
      console.error(err);
      setMessage(`❌ ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-3xl mb-6 font-bold">Sign Up Demo</h1>

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
          onClick={handleSignup}
          className="bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Sign Up
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
