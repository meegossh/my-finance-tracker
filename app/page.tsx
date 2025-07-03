"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../lib/supabaseClient"

interface Expense {
  id: string
  amount: number
  date: string
  description: string
}

export default function Home() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // Redirect to your auth route (or you could show login form here)
        router.push("/auth")
        return
      }

      // Fetch expenses from Supabase directly
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("date", { ascending: false })

      if (error) {
        console.error("Error fetching expenses:", error)
      } else {
        setExpenses(data || [])
      }

      setLoading(false)
    }

    fetchData()
  }, [router])

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Your Expenses</h1>

      {loading && <p>Loading...</p>}

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
