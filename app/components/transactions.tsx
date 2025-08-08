"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  Row,
} from "@tanstack/react-table";
import { rankItem } from "@tanstack/match-sorter-utils";
import { supabase } from "../lib/supabaseClient";
import Papa from "papaparse";

// ---------- UI helpers ----------
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
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Types ----------
interface Expense {
  id: string;
  description: string;
  category_id: string;
  amount: number;
  date: string; // ISO yyyy-mm-dd
  account_id: string;
  place: string;
}
interface Category { id: string; name: string }
interface Account { id: string; name: string; balance?: number }

// ---------- Component ----------
export default function Transactions() {
  // Data
  const [data, setData] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  // UI
  const [loading, setLoading] = useState(true);
  const [globalFilter, setGlobalFilter] = useState("");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [undoStack, setUndoStack] = useState<Expense[]>([]);
  const [showUndo, setShowUndo] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Month nav
  const today = new Date();
  const [month, setMonth] = useState<number>(today.getMonth());
  const [year, setYear] = useState<number>(today.getFullYear());

  // New expense
  const [newExpense, setNewExpense] = useState<Partial<Expense>>({
    description: "",
    amount: 0,
    category_id: "",
    account_id: "",
    place: "",
    date: new Date().toISOString().substring(0, 10),
  });

  // Load
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [{ data: cats }, { data: exps }, { data: accs }] = await Promise.all([
        supabase.from("categories").select("*").throwOnError(),
        supabase.from("expenses").select("*").throwOnError(),
        supabase.from("accounts").select("id, name, balance").throwOnError(),
      ]);
      setCategories(cats || []);
      setData(exps || []);
      setAccounts(accs || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Helpers
  const monthLabel = useMemo(
    () => new Date(year, month, 1).toLocaleString(undefined, { month: "long", year: "numeric" }),
    [month, year]
  );

  const changeMonth = (offset: number) => {
    const d = new Date(year, month + offset, 1);
    setMonth(d.getMonth());
    setYear(d.getFullYear());
  };

  const isInMonth = (isoDate: string, m: number, y: number) => {
    const d = new Date(isoDate + "T00:00:00");
    return d.getMonth() === m && d.getFullYear() === y;
  };

  const filteredData = useMemo(
    () => data.filter((e) => isInMonth(e.date, month, year)),
    [data, month, year]
  );

  const total = useMemo(
    () => filteredData.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [filteredData]
  );

  // CRUD
  const addExpenseToDB = async () => {
    if (!newExpense.description || !newExpense.account_id || !newExpense.category_id || !newExpense.amount || !newExpense.date) {
      alert("Please fill in all fields.");
      return;
    }
    const { data: inserted, error } = await supabase
      .from("expenses")
      .insert([newExpense])
      .select()
      .single();

    if (error || !inserted) {
      console.error("Insert failed:", error?.message);
      return;
    }

    setData((prev) => [...prev, inserted]);
    setShowModal(false);

    const acc = accounts.find((a) => a.id === inserted.account_id);
    if (acc) {
      const newBalance = (acc.balance || 0) - inserted.amount;
      const { error: updateErr } = await supabase
        .from("accounts")
        .update({ balance: newBalance })
        .eq("id", acc.id);
      if (!updateErr) {
        await supabase.from("account_balances").insert([
          { account_id: acc.id, balance: newBalance, recorded_at: new Date().toISOString().substring(0, 10) },
        ]);
        setAccounts((prev) => prev.map((a) => (a.id === acc.id ? { ...a, balance: newBalance } : a)));
      }
    }

    setNewExpense({
      description: "",
      amount: 0,
      category_id: "",
      account_id: "",
      place: "",
      date: new Date().toISOString().substring(0, 10),
    });
  };

  const deleteExpense = async (rowIndex: number) => {
    const exp = filteredData[rowIndex];
    if (!exp) return;

    const { error } = await supabase.from("expenses").delete().eq("id", exp.id);
    if (error) return console.error("Delete failed:", error);

    const acc = accounts.find((a) => a.id === exp.account_id);
    if (acc) {
      const newBalance = (acc.balance || 0) + exp.amount;
      await supabase.from("accounts").update({ balance: newBalance }).eq("id", acc.id);
      setAccounts((prev) => prev.map((a) => (a.id === acc.id ? { ...a, balance: newBalance } : a)));
    }

    setUndoStack([exp]);
    setShowUndo(true);
    setData((prev) => prev.filter((d) => d.id !== exp.id));
    setTimeout(() => setShowUndo(false), 4000);
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedRows);
    if (!ids.length) return;

    const deleted = data.filter((d) => ids.includes(d.id));
    const { error } = await supabase.from("expenses").delete().in("id", ids);
    if (error) return console.error("Bulk delete failed:", error);

    for (const exp of deleted) {
      const acc = accounts.find((a) => a.id === exp.account_id);
      if (acc) {
        const newBalance = (acc.balance || 0) + exp.amount;
        await supabase.from("accounts").update({ balance: newBalance }).eq("id", acc.id);
        setAccounts((prev) => prev.map((a) => (a.id === acc.id ? { ...a, balance: newBalance } : a)));
      }
    }

    setUndoStack(deleted);
    setShowUndo(true);
    setData((prev) => prev.filter((d) => !ids.includes(d.id)));
    setSelectedRows(new Set());
    setTimeout(() => setShowUndo(false), 4000);
  };

  const undoDelete = async () => {
    for (const exp of undoStack) {
      await supabase.from("expenses").insert([exp]);
      const acc = accounts.find((a) => a.id === exp.account_id);
      if (acc) {
        const newBalance = (acc.balance || 0) - exp.amount;
        await supabase.from("accounts").update({ balance: newBalance }).eq("id", acc.id);
        setAccounts((prev) => prev.map((a) => (a.id === acc.id ? { ...a, balance: newBalance } : a)));
      }
    }
    setData((prev) => [...prev, ...undoStack]);
    setShowUndo(false);
  };

  const toggleSelectAll = () => {
    const source = filteredData;
    setSelectedRows(new Set(selectedRows.size === source.length ? [] : source.map((d) => d.id)));
  };

  const toggleSelectRow = (id: string) => {
    const updated = new Set(selectedRows);
    updated.has(id) ? updated.delete(id) : updated.add(id);
    setSelectedRows(updated);
  };

  // CSV import/export
  const importCSV = async (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: ",",
      quoteChar: '"',
      transformHeader: (header) => header.trim().toLowerCase(),
      complete: async (results) => {
        const rows = results.data as Record<string, unknown>[];
        if (!rows?.length) return alert("No rows found in CSV.");

        const { data: existingCategoriesRaw } = await supabase.from("categories").select("*");
        const { data: existingAccountsRaw } = await supabase.from("accounts").select("id, name");

        const existingCategories = existingCategoriesRaw ?? [];
        const existingAccounts = existingAccountsRaw ?? [];

        const newExpenses: Omit<Expense, "id">[] = [];

        for (const row of rows) {
          const description = (row["description"] as string) || (row["detalle"] as string) || "";
          const place = ((row["place"] as string) || (row["ubicacion"] as string) || "").trim();
          const amount = (row["amount"] as string) || (row["monto"] as string) || "";
          const category = (row["category"] as string) || (row["categoria"] as string) || "";
          const date = (row["date"] as string) || (row["fecha"] as string) || "";
          const account = (row["account"] as string) || (row["cuenta"] as string) || "";

          const cleanedAmount = amount ? parseFloat(amount.toString().replace(/,/g, "").trim()) : NaN;
          const parsedDate = date ? new Date(date) : null;
          const isoDate =
            parsedDate && !isNaN(parsedDate.getTime())
              ? new Date(parsedDate.getTime() - parsedDate.getTimezoneOffset() * 60000)
                  .toISOString()
                  .substring(0, 10)
              : null;

          if (!description || !category || !account || !isoDate || isNaN(cleanedAmount)) continue;

          let category_id = existingCategories.find((c: Category) => c.name.toLowerCase() === category.toLowerCase())?.id;
          if (!category_id) {
            const { data: createdCat } = await supabase
              .from("categories")
              .insert({ name: category })
              .select()
              .single();
            if (createdCat) {
              category_id = createdCat.id;
              existingCategories.push(createdCat);
            } else {
              continue;
            }
          }

          const account_id = existingAccounts.find((a: Account) => a.name.toLowerCase() === account.toLowerCase())?.id;
          if (!account_id) continue;

          newExpenses.push({
            description: description.trim(),
            category_id,
            amount: cleanedAmount,
            date: isoDate,
            account_id,
            place,
          });
        }

        if (newExpenses.length > 0) {
          const { data: inserted, error } = await supabase.from("expenses").insert(newExpenses).select();
          if (error) {
            console.error("Failed to insert expenses:", error.message);
            alert("Import failed. Check console for details.");
          } else {
            setData((prev) => [...prev, ...(inserted ?? [])]);
            alert(`${inserted?.length ?? 0} expenses imported successfully.`);
          }
        } else {
          alert("No valid rows to import.");
        }
      },
    });
  };

  const exportCSV = () => {
    const headers = ["Description", "Place", "Category", "Amount", "Date", "Account"];
    const filtered = filteredData.filter((e) => selectedRows.size === 0 || selectedRows.has(e.id));
    const rows = filtered.map((exp) => [
      exp.description,
      exp.place || "",
      categories.find((c) => c.id === exp.category_id)?.name ?? "",
      exp.amount,
      exp.date,
      accounts.find((a) => a.id === exp.account_id)?.name ?? "",
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map((e) => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `expenses_${year}-${String(month + 1).padStart(2, "0")}.csv`;
    link.click();
  };

  // Table
  const fuzzyFilter = (row: Row<Expense>, columnId: string, value: string) =>
    rankItem(row.getValue(columnId), value).passed;

  const columns: ColumnDef<Expense>[] = [
    {
      id: "select",
      header: () => (
        <input
          type="checkbox"
          checked={selectedRows.size === filteredData.length && filteredData.length > 0}
          onChange={toggleSelectAll}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={selectedRows.has(row.original.id)}
          onChange={() => toggleSelectRow(row.original.id)}
        />
      ),
    },
    {
      header: "Description",
      accessorKey: "description",
      cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span>,
    },
    {
      header: "Place",
      accessorKey: "place",
      cell: ({ getValue }) => <span className="text-zinc-600 dark:text-zinc-400">{(getValue() as string) || "—"}</span>,
    },
    {
      header: "Date",
      accessorKey: "date",
      cell: ({ getValue }) => <span>{getValue() as string}</span>,
    },
    {
      header: "Category",
      accessorKey: "category_id",
      cell: ({ getValue }) => <span>{categories.find((c) => c.id === getValue())?.name || ""}</span>,
    },
    {
      header: "Account",
      accessorKey: "account_id",
      cell: ({ getValue }) => <span>{accounts.find((a) => a.id === getValue())?.name || ""}</span>,
    },
    {
      header: "Amount",
      accessorKey: "amount",
      cell: ({ getValue }) => <span className="tabular-nums">${Number(getValue()).toFixed(2)}</span>,
    },
  ];

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: fuzzyFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  // UI
  return (
    <div className="mx-auto max-w-7xl p-6 sm:p-8 bg-inherit">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">Expenses</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Focused view for {monthLabel}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <label className="inline-flex items-center rounded-xl border border-white/30 bg-white/70 px-4 py-2 text-sm shadow-sm backdrop-blur transition hover:bg-white dark:border-zinc-700/40 dark:bg-zinc-800/60 dark:text-zinc-200 cursor-pointer">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importCSV(file);
                (e.target as HTMLInputElement).value = "";
              }}
              className="hidden"
            />
            Import CSV
          </label>
          <button
            onClick={exportCSV}
            className="rounded-xl border border-white/30 bg-white/70 px-4 py-2 text-sm shadow-sm backdrop-blur transition hover:bg-white dark:border-zinc-700/40 dark:bg-zinc-800/60 dark:text-zinc-200"
          >
            Export CSV
          </button>
          <button
            onClick={bulkDelete}
            disabled={selectedRows.size === 0}
            className="rounded-xl border border-white/30 bg-white/70 px-4 py-2 text-sm shadow-sm backdrop-blur transition hover:bg-white disabled:opacity-40 dark:border-zinc-700/40 dark:bg-zinc-800/60 dark:text-zinc-200"
          >
            Delete Selected
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-xl bg-gradient-to-tr from-blue-600 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
          >
            + Add Expense
          </button>
        </div>
      </div>

      {/* Month Nav + Search */}
      <Card className="mb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => changeMonth(-1)}
              className="h-9 px-3 rounded-xl border border-white/30 bg-white/70 shadow-sm backdrop-blur transition hover:bg-white dark:border-zinc-700/40 dark:bg-zinc-800/60"
              aria-label="Previous month"
            >
              ◀
            </button>
            <div className="min-w-[180px] rounded-xl border border-white/30 bg-white/60 px-3 py-2 text-center font-medium shadow-sm backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60">
              {monthLabel}
            </div>
            <button
              onClick={() => changeMonth(1)}
              className="h-9 px-3 rounded-xl border border-white/30 bg-white/70 shadow-sm backdrop-blur transition hover:bg-white dark:border-zinc-700/40 dark:bg-zinc-800/60"
              aria-label="Next month"
            >
              ▶
            </button>
            <button
              onClick={() => {
                const now = new Date();
                setMonth(now.getMonth());
                setYear(now.getFullYear());
              }}
              className="h-9 px-3 rounded-xl border border-white/30 bg-white/70 shadow-sm backdrop-blur transition hover:bg-white dark:border-zinc-700/40 dark:bg-zinc-800/60"
            >
              This Month
            </button>
          </div>

          <input
            type="text"
            placeholder="Search description, place..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none md:w-80 dark:border-zinc-700/40 dark:bg-zinc-800/60"
          />
        </div>
      </Card>

      {/* Summary cards */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <div className="text-sm text-zinc-600 dark:text-zinc-300">Transactions</div>
          <div className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{filteredData.length}</div>
        </Card>
        <Card>
          <div className="text-sm text-zinc-600 dark:text-zinc-300">Total Spent</div>
          <div className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            ${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </Card>
        <Card>
          <div className="text-sm text-zinc-600 dark:text-zinc-300">Selected</div>
          <div className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{selectedRows.size}</div>
        </Card>
      </div>

      {/* Table */}
      <div
        className={[
          "overflow-x-auto rounded-2xl border shadow-xl",
          "border-white/30 bg-white/70 backdrop-blur-2xl",
          "dark:border-zinc-700/40 dark:bg-zinc-900/50",
        ].join(" ")}
      >
        {loading ? (
          <div className="p-8 text-zinc-500 dark:text-zinc-400">Loading…</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="text-left">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="border-b border-white/30 px-3 py-3 font-semibold text-zinc-600 dark:border-zinc-700/40 dark:text-zinc-300"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                  <th className="border-b border-white/30 px-3 py-3 font-semibold text-zinc-600 dark:border-zinc-700/40 dark:text-zinc-300">
                    Actions
                  </th>
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row, idx) => (
                <tr
                  key={row.id}
                  className="transition hover:bg-white/60 dark:hover:bg-zinc-800/40"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="border-b border-white/30 px-3 py-3 align-top dark:border-zinc-700/40">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                  <td className="border-b border-white/30 px-3 py-3 dark:border-zinc-700/40">
                    <button
                      onClick={() => deleteExpense(idx)}
                      className="rounded-xl border border-white/30 bg-white/70 px-3 py-1 text-sm shadow-sm transition hover:bg-white dark:border-zinc-700/40 dark:bg-zinc-800/60"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-white/60 dark:bg-zinc-800/50">
                <td className="px-3 py-3 text-right font-medium text-zinc-700 dark:text-zinc-200" colSpan={6}>
                  Total
                </td>
                <td className="px-3 py-3 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  ${total.toLocaleString()}
                </td>
                <td className="px-3 py-3" />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Undo toast */}
      {showUndo && (
        <div
          className={[
            "fixed bottom-4 left-1/2 -translate-x-1/2 z-50",
            "rounded-xl border border-white/30 bg-zinc-900/90 px-5 py-3 text-white shadow-2xl backdrop-blur",
          ].join(" ")}
        >
          <span className="mr-4">Deleted {undoStack.length} item(s)</span>
          <button onClick={undoDelete} className="underline">
            Undo
          </button>
        </div>
      )}

      {/* Add expense modal */}
      {showModal && (
        <ModalShell title="Add Expense" onClose={() => setShowModal(false)}>
          <div className="space-y-3">
            <input
              className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none dark:border-zinc-700/40 dark:bg-zinc-800/60"
              placeholder="Description"
              value={newExpense.description || ""}
              onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
            />
            <input
              className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none dark:border-zinc-700/40 dark:bg-zinc-800/60"
              placeholder="Place"
              value={newExpense.place || ""}
              onChange={(e) => setNewExpense({ ...newExpense, place: e.target.value })}
            />
            <input
              type="number"
              className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none dark:border-zinc-700/40 dark:bg-zinc-800/60"
              placeholder="Amount"
              value={newExpense.amount || ""}
              onChange={(e) => setNewExpense({ ...newExpense, amount: Number(e.target.value) })}
            />
            <select
              className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none dark:border-zinc-700/40 dark:bg-zinc-800/60"
              value={newExpense.category_id || ""}
              onChange={async (e) => {
                const val = e.target.value;
                if (val === "NEW_CATEGORY") {
                  const name = prompt("Enter new category name:");
                  if (name && name.trim()) {
                    const { data: created, error } = await supabase
                      .from("categories")
                      .insert({ name: name.trim() })
                      .select()
                      .single();
                    if (!error && created) {
                      setCategories((prev) => [...prev, created]);
                      setNewExpense((prev) => ({ ...prev, category_id: created.id }));
                    } else {
                      alert("Failed to create category.");
                    }
                  }
                } else {
                  setNewExpense((prev) => ({ ...prev, category_id: val }));
                }
              }}
            >
              <option value="">Select Category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="NEW_CATEGORY">➕ Add New Category</option>
            </select>
            <select
              className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none dark:border-zinc-700/40 dark:bg-zinc-800/60"
              value={newExpense.account_id || ""}
              onChange={(e) => setNewExpense({ ...newExpense, account_id: e.target.value })}
            >
              <option value="">Select Account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none dark:border-zinc-700/40 dark:bg-zinc-800/60"
              value={newExpense.date}
              onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
            />
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setShowModal(false)}
              className="rounded-xl border border-white/30 bg-white/70 px-4 py-2 text-sm shadow-sm dark:border-zinc-700/40 dark:bg-zinc-800/60"
            >
              Cancel
            </button>
            <button
              onClick={addExpenseToDB}
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
