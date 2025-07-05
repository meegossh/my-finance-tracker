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
  LogOut,
  Menu
} from "lucide-react";

type SidebarProps = {
  selected: string;
  setSelected: (value: string) => void;
  user: any;
};

const menuItems = [
  { name: "Dashboard", icon: <Home size={18} /> },
  { name: "Accounts", icon: <CreditCard size={18} /> },
  { name: "Transactions", icon: <List size={18} /> },
  { name: "Cash Flow", icon: <BarChart size={18} /> },
  { name: "Reports", icon: <FileText size={18} /> },
  { name: "Budget", icon: <DollarSign size={18} /> },
  { name: "Recurring", icon: <Repeat size={18} /> },
  { name: "Goals", icon: <Target size={18} /> },
  { name: "Investments", icon: <PieChart size={18} /> },
  { name: "Settings", icon: <Settings size={18} /> },
];

export default function Sidebar({ selected, setSelected, user }: SidebarProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={`bg-[#f9fafb] border-r border-gray-200 p-4 flex flex-col h-screen transition-all duration-300 ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Hamburger toggle aligned like icons */}
      <div
        onClick={() => setCollapsed(!collapsed)}
        className={`flex cursor-pointer p-2 rounded-lg hover:bg-orange-50 transition ${
          collapsed ? "justify-center" : "items-center gap-3 w-full pl-1"
        }`}
      >
        <Menu size={20} />
        {!collapsed && <span className="font-bold text-orange-600 text-lg">VitaFin</span>}
      </div>

      {/* Menu items */}
      <ul className="flex flex-col space-y-1 mt-4">
        {menuItems.map((item) => (
          <li
            key={item.name}
            onClick={() => setSelected(item.name)}
            className={`flex p-2 rounded-lg cursor-pointer transition
              ${
                selected === item.name
                  ? "bg-orange-100 text-orange-700 font-semibold"
                  : "hover:bg-orange-50 text-gray-700"
              }
              ${collapsed ? "justify-center" : "items-center gap-3 w-full pl-1"}
            `}
          >
            {item.icon}
            {!collapsed && <span>{item.name}</span>}
          </li>
        ))}
      </ul>

      {/* User section at bottom */}
      <div
        className="relative mt-auto pl-1 text-sm text-gray-600 cursor-pointer"
        onMouseEnter={() => setShowMenu(true)}
        onMouseLeave={() => setShowMenu(false)}
      >
        {!collapsed && (
          <div className="font-medium text-gray-800 truncate w-full">
            {user?.email ?? "Loading..."}
          </div>
        )}
        {showMenu && !collapsed && (
          <div className="absolute bottom-8 left-0 bg-white border rounded-lg shadow-md w-44">
            <div
              className="px-4 py-2 hover:bg-orange-50 cursor-pointer"
              onClick={() => setSelected("Settings")}
            >
              Account Settings
            </div>
            <div
              className="px-4 py-2 hover:bg-orange-50 cursor-pointer"
              onClick={() => alert("Signing out...")}
            >
              <div className="flex items-center gap-2">
                <LogOut size={16} /> Sign Out
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
