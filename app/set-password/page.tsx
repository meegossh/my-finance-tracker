"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

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

  // validation checks
  const hasMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const handleSetPassword = async () => {
    setMessage("");
    if (!hasMinLength || !hasNumber || !hasSymbol) {
      setMessage("❌ Password does not meet requirements.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      console.error(error);
      setMessage(`❌ ${error.message}`);
    } else {
      setMessage("✅ Password updated successfully!");
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
      <div className="w-full max-w-sm bg-white p-6 rounded-lg shadow-md">
        <div className="flex flex-col items-center mb-4">
          <div className="text-2xl font-bold mb-1">🍂 Meegossh's Finance App</div>
          <h1 className="text-xl font-semibold text-center mb-2">Create your password</h1>
          <p className="text-gray-500 text-center">
            Your password must be at least 8 characters long, include 1 symbol and 1 number.
          </p>
        </div>

        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="p-2 border rounded w-full mt-4 mb-4"
        />

        <ul className="mb-4 text-sm">
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

        <button
          onClick={handleSetPassword}
          className="bg-orange-400 text-white py-2 rounded w-full hover:bg-orange-500"
        >
          Set Password
        </button>

        {message && (
          <p className="mt-4 text-center text-sm">{message}</p>
        )}


      </div>
    </main>
  );
}
