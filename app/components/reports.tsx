"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer
} from "recharts";

type BalanceItem = {
  date: string;
  total: number;
};

export default function Reports() {
  const [balanceData, setBalanceData] = useState<BalanceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBalanceHistory = async () => {
      const { data, error } = await supabase
        .from("account_balances")
        .select("account_id, balance, snapshot_date")
        .order("snapshot_date", { ascending: true });

      if (error) {
        console.error("Error fetching balance history:", error);
      } else if (data) {
        const groupedByDate = data.reduce(
          (acc: Record<string, number>, curr: { snapshot_date: string; balance: number }) => {
            const date = curr.snapshot_date.substring(0, 10);
            acc[date] = (acc[date] || 0) + curr.balance;
            return acc;
          },
          {}
        );

        const result: BalanceItem[] = Object.entries(groupedByDate).map(([date, total]) => ({
          date,
          total
        }));

        setBalanceData(result);
      }

      setLoading(false);
    };

    fetchBalanceHistory();
  }, []);

  return (
    <div className="p-8">
      <h2 className="text-3xl font-bold mb-4">Reports</h2>

      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">Net Worth Over Time</h3>
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={balanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="#f97316" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-10">
        <h3 className="text-xl font-semibold mb-2">Feature Roadmap</h3>
        <ul className="list-disc ml-6 text-gray-700">
          <li>Daily/Monthly charts using balance history</li>
          <li>Net worth tracking over time</li>
          <li>Goal progress visualization</li>
          <li>Automated daily balance snapshots</li>
          <li>Alerts for balance drops</li>
        </ul>
      </div>
    </div>
  );
}
