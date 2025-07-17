"use client";

import { useState } from "react";
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

export default function Welcome() {
  const [selected, setSelected] = useState("Dashboard");
  const userInfo = { email: "guest@vitafin.com" }; // Mocked Supabase user

  return (
    <div className="flex h-screen bg-[#f3f4f6]">
      {/* Sidebar should be FIRST */}
      <Sidebar selected={selected} setSelected={setSelected} user={userInfo} />

      {/* Main content on the RIGHT of sidebar */}
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
