"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setMessage("");
    setLoading(true);

    console.log("✅ Sending OTP magic link for:", email);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: "https://my-finance-tracker-smoky.vercel.app/set-password"
      }
    });

    if (error) {
      console.error("❌ Supabase signInWithOtp failed:", error);
      setMessage(`❌ ${error.message}`);
    } else {
      console.log("✅ OTP magic link sent!");
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

        <button
          className="flex items-center justify-center w-full border rounded py-2 mb-3 hover:bg-gray-100"
          onClick={() => alert("Apple login not implemented")}
        >
          🍏 Continue with Apple
        </button>

        <button
          className="flex items-center justify-center w-full border rounded py-2 mb-4 hover:bg-gray-100"
          onClick={() => alert("Google login not implemented")}
        >
          🌐 Continue with Google
        </button>

        <div className="flex items-center mb-4">
          <hr className="flex-grow border-gray-300" />
          <span className="px-2 text-gray-500 text-sm">OR</span>
          <hr className="flex-grow border-gray-300" />
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
            className="bg-orange-400 text-white py-2 px-4 rounded w-full hover:bg-orange-500 disabled:opacity-50"
          >
            {loading ? "Sending..." : "Sign up with email"}
          </button>
        </div>

        {message && (
          <p className="text-center text-sm mb-4">{message}</p>
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
