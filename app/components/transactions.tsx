"use client";

import { useEffect, useState, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef
} from "@tanstack/react-table";
import { rankItem } from "@tanstack/match-sorter-utils";
import { supabase } from "../lib/supabaseClient";
import debounce from "lodash.debounce";
import Papa from "papaparse";

interface Expense {
  id: string;
  description: string;
  category_id: string;
  amount: number;
  date: string;
  account_id: string;
  place: string;
}

interface Category {
  id: string;
  name: string;
}

interface Account {
  id: string;
  name: string;
  balance?: number;
}

export default function Transactions() {
  const [data, setData] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalFilter, setGlobalFilter] = useState("");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [undoStack, setUndoStack] = useState<Expense[]>([]);
  const [showUndo, setShowUndo] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newExpense, setNewExpense] = useState<Partial<Expense>>({
    description: "",
    amount: 0,
    category_id: "",
    account_id: "",
    date: new Date().toISOString().substring(0, 10)
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: cats } = await supabase.from("categories").select("*");
      setCategories(cats || []);

      const { data: exps } = await supabase.from("expenses").select("*");
      setData(exps || []);

      const { data: accs } = await supabase.from("accounts").select("id, name, balance");
      setAccounts(accs || []);
      setLoading(false);
    };
    fetchData();
  }, []);

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

    if (error || !inserted) return console.error("Insert failed:", error?.message);

    setData([...data, inserted]);
    setShowModal(false);

    const acc = accounts.find(a => a.id === inserted.account_id);
    if (acc) {
      const newBalance = (acc.balance || 0) - inserted.amount;
      const { error: updateErr } = await supabase
        .from("accounts")
        .update({ balance: newBalance })
        .eq("id", acc.id);

      if (!updateErr) {
        await supabase.from("account_balances").insert([{
          account_id: acc.id,
          balance: newBalance,
          recorded_at: new Date().toISOString().substring(0, 10)
        }]);

        setAccounts(prev => prev.map(a => (a.id === acc.id ? { ...a, balance: newBalance } : a)));
      }
    }

    setNewExpense({
      description: "",
      amount: 0,
      category_id: "",
      account_id: "",
      date: new Date().toISOString().substring(0, 10)
    });
  };

  const deleteExpense = async (rowIndex: number) => {
    const exp = data[rowIndex];
    const { error } = await supabase.from("expenses").delete().eq("id", exp.id);
    if (error) return console.error("Delete failed:", error);

    const acc = accounts.find(a => a.id === exp.account_id);
    if (acc) {
      const newBalance = (acc.balance || 0) + exp.amount;
      await supabase.from("accounts").update({ balance: newBalance }).eq("id", acc.id);
      setAccounts(prev => prev.map(a => (a.id === acc.id ? { ...a, balance: newBalance } : a)));
    }

    setUndoStack([exp]);
    setShowUndo(true);
    setData(data.filter((_, i) => i !== rowIndex));
    setTimeout(() => setShowUndo(false), 500);
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedRows);
    if (!ids.length) return;

    const deleted = data.filter(d => ids.includes(d.id));
    const { error } = await supabase.from("expenses").delete().in("id", ids);
    if (error) return console.error("Bulk delete failed:", error);

    for (const exp of deleted) {
      const acc = accounts.find(a => a.id === exp.account_id);
      if (acc) {
        const newBalance = (acc.balance || 0) + exp.amount;
        await supabase.from("accounts").update({ balance: newBalance }).eq("id", acc.id);
        setAccounts(prev => prev.map(a => (a.id === acc.id ? { ...a, balance: newBalance } : a)));
      }
    }

    setUndoStack(deleted);
    setShowUndo(true);
    setData(data.filter(d => !ids.includes(d.id)));
    setSelectedRows(new Set());
    setTimeout(() => setShowUndo(false), 500);
  };

  const undoDelete = async () => {
    for (const exp of undoStack) {
      await supabase.from("expenses").insert([exp]);
    }
    setData([...data, ...undoStack]);
    setShowUndo(false);
  };

  const toggleSelectAll = () => {
    setSelectedRows(new Set(selectedRows.size === data.length ? [] : data.map(d => d.id)));
  };

  const toggleSelectRow = (id: string) => {
    const updated = new Set(selectedRows);
    updated.has(id) ? updated.delete(id) : updated.add(id);
    setSelectedRows(updated);
  };

  const importCSV = async (file: File) => {
  Papa.parse(file, {
  header: true,
  skipEmptyLines: true,
  delimiter: ",",            // ← enforce comma
  quoteChar: '"',            // ← enforce quotes for "55,715"
  transformHeader: header => header.trim().toLowerCase(),
  complete: async (results) => {
    const rows = results.data as any[];
    console.log("First parsed row:", rows[0]); // ⬅️ confirm it's parsed into 6 keys

    const { data: existingCategoriesRaw } = await supabase.from("categories").select("*");
    const { data: existingAccountsRaw } = await supabase.from("accounts").select("id, name");

    const existingCategories = existingCategoriesRaw ?? [];
    const existingAccounts = existingAccountsRaw ?? [];

    const newExpenses: Omit<Expense, "id">[] = [];

    for (const row of rows) {
  const {
    description,
    place,
    amount,
    category,
    date,
    account
  } = row;

  // Clean and parse
  const cleanedAmount = amount ? parseFloat(amount.replace(/,/g, "").trim()) : NaN;
  const parsedDate = date ? new Date(date) : null;
  const isoDate = parsedDate && !isNaN(parsedDate.getTime())
    ? parsedDate.toISOString().substring(0, 10)
    : null;

  // Minimal required field check
  if (typeof description !== "string") {
  console.warn("Invalid description:", description, row);
  continue;
}

if (typeof category !== "string") {
  console.warn("Invalid category:", category, row);
  continue;
}

if (typeof account !== "string") {
  console.warn("Invalid account:", account, row);
  continue;
}

if (!isoDate) {
  console.warn("Invalid date:", date, parsedDate, isoDate, row);
  continue;
}

if (isNaN(cleanedAmount)) {
  console.warn("Invalid amount:", amount, cleanedAmount, row);
  continue;
}

  // Get or create category
  let category_id = existingCategories.find(c => c.name.toLowerCase() === category.toLowerCase())?.id;
  if (!category_id) {
    const { data: createdCat, error: catError } = await supabase
      .from("categories")
      .insert({ name: category })
      .select()
      .single();
    if (!catError && createdCat) {
      category_id = createdCat.id;
      existingCategories.push(createdCat);
    } else {
      console.error("Failed to create category:", category);
      continue;
    }
  }

  // Find account
  const account_id = existingAccounts.find(a => a.name.toLowerCase() === account.toLowerCase())?.id;
  if (!account_id) {
    console.warn("Skipping row due to unknown account:", row);
    continue;
  }

  newExpenses.push({
    description: description.trim(),
    category_id,
    amount: cleanedAmount,
    date: isoDate,
    account_id,
    place: place?.trim() || ""
  });
}


    if (newExpenses.length > 0) {
      const { data: inserted, error } = await supabase.from("expenses").insert(newExpenses).select();
      if (error) {
        console.error("Failed to insert expenses:", error.message);
      } else {
        setData(prev => [...prev, ...(inserted ?? [])]);
        alert(`${inserted?.length ?? 0} expenses imported successfully.`);
      }
    } else {
      alert("No valid rows to import.");
    }
  }
});
};


  const exportCSV = () => {
    const headers = ["Description", "Category", "Amount", "Date", "Account"];
    const filtered = data.filter(e => selectedRows.size === 0 || selectedRows.has(e.id));
    const rows = filtered.map(exp => [
      exp.description,
      categories.find(c => c.id === exp.category_id)?.name ?? "",
      exp.amount,
      exp.date,
      accounts.find(a => a.id === exp.account_id)?.name ?? ""
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "expenses.csv";
    link.click();
  };

  const fuzzyFilter = (row: any, columnId: string, value: string) =>
    rankItem(row.getValue(columnId), value).passed;

  const columns: ColumnDef<Expense>[] = [
  {
    id: "select",
    header: () => <input type="checkbox" checked={selectedRows.size === data.length} onChange={toggleSelectAll} />,
    cell: ({ row }) => (
      <input
        type="checkbox"
        checked={selectedRows.has(row.original.id)}
        onChange={() => toggleSelectRow(row.original.id)}
      />
    )
  },
  {
    header: "Description",
    accessorKey: "description",
    cell: ({ getValue }) => <span>{getValue() as string}</span>
  },
    {
    header: "Place", // ← Add this column
    accessorKey: "place",
    cell: ({ getValue }) => <span>{getValue() as string}</span>
  },
    {
    header: "Date",
    accessorKey: "date",
    cell: ({ getValue }) => <span>{getValue() as string}</span>
  },
  {
    header: "Category",
    accessorKey: "category_id",
    cell: ({ getValue }) => <span>{categories.find(c => c.id === getValue())?.name || ""}</span>
  },
  {
    header: "Account",
    accessorKey: "account_id",
    cell: ({ getValue }) => <span>{accounts.find(a => a.id === getValue())?.name || ""}</span>
  },
  {
    header: "Amount",
    accessorKey: "amount",
    cell: ({ getValue }) => <span>${Number(getValue()).toFixed(2)}</span>
  }


];


  const table = useReactTable({
    data,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: fuzzyFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel()
  });

  const total = data.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return (
    <div className="p-8 w-full relative">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-3xl font-bold">Expenses</h2>
        <div className="flex gap-2">
          <input
  type="file"
  accept=".csv"
  onChange={(e) => {
    const file = e.target.files?.[0];
    if (file) importCSV(file);
  }}
  className="hidden"
  id="csv-upload"
/>
<label htmlFor="csv-upload" className="bg-green-600 text-white px-4 py-2 rounded cursor-pointer">
  Import CSV
</label>
          <button onClick={exportCSV} className="bg-blue-500 text-white px-4 py-2 rounded">Export CSV</button>
          <button onClick={bulkDelete} className="bg-red-500 text-white px-4 py-2 rounded" disabled={selectedRows.size === 0}>Delete Selected</button>
          <button onClick={() => setShowModal(true)} className="bg-orange-500 text-white px-4 py-2 rounded">+ Add Expense</button>
        </div>
      </div>

      <input
        type="text"
        placeholder="Search..."
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        className="border p-2 rounded mb-4 w-1/3"
      />

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="overflow-x-auto shadow rounded">
          <table className="min-w-full border">
            <thead className="bg-gray-100">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th key={header.id} className="p-2 border text-left">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map(row => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="p-2 border">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold bg-gray-50">
                <td colSpan={4} className="p-2 border text-right">Total</td>
                <td className="p-2 border">${total.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {showUndo && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded shadow-lg flex gap-4 items-center">
          <span>Deleted rows</span>
          <button onClick={undoDelete} className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded">Undo</button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow w-96">
            <h2 className="text-xl font-semibold mb-4">Add Expense</h2>
            <input className="w-full border p-2 mb-2 rounded" placeholder="Description"
              value={newExpense.description || ""}
              onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
            />
            <input
              className="w-full border p-2 mb-2 rounded"
              placeholder="Place"
              value={newExpense.place || ""}
              onChange={e => setNewExpense({ ...newExpense, place: e.target.value })}
            />

            <input type="number" className="w-full border p-2 mb-2 rounded" placeholder="Amount"
              value={newExpense.amount || ""}
              onChange={e => setNewExpense({ ...newExpense, amount: Number(e.target.value) })}
            />
            <select
  className="w-full border p-2 mb-2 rounded"
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
          setCategories(prev => [...prev, created]);
          setNewExpense(prev => ({ ...prev, category_id: created.id }));
        } else {
          alert("Failed to create category.");
        }
      }
    } else {
      setNewExpense(prev => ({ ...prev, category_id: val }));
    }
  }}
>
  <option value="">Select Category</option>
  {categories.map(c => (
    <option key={c.id} value={c.id}>{c.name}</option>
  ))}
  <option value="NEW_CATEGORY">➕ Add New Category</option>
</select>
            <select className="w-full border p-2 mb-2 rounded"
              value={newExpense.account_id || ""}
              onChange={e => setNewExpense({ ...newExpense, account_id: e.target.value })}
            >
              <option value="">Select Account</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <input type="date" className="w-full border p-2 mb-4 rounded"
              value={newExpense.date}
              onChange={e => setNewExpense({ ...newExpense, date: e.target.value })}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded">Cancel</button>
              <button onClick={addExpenseToDB} className="bg-orange-500 text-white px-4 py-2 rounded">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
