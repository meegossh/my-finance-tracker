"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { ResponsiveLine } from "@nivo/line";
import { ResponsiveBar } from "@nivo/bar";
import { ResponsivePie } from "@nivo/pie";

// ========== Types ==========
type Currency = "USD" | "CRC";

interface Account { id: string; name: string; currency: Currency; balance: number }
interface BalanceSnap { account_id: string; balance: number; recorded_at: string }
interface Expense { id: string; description: string; category_id: string | null; amount: number; date: string; account_id: string }
interface Category { id: string; name: string }
interface Income { id: string; description: string; amount: number; date: string; account_id: string }
interface Recurring { id: string; name: string; amount: number; currency: Currency }
interface RecurringPayment { id: string; recurring_id: string; date: string; actual_amount: number | null; is_paid: boolean; account_id: string | null }

// ========== UI helpers ==========
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

// ========== Utils ==========
const toISO = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
const startOfMonth = (y: number, m: number) => new Date(y, m, 1);
const endOfMonth = (y: number, m: number) => new Date(y, m + 1, 0);

const nivoTheme = {
  textColor: "#111827",
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

// Grouping
type GroupBy = "day" | "week" | "month";
function fmtPeriod(d: Date, grp: GroupBy): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  if (grp === "day") return `${y}-${m}-${day}`;
  if (grp === "week") {
    const date = new Date(Date.UTC(y, d.getMonth(), d.getDate()));
    const dayNum = (date.getUTCDay() + 6) % 7; // Monday=0
    date.setUTCDate(date.getUTCDate() - dayNum + 3);
    const week1 = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
    const weekNo =
      1 +
      Math.round(
        ((date.getTime() - week1.getTime()) / 86400000 -
          3 +
          ((week1.getUTCDay() + 6) % 7)) /
          7
      );
    return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  }
  return `${y}-${m}`; // month
}

// ========== Component ==========
export default function CashFlowModule() {
  // Date range presets
  const today = new Date();
  const [groupBy, setGroupBy] = useState<GroupBy>("month");
  const [range, setRange] = useState<{ start: Date; end: Date }>(() => ({
    start: new Date(today.getFullYear(), today.getMonth() - 5, 1),
    end: endOfMonth(today.getFullYear(), today.getMonth()),
  }));

  // Filters
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [baseCurrency, setBaseCurrency] = useState<Currency>("USD");
  const [fxRate, setFxRate] = useState<number>(500); // CRC->USD estimado

  // Data
  const [snaps, setSnaps] = useState<BalanceSnap[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recurrings, setRecurrings] = useState<Recurring[]>([]);
  const [payments, setPayments] = useState<RecurringPayment[]>([]);
  const [loading, setLoading] = useState(true);

  // Load data
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const startISO = toISO(range.start);
      const endISO = toISO(range.end);
      const yearAgoISO = toISO(new Date(today.getFullYear() - 1, today.getMonth(), 1));

      const [acc, bal, exp, inc, cat, r, rp] = await Promise.all([
        supabase.from("accounts").select("id,name,currency,balance").order("name"),
        supabase
          .from("account_balances")
          .select("account_id,balance,recorded_at")
          .gte("recorded_at", yearAgoISO)
          .order("recorded_at"),
        supabase
          .from("expenses")
          .select("id,description,category_id,amount,date,account_id")
          .gte("date", startISO)
          .lte("date", endISO),
        supabase
          .from("incomes")
          .select("id,description,amount,date,account_id")
          .gte("date", startISO)
          .lte("date", endISO),
        supabase.from("categories").select("id,name"),
        supabase.from("recurrings").select("id,name,amount,currency"),
        supabase
          .from("recurring_payments")
          .select("id,recurring_id,date,actual_amount,is_paid,account_id")
          .gte("date", startISO)
          .lte("date", endISO),
      ]);

      setAccounts(acc.data || []);
      setSnaps(bal.data || []);
      setExpenses(exp.data || []);
      setIncomes(inc.data || []); // si no existe tabla, queda []
      setCategories(cat.data || []);
      setRecurrings(r.data || []);
      setPayments(rp.data || []);
      setLoading(false);
    };
    load();
  }, [range.start, range.end]);

  // FX converter a moneda base
  const toBase = (amt: number, currency: Currency) => {
    if (baseCurrency === currency) return amt;
    if (currency === "CRC" && baseCurrency === "USD") return amt / fxRate;
    if (currency === "USD" && baseCurrency === "CRC") return amt * fxRate;
    return amt;
  };

  // Filtro por cuentas (si hay seleccionadas)
  const accountFilter = (accountId: string | null | undefined) =>
    selectedAccounts.length === 0 ||
    (accountId ? selectedAccounts.includes(accountId) : true);

  // ====== Método A: flujo usando transacciones ======
  const flowByPeriod_txn = useMemo(() => {
    const map = new Map<string, { inflow: number; outflow: number }>();
    const cursor = new Date(range.start);
    while (cursor <= range.end) {
      map.set(fmtPeriod(cursor, groupBy), { inflow: 0, outflow: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    for (const inc of incomes) {
      if (!accountFilter(inc.account_id)) continue;
      const d = new Date(inc.date);
      if (d < range.start || d > range.end) continue;
      const key = fmtPeriod(d, groupBy);
      const current = map.get(key);
      if (!current) continue;
      current.inflow += toBase(
        Number(inc.amount || 0),
        accounts.find((a) => a.id === inc.account_id)?.currency ?? baseCurrency
      );
    }

    for (const exp of expenses) {
      if (!accountFilter(exp.account_id)) continue;
      const d = new Date(exp.date);
      if (d < range.start || d > range.end) continue;
      const key = fmtPeriod(d, groupBy);
      const current = map.get(key);
      if (!current) continue;
      current.outflow += toBase(
        Number(exp.amount || 0),
        accounts.find((a) => a.id === exp.account_id)?.currency ?? baseCurrency
      );
    }

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([period, v]) => ({ period, ...v, net: v.inflow - v.outflow }));
  }, [
    incomes,
    expenses,
    groupBy,
    range.start,
    range.end,
    accounts,
    baseCurrency,
    fxRate,
    selectedAccounts,
  ]);

  // ====== Método B: flujo inferido por snapshots ======
  const flowByPeriod_snap = useMemo(() => {
    const map = new Map<string, { inflow: number; outflow: number }>();
    const cursor = new Date(range.start);
    while (cursor <= range.end) {
      map.set(fmtPeriod(cursor, groupBy), { inflow: 0, outflow: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    const byAcc: Record<string, BalanceSnap[]> = {};
    for (const s of snaps) {
      const d = new Date(s.recorded_at);
      if (d < range.start || d > range.end) continue;
      (byAcc[s.account_id] ||= []).push(s);
    }
    for (const arr of Object.values(byAcc)) {
      arr.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
      const acc = accounts.find((a) => a.id === arr[0]?.account_id);
      for (let i = 1; i < arr.length; i++) {
        const d = new Date(arr[i].recorded_at);
        const key = fmtPeriod(d, groupBy);
        const current = map.get(key);
        if (!current) continue;
        const delta = Number(arr[i].balance) - Number(arr[i - 1].balance);
        const valBase = toBase(Math.abs(delta), acc?.currency ?? baseCurrency);
        if (delta >= 0) current.inflow += valBase;
        else current.outflow += valBase;
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([period, v]) => ({ period, ...v, net: v.inflow - v.outflow }));
  }, [snaps, accounts, groupBy, range.start, range.end, baseCurrency, fxRate]);

  const useTxn = incomes.length > 0;
  const flow = useTxn ? flowByPeriod_txn : flowByPeriod_snap;

  // Cumulative net
  const cumulativeSeries = useMemo(() => {
    let cum = 0;
    return [
      {
        id: "Net",
        data: flow.map((p) => {
          cum += p.net;
          return { x: p.period, y: cum };
        }),
      },
    ];
  }, [flow]);

  // Top outflow categories
  const outflowByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      if (!accountFilter(e.account_id)) continue;
      const d = new Date(e.date);
      if (d < range.start || d > range.end) continue;
      const name = categories.find((c) => c.id === e.category_id)?.name ?? "Uncategorized";
      const cur = accounts.find((a) => a.id === e.account_id)?.currency ?? baseCurrency;
      map.set(name, (map.get(name) ?? 0) + toBase(Number(e.amount || 0), cur));
    }
    return Array.from(map.entries())
      .map(([id, value]) => ({ id, label: id, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [
    expenses,
    categories,
    accounts,
    range.start,
    range.end,
    baseCurrency,
    fxRate,
    selectedAccounts,
  ]);

  // By account bars
  const byAccountBars = useMemo(() => {
    const map = new Map<string, { Inflow: number; Outflow: number }>();
    for (const a of accounts) map.set(a.name, { Inflow: 0, Outflow: 0 });

    if (useTxn) {
      for (const inc of incomes) {
        if (!accountFilter(inc.account_id)) continue;
        const a = accounts.find((x) => x.id === inc.account_id);
        if (!a) continue;
        map.set(a.name, {
          ...(map.get(a.name) ?? { Inflow: 0, Outflow: 0 }),
          Inflow:
            (map.get(a.name)?.Inflow ?? 0) +
            toBase(Number(inc.amount || 0), a.currency),
        });
      }
      for (const exp of expenses) {
        if (!accountFilter(exp.account_id)) continue;
        const a = accounts.find((x) => x.id === exp.account_id);
        if (!a) continue;
        map.set(a.name, {
          ...(map.get(a.name) ?? { Inflow: 0, Outflow: 0 }),
          Outflow:
            (map.get(a.name)?.Outflow ?? 0) +
            toBase(Number(exp.amount || 0), a.currency),
        });
      }
    } else {
      const byAcc: Record<string, BalanceSnap[]> = {};
      for (const s of snaps) {
        const d = new Date(s.recorded_at);
        if (d < range.start || d > range.end) continue;
        (byAcc[s.account_id] ||= []).push(s);
      }
      for (const [accId, arr] of Object.entries(byAcc)) {
        const a = accounts.find((x) => x.id === accId);
        if (!a) continue;
        arr.sort((x, y) => x.recorded_at.localeCompare(y.recorded_at));
        let inflow = 0,
          outflow = 0;
        for (let i = 1; i < arr.length; i++) {
          const delta =
            Number(arr[i].balance) - Number(arr[i - 1].balance);
          const base = toBase(Math.abs(delta), a.currency);
          if (delta >= 0) inflow += base;
          else outflow += base;
        }
        map.set(a.name, { Inflow: inflow, Outflow: outflow });
      }
    }

    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort(
        (a, b) => b.Inflow + b.Outflow - (a.Inflow + a.Outflow)
      );
  }, [
    accounts,
    incomes,
    expenses,
    snaps,
    range.start,
    range.end,
    baseCurrency,
    fxRate,
    selectedAccounts,
    useTxn,
  ]);

  // Recurring vs Non-recurring split
  const recurringSplit = useMemo(() => {
    let rec = 0,
      nonrec = 0;
    const paidSet = new Set<string>();
    for (const rp of payments) {
      if (!rp.is_paid) continue;
      if (
        selectedAccounts.length > 0 &&
        rp.account_id &&
        !selectedAccounts.includes(rp.account_id)
      )
        continue;
      const d = new Date(rp.date);
      if (d < range.start || d > range.end) continue;
      const r = recurrings.find((x) => x.id === rp.recurring_id);
      if (!r) continue;
      const val = toBase(Number(rp.actual_amount ?? r.amount), r.currency);
      rec += val;
      paidSet.add(rp.id);
    }
    const totalExp = expenses.reduce((s, e) => {
      if (!accountFilter(e.account_id)) return s;
      const a = accounts.find((x) => x.id === e.account_id);
      return s + toBase(Number(e.amount || 0), a?.currency ?? baseCurrency);
    }, 0);
    nonrec = Math.max(0, totalExp - rec);
    return [
      { id: "Recurring", label: "Recurring", value: rec },
      { id: "Non-Recurring", label: "Non-Recurring", value: nonrec },
    ];
  }, [
    payments,
    recurrings,
    expenses,
    accounts,
    range.start,
    range.end,
    baseCurrency,
    fxRate,
    selectedAccounts,
  ]);

  // CSV export
  const exportCSV = () => {
    const rows = [
      "Period,Inflow,Outflow,Net",
      ...flow.map((p) => `${p.period},${p.inflow},${p.outflow},${p.net}`),
    ];
    const blob = new Blob([rows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cashflow_${flow[0]?.period ?? "range"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totals = useMemo(
    () =>
      flow.reduce(
        (s, p) => ({
          inflow: s.inflow + p.inflow,
          outflow: s.outflow + p.outflow,
          net: s.net + p.net,
        }),
        { inflow: 0, outflow: 0, net: 0 }
      ),
    [flow]
  );

  // ========== Render ==========
  return (
    <div className="mx-auto max-w-7xl p-6 sm:p-8 bg-inherit space-y-6">
      {/* Header + Filters */}
      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Cash Flow
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Inflow / Outflow, net y proyección.{" "}
              <span className="ml-2">Base: {baseCurrency}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-9 rounded-xl border border-white/30 bg-white/70 px-2 text-sm shadow-sm backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            >
              <option value="month">Month</option>
              <option value="week">Week</option>
              <option value="day">Day</option>
            </select>
            <div className="flex items-center gap-1">
              <input
                type="date"
                className="h-9 rounded-xl border border-white/30 bg-white/70 px-2 text-sm shadow-sm backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
                value={toISO(range.start)}
                onChange={(e) => setRange((r) => ({ ...r, start: new Date(e.target.value) }))}
              />
              <span className="text-zinc-400">–</span>
              <input
                type="date"
                className="h-9 rounded-xl border border-white/30 bg-white/70 px-2 text-sm shadow-sm backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
                value={toISO(range.end)}
                onChange={(e) => setRange((r) => ({ ...r, end: new Date(e.target.value) }))}
              />
            </div>
            <select
              className="h-9 rounded-xl border border-white/30 bg-white/70 px-2 text-sm shadow-sm backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value as Currency)}
            >
              <option value="USD">USD</option>
              <option value="CRC">CRC</option>
            </select>
            {baseCurrency === "USD" && (
              <input
                className="h-9 w-28 rounded-xl border border-white/30 bg-white/70 px-2 text-sm shadow-sm backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
                type="number"
                value={fxRate}
                onChange={(e) => setFxRate(Number(e.target.value))}
                title="CRC→USD"
              />
            )}
            <button
              className="h-9 rounded-xl border border-white/30 bg-white/70 px-3 text-sm shadow-sm backdrop-blur transition hover:bg-white dark:border-zinc-700/40 dark:bg-zinc-800/60"
              onClick={exportCSV}
            >
              Export CSV
            </button>
          </div>
        </div>
      </Card>

      {/* Account filter */}
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-zinc-600 dark:text-zinc-300">Accounts:</span>
          <button
            className={[
              "rounded-full border px-3 py-1 text-sm transition",
              "border-white/30 bg-white/70 shadow-sm backdrop-blur hover:bg-white",
              "dark:border-zinc-700/40 dark:bg-zinc-800/60 dark:text-zinc-200",
              selectedAccounts.length === 0 ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "",
            ].join(" ")}
            onClick={() => setSelectedAccounts([])}
          >
            All
          </button>
          {accounts.map((a) => {
            const active = selectedAccounts.includes(a.id);
            return (
              <button
                key={a.id}
                className={[
                  "rounded-full border px-3 py-1 text-sm transition",
                  "border-white/30 bg-white/70 shadow-sm backdrop-blur hover:bg-white",
                  "dark:border-zinc-700/40 dark:bg-zinc-800/60 dark:text-zinc-200",
                  active ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "",
                ].join(" ")}
                onClick={() =>
                  setSelectedAccounts((prev) =>
                    prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id]
                  )
                }
              >
                {a.name}
              </button>
            );
          })}
        </div>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Total Inflow
          </div>
          <div className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {(baseCurrency === "CRC" ? "₡" : "$")}
            {totals.inflow.toLocaleString()}
          </div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Total Outflow
          </div>
          <div className="text-2xl font-semibold tabular-nums text-rose-600">
            {(baseCurrency === "CRC" ? "₡" : "$")}
            {totals.outflow.toLocaleString()}
          </div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Net
          </div>
          <div
            className={[
              "text-2xl font-semibold tabular-nums",
              totals.net >= 0 ? "text-emerald-600" : "text-rose-600",
            ].join(" ")}
          >
            {totals.net >= 0 ? "+" : "-"}
            {(baseCurrency === "CRC" ? "₡" : "$")}
            {Math.abs(totals.net).toLocaleString()}
          </div>
        </Card>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Inflow vs Outflow by period */}
        <Card className="h-80 lg:col-span-2">
          <div className="mb-2 text-sm text-zinc-600 dark:text-zinc-300">Inflow vs Outflow</div>
          <div className="h-[90%]">
            <ResponsiveBar
              data={flow.map((p) => ({ name: p.period, Inflow: p.inflow, Outflow: p.outflow }))}
              theme={nivoTheme}
              keys={["Inflow", "Outflow"]}
              indexBy="name"
              margin={{ top: 20, right: 20, bottom: 40, left: 60 }}
              padding={0.3}
              groupMode="grouped"
              colors={({ id }) => (String(id) === "Inflow" ? "#22C55E" : "#EF4444")}
              axisBottom={{ tickRotation: groupBy === "day" ? -45 : 0 }}
              labelSkipWidth={24}
              labelSkipHeight={16}
              tooltip={({ value, id }) => (
                <div className="px-2 py-1 rounded-lg border border-black/5 bg-white/90 text-sm shadow">
                  <b>{String(id)}</b>: {(baseCurrency === "CRC" ? "₡" : "$")}
                  {Number(value).toLocaleString()}
                </div>
              )}
            />
          </div>
        </Card>

        {/* Top outflow categories */}
        <Card className="h-80">
          <div className="mb-2 text-sm text-zinc-600 dark:text-zinc-300">Top spending categories</div>
          <div className="h-[90%]">
            <ResponsivePie
              data={outflowByCategory}
              theme={nivoTheme}
              margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
              innerRadius={0.55}
              padAngle={1.2}
              cornerRadius={3}
              activeOuterRadiusOffset={8}
              colors={{ scheme: "category10" }}
              tooltip={({ datum }) => (
                <div className="px-2 py-1 rounded-lg border border-black/5 bg-white/90 text-sm shadow">
                  <b>{String(datum.id)}</b>: {(baseCurrency === "CRC" ? "₡" : "$")}
                  {Number(datum.value).toLocaleString()}
                </div>
              )}
            />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Cumulative net (runway) */}
        <Card className="h-80 lg:col-span-2">
          <div className="mb-2 text-sm text-zinc-600 dark:text-zinc-300">Cumulative net (runway)</div>
          <div className="h-[90%]">
            <ResponsiveLine
              data={cumulativeSeries}
              theme={nivoTheme}
              margin={{ top: 20, right: 20, bottom: 40, left: 60 }}
              xScale={{ type: "point" }}
              yScale={{ type: "linear", stacked: false }}
              axisBottom={{ tickRotation: groupBy === "day" ? -45 : 0 }}
              colors={["#6366F1"]}
              lineWidth={3}
              pointSize={6}
              enableArea
              areaOpacity={0.15}
              useMesh
              enableSlices="x"
              tooltip={({ point }) => (
                <div className="px-2 py-1 rounded-lg border border-black/5 bg-white/90 text-sm shadow">
                  <b>{String(point.data.xFormatted)}</b>: {(baseCurrency === "CRC" ? "₡" : "$")}
                  {Number(point.data.y).toLocaleString()}
                </div>
              )}
            />
          </div>
        </Card>

        {/* By account bar */}
        <Card className="h-80">
          <div className="mb-2 text-sm text-zinc-600 dark:text-zinc-300">Flow by account</div>
          <div className="h-[90%]">
            <ResponsiveBar
              data={byAccountBars}
              theme={nivoTheme}
              keys={["Inflow", "Outflow"]}
              indexBy="name"
              margin={{ top: 20, right: 20, bottom: 64, left: 60 }}
              padding={0.3}
              groupMode="grouped"
              colors={({ id }) => (String(id) === "Inflow" ? "#22C55E" : "#EF4444")}
              axisBottom={{ tickRotation: -30 }}
              labelSkipWidth={24}
              labelSkipHeight={16}
              tooltip={({ value, id, indexValue }) => (
                <div className="px-2 py-1 rounded-lg border border-black/5 bg-white/90 text-sm shadow">
                  <b>
                    {String(indexValue)} – {String(id)}
                  </b>
                  : {(baseCurrency === "CRC" ? "₡" : "$")}
                  {Number(value).toLocaleString()}
                </div>
              )}
            />
          </div>
        </Card>
      </div>

      {/* Recurring vs Non-recurring */}
      <Card className="h-80">
        <div className="mb-2 text-sm text-zinc-600 dark:text-zinc-300">
          Recurring vs Non-recurring (outflow)
        </div>
        <div className="h-[90%]">
          <ResponsivePie
            data={recurringSplit}
            theme={nivoTheme}
            margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
            innerRadius={0.5}
            padAngle={1}
            cornerRadius={2}
            activeOuterRadiusOffset={8}
            colors={["#0EA5E9", "#A3A3A3"]}
            tooltip={({ datum }) => (
              <div className="px-2 py-1 rounded-lg border border-black/5 bg-white/90 text-sm shadow">
                <b>{String(datum.id)}</b>: {(baseCurrency === "CRC" ? "₡" : "$")}
                {Number(datum.value).toLocaleString()}
              </div>
            )}
          />
        </div>
      </Card>

      {/* Period table */}
      <div
        className={[
          "overflow-x-auto rounded-2xl border shadow-xl",
          "border-white/30 bg-white/70 backdrop-blur-2xl",
          "dark:border-zinc-700/40 dark:bg-zinc-900/50",
        ].join(" ")}
      >
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="border-b border-white/30 px-3 py-3 text-left font-semibold text-zinc-600 dark:border-zinc-700/40 dark:text-zinc-300">
                Period
              </th>
              <th className="border-b border-white/30 px-3 py-3 text-right font-semibold text-zinc-600 dark:border-zinc-700/40 dark:text-zinc-300">
                Inflow
              </th>
              <th className="border-b border-white/30 px-3 py-3 text-right font-semibold text-zinc-600 dark:border-zinc-700/40 dark:text-zinc-300">
                Outflow
              </th>
              <th className="border-b border-white/30 px-3 py-3 text-right font-semibold text-zinc-600 dark:border-zinc-700/40 dark:text-zinc-300">
                Net
              </th>
            </tr>
          </thead>
          <tbody>
            {flow.map((row) => (
              <tr key={row.period} className="transition hover:bg-white/60 dark:hover:bg-zinc-800/40">
                <td className="border-b border-white/30 px-3 py-3 dark:border-zinc-700/40">
                  {row.period}
                </td>
                <td className="border-b border-white/30 px-3 py-3 text-right dark:border-zinc-700/40">
                  {(baseCurrency === "CRC" ? "₡" : "$")}
                  {row.inflow.toLocaleString()}
                </td>
                <td className="border-b border-white/30 px-3 py-3 text-right dark:border-zinc-700/40">
                  {(baseCurrency === "CRC" ? "₡" : "$")}
                  {row.outflow.toLocaleString()}
                </td>
                <td
                  className={[
                    "border-b border-white/30 px-3 py-3 text-right tabular-nums dark:border-zinc-700/40",
                    row.net < 0 ? "text-rose-600" : "text-emerald-600",
                  ].join(" ")}
                >
                  {row.net < 0 ? "-" : "+"}
                  {(baseCurrency === "CRC" ? "₡" : "$")}
                  {Math.abs(row.net).toLocaleString()}
                </td>
              </tr>
            ))}
            <tr className="bg-white/60 dark:bg-zinc-800/50">
              <td className="px-3 py-3 font-medium text-zinc-700 dark:text-zinc-200">Total</td>
              <td className="px-3 py-3 text-right font-semibold text-zinc-900 dark:text-zinc-100">
                {(baseCurrency === "CRC" ? "₡" : "$")}
                {totals.inflow.toLocaleString()}
              </td>
              <td className="px-3 py-3 text-right font-semibold text-zinc-900 dark:text-zinc-100">
                {(baseCurrency === "CRC" ? "₡" : "$")}
                {totals.outflow.toLocaleString()}
              </td>
              <td
                className={[
                  "px-3 py-3 text-right font-semibold",
                  totals.net < 0 ? "text-rose-600" : "text-emerald-600",
                ].join(" ")}
              >
                {totals.net < 0 ? "-" : "+"}
                {(baseCurrency === "CRC" ? "₡" : "$")}
                {Math.abs(totals.net).toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {loading && (
        <div className="text-zinc-500 dark:text-zinc-400">Loading…</div>
      )}
    </div>
  );
}
