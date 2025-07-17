"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

interface Recurring {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  actual_amount: number; 
  start_date: string;
  end_date: string | null;
  currency: string;
  created_at: string;
}

export default function Recurring() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());

  const [recurrings, setRecurrings] = useState<Recurring[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [frequency, setFrequency] = useState("Monthly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currency, setCurrency] = useState("USD");

  const [crcToUsd, setCrcToUsd] = useState(500); // Default fallback

  useEffect(() => {
    fetchRecurrings();
    fetchExchangeRate();
  }, []);

  const fetchExchangeRate = async () => {
    try {
      const res = await fetch("https://api.exchangerate.host/latest?base=CRC&symbols=USD");
      const data = await res.json();
      if (data?.rates?.USD) {
        setCrcToUsd(data.rates.USD);
      }
    } catch (err) {
      console.error("Error fetching exchange rate:", err);
    }
  };

  const currencySymbol = (code: string) => {
    switch (code) {
      case "CRC":
        return "₡";
      case "USD":
      default:
        return "$";
    }
  };

  const parseLocalDate = (str: string) => {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const fetchRecurrings = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("recurrings").select("*");
    if (error) {
      console.error("Error fetching recurrings:", error);
    } else {
      setRecurrings(data || []);
    }
    setLoading(false);
  };

  const addRecurring = async () => {
  const finalStart = startDate || new Date().toISOString().substring(0, 10);
  const value = typeof amount === "number" ? amount : 0;

  const { error } = await supabase.from("recurrings").insert([
    {
      name,
      amount: value, // budgeted amount
      actual_amount: value, // default actual = budgeted
      frequency,
      start_date: finalStart,
      end_date: endDate || null,
      currency,
    },
  ]);

  if (error) {
    console.error("Insert error:", error);
  } else {
    setName("");
    setAmount("");
    setFrequency("Monthly");
    setStartDate("");
    setEndDate("");
    setCurrency("USD");
    setShowModal(false);
    fetchRecurrings();
  }
};

  const deleteRecurring = async (id: string) => {
    const { error } = await supabase.from("recurrings").delete().eq("id", id);
    if (error) console.error("Delete error:", error);
    else fetchRecurrings();
  };

  const sumByCurrency = (
    recurrings: Recurring[],
    targetMonth: number,
    targetYear: number
  ) => {
    let usd = 0;
    let crc = 0;

    recurrings.forEach((r) => {
      const start = parseLocalDate(r.start_date);
      const end = r.end_date ? parseLocalDate(r.end_date) : null;

      const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
      const scheduledDay = Math.min(start.getDate(), lastDay);
      const occurrenceDate = new Date(targetYear, targetMonth, scheduledDay);

      if (occurrenceDate < start || (end && occurrenceDate > end)) return;

      if (r.currency === "USD") usd += r.amount;
      else if (r.currency === "CRC") crc += r.amount;
    });

    return {
      usd,
      crc,
      combined: usd + crc / crcToUsd,
    };
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = new Date(year, month, 1).getDay();
  const paymentsByDay: Record<number, Recurring[]> = {};

  recurrings.forEach((r) => {
    const start = parseLocalDate(r.start_date);
    const end = r.end_date ? parseLocalDate(r.end_date) : null;

    for (let day = 1; day <= daysInMonth; day++) {
      const current = new Date(year, month, day);
      if (end && current > end) continue;

      const startDay = start.getDate();
      const dayOfWeek = start.getDay();

      const shouldInclude = (() => {
        switch (r.frequency) {
          case "Monthly":
            return current.getDate() === Math.min(
              startDay,
              new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate()
            );
          case "Weekly":
            return current >= start && current.getDay() === dayOfWeek;
          case "Semi-Monthly":
            const secondDay = startDay + 15;
            return (
              current >= start &&
              (current.getDate() === startDay ||
                current.getDate() === Math.min(secondDay, daysInMonth))
            );
          case "Yearly":
            return (
              current.getDate() === startDay &&
              current.getMonth() === start.getMonth()
            );
          default:
            return false;
        }
      })();

      if (shouldInclude) {
        if (!paymentsByDay[day]) paymentsByDay[day] = [];
        paymentsByDay[day].push(r);
      }
    }
  });

  const { usd, crc, combined } = sumByCurrency(recurrings, month, year);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">
            Recurring Calendar -{" "}
            {new Date(year, month).toLocaleString("default", {
              month: "long",
              year: "numeric",
            })}
          </h2>
          <div className="flex gap-2">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="border p-2 rounded"
            >
              {Array.from({ length: 12 }).map((_, idx) => (
                <option key={idx} value={idx}>
                  {new Date(0, idx).toLocaleString("default", {
                    month: "long",
                  })}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="border p-2 rounded"
            >
              {Array.from({ length: 10 }).map((_, idx) => {
                const y = today.getFullYear() - 2 + idx;
                return (
                  <option key={y} value={y}>
                    {y}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded"
        >
          + Add Recurring
        </button>
      </div>

      {/* ✅ Overview Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="border rounded-lg p-4 bg-white shadow">
          <div className="text-sm text-gray-500">Monthly USD Expenses</div>
          <div className="text-xl font-semibold text-red-500">
            ${usd.toFixed(2)}
          </div>
        </div>
        <div className="border rounded-lg p-4 bg-white shadow">
          <div className="text-sm text-gray-500">Monthly CRC Expenses</div>
          <div className="text-xl font-semibold text-red-500">
            ₡{crc.toLocaleString()}
          </div>
        </div>
        <div className="border rounded-lg p-4 bg-white shadow">
          <div className="text-sm text-gray-500">Total Expenses in USD</div>
          <div className="text-xl font-semibold text-red-700">
            ${combined.toFixed(2)}{" "}
            <span className="text-xs text-gray-400">(incl. CRC)</span>
          </div>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-4 text-center font-medium text-gray-600 mb-2">
        <div>Sun</div>
        <div>Mon</div>
        <div>Tue</div>
        <div>Wed</div>
        <div>Thu</div>
        <div>Fri</div>
        <div>Sat</div>
      </div>

      {/* Calendar */}
      <div className="grid grid-cols-7 gap-4 mb-8">
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`offset-${i}`} />
        ))}
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
                  {p.name} {currencySymbol(p.currency)}
                  {p.amount}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Recurring List */}
      <div className="mt-8">
  <h3 className="text-lg font-semibold mb-2">Recurring List</h3>
  <div className="border rounded-lg">
    <div className="grid grid-cols-6 font-semibold text-sm bg-gray-100 p-3 border-b">
      <div>Name</div>
      <div>Frequency</div>
      <div>Start / End</div>
      <div className="text-right">Budgeted</div>
      <div className="text-right">Actual</div>
      <div className="text-right">Actions</div>
    </div>

    {loading && <div className="p-3 text-sm text-gray-500">Loading...</div>}
    {!loading && recurrings.length === 0 && (
      <div className="p-3 text-sm text-gray-500">No recurring payments yet.</div>
    )}

    {!loading &&
      recurrings.map((p) => (
        <div
          key={p.id}
          className="grid grid-cols-6 items-center text-sm px-3 py-2 border-t"
        >
          <div>{p.name}</div>
          <div>{p.frequency}</div>
          <div>
            {p.start_date}
            {p.end_date && ` - ${p.end_date}`}
          </div>
          <div className="text-right">
            {currencySymbol(p.currency)}
            {p.amount}
          </div>
          <div className="text-right">
            <input
              type="number"
              defaultValue={p.actual_amount}
              className="border px-2 py-1 w-20 text-right rounded text-sm"
              onBlur={async (e) => {
                const newVal = parseFloat(e.target.value);
                if (!isNaN(newVal) && newVal !== p.actual_amount) {
                  const { error } = await supabase
                    .from("recurrings")
                    .update({ actual_amount: newVal })
                    .eq("id", p.id);
                  if (!error) fetchRecurrings();
                }
              }}
            />
          </div>
          <div className="text-right">
            <button
              onClick={() => deleteRecurring(p.id)}
              className="text-red-500 hover:underline text-xs"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
  </div>
</div>


      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Recurring Payment</h2>

            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              placeholder="Netflix"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border p-2 rounded w-full mb-3"
            />

            <label className="block text-sm font-medium mb-1">Amount</label>
            <input
              type="number"
              placeholder="25"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="border p-2 rounded w-full mb-3"
            />

            <label className="block text-sm font-medium mb-1">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="border p-2 rounded w-full mb-3"
            >
              <option value="USD">USD ($)</option>
              <option value="CRC">CRC (₡)</option>
            </select>

            <label className="block text-sm font-medium mb-1">Frequency</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="border p-2 rounded w-full mb-3"
            >
              <option value="Monthly">Monthly</option>
              <option value="Weekly">Weekly</option>
              <option value="Semi-Monthly">Semi-Monthly</option>
              <option value="Yearly">Yearly</option>
            </select>

            <label className="block text-sm font-medium mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border p-2 rounded w-full mb-3"
            />

            <label className="block text-sm font-medium mb-1">
              End Date (optional)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
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
