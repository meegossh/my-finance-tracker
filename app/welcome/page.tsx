"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import Sidebar from "@/components/sidebar";
import Dashboard from "@/components/dashboard";
import Accounts from "@/components/accounts";
import Transactions from "@/components/transactions";
import CashFlow from "@/components/cashflow";
import Reports from "@/components/reports";
import Budget from "@/components/budget";
import Recurring from "@/components/recurring";
import Goals from "@/components/goals";
import Investments from "@/components/investments";
import Settings from "@/components/settings";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Welcome() {
  const [selected, setSelected] = useState("Dashboard");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUser(data.user);
      }
    });
  }, []);

  return (
    <div className="flex h-screen bg-[#f3f4f6]">
      <Sidebar selected={selected} setSelected={setSelected} user={user} />
      <div className="flex-1 p-8 overflow-y-auto">
        {selected === "Dashboard" && <Dashboard />}
        {selected === "Accounts" && <Accounts />}
        {selected === "Transactions" && <Transactions />}
        {selected === "Cash Flow" && <CashFlow />}
        {selected === "Reports" && <Reports />}
        {selected === "Budget" && <Budget />}
        {selected === "Recurring" && <Recurring />}
        {selected === "Goals" && <Goals />}
        {selected === "Investments" && <Investments />}
        {selected === "Settings" && <Settings />}
      </div>
    </div>
  );
}
