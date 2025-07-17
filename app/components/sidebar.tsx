"use client";

import { useState } from "react";
import {
  Home,
  CreditCard,
  List,
  BarChart,
  FileText,
  DollarSign,
  Repeat,
  Target,
  PieChart,
  Settings,
  Menu
} from "lucide-react";

type SidebarProps = {
  selected: string;
  setSelected: (value: string) => void;
  user: { email?: string | null }; // ✅ Replaced `any`
};

const menuItems = [
  { name: "Dashboard", icon: Home },
  { name: "Accounts", icon: CreditCard },
  { name: "Transactions", icon: List },
  { name: "Cash Flow", icon: BarChart },
  { name: "Reports", icon: FileText },
  { name: "Budget", icon: DollarSign },
  { name: "Recurring", icon: Repeat },
  { name: "Goals", icon: Target },
  { name: "Investments", icon: PieChart },
  { name: "Settings", icon: Settings },
];

export default function Sidebar({ selected, setSelected, user }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={`bg-[#f9fafb] border-r border-gray-200 p-4 flex flex-col h-screen transition-all duration-300 ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Toggle Button */}
      <div
        onClick={() => setCollapsed(!collapsed)}
        className={`flex items-center ${
          collapsed ? "justify-center" : "justify-between"
        } cursor-pointer mb-6`}
      >
        {!collapsed && <span className="text-xl font-bold text-orange-600">VitaFin</span>}
        <Menu size={24} className="text-orange-600" />
      </div>

      {/* Menu */}
      <ul className="space-y-2">
        {menuItems.map(({ name, icon: Icon }) => (
          <li
            key={name}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer text-sm font-medium ${
              selected === name
                ? "bg-orange-100 text-orange-700"
                : "text-slate-800 hover:bg-orange-50"
            } ${collapsed ? "justify-center" : ""}`}
            onClick={() => setSelected(name)}
          >
            <Icon size={20} />
            {!collapsed && <span>{name}</span>}
          </li>
        ))}
      </ul>

      {/* Footer */}
      <div className={`mt-auto text-sm text-slate-500 ${collapsed ? "text-center" : "text-right pr-1"}`}>
        {!collapsed ? user?.email ?? "Loading..." : "…"}
      </div>
    </div>
  );
}
