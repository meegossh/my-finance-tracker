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

export default function Recurring() {
  const [recurrings, setRecurrings] = useState<Recurring[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // form states
  const [name, setName] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [frequency, setFrequency] = useState("Monthly");
  const [startDate, setStartDate] = useState("");

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

  const addRecurring = async () => {
    const { error } = await supabase
      .from("recurrings")
      .insert([{ name, amount, frequency, start_date: startDate }]);
    if (error) {
      console.error("Insert error:", error);
    } else {
      // reset form and close modal
      setName("");
      setAmount("");
      setFrequency("Monthly");
      setStartDate("");
      setShowModal(false);

      // refresh data
      const { data } = await supabase
        .from("recurrings")
        .select("id, user_id, name, amount, frequency, start_date, created_at");
      setRecurrings(data || []);
    }
  };

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
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Recurring Calendar - July 2025</h2>
        <button
          onClick={() => setShowModal(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded"
        >
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

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Recurring Payment</h2>

            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border p-2 rounded w-full mb-3"
            />

            <input
              type="number"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="border p-2 rounded w-full mb-3"
            />

            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="border p-2 rounded w-full mb-3"
            >
              <option value="Monthly">Monthly</option>
              <option value="Weekly">Weekly</option>
              <option value="Yearly">Yearly</option>
            </select>

            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border p-2 rounded w-full mb-4"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border rounded"
              >
                Cancel
              </button>
              <button
                onClick={addRecurring}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
