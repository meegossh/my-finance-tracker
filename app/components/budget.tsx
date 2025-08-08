"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { ResponsivePie } from "@nivo/pie";
import { ResponsiveBar } from "@nivo/bar";
import { ResponsiveLine } from "@nivo/line";

// ===== UI helpers (glass) =====
function Card({
  className = "",
  children,
}: { className?: string; children: React.ReactNode }) {
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

function ModalShell({
  title,
  onClose,
  children,
  className = "",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={[
          "relative mx-auto w-full max-w-md rounded-2xl p-6 shadow-2xl",
          "border border-white/30 bg-white/80 backdrop-blur-2xl",
          "dark:border-zinc-700/40 dark:bg-zinc-900/80",
          className,
        ].join(" ")}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ===== Types =====
type Currency = "USD" | "CRC";

interface Category { id: string; name: string }
interface Account { id: string; name: string; currency: Currency; balance: number }
interface Expense { id: string; category_id: string | null; amount: number; date: string; account_id: string }

interface BudgetItem {
  id: string;
  category_id: string | null;
  name: string;
  month: string; // yyyy-mm-01
  amount: number;
  currency: Currency;
  rollover_enabled: boolean;
  account_id: string | null;
  created_at: string;
}

interface Goal {
  id: string;
  name: string;
  target_amount: number;
  target_date: string;
  currency: Currency;
  account_id: string | null;
  category_id: string | null;
  monthly_contribution: number | null;
  autoplan: boolean;
  created_at: string;
}
interface GoalContribution {
  id: string;
  goal_id: string;
  amount: number;
  date: string;
  account_id: string | null;
  note: string | null;
}

// ===== Utils =====
const toISO = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
const startOfMonth = (y: number, m: number) => new Date(y, m, 1);
const endOfMonth = (y: number, m: number) => new Date(y, m + 1, 0);

const fmtMoney = (n: number, c: Currency) =>
  c === "CRC"
    ? `₡${n.toLocaleString()}`
    : `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const nivoTheme = {
  textColor: "#111827",
  fontSize: 12,
  grid: { line: { stroke: "#e5e7eb" } },
  axis: { ticks: { text: { fill: "#6b7280" } }, legend: { text: { fill: "#6b7280" } } },
  tooltip: {
    container: {
      background: "white",
      color: "#111827",
      fontSize: 12,
      borderRadius: 8,
      boxShadow: "0 4px 18px rgba(0,0,0,.1)",
    },
  },
} as const;

// ===== Component =====
export default function BudgetModule() {
  // Tabs
  const [tab, setTab] = useState<"budgets" | "goals">("budgets");

  // Month selector
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const monthStart = useMemo(() => startOfMonth(year, month), [year, month]);
  const monthEnd = useMemo(() => endOfMonth(year, month), [year, month]);
  const monthISO = useMemo(() => toISO(monthStart), [monthStart]);
  const monthLabel = new Date(year, month, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  // Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalContribs, setGoalContribs] = useState<GoalContribution[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [editing, setEditing] = useState<BudgetItem | null>(null);
  const [statusFilter, setStatusFilter] =
    useState<"all" | "ok" | "near" | "over">("all");

  const [showAddCategory, setShowAddCategory] = useState(false);

  // Budget form
  const [biName, setBiName] = useState("");
  const [biCategory, setBiCategory] = useState<string | "">("");
  const [biAmount, setBiAmount] = useState<number | "">("");
  const [biCurrency, setBiCurrency] = useState<Currency>("USD");
  const [biRollover, setBiRollover] = useState(true);
  const [biAccount, setBiAccount] = useState<string | "">("");

  // Category form
  const [catName, setCatName] = useState("");

  // Goals forms
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [gName, setGName] = useState("");
  const [gTarget, setGTarget] = useState<number | "">("");
  const [gDate, setGDate] = useState<string>(
    toISO(new Date(new Date().getFullYear(), new Date().getMonth() + 3, 1))
  );
  const [gCurrency, setGCurrency] = useState<Currency>("USD");
  const [gAccount, setGAccount] = useState<string | "">("");
  const [gCategory, setGCategory] = useState<string | "">("");
  const [gMonthly, setGMonthly] = useState<number | "">("");
  const [gAutoplan, setGAutoplan] = useState(false);

  const [showContribModal, setShowContribModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [cAmount, setCAmount] = useState<number | "">("");
  const [cDate, setCDate] = useState<string>(toISO(new Date()));
  const [cAccount, setCAccount] = useState<string | "">("");
  const [cNote, setCNote] = useState<string>("");

  // Load base data
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const startISO = toISO(monthStart);
      const endISO = toISO(monthEnd);
      const [cat, acc, exp, bud, g, gc] = await Promise.all([
        supabase.from("categories").select("id,name").order("name"),
        supabase
          .from("accounts")
          .select("id,name,currency,balance")
          .order("name"),
        supabase
          .from("expenses")
          .select("id,category_id,amount,date,account_id")
          .gte("date", startISO)
          .lte("date", endISO),
        supabase
          .from("budget_items")
          .select("*")
          .eq("month", monthISO)
          .order("created_at"),
        supabase.from("goals").select("*").order("created_at"),
        supabase.from("goal_contributions").select("*").order("date"),
      ]);
      setCategories(cat.data || []);
      setAccounts(acc.data || []);
      setExpenses(exp.data || []);
      setBudgetItems(bud.data || []);
      setGoals(g.data || []);
      setGoalContribs(gc.data || []);
      setLoading(false);
    };
    load();
  }, [monthISO, monthStart, monthEnd]);

  // ===== Derived: actual spend per category/account in month =====
  const actualByCategoryCurrency = useMemo(() => {
    const map = new Map<string, number>(); // key = `${category_id||name}|${currency}`
    for (const e of expenses) {
      const acc = accounts.find((a) => a.id === e.account_id);
      const currency: Currency = acc?.currency ?? "USD";
      const key = `${e.category_id || "uncat"}|${currency}`;
      map.set(key, (map.get(key) ?? 0) + Number(e.amount || 0));
    }
    return map;
  }, [expenses, accounts]);

  // Rollover placeholder
  const rolloverForItem = (bi: BudgetItem) => (bi.rollover_enabled ? 0 : 0);

  // Rows + status
  const rows = useMemo(() => {
    return budgetItems
      .map((bi) => {
        const key = `${bi.category_id || "uncat"}|${bi.currency}`;
        const actual = actualByCategoryCurrency.get(key) ?? 0;
        const rolloverIn = rolloverForItem(bi);
        const plannedTotal = Number(bi.amount || 0) + rolloverIn;
        const remaining = plannedTotal - actual;
        const pct =
          plannedTotal > 0
            ? Math.min(100, Math.max(0, (actual / plannedTotal) * 100))
            : 0;
        const status: "ok" | "near" | "over" =
          pct >= 100 ? "over" : pct >= 80 ? "near" : "ok";
        return { bi, actual, plannedTotal, remaining, pct, rolloverIn, status };
      })
      .sort((a, b) => (a.bi.name || "").localeCompare(b.bi.name || ""));
  }, [budgetItems, actualByCategoryCurrency]);

  const filteredRows = useMemo(
    () => rows.filter((r) => (statusFilter === "all" ? true : r.status === statusFilter)),
    [rows, statusFilter]
  );

  const totalPlanned = filteredRows.reduce((s, r) => s + r.plannedTotal, 0);
  const totalActual = filteredRows.reduce((s, r) => s + r.actual, 0);

  // ===== Charts =====
  const pieData = useMemo(
    () =>
      filteredRows.map((r) => ({
        id:
          r.bi.name ||
          (categories.find((c) => c.id === r.bi.category_id)?.name ??
            "Uncategorized"),
        label:
          r.bi.name ||
          (categories.find((c) => c.id === r.bi.category_id)?.name ??
            "Uncategorized"),
        value: r.actual,
      })),
    [filteredRows, categories]
  );

  const barData = useMemo(
    () =>
      filteredRows.map((r) => ({
        name:
          r.bi.name ||
          (categories.find((c) => c.id === r.bi.category_id)?.name ??
            "Uncategorized"),
        Budget: r.plannedTotal,
        Actual: r.actual,
      })),
    [filteredRows, categories]
  );

  // Trend last 6 months
  const [trendMonths, trendStartISO] = useMemo(() => {
    const months: string[] = [];
    const base = new Date(monthStart);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      months.push(toISO(d));
    }
    return [months, months[0]] as const;
  }, [monthStart]);

  const [trendData, setTrendData] = useState<{ x: string; y: number }[]>([]);
  useEffect(() => {
    const loadTrend = async () => {
      const start = trendStartISO;
      const end = toISO(endOfMonth(year, month));
      const { data } = await supabase
        .from("expenses")
        .select("amount,date")
        .gte("date", start)
        .lte("date", end);
      const byMonth = new Map<string, number>();
      for (const mISO of trendMonths) byMonth.set(mISO, 0);
      for (const e of data || []) {
        const d = new Date(e.date);
        const k = toISO(new Date(d.getFullYear(), d.getMonth(), 1));
        byMonth.set(k, (byMonth.get(k) ?? 0) + Number(e.amount || 0));
      }
      const points = Array.from(byMonth.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, v]) => ({ x: k.slice(0, 7), y: v }));
      setTrendData(points);
    };
    loadTrend();
  }, [trendMonths, trendStartISO, year, month]);

  // ===== CRUD: Budget lines =====
  const openCreate = () => {
    setEditing(null);
    setBiName("");
    setBiCategory("");
    setBiAmount("");
    setBiCurrency("USD");
    setBiRollover(true);
    setBiAccount("");
    setShowBudgetModal(true);
  };

  const openEdit = (bi: BudgetItem) => {
    setEditing(bi);
    setBiName(bi.name || "");
    setBiCategory(bi.category_id || "");
    setBiAmount(bi.amount);
    setBiCurrency(bi.currency);
    setBiRollover(!!bi.rollover_enabled);
    setBiAccount(bi.account_id || "");
    setShowBudgetModal(true);
  };

  const saveItem = async () => {
    const payload = {
      category_id: biCategory || null,
      name: biName || null,
      month: monthISO,
      amount: Number(biAmount || 0),
      currency: biCurrency,
      rollover_enabled: biRollover,
      account_id: biAccount || null,
    };
    if (editing) {
      const { error } = await supabase
        .from("budget_items")
        .update(payload)
        .eq("id", editing.id);
      if (error) return alert("Update failed: " + error.message);
    } else {
      const { error } = await supabase.from("budget_items").insert([payload]);
      if (error) return alert("Insert failed: " + error.message);
    }
    const { data } = await supabase
      .from("budget_items")
      .select("*")
      .eq("month", monthISO)
      .order("created_at");
    setBudgetItems(data || []);
    setShowBudgetModal(false);
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Delete this budget line?")) return;
    const { error } = await supabase.from("budget_items").delete().eq("id", id);
    if (error) return alert(error.message);
    setBudgetItems((prev) => prev.filter((b) => b.id !== id));
  };

  // ===== CRUD: Categories =====
  const addCategory = async () => {
    const name = catName.trim();
    if (!name) return alert("Nombre de categoría requerido");
    const { data, error } = await supabase
      .from("categories")
      .insert({ name })
      .select()
      .single();
    if (error) return alert(error.message);
    setCategories((prev) => [...prev, data]);
    setCatName("");
    setShowAddCategory(false);
  };

  // ===== Goals helpers / CRUD =====
  const goalSaved = (goalId: string) =>
    goalContribs
      .filter((c) => c.goal_id === goalId)
      .reduce((s, c) => s + Number(c.amount || 0), 0);

  const openCreateGoal = () => {
    setEditingGoal(null);
    setGName("");
    setGTarget("");
    setGDate(
      toISO(new Date(new Date().getFullYear(), new Date().getMonth() + 3, 1))
    );
    setGCurrency("USD");
    setGAccount("");
    setGCategory("");
    setGMonthly("");
    setGAutoplan(false);
    setShowGoalModal(true);
  };

  const saveGoal = async () => {
    const payload = {
      name: gName.trim(),
      target_amount: Number(gTarget || 0),
      target_date: gDate,
      currency: gCurrency,
      account_id: gAccount || null,
      category_id: gCategory || null,
      monthly_contribution: gMonthly === "" ? null : Number(gMonthly),
      autoplan: gAutoplan,
    };
    if (!payload.name || !payload.target_amount || !payload.target_date)
      return alert("Completa nombre, meta y fecha");

    if (editingGoal) {
      const { error } = await supabase
        .from("goals")
        .update(payload)
        .eq("id", editingGoal.id);
      if (error) return alert(error.message);
    } else {
      const { error } = await supabase.from("goals").insert([payload]);
      if (error) return alert(error.message);
    }
    const { data: g } = await supabase.from("goals").select("*").order("created_at");
    setGoals(g || []);
    setShowGoalModal(false);
  };

  const deleteGoal = async (id: string) => {
    if (!confirm("Delete this goal?")) return;
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (error) return alert(error.message);
    setGoals((prev) => prev.filter((x) => x.id !== id));
  };

  const openContrib = (goal: Goal) => {
    setSelectedGoal(goal);
    setCAmount("");
    setCDate(toISO(new Date()));
    setCAccount(goal.account_id || "");
    setCNote("");
    setShowContribModal(true);
  };

  const saveContrib = async () => {
    if (!selectedGoal) return;
    const payload = {
      goal_id: selectedGoal.id,
      amount: Number(cAmount || 0),
      date: cDate,
      account_id: cAccount || null,
      note: cNote || null,
    };
    if (!payload.amount) return alert("Monto requerido");
    const { error } = await supabase
      .from("goal_contributions")
      .insert([payload]);
    if (error) return alert(error.message);
    const { data: gc } = await supabase
      .from("goal_contributions")
      .select("*")
      .order("date");
    setGoalContribs(gc || []);
    setShowContribModal(false);
  };

  // ===== Render =====
  return (
    <div className="mx-auto max-w-7xl p-6 sm:p-8 space-y-6">
      {/* Header */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Budgets & Goals
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Planifica por categorías y ahorra para objetivos.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="h-9 px-3 rounded-lg border border-white/30 bg-white/70 shadow-sm hover:brightness-95 backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
              onClick={() => setMonth((m) => (m === 0 ? 11 : m - 1))}
            >
              ◀
            </button>
            <div className="min-w-[160px] rounded-lg border border-white/30 bg-white/70 px-3 py-2 text-center font-medium shadow-sm backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60">
              {monthLabel}
            </div>
            <button
              className="h-9 px-3 rounded-lg border border-white/30 bg-white/70 shadow-sm hover:brightness-95 backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
              onClick={() => setMonth((m) => (m === 11 ? 0 : m + 1))}
            >
              ▶
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setTab("budgets")}
            className={`px-4 py-2 rounded-xl border shadow-sm ${
              tab === "budgets"
                ? "bg-gradient-to-tr from-blue-600 to-fuchsia-500 text-white"
                : "border-white/30 bg-white/70 dark:border-zinc-700/40 dark:bg-zinc-800/60"
            }`}
          >
            Budgets
          </button>
          <button
            onClick={() => setTab("goals")}
            className={`px-4 py-2 rounded-xl border shadow-sm ${
              tab === "goals"
                ? "bg-gradient-to-tr from-blue-600 to-fuchsia-500 text-white"
                : "border-white/30 bg-white/70 dark:border-zinc-700/40 dark:bg-zinc-800/60"
            }`}
          >
            Goals
          </button>
        </div>
      </Card>

      {tab === "budgets" ? (
        <>
          {/* Filters & Actions */}
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-2 text-sm text-zinc-600 dark:text-zinc-300">
                Status:
              </span>
              <button
                className={`rounded-full border px-3 py-1 shadow-sm ${
                  statusFilter === "all"
                    ? "bg-zinc-900 text-white"
                    : "border-white/30 bg-white/70 dark:border-zinc-700/40 dark:bg-zinc-800/60"
                }`}
                onClick={() => setStatusFilter("all")}
              >
                All
              </button>
              <button
                className={`rounded-full border px-3 py-1 shadow-sm ${
                  statusFilter === "ok"
                    ? "bg-emerald-600 text-white"
                    : "border-white/30 bg-white/70 dark:border-zinc-700/40 dark:bg-zinc-800/60"
                }`}
                onClick={() => setStatusFilter("ok")}
              >
                On Track
              </button>
              <button
                className={`rounded-full border px-3 py-1 shadow-sm ${
                  statusFilter === "near"
                    ? "bg-amber-500 text-white"
                    : "border-white/30 bg-white/70 dark:border-zinc-700/40 dark:bg-zinc-800/60"
                }`}
                onClick={() => setStatusFilter("near")}
              >
                Near
              </button>
              <button
                className={`rounded-full border px-3 py-1 shadow-sm ${
                  statusFilter === "over"
                    ? "bg-rose-600 text-white"
                    : "border-white/30 bg-white/70 dark:border-zinc-700/40 dark:bg-zinc-800/60"
                }`}
                onClick={() => setStatusFilter("over")}
              >
                Over
              </button>

              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => setShowAddCategory(true)}
                  className="h-9 rounded-lg border border-white/30 bg-white/70 px-3 shadow-sm backdrop-blur hover:brightness-95 dark:border-zinc-700/40 dark:bg-zinc-800/60"
                >
                  + Add Category
                </button>
                <button
                  onClick={openCreate}
                  className="h-9 rounded-lg bg-gradient-to-tr from-blue-600 to-fuchsia-500 px-3 font-semibold text-white shadow-sm hover:brightness-110"
                >
                  + Add Budget
                </button>
              </div>
            </div>
          </Card>

          {/* Summary */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Card>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Total Budget
              </div>
              <div className="tabular-nums text-2xl font-semibold">
                {fmtMoney(totalPlanned, "USD")}
              </div>
            </Card>
            <Card>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Total Actual
              </div>
              <div className="tabular-nums text-2xl font-semibold text-rose-600">
                {fmtMoney(totalActual, "USD")}
              </div>
            </Card>
            <Card>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Remaining
              </div>
              <div
                className={`tabular-nums text-2xl font-semibold ${
                  totalPlanned - totalActual >= 0
                    ? "text-emerald-600"
                    : "text-rose-600"
                }`}
              >
                {fmtMoney(totalPlanned - totalActual, "USD")}
              </div>
            </Card>
            <Card>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Categories
              </div>
              <div className="tabular-nums text-2xl font-semibold">
                {filteredRows.length}
              </div>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="h-80">
              <div className="mb-2 text-sm text-zinc-600 dark:text-zinc-300">
                Spend distribution
              </div>
              <div className="h-[90%]">
                <ResponsivePie
                  data={pieData}
                  theme={nivoTheme}
                  margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                  innerRadius={0.55}
                  padAngle={1.2}
                  cornerRadius={3}
                  activeOuterRadiusOffset={8}
                  colors={{ scheme: "category10" }}
                  tooltip={({ datum }) => (
                    <div className="rounded bg-white px-2 py-1 text-sm shadow">
                      <b>{String(datum.id)}</b>: $
                      {Number(datum.value).toLocaleString()}
                    </div>
                  )}
                />
              </div>
            </Card>

            <Card className="h-80 lg:col-span-2">
              <div className="mb-2 text-sm text-zinc-600 dark:text-zinc-300">
                Budget vs Actual by category
              </div>
              <div className="h-[90%]">
                <ResponsiveBar
                  data={barData}
                  theme={nivoTheme}
                  keys={["Budget", "Actual"]}
                  indexBy="name"
                  margin={{ top: 20, right: 20, bottom: 64, left: 60 }}
                  padding={0.3}
                  groupMode="grouped"
                  colors={({ id }) =>
                    String(id) === "Actual" ? "#6366F1" : "#CBD5E1"
                  }
                  axisBottom={{ tickRotation: -30 }}
                  labelSkipWidth={24}
                  labelSkipHeight={16}
                  tooltip={({ value, id, indexValue }) => (
                    <div className="rounded bg-white px-2 py-1 text-sm shadow">
                      <b>
                        {String(indexValue)} – {String(id)}
                      </b>
                      : ${Number(value).toLocaleString()}
                    </div>
                  )}
                />
              </div>
            </Card>
          </div>

          {/* Trend */}
          <Card className="h-80">
            <div className="mb-2 text-sm text-zinc-600 dark:text-zinc-300">
              6-month spend trend
            </div>
            <div className="h-[90%]">
              <ResponsiveLine
                data={[{ id: "Spend", data: trendData }]}
                theme={nivoTheme}
                margin={{ top: 20, right: 20, bottom: 40, left: 60 }}
                xScale={{ type: "point" }}
                yScale={{ type: "linear", stacked: false }}
                axisBottom={{ tickRotation: -30 }}
                colors={["#14B8A6"]}
                lineWidth={3}
                pointSize={6}
                enableArea
                areaOpacity={0.15}
                useMesh
                enableSlices="x"
                tooltip={({ point }) => (
                  <div className="rounded bg-white px-2 py-1 text-sm shadow">
                    <b>{String(point.data.xFormatted)}</b>: $
                    {Number(point.data.y).toLocaleString()}
                  </div>
                )}
              />
            </div>
          </Card>

          {/* Table */}
          <Card className="overflow-x-auto p-0">
            <table className="min-w-full text-sm">
              <thead className="bg-white/60 dark:bg-zinc-900/40">
                <tr>
                  <th className="p-3 text-left">Category</th>
                  <th className="p-3 text-left">Account</th>
                  <th className="p-3 text-right">Budget</th>
                  <th className="p-3 text-right">Rollover in</th>
                  <th className="p-3 text-right">Actual</th>
                  <th className="p-3 text-right">Remaining</th>
                  <th className="p-3 text-center">Progress</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(
                  ({ bi, actual, plannedTotal, remaining, pct, rolloverIn, status }) => {
                    const label =
                      bi.name ||
                      categories.find((c) => c.id === bi.category_id)?.name ||
                      "Uncategorized";
                    const acc = accounts.find((a) => a.id === (bi.account_id || ""));
                    const progressColor =
                      status === "over"
                        ? "bg-rose-500"
                        : status === "near"
                        ? "bg-amber-500"
                        : "bg-emerald-500";
                    const statusBadge =
                      status === "over"
                        ? "text-rose-700 bg-rose-50 border-rose-200"
                        : status === "near"
                        ? "text-amber-700 bg-amber-50 border-amber-200"
                        : "text-emerald-700 bg-emerald-50 border-emerald-200";
                    const statusText =
                      status === "over"
                        ? "Over"
                        : status === "near"
                        ? "Near limit"
                        : "On track";
                    return (
                      <tr key={bi.id} className="hover:bg-white/50 dark:hover:bg-zinc-900/30">
                        <td className="border-t p-3 align-top">{label}</td>
                        <td className="border-t p-3 align-top">
                          {acc?.name || "All"}
                        </td>
                        <td className="border-t p-3 text-right align-top">
                          {fmtMoney(bi.amount, bi.currency)}
                        </td>
                        <td className="border-t p-3 text-right align-top">
                          {fmtMoney(rolloverIn, bi.currency)}
                        </td>
                        <td className="border-t p-3 text-right align-top">
                          {fmtMoney(actual, bi.currency)}
                        </td>
                        <td
                          className={`border-t p-3 text-right align-top ${
                            remaining < 0 ? "text-rose-600" : ""
                          }`}
                        >
                          {fmtMoney(remaining, bi.currency)}
                        </td>
                        <td className="border-t p-3 align-top">
                          <div className="h-2 w-40 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                            <div
                              className={`h-2 ${progressColor}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                            {pct.toFixed(0)}%
                          </div>
                        </td>
                        <td className="border-t p-3 align-top">
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-1 text-xs ${statusBadge}`}
                          >
                            {statusText}
                          </span>
                        </td>
                        <td className="border-t p-3 text-right align-top">
                          <button
                            className="mr-2 rounded border border-white/30 bg-white/70 px-2 py-1 shadow-sm dark:border-zinc-700/40 dark:bg-zinc-800/60"
                            onClick={() => openEdit(bi)}
                          >
                            Edit
                          </button>
                          <button
                            className="rounded border border-white/30 bg-white/70 px-2 py-1 shadow-sm dark:border-zinc-700/40 dark:bg-zinc-800/60"
                            onClick={() => deleteItem(bi.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </Card>
        </>
      ) : (
        // ===== GOALS TAB =====
        <>
          <div className="flex items-center gap-2">
            <button
              onClick={openCreateGoal}
              className="rounded-xl bg-gradient-to-tr from-blue-600 to-fuchsia-500 px-3 py-2 font-semibold text-white shadow-sm hover:brightness-110"
            >
              + Add Goal
            </button>
          </div>

          {/* Goals grid */}
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {goals.map((g) => {
              const saved = goalSaved(g.id);
              const remaining = Math.max(0, Number(g.target_amount) - saved);
              const pct = Math.min(
                100,
                Math.round((saved / (Number(g.target_amount) || 1)) * 100)
              );
              const now = new Date();
              const monthsLeft =
                (new Date(g.target_date).getFullYear() - now.getFullYear()) * 12 +
                (new Date(g.target_date).getMonth() - now.getMonth());
              const suggested = Math.ceil(
                remaining / Math.max(1, monthsLeft)
              );
              const risk =
                saved +
                  (Number(g.monthly_contribution ?? suggested) *
                    Math.max(1, monthsLeft)) <
                Number(g.target_amount);

              return (
                <Card key={g.id}>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {g.name}
                    </div>
                    <button
                      className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                      onClick={() => deleteGoal(g.id)}
                    >
                      Delete
                    </button>
                  </div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    Target: {fmtMoney(Number(g.target_amount), g.currency)} by{" "}
                    {g.target_date}
                  </div>
                  <div className="mt-2 text-sm">
                    Saved:{" "}
                    <b>{fmtMoney(saved, g.currency)}</b> ({pct}%)
                  </div>
                  <div className="mt-1 text-sm">
                    Remaining:{" "}
                    <b className={`${remaining > 0 ? "" : "text-emerald-600"}`}>
                      {fmtMoney(remaining, g.currency)}
                    </b>
                  </div>
                  <div className="mt-1 text-sm">
                    Suggested / month:{" "}
                    <b>
                      {fmtMoney(
                        g.monthly_contribution ?? suggested,
                        g.currency
                      )}
                    </b>
                  </div>
                  <div className="mt-2">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                      <div
                        className={`h-2 ${
                          risk ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                      {risk ? "At risk" : "On track"}
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      className="rounded border border-white/30 bg-white/70 px-3 py-1 shadow-sm dark:border-zinc-700/40 dark:bg-zinc-800/60"
                      onClick={() => {
                        setEditingGoal(g);
                        setGName(g.name);
                        setGTarget(g.target_amount);
                        setGDate(g.target_date);
                        setGCurrency(g.currency);
                        setGAccount(g.account_id || "");
                        setGCategory(g.category_id || "");
                        setGMonthly(g.monthly_contribution ?? "");
                        setGAutoplan(!!g.autoplan);
                        setShowGoalModal(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="rounded border border-white/30 bg-white/70 px-3 py-1 shadow-sm dark:border-zinc-700/40 dark:bg-zinc-800/60"
                      onClick={() => openContrib(g)}
                    >
                      Add contribution
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Goal history line (aggregated) */}
          <Card className="mt-6 h-80">
            <div className="mb-2 text-sm text-zinc-600 dark:text-zinc-300">
              Goal contributions (last 6 months)
            </div>
            <div className="h-[90%]">
              <ResponsiveLine
                data={[
                  {
                    id: "Contributions",
                    data: (() => {
                      const byMonth = new Map<string, number>();
                      const now = new Date();
                      for (let i = 5; i >= 0; i--) {
                        const d = new Date(
                          now.getFullYear(),
                          now.getMonth() - i,
                          1
                        );
                        byMonth.set(d.toISOString().slice(0, 7), 0);
                      }
                      for (const c of goalContribs) {
                        const d = new Date(c.date);
                        const k = `${d.getFullYear()}-${String(
                          d.getMonth() + 1
                        ).padStart(2, "0")}`;
                        if (byMonth.has(k))
                          byMonth.set(
                            k,
                            (byMonth.get(k) ?? 0) + Number(c.amount || 0)
                          );
                      }
                      return Array.from(byMonth.entries())
                        .sort((a, b) => a[0].localeCompare(b[0]))
                        .map(([x, y]) => ({ x, y }));
                    })(),
                  },
                ]}
                theme={nivoTheme}
                margin={{ top: 20, right: 20, bottom: 40, left: 60 }}
                xScale={{ type: "point" }}
                yScale={{ type: "linear", stacked: false }}
                axisBottom={{ tickRotation: -30 }}
                colors={["#0EA5E9"]}
                lineWidth={3}
                pointSize={6}
                enableArea
                areaOpacity={0.15}
                useMesh
                enableSlices="x"
                tooltip={({ point }) => (
                  <div className="rounded bg-white px-2 py-1 text-sm shadow">
                    <b>{String(point.data.xFormatted)}</b>: $
                    {Number(point.data.y).toLocaleString()}
                  </div>
                )}
              />
            </div>
          </Card>
        </>
      )}

      {/* Modal: Add/Edit Budget */}
      {showBudgetModal && (
        <ModalShell
          title={editing ? "Edit budget line" : "Add budget line"}
          onClose={() => setShowBudgetModal(false)}
        >
          <div className="space-y-3">
            <label className="block text-sm">Category</label>
            <select
              className="w-full rounded-xl border border-white/30 bg-white/70 p-2 shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
              value={biCategory}
              onChange={async (e) => {
                const v = e.target.value;
                if (v === "NEW_CATEGORY") {
                  setShowAddCategory(true);
                  return;
                }
                setBiCategory(v);
              }}
            >
              <option value="">— Custom label —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="NEW_CATEGORY">➕ Add new category</option>
            </select>

            <label className="block text-sm">Label (optional)</label>
            <input
              className="w-full rounded-xl border border-white/30 bg-white/70 p-2 shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
              placeholder="e.g., Groceries"
              value={biName}
              onChange={(e) => setBiName(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm">Amount</label>
                <input
                  className="w-full rounded-xl border border-white/30 bg-white/70 p-2 shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
                  type="number"
                  value={biAmount}
                  onChange={(e) => setBiAmount(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm">Currency</label>
                <select
                  className="w-full rounded-xl border border-white/30 bg-white/70 p-2 shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
                  value={biCurrency}
                  onChange={(e) => setBiCurrency(e.target.value as Currency)}
                >
                  <option value="USD">USD</option>
                  <option value="CRC">CRC</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm">Account (optional)</label>
                <select
                  className="w-full rounded-xl border border-white/30 bg-white/70 p-2 shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
                  value={biAccount}
                  onChange={(e) => setBiAccount(e.target.value)}
                >
                  <option value="">All</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="mt-6 flex items-center gap-2">
                <input
                  id="rollover"
                  type="checkbox"
                  checked={biRollover}
                  onChange={(e) => setBiRollover(e.target.checked)}
                />
                <span className="text-sm">Enable rollover</span>
              </label>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              className="rounded-xl border border-white/30 bg-white/70 px-4 py-2 text-sm shadow-sm dark:border-zinc-700/40 dark:bg-zinc-800/60"
              onClick={() => setShowBudgetModal(false)}
            >
              Cancel
            </button>
            <button
              className="rounded-xl bg-gradient-to-tr from-blue-600 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110"
              onClick={saveItem}
            >
              Save
            </button>
          </div>
        </ModalShell>
      )}

      {/* Modal: Add Category */}
      {showAddCategory && (
        <ModalShell title="Add category" onClose={() => setShowAddCategory(false)}>
          <input
            className="mb-3 w-full rounded-xl border border-white/30 bg-white/70 p-2 shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
            placeholder="Category name"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button
              className="rounded-xl border border-white/30 bg-white/70 px-4 py-2 text-sm shadow-sm dark:border-zinc-700/40 dark:bg-zinc-800/60"
              onClick={() => setShowAddCategory(false)}
            >
              Cancel
            </button>
            <button
              className="rounded-xl bg-gradient-to-tr from-blue-600 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110"
              onClick={addCategory}
            >
              Save
            </button>
          </div>
        </ModalShell>
      )}

      {/* Modal: Add/Edit Goal */}
      {showGoalModal && (
        <ModalShell
          title={editingGoal ? "Edit goal" : "Add goal"}
          onClose={() => setShowGoalModal(false)}
        >
          <div className="space-y-3">
            <input
              className="w-full rounded-xl border border-white/30 bg-white/70 p-2 shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
              placeholder="Goal name (e.g., Trip)"
              value={gName}
              onChange={(e) => setGName(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className="rounded-xl border border-white/30 bg-white/70 p-2 shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
                type="number"
                placeholder="Target amount"
                value={gTarget}
                onChange={(e) => setGTarget(Number(e.target.value))}
              />
              <input
                className="rounded-xl border border-white/30 bg-white/70 p-2 shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
                type="date"
                value={gDate}
                onChange={(e) => setGDate(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select
                className="rounded-xl border border-white/30 bg-white/70 p-2 shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
                value={gCurrency}
                onChange={(e) => setGCurrency(e.target.value as Currency)}
              >
                <option value="USD">USD</option>
                <option value="CRC">CRC</option>
              </select>
              <input
                className="rounded-xl border border-white/30 bg-white/70 p-2 shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
                type="number"
                placeholder="Monthly (optional)"
                value={gMonthly}
                onChange={(e) => setGMonthly(Number(e.target.value))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select
                className="rounded-xl border border-white/30 bg-white/70 p-2 shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
                value={gAccount}
                onChange={(e) => setGAccount(e.target.value)}
              >
                <option value="">Account (optional)</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-xl border border-white/30 bg-white/70 p-2 shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
                value={gCategory}
                onChange={(e) => setGCategory(e.target.value)}
              >
                <option value="">Category (optional)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={gAutoplan}
                onChange={(e) => setGAutoplan(e.target.checked)}
              />
              Enable autoplan (create monthly transfer)
            </label>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              className="rounded-xl border border-white/30 bg-white/70 px-4 py-2 text-sm shadow-sm dark:border-zinc-700/40 dark:bg-zinc-800/60"
              onClick={() => setShowGoalModal(false)}
            >
              Cancel
            </button>
            <button
              className="rounded-xl bg-gradient-to-tr from-blue-600 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110"
              onClick={saveGoal}
            >
              Save
            </button>
          </div>
        </ModalShell>
      )}

      {/* Modal: Add Contribution */}
      {showContribModal && selectedGoal && (
        <ModalShell
          title={`Add contribution – ${selectedGoal.name}`}
          onClose={() => setShowContribModal(false)}
        >
          <div className="space-y-3">
            <input
              className="w-full rounded-xl border border-white/30 bg-white/70 p-2 shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
              type="number"
              placeholder="Amount"
              value={cAmount}
              onChange={(e) => setCAmount(Number(e.target.value))}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className="rounded-xl border border-white/30 bg-white/70 p-2 shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
                type="date"
                value={cDate}
                onChange={(e) => setCDate(e.target.value)}
              />
              <select
                className="rounded-xl border border-white/30 bg-white/70 p-2 shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
                value={cAccount}
                onChange={(e) => setCAccount(e.target.value)}
              >
                <option value="">Account (optional)</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <input
              className="w-full rounded-xl border border-white/30 bg-white/70 p-2 shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
              placeholder="Note (optional)"
              value={cNote}
              onChange={(e) => setCNote(e.target.value)}
            />
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              className="rounded-xl border border-white/30 bg-white/70 px-4 py-2 text-sm shadow-sm dark:border-zinc-700/40 dark:bg-zinc-800/60"
              onClick={() => setShowContribModal(false)}
            >
              Cancel
            </button>
            <button
              className="rounded-xl bg-gradient-to-tr from-blue-600 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110"
              onClick={saveContrib}
            >
              Save
            </button>
          </div>
        </ModalShell>
      )}

      {loading && (
        <div className="text-zinc-500 dark:text-zinc-400">Loading…</div>
      )}
    </div>
  );
}
