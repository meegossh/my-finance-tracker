"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

interface Recurring {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  frequency: string;
  start_date: string;
  created_at: string;
}

export default function RecurringPage() {
  const [recurrings, setRecurrings] = useState<Recurring[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecurrings = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("recurrings")
        .select("id, user_id, name, amount, frequency, start_date, created_at");

      if (error) {
        console.error("Error fetching recurrings:", error);
      } else {
        setRecurrings(data || []);
      }
      setLoading(false);
    };

    fetchRecurrings();
  }, []);

  const daysInMonth = 31;
  const startOffset = 2; // July 2025 starts on Tuesday

  // prepare payments by day
  const paymentsByDay: Record<number, Recurring[]> = {};
  recurrings.forEach(r => {
    const day = new Date(r.start_date).getDate();
    if (!paymentsByDay[day]) paymentsByDay[day] = [];
    paymentsByDay[day].push(r);
  });

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Recurring Calendar - July 2025</h2>
        <button className="bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded">
          + Add Recurring
        </button>
      </div>

      <div className="grid grid-cols-7 gap-4 mb-8">
        {/* Blank offset for calendar start */}
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`offset-${i}`} />
        ))}

        {/* Render days */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayPayments = paymentsByDay[day] || [];

          return (
            <div
              key={day}
              className="border rounded-xl p-3 shadow-sm hover:bg-gray-50 transition duration-200"
            >
              <div className="text-sm text-gray-500">{day}</div>
              {dayPayments.map((p) => (
                <div
                  key={p.id}
                  className="mt-2 bg-orange-100 text-orange-800 text-xs rounded px-2 py-1"
                >
                  {p.name} ${p.amount}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-2">This month</h3>
        <div className="border rounded-lg divide-y">
          {loading && <div className="p-3 text-sm text-gray-500">Loading...</div>}
          {!loading && recurrings.length === 0 && (
            <div className="p-3 text-sm text-gray-500">No recurring payments yet.</div>
          )}
          {recurrings.map((p) => (
            <div key={p.id} className="flex justify-between p-3 text-sm">
              <span>{p.name} ({p.frequency})</span>
              <span>${p.amount}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
