"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function SetPasswordPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth");
      } else {
        setLoading(false);
      }
    };
    checkUser();
  }, [router]);

  const handleSetPassword = async () => {
    if (!password || password.length < 6) {
      setMessage("❌ Password must be at least 6 characters.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage(`❌ ${error.message}`);
    } else {
      setMessage("✅ Password updated!");
      setTimeout(() => router.push("/welcome"), 1500);
    }
  };

  if (loading) return (
    <main className="flex items-center justify-center min-h-screen">
      <p>Loading...</p>
    </main>
  );

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <div className="w-full max-w-md bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-xl font-bold mb-4 text-center">Create or update your password</h1>
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="p-2 border rounded w-full mb-4"
        />
        <button
          onClick={handleSetPassword}
          className="bg-green-600 text-white py-2 rounded w-full hover:bg-green-700"
        >
          Set Password
        </button>
        {message && <p className="mt-4 text-center text-sm">{message}</p>}
        <div className="text-center mt-6">
          <a href="/welcome" className="text-blue-600 underline">Back to Welcome</a>
        </div>
      </div>
    </main>
  );
}
