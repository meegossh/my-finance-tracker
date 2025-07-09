"use client";
import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const { signIn, setActive, isLoaded } = useSignIn();

  // Password checks for UI feedback
  const hasMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const handleLogin = async () => {
    setMessage("");

    if (!isLoaded) {
      console.log("⏳ Clerk not loaded yet, skipping login.");
      return;
    }

    setLoading(true);

    try {
      console.log("✅ Logging in user with Clerk:", email);

      const result = await signIn!.create({
        identifier: email,
        password: password,
      });

      await setActive!({ session: result.createdSessionId });

      console.log("✅ User logged in and session started!");
      setMessage("✅ Successfully logged in! Redirecting...");
    } catch (err: any) {
      console.error("❌ Clerk login error:", err);
      setMessage(`❌ ${err.errors?.[0]?.message || "An error occurred"}`);
    }

    setLoading(false);
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <div className="w-full max-w-sm bg-white p-6 rounded-lg shadow-md">
        <div className="flex flex-col items-center mb-6">
          <div className="text-2xl font-bold mb-1">🍂 VitaFin</div>
          <div className="text-lg font-semibold text-center">
            Sign in to your account
          </div>
          <p className="text-gray-500 text-center mt-1">
            Welcome back! Please enter your credentials.
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
          <input
            className="p-2 border rounded w-full"
            type="password"
            placeholder="Your Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <ul className="mb-2 text-sm">
            <li className={`flex items-center mb-1 ${hasMinLength ? 'text-green-600' : 'text-gray-500'}`}>
              <span className="mr-2">{hasMinLength ? '✅' : '⚪'}</span>
              Minimum 8 characters
            </li>
            <li className={`flex items-center mb-1 ${hasNumber ? 'text-green-600' : 'text-gray-500'}`}>
              <span className="mr-2">{hasNumber ? '✅' : '⚪'}</span>
              At least one number
            </li>
            <li className={`flex items-center ${hasSymbol ? 'text-green-600' : 'text-gray-500'}`}>
              <span className="mr-2">{hasSymbol ? '✅' : '⚪'}</span>
              At least one symbol
            </li>
          </ul>

          {/* Clerk visible CAPTCHA */}
          <div id="clerk-captcha" className="mb-4"></div>

          <button
            onClick={handleLogin}
            disabled={loading || !isLoaded}
            className="bg-orange-400 text-white py-2 px-4 rounded w-full hover:bg-orange-500 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </div>

        {message && (
          <p className="text-center text-sm mb-4">{message}</p>
        )}

        <div className="text-center text-sm">
          Don't have an account?{" "}
          <a href="/auth" className="text-blue-600 hover:underline">
            Sign up
          </a>
        </div>
      </div>
    </main>
  );
}
