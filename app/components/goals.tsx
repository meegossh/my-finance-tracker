"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { ResponsiveLine } from "@nivo/line";
import { ResponsivePie } from "@nivo/pie";

// ===== UI helpers (glass) =====
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

interface Account { id: string; name: string; currency: Currency; balance: number }
interface Goal {
  id: string;
  name: string;
  target_amount: number;
  target_date: string; // yyyy-mm-dd
  currency: Currency;
  account_id: string | null;
  category_id: string | null;
  monthly_contribution: number | null;
  autoplan: boolean;
  created_at: string;
  closed_at?: string | null;
}
interface GoalContribution {
  id: string;
  goal_id: string;
  amount: number; // + deposit, - withdrawal
  date: string; // yyyy-mm-dd
  account_id: string | null;
  note: string | null;
}

// ===== Utils =====

const toISO = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
const monthsBetween = (from: Date, to: Date) => (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + (to.getDate() >= from.getDate() ? 0 : -1);
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const money = (n: number, c: Currency) => (c === "CRC" ? `₡${n.toLocaleString()}` : `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);

const nivoTheme = {
  textColor: "#111827",
  fontSize: 12,
  grid: { line: { stroke: "#e5e7eb" } },
  axis: { ticks: { text: { fill: "#6b7280" } }, legend: { text: { fill: "#6b7280" } } },
  tooltip: { container: { background: "white", color: "#111827", fontSize: 12, borderRadius: 8, boxShadow: "0 4px 18px rgba(0,0,0,.1)" } },
} as const;

// ===== Component =====
export default function GoalsModule() {
  const today = new Date();

  // Data
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [contribs, setContribs] = useState<GoalContribution[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"eta" | "progress" | "target" | "name">("eta");
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  // Goal form
  const [gName, setGName] = useState("");
  const [gTarget, setGTarget] = useState<number | "">("");
  const [gDate, setGDate] = useState<string>(toISO(addMonths(today, 6)));
  const [gCurrency, setGCurrency] = useState<Currency>("USD");
  const [gAccount, setGAccount] = useState<string | "">("");
  const [gMonthly, setGMonthly] = useState<number | "">("");
  const [gAutoplan, setGAutoplan] = useState(false);

  // Contribution modal
  const [showContribModal, setShowContribModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [amount, setAmount] = useState<number | "">("");
  const [date, setDate] = useState<string>(toISO(today));
  const [cAccount, setCAccount] = useState<string | "">("");
  const [note, setNote] = useState<string>("");

  // Load
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [acc, g, gc] = await Promise.all([
        supabase.from("accounts").select("id,name,currency,balance").order("name"),
        supabase.from("goals").select("*").order("created_at"),
        supabase.from("goal_contributions").select("*").order("date")
      ]);
      setAccounts(acc.data || []);
      setGoals(g.data || []);
      setContribs(gc.data || []);
      setLoading(false);
    };
    load();
  }, []);

  // Helpers
  const savedFor = (goalId: string) => contribs.filter(c => c.goal_id === goalId).reduce((s, c) => s + Number(c.amount || 0), 0);
  const monthlyAvgFor = (goalId: string, months = 3) => {
    const list = contribs.filter(c => c.goal_id === goalId).sort((a, b) => a.date.localeCompare(b.date));
    if (list.length === 0) return 0;
    const first = new Date(list[0].date);
    const last = new Date(list[list.length - 1].date);
    const m = Math.max(1, monthsBetween(first, last) + 1);
    const total = list.reduce((s, c) => s + Number(c.amount || 0), 0);
    return total / m;
  };

  // ===== Rebalance helper =====
  async function rebalanceGoalMonthly(g: Goal) {
    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const saved = contribs.filter(c => c.goal_id === g.id).reduce((s, c) => s + Number(c.amount || 0), 0);
    const remaining = Math.max(0, Number(g.target_amount) - saved);
    const monthsLeft = Math.max(1, monthsBetween(now, new Date(g.target_date)));

    const plannedMonthly = Number(g.monthly_contribution || 0);
    const avgMonthly = monthlyAvgFor(g.id, 3);
    const suggested = Math.ceil(remaining / monthsLeft);
    const baselineMonthly = plannedMonthly || Math.round(avgMonthly) || suggested;

    const contributedThisMonth = contribs
      .filter(c => c.goal_id === g.id && c.date.startsWith(thisMonthKey))
      .reduce((s, c) => s + Number(c.amount || 0), 0);

    const monthsLeftExclCurrent = Math.max(1, monthsBetween(nextMonthStart, new Date(g.target_date)) + 1);
    const delta = baselineMonthly - contributedThisMonth;
    let rebalanceAdj = 0;
    if (delta > 0) rebalanceAdj = Math.ceil(delta / monthsLeftExclCurrent);
    else if (delta < 0) rebalanceAdj = Math.floor(delta / monthsLeftExclCurrent);
    const newMonthly = Math.max(0, baselineMonthly + rebalanceAdj);

    const { error } = await supabase.from('goals').update({ monthly_contribution: newMonthly }).eq('id', g.id);
    if (!error) setGoals(prev => prev.map(x => x.id === g.id ? { ...x, monthly_contribution: newMonthly } : x));
  }

  // ===== Derived rows (cards) =====
  const rows = useMemo(() => {
    const thisMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    return goals.map(g => {
      const saved = savedFor(g.id);
      const remaining = Math.max(0, Number(g.target_amount) - saved);
      const monthsLeft = Math.max(1, monthsBetween(today, new Date(g.target_date)));

      const plannedMonthly = Number(g.monthly_contribution || 0);
      const avgMonthly = monthlyAvgFor(g.id, 3);
      const suggested = Math.ceil(remaining / monthsLeft);
      const baselineMonthly = plannedMonthly || Math.round(avgMonthly) || suggested;

      const contributedThisMonth = contribs
        .filter(c => c.goal_id === g.id && c.date.startsWith(thisMonthKey))
        .reduce((s, c) => s + Number(c.amount || 0), 0);

      const monthsLeftExclCurrent = Math.max(1, monthsBetween(nextMonthStart, new Date(g.target_date)) + 1);
      const delta = baselineMonthly - contributedThisMonth;
      let rebalanceAdj = 0;
      if (delta > 0) rebalanceAdj = Math.ceil(delta / monthsLeftExclCurrent);
      else if (delta < 0) rebalanceAdj = Math.floor(delta / monthsLeftExclCurrent);
      const rebalancedNextMonthly = Math.max(0, baselineMonthly + rebalanceAdj);

      const projectedAtTarget = saved + rebalancedNextMonthly * monthsLeftExclCurrent;
      const onTrack = projectedAtTarget >= Number(g.target_amount);

      const progressPct = clamp(Math.round((saved / (Number(g.target_amount) || 1)) * 100), 0, 100);
      const etaMonths = remaining <= 0 ? 0 : Math.ceil(remaining / Math.max(1, rebalancedNextMonthly));
      const etaDate = toISO(addMonths(today, etaMonths));

      const streak = (() => {
        let s = 0; const firstOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        for (let i = 0; i < 12; i++) {
          const d = new Date(firstOfThisMonth.getFullYear(), firstOfThisMonth.getMonth() - i, 1);
          const yyyymm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const has = contribs.some(c => c.goal_id === g.id && c.date.startsWith(yyyymm));
          if (has) s++; else break;
        }
        return s;
      })();

      return { g, saved, remaining, monthsLeft, plannedMonthly, avgMonthly, suggested, baselineMonthly, contributedThisMonth, rebalancedNextMonthly, onTrack, progressPct, etaMonths, etaDate, streak };
    }).filter(r => !r.g.closed_at && (r.g.name.toLowerCase().includes(search.toLowerCase())));
  }, [goals, contribs, search]);

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    switch (sort) {
      case "progress": copy.sort((a, b) => b.progressPct - a.progressPct); break;
      case "target": copy.sort((a, b) => Number(a.g.target_amount) - Number(b.g.target_amount)); break;
      case "name": copy.sort((a, b) => a.g.name.localeCompare(b.g.name)); break;
      default: copy.sort((a, b) => a.etaMonths - b.etaMonths); // eta
    }
    return copy;
  }, [rows, sort]);

  // ===== Charts =====
  const donutData = useMemo(() => {
    const totalTarget = sortedRows.reduce((s, r) => s + Number(r.g.target_amount || 0), 0);
    const totalSaved = sortedRows.reduce((s, r) => s + r.saved, 0);
    return [
      { id: "Saved", label: "Saved", value: totalSaved },
      { id: "Remaining", label: "Remaining", value: Math.max(0, totalTarget - totalSaved) },
    ];
  }, [sortedRows]);

  const contributionSeries = useMemo(() => {
    const points: { [k: string]: number } = {};
    const base = new Date(today.getFullYear(), today.getMonth(), 1);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      points[key] = 0;
    }
    for (const c of contribs) {
      const d = new Date(c.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (key in points) points[key] += Number(c.amount || 0);
    }
    return [{ id: "Contributions", data: Object.entries(points).sort((a, b) => a[0].localeCompare(b[0])).map(([x, y]) => ({ x, y })) }];
  }, [contribs]);

  // ===== CRUD =====
  const openCreate = () => {
    setEditingGoal(null);
    setGName("");
    setGTarget("");
    setGDate(toISO(addMonths(today, 6)));
    setGCurrency("USD");
    setGAccount("");
    setGMonthly("");
    setGAutoplan(false);
    setShowGoalModal(true);
  };

  const openEdit = (g: Goal) => {
    setEditingGoal(g);
    setGName(g.name);
    setGTarget(g.target_amount);
    setGDate(g.target_date);
    setGCurrency(g.currency);
    setGAccount(g.account_id || "");
    setGMonthly(g.monthly_contribution ?? "");
    setGAutoplan(!!g.autoplan);
    setShowGoalModal(true);
  };

  const saveGoal = async () => {
    const payload = {
      name: gName.trim(),
      target_amount: Number(gTarget || 0),
      target_date: gDate,
      currency: gCurrency,
      account_id: gAccount || null,
      category_id: null,
      monthly_contribution: gMonthly === "" ? null : Number(gMonthly),
      autoplan: gAutoplan,
    };
    if (!payload.name || !payload.target_amount || !payload.target_date) return alert("Completa nombre, meta y fecha");
    if (editingGoal) {
      const { error } = await supabase.from("goals").update(payload).eq("id", editingGoal.id);
      if (error) return alert(error.message);
    } else {
      const { error } = await supabase.from("goals").insert([payload]);
      if (error) return alert(error.message);
    }
    const { data } = await supabase.from("goals").select("*").order("created_at");
    setGoals(data || []);
    setShowGoalModal(false);
  };

  const closeGoal = async (id: string) => {
    const { error } = await supabase.from("goals").update({ closed_at: toISO(new Date()) }).eq("id", id);
    if (error) return alert(error.message);
    setGoals(prev => prev.map(g => g.id === id ? { ...g, closed_at: toISO(new Date()) } : g));
  };

  const openContrib = (g: Goal, sign: 1 | -1 = 1) => {
    setSelectedGoal(g);
    setAmount("");
    setDate(toISO(new Date()));
    setCAccount(g.account_id || "");
    setNote(sign === 1 ? "" : "Withdrawal");
    setShowContribModal(true);
  };

  const saveContrib = async (sign: 1 | -1 = 1) => {
    if (!selectedGoal) return;
    const payload = {
      goal_id: selectedGoal.id,
      amount: Number(amount || 0) * sign,
      date,
      account_id: cAccount || null,
      note: note || null,
    };
    if (!payload.amount) return alert("Monto requerido");
    const { error } = await supabase.from("goal_contributions").insert([payload]);
    if (error) return alert(error.message);
    const { data } = await supabase.from("goal_contributions").select("*").order("date");
    setContribs(data || []);

    if (sign === 1) {
      const g = goals.find(x => x.id === selectedGoal.id);
      if (g) await rebalanceGoalMonthly(g);
    }

    setShowContribModal(false);
  };

  // ===== Render =====
  return (
    <div className="mx-auto max-w-7xl p-6 sm:p-8 bg-inherit space-y-6">
      {/* Header */}
      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Goals
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Viajes, vacaciones, compras grandes… planifica y sigue tu progreso.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="h-9 rounded-xl border border-white/30 bg-white/70 px-3 text-sm shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
              placeholder="Search goals…"
              value={search}
              onChange={(e)=> setSearch(e.target.value)}
            />
            <select
              className="h-9 rounded-xl border border-white/30 bg-white/70 px-2 text-sm shadow-sm backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
              value={sort}
              onChange={(e)=> setSort(e.target.value as any)}
            >
              <option value="eta">ETA</option>
              <option value="progress">Progress</option>
              <option value="target">Target</option>
              <option value="name">Name</option>
            </select>
            <button
              onClick={openCreate}
              className="rounded-xl bg-gradient-to-tr from-blue-600 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
            >
              + Add Goal
            </button>
          </div>
        </div>
      </Card>

      {/* Overview charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="h-80">
          <div className="mb-2 text-sm text-zinc-600 dark:text-zinc-300">All goals – Saved vs Remaining</div>
          <div className="h-[90%]">
            <ResponsivePie
              data={donutData}
              theme={nivoTheme}
              margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
              innerRadius={0.6}
              padAngle={1.2}
              cornerRadius={3}
              activeOuterRadiusOffset={8}
              colors={["#22C55E", "#E5E7EB"]}
              tooltip={({ datum }) => (
                <div className="rounded bg-white px-2 py-1 text-sm shadow">
                  <b>{String(datum.id)}</b>: ${Number(datum.value).toLocaleString()}
                </div>
              )}
            />
          </div>
        </Card>

        <Card className="h-80 lg:col-span-2">
          <div className="mb-2 text-sm text-zinc-600 dark:text-zinc-300">Contributions (last 6 months)</div>
          <div className="h-[90%]">
            <ResponsiveLine
              data={contributionSeries}
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
                  <b>{String(point.data.xFormatted)}</b>: ${Number(point.data.y).toLocaleString()}
                </div>
              )}
            />
          </div>
        </Card>
      </div>

      {/* Goals grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sortedRows.map(({ g, saved, remaining, monthsLeft, plannedMonthly, avgMonthly, suggested, baselineMonthly, contributedThisMonth, rebalancedNextMonthly, onTrack, progressPct, etaMonths, etaDate, streak }) => (
          <Card key={g.id}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">{g.name}</div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  Target {money(Number(g.target_amount), g.currency)} by {g.target_date}
                </div>
              </div>
              <div className={`text-xs px-2 py-1 rounded-md border ${onTrack?"text-emerald-700 bg-emerald-50 border-emerald-200":"text-amber-700 bg-amber-50 border-amber-200"}`}>
                {onTrack ? "On track" : "At risk"}
              </div>
            </div>

            <div className="mt-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className={`h-2 ${onTrack ? "bg-emerald-500" : "bg-amber-500"}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                {progressPct}% • Saved {money(saved, g.currency)} • Remaining {money(remaining, g.currency)}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-zinc-500 dark:text-zinc-400">Months left</div>
                <div className="font-medium text-zinc-900 dark:text-zinc-100">{monthsLeft}</div>
              </div>
              <div>
                <div className="text-zinc-500 dark:text-zinc-400">ETA</div>
                <div className="font-medium text-zinc-900 dark:text-zinc-100">{etaMonths===0?"Achieved":etaDate}</div>
              </div>
              <div>
                <div className="text-zinc-500 dark:text-zinc-400">Monthly plan</div>
                <input
                  className="w-28 rounded-lg border border-white/30 bg-white/70 px-2 py-1 text-sm shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
                  type="number"
                  value={plannedMonthly || ""}
                  placeholder="$/mo"
                  onChange={(e)=>{
                    const v = Number(e.target.value);
                    setGoals(prev => prev.map(x => x.id===g.id ? { ...x, monthly_contribution: (isNaN(v) ? null as any : v) } : x));
                  }}
                  onBlur={async (e)=>{
                    const v = Number(e.currentTarget.value || 0);
                    const { error } = await supabase.from('goals').update({ monthly_contribution: v || null }).eq('id', g.id);
                    if (error) alert(error.message);
                  }}
                />
              </div>
              <div>
                <div className="text-zinc-500 dark:text-zinc-400">Contributed this month</div>
                <div className="font-medium text-zinc-900 dark:text-zinc-100">{money(contributedThisMonth, g.currency)}</div>
              </div>
              <div>
                <div className="text-zinc-500 dark:text-zinc-400">Suggested $/mo</div>
                <div className="font-medium text-zinc-900 dark:text-zinc-100">{money(suggested, g.currency)}</div>
              </div>
              <div>
                <div className="text-zinc-500 dark:text-zinc-400">Rebalanced next months</div>
                <div className="font-medium text-zinc-900 dark:text-zinc-100">{money(rebalancedNextMonthly, g.currency)}</div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button className="rounded-xl border border-white/30 bg-white/70 px-3 py-1 text-sm shadow-sm dark:border-zinc-700/40 dark:bg-zinc-800/60" onClick={()=> openEdit(g)}>Edit</button>
              <button className="rounded-xl border border-white/30 bg-white/70 px-3 py-1 text-sm shadow-sm dark:border-zinc-700/40 dark:bg-zinc-800/60" onClick={()=> openContrib(g, +1)}>Add deposit</button>
              <button className="rounded-xl border border-white/30 bg-white/70 px-3 py-1 text-sm shadow-sm dark:border-zinc-700/40 dark:bg-zinc-800/60" onClick={()=> openContrib(g, -1)}>Withdraw</button>
              <button className="rounded-xl border border-white/30 bg-white/70 px-3 py-1 text-sm shadow-sm dark:border-zinc-700/40 dark:bg-zinc-800/60" onClick={()=> closeGoal(g.id)}>Close</button>
              <button
                className="rounded-xl bg-gradient-to-tr from-blue-600 to-fuchsia-500 px-3 py-1 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
                title="Persist rebalanced value as new monthly plan"
                onClick={async ()=>{
                  const { error } = await supabase.from('goals').update({ monthly_contribution: rebalancedNextMonthly }).eq('id', g.id);
                  if (!error) setGoals(prev => prev.map(x => x.id===g.id ? { ...x, monthly_contribution: rebalancedNextMonthly } : x));
                  else alert(error.message);
                }}
              >
                Apply rebalance
              </button>
            </div>
          </Card>
        ))}
      </div>

      {/* Modal: Create/Edit Goal */}
      {showGoalModal && (
        <ModalShell title={editingGoal ? "Edit goal" : "Add goal"} onClose={() => setShowGoalModal(false)}>
          <div className="space-y-3">
            <input
              className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
              placeholder="Goal name (e.g., Trip to Europe)"
              value={gName}
              onChange={(e)=> setGName(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className="rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
                type="number"
                placeholder="Target amount"
                value={gTarget}
                onChange={(e)=> setGTarget(Number(e.target.value))}
              />
              <input
                className="rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
                type="date"
                value={gDate}
                onChange={(e)=> setGDate(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select
                className="rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
                value={gCurrency}
                onChange={(e)=> setGCurrency(e.target.value as Currency)}
              >
                <option value="USD">USD</option>
                <option value="CRC">CRC</option>
              </select>
              <input
                className="rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
                type="number"
                placeholder="Monthly (optional)"
                value={gMonthly}
                onChange={(e)=> setGMonthly(Number(e.target.value))}
              />
            </div>
            <select
              className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
              value={gAccount}
              onChange={(e)=> setGAccount(e.target.value)}
            >
              <option value="">Account (optional)</option>
              {accounts.map(a=> <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" checked={gAutoplan} onChange={(e)=> setGAutoplan(e.target.checked)} />
              Enable autoplan (create monthly transfer)
            </label>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              className="rounded-xl border border-white/30 bg-white/70 px-4 py-2 text-sm shadow-sm dark:border-zinc-700/40 dark:bg-zinc-800/60"
              onClick={()=> setShowGoalModal(false)}
            >
              Cancel
            </button>
            <button
              className="rounded-xl bg-gradient-to-tr from-blue-600 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
              onClick={saveGoal}
            >
              Save
            </button>
          </div>
        </ModalShell>
      )}

      {/* Modal: Contribution (deposit/withdraw) */}
      {showContribModal && selectedGoal && (
        <ModalShell title={`${selectedGoal.name}: Add movement`} onClose={() => setShowContribModal(false)}>
          <div className="space-y-3">
            <input
              className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
              type="number"
              placeholder="Amount (+ deposit, - withdraw)"
              value={amount}
              onChange={(e)=> setAmount(Number(e.target.value))}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className="rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
                type="date"
                value={date}
                onChange={(e)=> setDate(e.target.value)}
              />
              <select
                className="rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
                value={cAccount}
                onChange={(e)=> setCAccount(e.target.value)}
              >
                <option value="">Account (optional)</option>
                {accounts.map(a=> <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <input
              className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
              placeholder="Note (optional)"
              value={note}
              onChange={(e)=> setNote(e.target.value)}
            />
          </div>
          <div className="mt-5 flex justify-between gap-2">
            <button
              className="rounded-xl border border-white/30 bg-white/70 px-4 py-2 text-sm shadow-sm dark:border-zinc-700/40 dark:bg-zinc-800/60"
              onClick={()=> saveContrib(-1)}
            >
              Withdraw
            </button>
            <div className="flex gap-2">
              <button
                className="rounded-xl border border-white/30 bg-white/70 px-4 py-2 text-sm shadow-sm dark:border-zinc-700/40 dark:bg-zinc-800/60"
                onClick={()=> setShowContribModal(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-xl bg-gradient-to-tr from-blue-600 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
                onClick={()=> saveContrib(+1)}
              >
                Deposit
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {loading && <div className="text-zinc-500 dark:text-zinc-400">Loading…</div>}
    </div>
  );
}
