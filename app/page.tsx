"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../lib/supabaseClient"

interface Expense {
  id: string
  amount: number
  date: string
  description: string
  category_id: string | null
  created_at: string
}

export default function Home() {
  const router = useRouter()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push("/auth")
        return
      }

      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("date", { ascending: false })

      if (error) {
        console.error("Error fetching expenses:", error)
        setError("Failed to load expenses.")
      } else {
        setExpenses(data || [])
      }

      setLoading(false)
    }

    fetchData()
  }, [router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/auth")
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Your Expenses</h1>
        <button
          onClick={handleSignOut}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          Sign Out
        </button>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {!loading && expenses.length === 0 && (
        <p className="text-gray-600">No expenses found. Try adding some!</p>
      )}

      <ul className="space-y-4">
        {expenses.map(expense => (
          <li key={expense.id} className="border rounded p-4 shadow-sm hover:shadow-md transition">
            <div className="text-lg font-semibold">${expense.amount.toFixed(2)}</div>
            <div className="text-sm text-gray-600">{expense.date}</div>
            <div className="text-sm">{expense.description}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}
