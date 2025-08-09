"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

// --------- Tipos ---------
interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  institution?: string;
  color?: string;
  created_at: string;
  updated_at: string;
}
interface AccountBalance {
  account_id: string;
  balance: number;
  recorded_at: string; // yyyy-mm-dd
}
interface Expense {
  id: string;
  account_id: string;
  amount: number;
  date: string; // yyyy-mm-dd
}

// --------- Helpers UI ---------
function Card({
  className = "",
  children,
  onClick,
}: {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={[
        "rounded-2xl border p-4 shadow-xl transition",
        "border-white/30 bg-white/60 backdrop-blur-2xl",
        "dark:border-zinc-700/40 dark:bg-zinc-900/50",
        onClick ? "cursor-pointer hover:bg-white/70 dark:hover:bg-zinc-900/60" : "",
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
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DrawerShell({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={[
          "absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto p-6 shadow-2xl",
          "border-l border-white/30 bg-white/80 backdrop-blur-2xl",
          "dark:border-zinc-700/40 dark:bg-zinc-900/85",
        ].join(" ")}
      >
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// --------- Utils ---------
const toISO = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

// --------- Componente principal ---------
export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  // Create/Edit form
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("Checking");
  const [balance, setBalance] = useState<number | "">("");
  const [institution, setInstitution] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [color, setColor] = useState("#ffa500");

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");

  // Drawer detalle
  const [detailFor, setDetailFor] = useState<Account | null>(null);
  const [history, setHistory] = useState<AccountBalance[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Transfer
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferFrom, setTransferFrom] = useState<string>("");
  const [transferTo, setTransferTo] = useState<string>("");
  const [transferAmount, setTransferAmount] = useState<number | "">("");
  const [transferNote, setTransferNote] = useState<string>("");

  // ---- Data fetch ----
  useEffect(() => {
    const fetchAccounts = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("accounts")
        .select("*")
        .order("created_at", { ascending: false })
        .throwOnError();
      setAccounts(data || []);
      setLoading(false);
    };
    fetchAccounts();
  }, []);

  const refreshAccounts = async () => {
    const { data } = await supabase
      .from("accounts")
      .select("*")
      .order("created_at", { ascending: false })
      .throwOnError();
    setAccounts(data || []);
  };

  const addAccount = async () => {
    const { data: inserted, error } = await supabase
      .from("accounts")
      .insert([{ name, type, balance: Number(balance), institution, currency, color }])
      .select()
      .single();

    if (error || !inserted) {
      console.error("Insert error:", error);
      return;
    }

    await supabase.from("account_balances").insert([
      { account_id: inserted.id, balance: inserted.balance, recorded_at: toISO(new Date()) },
    ]);

    setShowModal(false);
    setName("");
    setType("Checking");
    setBalance("");
    setInstitution("");
    setCurrency("USD");
    setColor("#ffa500");

    refreshAccounts();
  };

  const updateAccountBalance = async (accountId: string, newBalance: number) => {
    const { error } = await supabase.from("accounts").update({ balance: newBalance }).eq("id", accountId);
    if (error) {
      console.error("Account update error:", error);
      return;
    }
    const { error: snapshotError } = await supabase
      .from("account_balances")
      .insert([{ account_id: accountId, balance: newBalance, recorded_at: toISO(new Date()) }]);
    if (snapshotError) console.error("Snapshot insert error:", snapshotError);
    refreshAccounts();
  };

  const startEdit = (acc: Account) => {
    setEditingId(acc.id);
    setEditingValue(acc.balance.toString());
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditingValue("");
  };
  const saveEdit = async (acc: Account) => {
    const val = Number(editingValue);
    if (isNaN(val)) return;
    await updateAccountBalance(acc.id, val);
    cancelEdit();
  };

  const openDetail = async (acc: Account) => {
    setDetailFor(acc);
    setDetailLoading(true);

    // last 30 days window
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 29);
    const startISO = toISO(start);
    const endISO = toISO(end);

    const [{ data: balances }, { data: expenses }] = await Promise.all([
      supabase
        .from("account_balances")
        .select("account_id, balance, recorded_at")
        .eq("account_id", acc.id)
        .gte("recorded_at", startISO)
        .lte("recorded_at", endISO)
        .order("recorded_at", { ascending: true })
        .throwOnError(),
      supabase
        .from("expenses")
        .select("id, account_id, amount, date")
        .eq("account_id", acc.id)
        .gte("date", startISO)
        .lte("date", endISO)
        .order("date", { ascending: false })
        .throwOnError(),
    ]);

    setHistory(balances || []);
    setRecentExpenses(expenses || []);
    setDetailLoading(false);
  };

  // ---- Derivados ----
  const detailMetrics = useMemo(() => {
    if (!detailFor || !history.length) return null;
    const startBal = history[0].balance;
    const endBal = history[history.length - 1].balance;

    let inflows = 0;
    for (let i = 1; i < history.length; i++) {
      const delta = Number(history[i].balance) - Number(history[i - 1].balance);
      if (delta > 0) inflows += delta;
    }
    const outflowsFromExpenses = recentExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

    return { startBal, endBal, inflows, outflowsFromExpenses };
  }, [detailFor, history, recentExpenses]);

  const chartData = useMemo(() => {
    if (!history.length) return [] as { date: string; balance: number }[];
    return history.map((h) => ({ date: h.recorded_at.slice(5), balance: Number(h.balance) }));
  }, [history]);

  // --------- Render ---------
  return (
    <div className="mx-auto max-w-7xl p-6 sm:p-8 bg-inherit">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">Accounts</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage balances, transfers, and view 30-day history.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTransfer(true)}
            className="rounded-xl border border-white/30 bg-white/70 px-4 py-2 text-sm shadow-sm backdrop-blur transition hover:bg-white dark:border-zinc-700/40 dark:bg-zinc-800/60 dark:text-zinc-200"
          >
            Quick Transfer
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-xl bg-gradient-to-tr from-blue-600 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
          >
            + Add Account
          </button>
        </div>
      </div>

      {/* Accounts grid */}
      {loading ? (
        <div className="text-zinc-500 dark:text-zinc-400">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Card
              key={account.id}
              onClick={() => openDetail(account)}
              className="group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {account.type}
                  </div>
                  <div className="mt-0.5 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {account.name}
                  </div>
                  {account.institution && (
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">
                      {account.institution}
                    </div>
                  )}
                </div>
                <div
                  className="h-8 w-8 rounded-full border border-white/30 shadow-sm"
                  style={{ background: account.color || "#fff" }}
                  aria-hidden
                />
              </div>

              <div className="mt-4">
                {editingId === account.id ? (
                  <div
                    className="flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      autoFocus
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(account);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="w-40 rounded-xl border border-white/30 bg-white/70 px-2 py-1 text-sm shadow-sm outline-none dark:border-zinc-700/40 dark:bg-zinc-800/60"
                    />
                    <button
                      className="rounded-xl border border-white/30 bg-white/70 px-3 py-1 text-sm shadow-sm dark:border-zinc-700/40 dark:bg-zinc-800/60"
                      onClick={() => saveEdit(account)}
                    >
                      Save
                    </button>
                    <button
                      className="rounded-xl border border-white/30 bg-white/70 px-3 py-1 text-sm shadow-sm dark:border-zinc-700/40 dark:bg-zinc-800/60"
                      onClick={cancelEdit}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-2">
                    <div className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                      {account.currency}{" "}
                      {account.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                    <button
                      className="text-sm text-blue-600 opacity-0 transition group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(account);
                      }}
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Account Modal */}
      {showModal && (
        <ModalShell title="Add Account" onClose={() => setShowModal(false)}>
          <div className="space-y-3">
            <input
              className="w-full rounded-xl border border-white/30 bg-white/70 p-2 shadow-sm outline-none dark:border-zinc-700/40 dark:bg-zinc-800/60"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <select
              className="w-full rounded-xl border border-white/30 bg-white/70 p-2 shadow-sm outline-none dark:border-zinc-700/40 dark:bg-zinc-800/60"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option>Checking</option>
              <option>Savings</option>
              <option>Credit Card</option>
              <option>Investment</option>
              <option>Loan</option>
            </select>
            <input
              className="w-full rounded-xl border border-white/30 bg-white/70 p-2 shadow-sm outline-none dark:border-zinc-700/40 dark:bg-zinc-800/60"
              type="number"
              placeholder="Balance"
              value={balance}
              onChange={(e) => setBalance(Number(e.target.value))}
            />
            <input
              className="w-full rounded-xl border border-white/30 bg-white/70 p-2 shadow-sm outline-none dark:border-zinc-700/40 dark:bg-zinc-800/60"
              placeholder="Institution (optional)"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
            />
            <input
              className="w-full rounded-xl border border-white/30 bg-white/70 p-2 shadow-sm outline-none dark:border-zinc-700/40 dark:bg-zinc-800/60"
              placeholder="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            />
            <div>
              <div className="mb-1 text-sm text-zinc-600 dark:text-zinc-300">Color</div>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-full cursor-pointer rounded"
              />
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
              onClick={addAccount}
              className="rounded-xl bg-gradient-to-tr from-blue-600 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
            >
              Add
            </button>
          </div>
        </ModalShell>
      )}

      {/* Detail Drawer */}
      <DrawerShell
        open={!!detailFor}
        onClose={() => setDetailFor(null)}
        title={detailFor ? `${detailFor.name}` : ""}
      >
        {detailLoading || !detailFor ? (
          <div className="text-zinc-500 dark:text-zinc-400">Loading…</div>
        ) : (
          <>
            {/* KPIs */}
            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Card className="p-3">
                <div className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Start (30d)</div>
                <div className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {detailFor.currency} {detailMetrics?.startBal.toLocaleString()}
                </div>
              </Card>
              <Card className="p-3">
                <div className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">End (Now)</div>
                <div className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {detailFor.currency} {detailMetrics?.endBal.toLocaleString()}
                </div>
              </Card>
              <Card className="p-3">
                <div className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Inflows (est.)</div>
                <div className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {detailFor.currency} {detailMetrics?.inflows.toLocaleString()}
                </div>
              </Card>
              <Card className="p-3">
                <div className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Outflows (expenses)</div>
                <div className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {detailFor.currency} {detailMetrics?.outflowsFromExpenses.toLocaleString()}
                </div>
              </Card>
            </div>

            {/* Chart */}
            <Card className="mb-6">
              <div className="mb-2 text-sm text-zinc-600 dark:text-zinc-300">Balance last 30 days</div>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ left: 6, right: 6, top: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="bal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366F1" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} width={70} />
                    <Tooltip
                    formatter={(value: string | number, name: string) =>
                      (typeof value === "number" ? value : Number(value) || 0).toLocaleString()
                    }
                  />
                    <Area type="monotone" dataKey="balance" stroke="#6366F1" fill="url(#bal)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Recent expenses */}
            <Card>
              <div className="mb-2 text-sm text-zinc-600 dark:text-zinc-300">Recent expenses (30 days)</div>
              {recentExpenses.length === 0 ? (
                <div className="text-sm text-zinc-500 dark:text-zinc-400">No expenses in this period.</div>
              ) : (
                <ul className="divide-y divide-white/30 dark:divide-zinc-700/40">
                  {recentExpenses.map((e) => (
                    <li key={e.id} className="flex items-center justify-between py-2">
                      <span className="text-sm text-zinc-800 dark:text-zinc-200">{e.date}</span>
                      <span className="text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
                        -{detailFor.currency} {(Number(e.amount) || 0).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </DrawerShell>

      {/* Quick Transfer Modal */}
      {showTransfer && (
        <ModalShell title="Quick Transfer" onClose={() => setShowTransfer(false)}>
          <div className="space-y-3">
            <select
              className="w-full rounded-xl border border-white/30 bg-white/70 p-2 shadow-sm outline-none dark:border-zinc-700/40 dark:bg-zinc-800/60"
              value={transferFrom}
              onChange={(e) => setTransferFrom(e.target.value)}
            >
              <option value="">From account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <select
              className="w-full rounded-xl border border-white/30 bg-white/70 p-2 shadow-sm outline-none dark:border-zinc-700/40 dark:bg-zinc-800/60"
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value)}
            >
              <option value="">To account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <input
              className="w-full rounded-xl border border-white/30 bg-white/70 p-2 shadow-sm outline-none dark:border-zinc-700/40 dark:bg-zinc-800/60"
              type="number"
              placeholder="Amount"
              value={transferAmount}
              onChange={(e) => setTransferAmount(Number(e.target.value))}
            />
            <input
              className="w-full rounded-xl border border-white/30 bg-white/70 p-2 shadow-sm outline-none dark:border-zinc-700/40 dark:bg-zinc-800/60"
              placeholder="Note (optional)"
              value={transferNote}
              onChange={(e) => setTransferNote(e.target.value)}
            />
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              className="rounded-xl border border-white/30 bg-white/70 px-4 py-2 text-sm shadow-sm dark:border-zinc-700/40 dark:bg-zinc-800/60"
              onClick={() => setShowTransfer(false)}
            >
              Cancel
            </button>
            <button
              className="rounded-xl bg-gradient-to-tr from-blue-600 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
              onClick={async () => {
                if (!transferFrom || !transferTo || !transferAmount || transferFrom === transferTo) return;
                const from = accounts.find((a) => a.id === transferFrom);
                const to = accounts.find((a) => a.id === transferTo);
                if (!from || !to) return;
                const amt = Number(transferAmount);
                await updateAccountBalance(from.id, (from.balance || 0) - amt);
                await updateAccountBalance(to.id, (to.balance || 0) + amt);
                setShowTransfer(false);
                setTransferFrom("");
                setTransferTo("");
                setTransferAmount("");
                setTransferNote("");
                refreshAccounts();
              }}
            >
              Transfer
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
