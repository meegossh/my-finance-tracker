"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

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
interface Recurring {
  id: string;
  name: string;
  amount: number; // budgeted
  frequency: "Weekly" | "Semi-Monthly" | "Monthly" | "Yearly";
  start_date: string; // yyyy-mm-dd
  end_date: string | null;
  currency: "USD" | "CRC";
  created_at: string;
}

interface RecurringPayment {
  id: string;
  recurring_id: string;
  date: string; // yyyy-mm-dd
  actual_amount: number | null;
  notes: string | null;
  is_paid: boolean;
  account_id: string | null;
  created_at: string;
}

interface Account {
  id: string;
  name: string;
  balance: number;
  currency: "USD" | "CRC";
}

// Tipos auxiliares para selects
type StatusFilter = "all" | "pending" | "paid";
type Currency = "USD" | "CRC";

// ===== Helpers =====
const startOfMonth = (y: number, m: number) => new Date(y, m, 1);
const endOfMonth = (y: number, m: number) => new Date(y, m + 1, 0);
const toISO = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
const money = (n: number, c: "USD" | "CRC") =>
  c === "CRC"
    ? `₡${n.toLocaleString()}`
    : `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function RecurringPage() {
  // Month selector
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());

  // Data
  const [recurrings, setRecurrings] = useState<Recurring[]>([]);
  const [payments, setPayments] = useState<RecurringPayment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [accountFilter, setAccountFilter] = useState<string>("");

  // Modal (create recurring)
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [frequency, setFrequency] =
    useState<Recurring["frequency"]>("Monthly");
  const [startDate, setStartDate] = useState<string>(toISO(new Date()));
  const [endDate, setEndDate] = useState<string>("");
  const [currency, setCurrency] = useState<Currency>("USD");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ data: r }, { data: p }, { data: a }] = await Promise.all([
        supabase
          .from("recurrings")
          .select("*")
          .order("created_at", { ascending: true }),
        supabase
          .from("recurring_payments")
          .select("*")
          .order("date", { ascending: true }),
        supabase
          .from("accounts")
          .select("id, name, balance, currency")
          .order("name"),
      ]);
      setRecurrings(r || []);
      setPayments(p || []);
      setAccounts(a || []);
      setLoading(false);
    };
    load();
  }, []);

  // Month-scope
  const monthStart = useMemo(() => startOfMonth(year, month), [year, month]);
  const monthEnd = useMemo(() => endOfMonth(year, month), [year, month]);
  const monthLabel = new Date(year, month, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  // Join month instances with recurring meta
  const baseRows = useMemo(() => {
    const startISO = toISO(monthStart);
    const endISO = toISO(monthEnd);
    return payments
      .filter((p) => p.date >= startISO && p.date <= endISO)
      .map((p) => ({
        payment: p,
        recurring: recurrings.find((r) => r.id === p.recurring_id)!,
      }))
      .filter((x) => !!x.recurring);
  }, [payments, recurrings, monthStart, monthEnd]);

  const filteredRows = useMemo(() => {
    return baseRows
      .filter((row) =>
        statusFilter === "pending"
          ? !row.payment.is_paid
          : statusFilter === "paid"
          ? row.payment.is_paid
          : true
      )
      .filter((row) =>
        accountFilter ? row.payment.account_id === accountFilter : true
      )
      .sort((a, b) => a.payment.date.localeCompare(b.payment.date));
  }, [baseRows, statusFilter, accountFilter]);

  // Summary totals
  const totals = useMemo(() => {
    let budgetUSD = 0,
      actualUSD = 0,
      budgetCRC = 0,
      actualCRC = 0;
    for (const row of filteredRows) {
      const budget = row.recurring.amount;
      const actual = row.payment.actual_amount ?? budget;
      if (row.recurring.currency === "USD") {
        budgetUSD += budget;
        actualUSD += actual;
      } else {
        budgetCRC += budget;
        actualCRC += actual;
      }
    }
    return { budgetUSD, actualUSD, budgetCRC, actualCRC };
  }, [filteredRows]);

  // Calendar buckets (support N items same day)
  const firstDay = useMemo(() => new Date(year, month, 1), [year, month]);
  const daysInMonth = useMemo(
    () => new Date(year, month + 1, 0).getDate(),
    [year, month]
  );
  const startOffset = useMemo(() => firstDay.getDay(), [firstDay]); // 0=Sun
  const paymentsByDay = useMemo(() => {
    const map: Record<
      number,
      { payment: RecurringPayment; recurring: Recurring }[]
    > = {};
    for (const r of baseRows) {
      const d = new Date(r.payment.date);
      const day = d.getDate();
      if (!map[day]) map[day] = [];
      map[day].push(r);
    }
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => a.recurring.name.localeCompare(b.recurring.name))
    );
    return map;
  }, [baseRows, year, month]);

  // Create recurring + refresh
  const addRecurring = async () => {
    const sd = startDate || toISO(new Date());
    const { data: inserted, error } = await supabase
      .from("recurrings")
      .insert([
        {
          name,
          amount: Number(amount || 0),
          frequency,
          start_date: sd,
          end_date: endDate || null,
          currency,
        },
      ])
      .select()
      .single();

    if (error || !inserted) {
      console.error(error);
      return;
    }

    setShowModal(false);
    setName("");
    setAmount("");
    setFrequency("Monthly");
    setStartDate(toISO(new Date()));
    setEndDate("");
    setCurrency("USD");

    const [{ data: r }, { data: p }] = await Promise.all([
      supabase
        .from("recurrings")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase
        .from("recurring_payments")
        .select("*")
        .order("date", { ascending: true }),
    ]);
    setRecurrings(r || []);
    setPayments(p || []);
  };

  // Update actual amount per instance
  const updateActual = async (paymentId: string, nextVal: number) => {
    const { error } = await supabase
      .from("recurring_payments")
      .update({ actual_amount: nextVal })
      .eq("id", paymentId);
    if (!error)
      setPayments((prev) =>
        prev.map((p) => (p.id === paymentId ? { ...p, actual_amount: nextVal } : p))
      );
  };

  // Mark paid (deduct account, snapshot, optional expense, set flag)
  const markPaid = async (
    row: { payment: RecurringPayment; recurring: Recurring },
    accountId: string
  ) => {
    const acc = accounts.find((a) => a.id === accountId);
    if (!acc) return;

    const amt = Number(row.payment.actual_amount ?? row.recurring.amount);

    // Currency check
    if (acc.currency !== row.recurring.currency) {
      const proceed = confirm(
        `La cuenta (${acc.currency}) no coincide con la moneda del recurrente (${row.recurring.currency}). ¿Deseas continuar sin conversión?`
      );
      if (!proceed) return;
    }

    // Balance check
    if ((acc.balance || 0) < amt) {
      const proceed = confirm(
        `Saldo insuficiente en la cuenta "${acc.name}". Balance: ${money(
          acc.balance || 0,
          acc.currency
        )} – Cargo: ${money(amt, acc.currency)}. ¿Continuar de todas formas?`
      );
      if (!proceed) return;
    }

    // 1) Deduct from account
    const newBalance = (acc.balance || 0) - amt;
    const { error: upErr } = await supabase
      .from("accounts")
      .update({ balance: newBalance })
      .eq("id", acc.id);
    if (upErr) {
      console.error(upErr);
      return;
    }
    setAccounts((prev) =>
      prev.map((a) => (a.id === acc.id ? { ...a, balance: newBalance } : a))
    );

    // 2) Snapshot
    await supabase.from("account_balances").insert([
      { account_id: acc.id, balance: newBalance, recorded_at: toISO(new Date()) },
    ]);

    // 3) Optional: register expense
    try {
      await supabase.from("expenses").insert([
        {
          description: `Recurring: ${row.recurring.name}`,
          category_id: null,
          amount: amt,
          date: row.payment.date,
          account_id: acc.id,
          place: "Recurring",
        },
      ]);
    } catch {
      // ignore
    }

    // 4) Set paid flag + account used
    const { error: pe } = await supabase
      .from("recurring_payments")
      .update({ is_paid: true, account_id: acc.id })
      .eq("id", row.payment.id);
    if (!pe)
      setPayments((prev) =>
        prev.map((p) =>
          p.id === row.payment.id ? { ...p, is_paid: true, account_id: acc.id } : p
        )
      );
  };

  // ===== UI =====
  return (
    <div className="mx-auto max-w-7xl p-6 sm:p-8 bg-inherit space-y-6">
      {/* Header */}
      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Recurring Payments
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Vista mensual, calendario y lista. Budget vs Actual, estado y cuenta usada.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <button
                className="h-9 rounded-xl border border-white/30 bg-white/70 px-3 text-sm shadow-sm backdrop-blur transition hover:bg-white dark:border-zinc-700/40 dark:bg-zinc-800/60"
                onClick={() => setMonth((m) => (m === 0 ? 11 : m - 1))}
              >
                ◀
              </button>
              <div className="min-w-[180px] rounded-xl border border-white/30 bg-white/60 px-3 py-2 text-center font-medium shadow-sm backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60">
                {monthLabel}
              </div>
              <button
                className="h-9 rounded-xl border border-white/30 bg-white/70 px-3 text-sm shadow-sm backdrop-blur transition hover:bg-white dark:border-zinc-700/40 dark:bg-zinc-800/60"
                onClick={() => setMonth((m) => (m === 11 ? 0 : m + 1))}
              >
                ▶
              </button>
            </div>
            <button
              className="rounded-xl bg-gradient-to-tr from-blue-600 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
              onClick={() => setShowModal(true)}
            >
              + Add Recurring
            </button>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="h-9 rounded-xl border border-white/30 bg-white/70 px-3 text-sm shadow-sm backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
          </select>
          <select
            className="h-9 rounded-xl border border-white/30 bg-white/70 px-3 text-sm shadow-sm backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
          >
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Card>
          <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Budget USD
          </div>
          <div className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            ${totals.budgetUSD.toLocaleString()}
          </div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Actual USD
          </div>
          <div className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            ${totals.actualUSD.toLocaleString()}
          </div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Budget CRC
          </div>
          <div className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            ₡{totals.budgetCRC.toLocaleString()}
          </div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Actual CRC
          </div>
          <div className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            ₡{totals.actualCRC.toLocaleString()}
          </div>
        </Card>
      </div>

      {/* Calendar */}
      <Card>
        <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs font-medium text-zinc-600 dark:text-zinc-300">
          <div>Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div>Sat</div>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: startOffset }).map((_, i) => (
            <div
              key={`off-${i}`}
              className="h-28 rounded-xl border border-white/30 bg-white/40 backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/40"
            />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const items = paymentsByDay[day] || [];
            return (
              <div
                key={day}
                className={[
                  "h-28 rounded-xl border p-2 overflow-hidden",
                  "border-white/30 bg-white/60 backdrop-blur",
                  "dark:border-zinc-700/40 dark:bg-zinc-900/40",
                ].join(" ")}
              >
                <div className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {day}
                </div>
                <div className="h-[calc(100%-18px)] space-y-1 overflow-y-auto pr-1">
                  {items.length === 0 ? (
                    <div className="text-[11px] text-zinc-400">—</div>
                  ) : (
                    items.map(({ payment, recurring }) => {
                      const budget = recurring.amount;
                      const actual = payment.actual_amount ?? budget;
                      const variance = (actual - budget) || 0;
                      return (
                        <div
                          key={payment.id}
                          className={[
                            "flex items-center justify-between rounded-md px-2 py-1 text-[11px]",
                            "border border-white/30 bg-white/70 backdrop-blur",
                            "dark:border-zinc-700/40 dark:bg-zinc-800/60",
                          ].join(" ")}
                          title={recurring.name}
                        >
                          <span className="truncate">{recurring.name}</span>
                          <span
                            className={[
                              "tabular-nums",
                              variance > 0
                                ? "text-rose-600"
                                : variance < 0
                                ? "text-emerald-600"
                                : "",
                            ].join(" ")}
                          >
                            {recurring.currency === "USD" ? `$${actual}` : `₡${actual}`}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Table */}
      <div
        className={[
          "overflow-x-auto rounded-2xl border shadow-xl",
          "border-white/30 bg-white/70 backdrop-blur-2xl",
          "dark:border-zinc-700/40 dark:bg-zinc-900/50",
        ].join(" ")}
      >
        {loading ? (
          <div className="p-6 text-zinc-500 dark:text-zinc-400">Loading…</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-6 text-zinc-500 dark:text-zinc-400">
            No recurring instances para este mes con los filtros actuales.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="border-b border-white/30 px-3 py-3 text-left font-semibold text-zinc-600 dark:border-zinc-700/40 dark:text-zinc-300">
                  Date
                </th>
                <th className="border-b border-white/30 px-3 py-3 text-left font-semibold text-zinc-600 dark:border-zinc-700/40 dark:text-zinc-300">
                  Name
                </th>
                <th className="border-b border-white/30 px-3 py-3 text-center font-semibold text-zinc-600 dark:border-zinc-700/40 dark:text-zinc-300">
                  Freq
                </th>
                <th className="border-b border-white/30 px-3 py-3 text-right font-semibold text-zinc-600 dark:border-zinc-700/40 dark:text-zinc-300">
                  Budget
                </th>
                <th className="border-b border-white/30 px-3 py-3 text-right font-semibold text-zinc-600 dark:border-zinc-700/40 dark:text-zinc-300">
                  Actual
                </th>
                <th className="border-b border-white/30 px-3 py-3 text-right font-semibold text-zinc-600 dark:border-zinc-700/40 dark:text-zinc-300">
                  Variance
                </th>
                <th className="border-b border-white/30 px-3 py-3 text-left font-semibold text-zinc-600 dark:border-zinc-700/40 dark:text-zinc-300">
                  Pay with
                </th>
                <th className="border-b border-white/30 px-3 py-3 text-left font-semibold text-zinc-600 dark:border-zinc-700/40 dark:text-zinc-300">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const { payment, recurring } = row;
                const budget = recurring.amount;
                const actual = payment.actual_amount ?? budget;
                const variance = (actual - budget) || 0;
                return (
                  <tr
                    key={payment.id}
                    className="transition hover:bg-white/60 dark:hover:bg-zinc-800/40"
                  >
                    <td className="border-b border-white/30 px-3 py-3 align-top dark:border-zinc-700/40">
                      {payment.date}
                    </td>
                    <td className="border-b border-white/30 px-3 py-3 align-top dark:border-zinc-700/40">
                      {recurring.name}
                    </td>
                    <td className="border-b border-white/30 px-3 py-3 text-center align-top dark:border-zinc-700/40">
                      {recurring.frequency}
                    </td>
                    <td className="border-b border-white/30 px-3 py-3 text-right align-top dark:border-zinc-700/40">
                      {money(budget, recurring.currency)}
                    </td>
                    <td className="border-b border-white/30 px-3 py-3 text-right align-top dark:border-zinc-700/40">
                      <input
                        type="number"
                        className="w-28 rounded-lg border border-white/30 bg-white/70 px-2 py-1 text-right text-sm shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
                        defaultValue={actual}
                        onBlur={(e) => {
                          const v = parseFloat(e.currentTarget.value);
                          if (!isNaN(v) && v !== actual) updateActual(payment.id, v);
                        }}
                      />
                    </td>
                    <td
                      className={[
                        "border-b border-white/30 px-3 py-3 text-right align-top tabular-nums dark:border-zinc-700/40",
                        variance > 0
                          ? "text-rose-600"
                          : variance < 0
                          ? "text-emerald-600"
                          : "",
                      ].join(" ")}
                    >
                      {money(variance, recurring.currency)}
                    </td>
                    <td className="border-b border-white/30 px-3 py-3 align-top dark:border-zinc-700/40">
                      <select
                        className="rounded-lg border border-white/30 bg-white/70 px-2 py-1 text-sm shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
                        defaultValue={payment.account_id || ""}
                        id={`pay-${payment.id}`}
                      >
                        <option value="">Select account</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border-b border-white/30 px-3 py-3 align-top dark:border-zinc-700/40">
                      {payment.is_paid ? (
                        <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/30 dark:text-emerald-300">
                          Paid
                        </span>
                      ) : (
                        <button
                          className="rounded-xl border border-white/30 bg-white/70 px-3 py-1 text-sm shadow-sm transition hover:bg-white dark:border-zinc-700/40 dark:bg-zinc-800/60"
                          onClick={() => {
                            const sel = document.getElementById(
                              `pay-${payment.id}`
                            ) as HTMLSelectElement | null;
                            const accId = sel?.value || "";
                            if (!accId) {
                              alert("Selecciona una cuenta para pagar.");
                              return;
                            }
                            markPaid(row, accId);
                          }}
                        >
                          Mark paid
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add recurring modal */}
      {showModal && (
        <ModalShell title="Add Recurring Payment" onClose={() => setShowModal(false)}>
          <div className="space-y-3">
            <input
              className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
              placeholder="Name (e.g., Electricity)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className="rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
                type="number"
                placeholder="Budgeted amount"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
              <select
                className="rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
              >
                <option value="USD">USD ($)</option>
                <option value="CRC">CRC (₡)</option>
              </select>
            </div>
            <select
              className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as Recurring["frequency"])}
            >
              <option>Monthly</option>
              <option>Weekly</option>
              <option>Semi-Monthly</option>
              <option>Yearly</option>
            </select>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Start date
                </div>
                <input
                  className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <div className="mb-1 text-sm text-zinc-600 dark:text-zinc-400">
                  End date
                </div>
                <input
                  className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setShowModal(false)}
              className="rounded-xl border border-white/30 bg-white/70 px-4 py-2 text-sm shadow-sm dark:border-zinc-700/40 dark:bg-zinc-800/60"
            >
              Cancel
            </button>
            <button
              onClick={addRecurring}
              className="rounded-xl bg-gradient-to-tr from-blue-600 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
            >
              Save
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
