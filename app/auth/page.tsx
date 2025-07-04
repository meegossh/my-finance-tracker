"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleSignup = async () => {
    setMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: "https://my-finance-tracker.vercel.app/set-password" // update to your deployed site
      }
    });

    if (error) {
      console.error(error);
      setMessage(`❌ ${error.message}`);
    } else {
      setMessage("✅ Check your email for the magic login link!");
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <div className="w-full max-w-sm bg-white p-6 rounded-lg shadow-md">
        <div className="flex flex-col items-center mb-6">
          <div className="text-2xl font-bold mb-1">🍂 Meegossh's Finance App</div>
          <div className="text-lg font-semibold text-center">
            Sign up to start your free trial
          </div>
          <p className="text-gray-500 text-center mt-1">
            Try Monarch free, cancel anytime.
          </p>
        </div>

        <button className="flex items-center justify-center w-full border rounded py-2 mb-3 hover:bg-gray-100">
          🍏 Continue with Apple
        </button>
        <button className="flex items-center justify-center w-full border rounded py-2 mb-4 hover:bg-gray-100">
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
            className="bg-orange-400 text-white py-2 rounded hover:bg-orange-500"
          >
            Sign up with email
          </button>
        </div>

        <p className="text-xs text-center text-gray-500 mb-4">
          By clicking the button above, you agree to our{" "}
          <a href="#" className="underline">Terms of Use</a> and{" "}
          <a href="#" className="underline">Privacy Policy</a>.
        </p>

        {message && (
          <div className="text-center text-sm text-red-600 mb-4">{message}</div>
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
