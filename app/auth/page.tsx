"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabaseClient"

export default function AuthPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAuth = async (mode: "signup" | "login") => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`https://<your-project>.functions.supabase.co/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      })

      const data = await res.json()

      if (data.error) {
        setError(data.error.message || data.error)
        return
      }

      // If signup/login succeeds, manually set session if returned
      if (data.session) {
        await supabase.auth.setSession(data.session)
      }

      // Or force refresh to let supabase.auth pick up localStorage
      router.push("/")
    } catch (err: any) {
      console.error("Unexpected error:", err)
      setError("An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <h1 className="text-2xl font-bold mb-6">Login or Sign Up</h1>

      <div className="w-full max-w-xs space-y-4">
        <input
          className="border rounded w-full p-2"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="border rounded w-full p-2"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <div className="text-red-500 text-sm">{error}</div>}

        <div className="flex space-x-2">
          <button
            className="bg-blue-600 text-white rounded px-4 py-2 flex-1 disabled:opacity-50"
            onClick={() => handleAuth("login")}
            disabled={loading}
          >
            Login
          </button>
          <button
            className="bg-green-600 text-white rounded px-4 py-2 flex-1 disabled:opacity-50"
            onClick={() => handleAuth("signup")}
            disabled={loading}
          >
            Sign Up
          </button>
        </div>
      </div>
    </div>
  )
}
