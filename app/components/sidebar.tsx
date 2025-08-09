"use client";

import React, { useMemo, useState, type Dispatch, type SetStateAction } from "react";
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
  Settings as SettingsIcon,
  Menu,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export type Page =
  | "Dashboard"
  | "Accounts"
  | "Transactions"
  | "Cash Flow"
  | "Reports"
  | "Budget"
  | "Recurring"
  | "Goals"
  | "Investments"
  | "Settings";

type SidebarProps = {
  selected?: Page | string;
  // Puede venir como setState o como callback externa
  setSelected?: Dispatch<SetStateAction<Page>> | ((value: Page | string) => void);
  user?: { email?: string | null };
  onLogout?: () => void | Promise<void>;
};

const menuItems: Array<{ name: Page; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
  { name: "Dashboard", icon: Home },
  { name: "Accounts", icon: CreditCard },
  { name: "Transactions", icon: List },
  { name: "Cash Flow", icon: BarChart },
  { name: "Reports", icon: FileText },
  { name: "Budget", icon: DollarSign },
  { name: "Recurring", icon: Repeat },
  { name: "Goals", icon: Target },
  { name: "Investments", icon: PieChart },
  { name: "Settings", icon: SettingsIcon },
] as const;

function isPage(value: unknown): value is Page {
  return typeof value === "string" && menuItems.some((m) => m.name === value);
}

export default function Sidebar({
  selected,
  setSelected,
  user,
  onLogout,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [internalSelected, setInternalSelected] = useState<Page>("Dashboard");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const currentSelected: Page = isPage(selected) ? selected : internalSelected;

  const email = user?.email ?? "guest@vitafin.com";
  const initials = useMemo(() => email.charAt(0).toUpperCase(), [email]);

  // ✅ sin `any`: llamamos con una firma compatible (Page => void)
  const changeSelected = (value: Page) => {
    if (setSelected) {
      (setSelected as (v: Page) => void)(value);
    } else {
      setInternalSelected(value);
    }
  };

  // ✅ Lógica de logout centralizada en el Sidebar como fallback si no viene onLogout
  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      if (onLogout) {
        await onLogout();
      } else {
        // Fallback: cerrar sesión directamente aquí
        const { error } = await supabase.auth.signOut();
        if (error) {
          // Muestra un mensaje simple; reemplázalo si usas toasts
          window.alert(error.message);
        }
      }
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <aside
      className="relative z-30 h-screen shrink-0 border-r border-white/20 bg-white/60 px-3 py-4 backdrop-blur-2xl transition-all duration-200 dark:border-zinc-800/50 dark:bg-zinc-900/40 md:px-4"
      style={{ width: collapsed ? 84 : 280 }}
    >
      {/* Gradients */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(60%_40%_at_10%_0%,_rgba(59,130,246,0.20)_0%,_rgba(59,130,246,0)_65%),radial-gradient(50%_35%_at_120%_10%,_rgba(236,72,153,0.18)_0%,_rgba(236,72,153,0)_60%)]" />
      </div>

      {/* Header */}
      <div className={`mb-4 flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && (
          <button
            onClick={() => changeSelected("Dashboard")}
            className="group flex items-center gap-2 rounded-2xl px-2 py-2 text-left transition hover:opacity-90"
            title="VitaFin"
          >
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-blue-600 to-fuchsia-500 shadow-sm" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">VitaFin</div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Personal Finance
              </div>
            </div>
          </button>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="rounded-xl border border-white/30 bg-white/70 p-2 text-zinc-700 shadow-sm transition hover:bg-white dark:border-zinc-700/40 dark:bg-zinc-800/60 dark:text-zinc-300"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
        >
          <Menu size={18} />
        </button>
      </div>

      {/* Menu */}
      <ul className="mt-2 space-y-1">
        {menuItems.map(({ name, icon: Icon }) => {
          const active = currentSelected === name;
          return (
            <li key={name}>
              <button
                onClick={() => changeSelected(name)}
                className={[
                  "group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl px-3 py-2.5 text-sm transition",
                  active
                    ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-slate-800 hover:bg-white/80 dark:text-zinc-300 dark:hover:bg-zinc-800/60",
                  "border border-white/30 backdrop-blur dark:border-zinc-800/50",
                  collapsed ? "justify-center" : "",
                ].join(" ")}
                title={name}
              >
                <span
                  className={[
                    "absolute left-0 top-0 h-full w-1 rounded-r-md",
                    active ? "bg-gradient-to-b from-blue-500 to-fuchsia-500" : "bg-transparent",
                  ].join(" ")}
                />
                <Icon size={20} className="shrink-0" />
                {!collapsed && <span className="flex-1 text-left">{name}</span>}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Footer fijo abajo (email + hover logout) */}
      <div className="pointer-events-auto absolute inset-x-3 bottom-3">
        <div className="relative group">
          <button
            className={[
              "flex w-full items-center gap-3 rounded-2xl border border-white/30",
              "bg-white/70 px-3 py-2 text-sm text-zinc-700 shadow-sm backdrop-blur",
              "transition hover:bg-white dark:border-zinc-700/40 dark:bg-zinc-800/60 dark:text-zinc-200",
              collapsed ? "justify-center" : "justify-between",
            ].join(" ")}
            title={email}
          >
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-fuchsia-500 text-xs font-bold text-white">
                {initials}
              </div>
              {!collapsed && <span className="truncate max-w-[160px]">{email}</span>}
            </div>
            {!collapsed && <span className="text-xs text-zinc-400">▼</span>}
          </button>

          {/* Hover dropdown */}
          <div
            className={[
              "pointer-events-none absolute bottom-full left-0 right-0 mb-2",
              "opacity-0 translate-y-1 transition duration-150 ease-out",
              "group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto",
            ].join(" ")}
          >
            <div className="rounded-2xl border border-white/30 bg-white/90 p-2 text-sm shadow-lg backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/90">
              <button
                onClick={() => void handleLogout()}
                disabled={isLoggingOut}
                className="w-full rounded-xl px-3 py-2 text-left hover:bg-zinc-100 disabled:opacity-60 dark:hover:bg-zinc-700/60"
              >
                {isLoggingOut ? "Logging out…" : "Logout"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
