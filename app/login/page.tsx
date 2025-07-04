"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleLogin = async () => {
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error(error);
      // make it user friendly for wrong credentials
      if (error.message.toLowerCase().includes("invalid login credentials")) {
        setMessage("❌ Incorrect email or password.");
      } else {
        setMessage(`❌ ${error.message}`);
      }
    } else {
      setMessage("✅ Logged in successfully!");
      setTimeout(() => router.push("/expenses"), 1000);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <div className="w-full max-w-sm bg-white p-6 rounded-lg shadow-md">
        <div className="flex flex-col items-center mb-6">
          <div className="text-2xl font-bold mb-1">🍂 Meegossh's Finance App</div>
          <div className="text-lg font-semibold text-center mb-1">
            Log in to your account
          </div>
          <p className="text-gray-500 text-center">
            Welcome back! Manage your budgets easily.
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

          <button
            onClick={handleLogin}
            className="bg-orange-400 text-white py-2 rounded w-full hover:bg-orange-500"
          >
            Log In
          </button>
        </div>

        {message && (
          <div
            className={`text-center text-sm mb-4 ${
              message.startsWith("✅") ? "text-green-600" : "text-red-600"
            }`}
          >
            {message}
          </div>
        )}

        <div className="text-center text-sm">
          Don’t have an account?{" "}
          <a href="/auth" className="text-blue-600 underline">Sign up</a>
        </div>
      </div>
    </main>
  );
}
