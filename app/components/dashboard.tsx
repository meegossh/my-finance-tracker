"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { ResponsiveLine } from "@nivo/line";
import { ResponsiveBar } from "@nivo/bar";
import { ResponsivePie } from "@nivo/pie";

type Currency = "USD" | "CRC";

interface Account { id: string; name: string; balance: number; currency: Currency }
interface BalanceSnap { account_id: string; balance: number; recorded_at: string }
interface Expense { id: string; description: string; category_id: string | null; amount: number; date: string; account_id: string }
interface Category { id: string; name: string }
interface Recurring { id: string; name: string; amount: number; currency: Currency }
interface RecurringPayment { id: string; recurring_id: string; date: string; actual_amount: number | null; is_paid: boolean }

const toISO = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const startOfMonth = (y: number, m: number) => new Date(y, m, 1);
const endOfMonth = (y: number, m: number) => new Date(y, m + 1, 0);

// ====== UI helpers ======
function Card({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={[
        "rounded-2xl border p-4 shadow-xl",
        "border-white/30 bg-white/60 backdrop-blur-2xl",
        "dark:border-zinc-700/40 dark:bg-zinc-900/50",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

// Nivo theme (coherente con la UI)
const nivoTheme = {
  textColor: "#0a0a0a",
  fontSize: 12,
  grid: { line: { stroke: "rgba(0,0,0,0.06)" } },
  axis: {
    ticks: { text: { fill: "#6b7280" } },
    legend: { text: { fill: "#6b7280" } },
  },
  tooltip: {
    container: {
      background: "rgba(255,255,255,0.95)",
      color: "#111827",
      fontSize: 12,
      borderRadius: 10,
      boxShadow: "0 10px 25px rgba(0,0,0,.12)",
      border: "1px solid rgba(0,0,0,.06)",
      backdropFilter: "blur(8px)",
    },
  },
} as const;

export default function Dashboard() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [snaps, setSnaps] = useState<BalanceSnap[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recurrings, setRecurrings] = useState<Recurring[]>([]);
  const [payments, setPayments] = useState<RecurringPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const monthStartISO = useMemo(() => toISO(startOfMonth(year, month)), [year, month]);
  const monthEndISO = useMemo(() => toISO(endOfMonth(year, month)), [year, month]);
  const monthLabel = new Date(year, month, 1).toLocaleString(undefined, { month: "long", year: "numeric" });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [acc, bal, exp, cat, r, rp] = await Promise.all([
        supabase.from("accounts").select("id,name,balance,currency").order("name"),
        supabase
          .from("account_balances")
          .select("account_id,balance,recorded_at")
          .gte("recorded_at", toISO(new Date(today.getFullYear() - 1, today.getMonth(), 1)))
          .order("recorded_at"),
        supabase
          .from("expenses")
          .select("id,description,category_id,amount,date,account_id")
          .gte("date", monthStartISO)
          .lte("date", monthEndISO),
        supabase.from("categories").select("id,name"),
        supabase.from("recurrings").select("id,name,amount,currency"),
        supabase
          .from("recurring_payments")
          .select("id,recurring_id,date,actual_amount,is_paid")
          .gte("date", monthStartISO)
          .lte("date", monthEndISO),
      ]);
      setAccounts(acc.data || []);
      setSnaps(bal.data || []);
      setExpenses(exp.data || []);
      setCategories(cat.data || []);
      setRecurrings(r.data || []);
      setPayments(rp.data || []);
      setLoading(false);
    };
    load();
  }, [monthStartISO, monthEndISO]);

  // ==== KPIs ====
  const netWorth = useMemo(
    () => accounts.reduce((s, a) => s + (a.balance ?? 0), 0),
    [accounts]
  );

  const expensesTotal = useMemo(
    () => expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0),
    [expenses]
  );

  // inflow “naive” con snapshots del mes: suma de deltas positivos
  const inflow = useMemo(() => {
    const snapsMonth = snaps.filter(s => s.recorded_at >= monthStartISO && s.recorded_at <= monthEndISO);
    let total = 0;
    const byAcc: Record<string, BalanceSnap[]> = {};
    for (const s of snapsMonth) (byAcc[s.account_id] ||= []).push(s);
    for (const arr of Object.values(byAcc)) {
      arr.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
      for (let i = 1; i < arr.length; i++) {
        const d = Number(arr[i].balance) - Number(arr[i - 1].balance);
        if (d > 0) total += d;
      }
    }
    return total;
  }, [snaps, monthStartISO, monthEndISO]);

  const outflow = expensesTotal;
  const cashflow = inflow - outflow;

  // ==== Series Net Worth (últimos 12+ meses) ====
  const netWorthSeries = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of snaps) {
      const d = s.recorded_at.slice(0, 10);
      map.set(d, (map.get(d) ?? 0) + Number(s.balance || 0));
    }
    const points = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, value]) => ({ x: date, y: value }));
    return [{ id: "Net Worth", data: points }];
  }, [snaps]);

  // ==== Pie de gasto por categoría (mes) ====
  const spendByCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      const name = categories.find(c => c.id === e.category_id)?.name ?? "Uncategorized";
      map.set(name, (map.get(name) ?? 0) + Number(e.amount || 0));
    }
    return Array.from(map.entries())
      .map(([id, value]) => ({ id, label: id, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses, categories]);

  // ==== Budget vs Actual (recurrentes del mes) ====
  const budgetActualBars = useMemo(() => {
    let budget = 0, actual = 0;
    for (const p of payments) {
      const r = recurrings.find(x => x.id === p.recurring_id);
      if (!r) continue;
      budget += r.amount;
      actual += Number(p.actual_amount ?? r.amount);
    }
    return [
      { name: "Budget", value: budget },
      { name: "Actual", value: actual },
    ];
  }, [payments, recurrings]);

  // ==== Próximos 7 días ====
  const upcoming = useMemo(() => {
    const now = new Date();
    const in7 = new Date(now); in7.setDate(now.getDate() + 7);
    return payments
      .filter(p => !p.is_paid && p.date >= toISO(now) && p.date <= toISO(in7))
      .map(p => ({ ...p, name: recurrings.find(r => r.id === p.recurring_id)?.name ?? "Recurring" }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [payments, recurrings]);

  return (
    <div className="mx-auto max-w-7xl p-6 sm:p-8 bg-inherit">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Overview for {monthLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="h-9 px-3 rounded-xl border border-white/30 bg-white/70 shadow-sm backdrop-blur transition hover:bg-white dark:border-zinc-700/40 dark:bg-zinc-800/60"
            onClick={() => setMonth(m => (m === 0 ? 11 : m - 1))}
            aria-label="Previous month"
          >
            ◀
          </button>
          <div className="px-3 py-2 min-w-[160px] text-center rounded-xl border border-white/30 bg-white/60 shadow-sm backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60">
            {monthLabel}
          </div>
          <button
            className="h-9 px-3 rounded-xl border border-white/30 bg-white/70 shadow-sm backdrop-blur transition hover:bg-white dark:border-zinc-700/40 dark:bg-zinc-800/60"
            onClick={() => setMonth(m => (m === 11 ? 0 : m + 1))}
            aria-label="Next month"
          >
            ▶
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Net Worth</div>
          <div className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            ${netWorth.toLocaleString()}
          </div>
        </Card>

        <Card>
          <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Cash Flow</div>
          <div className={`text-2xl font-semibold tabular-nums ${cashflow >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {cashflow >= 0 ? "+" : "-"}${Math.abs(cashflow).toLocaleString()}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Inflow ${inflow.toLocaleString()} • Outflow ${outflow.toLocaleString()}
          </div>
        </Card>

        <Card>
          <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Budget (recurrings)</div>
          <div className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            ${budgetActualBars.find(b => b.name === "Budget")?.value.toLocaleString() ?? 0}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Actual ${budgetActualBars.find(b => b.name === "Actual")?.value.toLocaleString() ?? 0}
          </div>
        </Card>

        <Card>
          <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Upcoming (7d)</div>
          <div className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {upcoming.length}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Unpaid instances</div>
        </Card>
      </div>

      {/* Charts */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Net worth line */}
        <Card className="h-80">
          <div className="text-sm text-zinc-600 dark:text-zinc-300 mb-2">Net worth (last 12+ months)</div>
          <div className="h-[90%]">
            <ResponsiveLine
              data={netWorthSeries}
              theme={nivoTheme}
              margin={{ top: 20, right: 20, bottom: 40, left: 60 }}
              xScale={{ type: "point" }}
              yScale={{ type: "linear", stacked: false }}
              axisBottom={{ tickRotation: -30 }}
              colors={["#6366F1"]}
              lineWidth={3}
              pointSize={6}
              enableArea
              areaOpacity={0.15}
              useMesh
              enableSlices="x"
              tooltip={({ point }) => (
                <div className="px-2 py-1 rounded-lg shadow bg-white/90 backdrop-blur text-sm border border-black/5">
                  <b>{point.data.xFormatted}</b>: ${Number(point.data.y).toLocaleString()}
                </div>
              )}
            />
          </div>
        </Card>

        {/* Cash flow bar */}
        <Card className="h-80">
          <div className="text-sm text-zinc-600 dark:text-zinc-300 mb-2">Cash flow</div>
          <div className="h-[90%]">
            <ResponsiveBar
              data={[{ name: monthLabel, Inflow: Math.max(inflow, 0), Outflow: Math.max(outflow, 0) }]}
              theme={nivoTheme}
              keys={["Inflow", "Outflow"]}
              indexBy="name"
              margin={{ top: 20, right: 20, bottom: 40, left: 60 }}
              padding={0.4}
              groupMode="grouped"
              colors={({ id }) => (id === "Inflow" ? "#22C55E" : "#EF4444")}
              axisBottom={{ tickRotation: 0 }}
              labelSkipWidth={24}
              labelSkipHeight={16}
              tooltip={({ value, id }) => (
                <div className="px-2 py-1 rounded-lg shadow bg-white/90 backdrop-blur text-sm border border-black/5">
                  <b>{id as string}</b>: ${Number(value).toLocaleString()}
                </div>
              )}
            />
          </div>
        </Card>

        {/* Spend by category pie */}
        <Card className="h-80">
          <div className="text-sm text-zinc-600 dark:text-zinc-300 mb-2">Spend by category</div>
          <div className="h-[90%]">
            <ResponsivePie
              data={spendByCat}
              theme={nivoTheme}
              margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
              innerRadius={0.55}
              padAngle={1.2}
              cornerRadius={3}
              activeOuterRadiusOffset={8}
              colors={{ scheme: "category10" }}
              arcLabelsTextColor={{ from: "color", modifiers: [["darker", 2.5]] }}
              tooltip={({ datum }) => (
                <div className="px-2 py-1 rounded-lg shadow bg-white/90 backdrop-blur text-sm border border-black/5">
                  <b>{datum.id as string}</b>: ${Number(datum.value).toLocaleString()}
                </div>
              )}
            />
          </div>
        </Card>
      </div>

      {/* Budget vs Actual + Upcoming */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="h-80">
          <div className="text-sm text-zinc-600 dark:text-zinc-300 mb-2">Budget vs Actual</div>
          <div className="h-[90%]">
            <ResponsiveBar
              data={budgetActualBars}
              theme={nivoTheme}
              keys={["value"]}
              indexBy="name"
              margin={{ top: 20, right: 20, bottom: 40, left: 60 }}
              padding={0.5}
              colors={(bar) => (bar.data.name === "Actual" ? "#6366F1" : "#94A3B8")}
              labelSkipWidth={24}
              labelSkipHeight={16}
              tooltip={({ value, indexValue }) => (
                <div className="px-2 py-1 rounded-lg shadow bg-white/90 backdrop-blur text-sm border border-black/5">
                  <b>{indexValue as string}</b>: ${Number(value).toLocaleString()}
                </div>
              )}
            />
          </div>
        </Card>

        <Card>
          <div className="text-sm text-zinc-600 dark:text-zinc-300">Upcoming recurring (next 7 days)</div>
          {upcoming.length === 0 ? (
            <div className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Nothing due in the next week.</div>
          ) : (
            <ul className="mt-3 divide-y divide-white/30 dark:divide-zinc-700/40">
              {upcoming.map((u) => (
                <li key={u.id} className="py-2 flex items-center justify-between">
                  <span className="text-sm text-zinc-800 dark:text-zinc-200">
                    {u.date} — {u.name}
                  </span>
                  <span className="text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
                    ${(u.actual_amount ?? (recurrings.find(r => r.id === u.recurring_id)?.amount ?? 0)).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {loading && <div className="mt-6 text-zinc-500 dark:text-zinc-400">Loading…</div>}
    </div>
  );
}
