"use client";
import { useState } from "react";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setLoading(true);
    setMessage("");

    const res = await fetch("/api/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      const data = await res.json();
      console.error("Error:", data);
      setMessage(`❌ ${data.message || "Failed to send OTP"}`);
    } else {
      setMessage("✅ Check your email for the magic login link!");
    }

    setLoading(false);
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <div className="w-full max-w-sm bg-white p-6 rounded-lg shadow-md">
        <div className="flex flex-col items-center mb-6">
          <div className="text-2xl font-bold mb-1">🍂 VitaFin</div>
          <div className="text-lg font-semibold text-center">
            Sign up to start your free trial
          </div>
          <p className="text-gray-500 text-center mt-1">
            Try Finance app free, cancel anytime.
          </p>
        </div>

        <div className="flex flex-col gap-3 mb-4">
          <input
            className="p-2 border rounded w-full"
            type="email"
            placeholder="Your Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <button
            onClick={handleSignup}
            disabled={loading}
            className={`text-white py-2 px-4 rounded w-full ${
              loading
                ? "bg-orange-300 cursor-not-allowed"
                : "bg-orange-400 hover:bg-orange-500"
            }`}
          >
            {loading ? "Sending..." : "Sign up with email"}
          </button>
        </div>

        {message && (
          <div className="text-center text-sm text-gray-600 mb-4">
            {message}
          </div>
        )}

        <div className="text-center text-sm">
          Already have an account?{" "}
          <a href="/auth" className="text-blue-600 hover:underline">
            Sign in
          </a>
        </div>
      </div>
    </main>
  );
}
