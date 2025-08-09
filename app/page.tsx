"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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
import Auth from "@/components/auth";

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

export default function Welcome() {
  const [selected, setSelected] = useState<Page>("Dashboard");
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // 1) Cargar sesión actual
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setEmail(data.session?.user?.email ?? null);
      setLoading(false);
    });

    // 2) Suscribirse a cambios de auth (login/logout)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setEmail(session?.user?.email ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Mientras verificamos la sesión
  if (loading) {
    return (
      <div className="grid h-screen place-items-center text-zinc-600 dark:text-zinc-300">
        Cargando…
      </div>
    );
  }

  // Si NO hay sesión => mostrar pantalla de login (email + código)
  if (!email) {
    return <Auth />;
  }

  // Si hay sesión => mostrar la app
  const userInfo = { email };

  return (
    <div className="flex h-screen bg-[#f3f4f6] dark:bg-zinc-900 transition-colors">
      <Sidebar
        selected={selected}
        setSelected={setSelected}
        user={userInfo}
        onLogout={async () => {
          await supabase.auth.signOut();
        }}
      />

      <main className="flex-1 overflow-y-auto p-6 sm:p-8">
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
      </main>
    </div>
  );
}
