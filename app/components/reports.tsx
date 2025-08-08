"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  LineChart as RLineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// ===== UI helpers (glass) =====
function Card({
  className = "",
  children,
}: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={[
        "rounded-3xl border p-4 shadow-xl sm:p-6",
        "border-white/30 bg-white/60 backdrop-blur-2xl",
        "dark:border-zinc-700/40 dark:bg-zinc-900/50",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

// ===== Types =====
type BalanceItem = { date: string; total: number };
type TxBase = {
  id: string;
  amount: number;
  date: string; // DATE en BD
  description: string | null;
  account_id?: string | null;
  place?: string | null;
};
type Expense = TxBase & { category_id: string | null };
type Income = TxBase;
type Category = { id: string; name: string };

// ===== Utils =====
function getMonthRange(yyyymm?: string) {
  const d = yyyymm ? new Date(yyyymm + "-01") : new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  const toISO = (x: Date) =>
    new Date(x.getTime() - x.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
  return { startISO: toISO(start), endISO: toISO(end) };
}
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

// ===== MonthPicker (no texto libre) =====
function MonthPicker({
  value, // "YYYY-MM"
  onChange,
  minYear = 2019,
  maxYear = new Date().getFullYear(),
}: {
  value: string;
  onChange: (yyyymm: string) => void;
  minYear?: number;
  maxYear?: number;
}) {
  // parse robusto
  const m = /^\d{4}-\d{2}$/.test(value)
    ? { y: Number(value.slice(0, 4)), m: Number(value.slice(5, 7)) - 1 }
    : { y: new Date().getFullYear(), m: new Date().getMonth() };

  const setYM = (y: number, monthIdx: number) => {
    const yy = clamp(y, minYear, maxYear);
    const mm = clamp(monthIdx, 0, 11);
    onChange(`${yy}-${String(mm + 1).padStart(2, "0")}`);
  };

  const prev = () => {
    let y = m.y, mm = m.m - 1;
    if (mm < 0) { mm = 11; y -= 1; }
    setYM(y, mm);
  };
  const next = () => {
    let y = m.y, mm = m.m + 1;
    if (mm > 11) { mm = 0; y += 1; }
    setYM(y, mm);
  };

  const months = [
    "01 • Jan","02 • Feb","03 • Mar","04 • Apr","05 • May","06 • Jun",
    "07 • Jul","08 • Aug","09 • Sep","10 • Oct","11 • Nov","12 • Dec",
  ];
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={prev}
        className="h-9 rounded-lg border border-white/30 bg-white/70 px-3 shadow-sm hover:brightness-95 backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
        aria-label="Previous month"
      >
        ◀
      </button>
      <select
        className="h-9 rounded-lg border border-white/30 bg-white/70 px-2 shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
        value={String(m.m)}
        onChange={(e) => setYM(m.y, Number(e.target.value))}
      >
        {months.map((label, idx) => (
          <option key={idx} value={idx}>{label}</option>
        ))}
      </select>
      <select
        className="h-9 rounded-lg border border-white/30 bg-white/70 px-2 shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
        value={String(m.y)}
        onChange={(e) => setYM(Number(e.target.value), m.m)}
      >
        {years.map((yy) => (
          <option key={yy} value={yy}>{yy}</option>
        ))}
      </select>
      <button
        onClick={next}
        className="h-9 rounded-lg border border-white/30 bg-white/70 px-3 shadow-sm hover:brightness-95 backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
        aria-label="Next month"
      >
        ▶
      </button>
      <button
        onClick={() => {
          const d = new Date();
          onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
        }}
        className="h-9 rounded-lg border border-white/30 bg-white/70 px-3 shadow-sm hover:brightness-95 backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
      >
        This month
      </button>
    </div>
  );
}

// ===== Component =====
export default function Reports() {
  const [month, setMonth] = useState<string>(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${d.getFullYear()}-${mm}`;
  });

  const { startISO, endISO } = useMemo(() => getMonthRange(month), [month]);

  const [chartLoading, setChartLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  const [balanceData, setBalanceData] = useState<BalanceItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const reportRef = useRef<HTMLDivElement | null>(null);

  // --- Net worth (account_balances) ---
  useEffect(() => {
    let mounted = true;
    (async () => {
      setChartLoading(true);
      try {
        const { data } = await supabase
          .from("account_balances")
          .select("balance, recorded_at")
          .order("recorded_at", { ascending: true })
          .throwOnError();

        // Agrupar por fecha (YYYY-MM-DD)
        const grouped: Record<string, number> = {};
        (data ?? []).forEach((row: any) => {
          const d = String(row.recorded_at); // ya es date en BD
          grouped[d] = (grouped[d] || 0) + Number(row.balance || 0);
        });

        const result = Object.entries(grouped)
          .map(([date, total]) => ({ date, total }))
          .sort((a, b) => a.date.localeCompare(b.date));

        if (mounted) setBalanceData(result);
      } catch (err: any) {
        console.error("Error fetching balance history:", err?.message || err);
        if (mounted) setBalanceData([]);
      } finally {
        if (mounted) setChartLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // --- Categorías ---
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase
          .from("categories")
          .select("id,name")
          .order("name")
          .throwOnError();
        if (mounted) setCategories(data ?? []);
      } catch (err) {
        if (mounted) setCategories([]);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // --- Gastos + Ingresos del mes ---
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const { data: exp } = await supabase
          .from("expenses")
          .select("id,amount,date,description,category_id,account_id,place")
          .gte("date", startISO)
          .lte("date", endISO)
          .order("date", { ascending: true })
          .throwOnError();

        const { data: inc } = await supabase
          .from("incomes")
          .select("id,amount,date,description,created_at")
          .gte("date", startISO)
          .lte("date", endISO)
          .order("date", { ascending: true })
          .throwOnError();

        if (mounted) {
          setExpenses((exp ?? []) as Expense[]);
          setIncomes((inc ?? []) as Income[]);
        }
      } catch (err: any) {
        console.error("Error loading monthly data:", err?.message || err);
        if (mounted) setErrorMsg(err?.message || "Unknown error");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [startISO, endISO]);

  const categoryMap = useMemo(
    () =>
      categories.reduce<Record<string, string>>((acc, c) => {
        acc[c.id] = c.name;
        return acc;
      }, {}),
    [categories]
  );

  // Totales
  const totalExpenses = useMemo(
    () => expenses.reduce((sum, t) => sum + Number(t.amount || 0), 0),
    [expenses]
  );
  const totalIncomes = useMemo(
    () => incomes.reduce((sum, t) => sum + Number(t.amount || 0), 0),
    [incomes]
  );
  const net = useMemo(() => totalIncomes - totalExpenses, [totalIncomes, totalExpenses]);

  // Agrupar gastos por categoría
  const expensesByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of expenses) {
      const key =
        (t.category_id && categoryMap[t.category_id]) ||
        (t.category_id ?? "Sin categoría");
      map[key] = (map[key] || 0) + Number(t.amount || 0);
    }
    return Object.entries(map)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [expenses, categoryMap]);

  // --- Exportar a PDF (captura visual del bloque) ---
  const handleExportPDF = async () => {
    const node = reportRef.current;
    if (!node) return;

    const prevScrollY = window.scrollY;
    window.scrollTo(0, 0);

    try {
      const canvas = await html2canvas(node, {
        useCORS: true,
        scale: 2,
        backgroundColor: null,
      });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgProps =
        (pdf as any).getImageProperties?.(imgData) || {
          width: canvas.width,
          height: canvas.height,
        };
      const imgWidth = pageWidth - 20;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

      if (imgHeight <= pageHeight - 20) {
        pdf.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight, undefined, "FAST");
      } else {
        // Partir en varias páginas si es largo
        let remaining = imgHeight;
        let sY = 0;
        const pxPageHeight = ((pageHeight - 20) * imgProps.width) / imgWidth;

        while (remaining > 0) {
          const pageCanvas = document.createElement("canvas");
          pageCanvas.width = canvas.width;
          pageCanvas.height = Math.min(pxPageHeight, canvas.height - sY);
          const ctx = pageCanvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(
              canvas,
              0,
              sY,
              canvas.width,
              pageCanvas.height,
              0,
              0,
              canvas.width,
              pageCanvas.height
            );
          }
          const pageImg = pageCanvas.toDataURL("image/png");
          const pageImgHeight = (pageCanvas.height * imgWidth) / pageCanvas.width;

          pdf.addImage(pageImg, "PNG", 10, 10, imgWidth, pageImgHeight, undefined, "FAST");
          remaining -= pageImgHeight;
          sY += pageCanvas.height;
          if (remaining > 0) pdf.addPage();
        }
      }

      pdf.save(`VitaFin-Report-${month}.pdf`);
    } catch (e) {
      console.error("Error exporting PDF", e);
    } finally {
      window.scrollTo(0, prevScrollY);
    }
  };

  // --- Exportar CSV ---
  const handleExportCSV = () => {
    const rows = [
      ["Type", "Date", "Description", "Category", "Amount", "Place"],
      ...incomes.map((t) => [
        "Income",
        t.date || "",
        t.description || "",
        "",
        String(t.amount ?? 0),
        "",
      ]),
      ...expenses.map((t) => [
        "Expense",
        t.date || "",
        t.description || "",
        (t.category_id && categoryMap[t.category_id]) || "",
        String(t.amount ?? 0),
        t.place || "",
      ]),
    ];

    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `VitaFin-Report-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ===== Render =====
  return (
    <div className="mx-auto max-w-7xl p-6 sm:p-8">
      {/* Header */}
      <Card>
        <div className="mb-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              Reports
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Descarga tus reportes mensuales de ingresos, gastos y neto.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* MonthPicker en lugar de texto libre */}
            <MonthPicker value={month} onChange={setMonth} minYear={2019} />
            <button
              onClick={handleExportCSV}
              className="rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:-translate-y-px hover:brightness-105 backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800 dark:text-zinc-200"
            >
              Export CSV
            </button>
            <button
              onClick={handleExportPDF}
              className="rounded-xl bg-gradient-to-tr from-blue-600 to-fuchsia-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:brightness-110"
            >
              Export PDF
            </button>
          </div>
        </div>
      </Card>

      {/* Report content */}
      <Card ref={reportRef as any}>
        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/30 bg-white/70 p-4 dark:border-zinc-700/40 dark:bg-zinc-800/60">
            <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Ingresos ({startISO}–{endISO})
            </div>
            <div className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              ₡{totalIncomes.toLocaleString()}
            </div>
          </div>
          <div className="rounded-2xl border border-white/30 bg-white/70 p-4 dark:border-zinc-700/40 dark:bg-zinc-800/60">
            <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Gastos ({startISO}–{endISO})
            </div>
            <div className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              ₡{totalExpenses.toLocaleString()}
            </div>
          </div>
          <div className="rounded-2xl border border-white/30 bg-white/70 p-4 dark:border-zinc-700/40 dark:bg-zinc-800/60">
            <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Neto
            </div>
            <div className={`mt-1 text-2xl font-semibold ${net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              ₡{net.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Net Worth Over Time
          </h3>
          <div className="h-[300px] rounded-2xl border border-white/30 bg-white/70 p-3 dark:border-zinc-700/40 dark:bg-zinc-800/60">
            {chartLoading ? (
              <div className="grid h-full place-items-center text-zinc-500">Cargando…</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RLineChart data={balanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" stroke="#f97316" strokeWidth={2} dot={false} />
                </RLineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Expenses by category */}
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Gastos por categoría — {month}
          </h3>
          <div className="rounded-2xl border border-white/30 bg-white/70 p-0 dark:border-zinc-700/40 dark:bg-zinc-800/60">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-zinc-600 dark:text-zinc-300">
                  <tr>
                    <th className="px-4 py-3">Categoría</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/30 dark:divide-zinc-700/40">
                  {loading ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-4 text-zinc-500">
                        Cargando…
                      </td>
                    </tr>
                  ) : expensesByCategory.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-4 text-zinc-500">
                        Sin datos para este mes.
                      </td>
                    </tr>
                  ) : (
                    expensesByCategory.map((row) => (
                      <tr key={row.name}>
                        <td className="px-4 py-2">{row.name}</td>
                        <td className="px-4 py-2 text-right">₡{row.total.toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {!loading && expensesByCategory.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-white/30 dark:border-zinc-700/40">
                      <td className="px-4 py-3 font-medium">Total</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        ₡{totalExpenses.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>

        {/* Error visible */}
        {errorMsg && (
          <div className="mt-4 rounded-xl border border-rose-300/40 bg-rose-50/60 p-3 text-rose-700">
            {errorMsg}
          </div>
        )}
      </Card>
    </div>
  );
}
