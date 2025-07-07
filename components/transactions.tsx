"use client";
import { useEffect, useState } from "react";
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

interface Expense {
  id: string;
  description: string;
  category_id: string;
  amount: number;
  date: string;
  isSaving?: boolean;
  savedOk?: boolean;
}

interface Category {
  id: string;
  name: string;
}

export default function Transactions() {
  const [data, setData] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [globalFilter, setGlobalFilter] = useState("");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [undoStack, setUndoStack] = useState<Expense[]>([]);
  const [showUndo, setShowUndo] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id ?? null;
      setUserId(uid);

      const { data: cats } = await supabase
        .from("categories")
        .select("*")
        .or(`user_id.eq.${uid},user_id.is.null`);
      setCategories(cats || []);

      const { data: exps } = await supabase
        .from("expenses")
        .select("*")
        .eq("user_id", uid);
      setData(exps || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const updateExpense = async (rowIndex: number, field: keyof Expense, value: any) => {
    const prev = [...data];
    const updated = [...data];
    updated[rowIndex] = { ...updated[rowIndex], [field]: value, isSaving: true, savedOk: false };
    setData(updated);

    const { error } = await supabase
      .from("expenses")
      .update({ [field]: value })
      .eq("id", updated[rowIndex].id);

    if (error) {
      console.error("Update failed:", error);
      setData(prev); // rollback
    } else {
      updated[rowIndex].isSaving = false;
      updated[rowIndex].savedOk = true;
      setData([...updated]);
      setTimeout(() => {
        updated[rowIndex].savedOk = false;
        setData([...updated]);
      }, 1000);
    }
  };

  const addExpense = async () => {
    if (!userId) return;
    const newExpense = {
      user_id: userId,
      description: "",
      category_id: categories[0]?.id ?? "",
      amount: 0,
      date: new Date().toISOString().substring(0, 10)
    };

    const { data: inserted, error } = await supabase
      .from("expenses")
      .insert([newExpense])
      .select()
      .single();

    if (error) console.error("Insert error:", error);
    else setData([...data, { ...inserted, savedOk: true }]);
  };

  const deleteExpense = async (rowIndex: number) => {
    const exp = data[rowIndex];
    const { error } = await supabase.from("expenses").delete().eq("id", exp.id);

    if (error) {
      console.error("Delete failed:", error);
      return;
    }

    setUndoStack([exp]);
    setShowUndo(true);

    const updated = data.filter((_, i) => i !== rowIndex);
    setData(updated);

    setTimeout(() => {
      setShowUndo(false);
    }, 5000);
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedRows);
    if (!ids.length) return;

    const expensesToDelete = data.filter(e => ids.includes(e.id));
    const { error } = await supabase.from("expenses").delete().in("id", ids);

    if (error) {
      console.error("Bulk delete failed:", error);
      return;
    }

    setUndoStack(expensesToDelete);
    setShowUndo(true);
    setData(data.filter(e => !ids.includes(e.id)));
    setSelectedRows(new Set());

    setTimeout(() => {
      setShowUndo(false);
    }, 5000);
  };

  const undoDelete = async () => {
    for (const exp of undoStack) {
      await supabase.from("expenses").insert([exp]);
    }
    setData([...data, ...undoStack]);
    setShowUndo(false);
  };

  const exportCSV = () => {
    const headers = ["Description", "Category", "Amount", "Date"];
    const filtered = data.filter(e => selectedRows.size === 0 || selectedRows.has(e.id));
    const rows = filtered.map(exp => [
      exp.description,
      categories.find(c => c.id === exp.category_id)?.name ?? "",
      exp.amount,
      exp.date
    ]);
    let csvContent = "data:text/csv;charset=utf-8,"
      + [headers, ...rows].map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "expenses.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fuzzyFilter = (row: any, columnId: string, value: string) => {
    return rankItem(row.getValue(columnId), value).passed;
  };

  const categoryColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = hash % 360;
    return `hsl(${h},70%,80%)`;
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === data.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(data.map(e => e.id)));
    }
  };

  const toggleSelectRow = (id: string) => {
    const updated = new Set(selectedRows);
    updated.has(id) ? updated.delete(id) : updated.add(id);
    setSelectedRows(updated);
  };

  const columns: ColumnDef<Expense>[] = [
    {
      id: "select",
      header: () => (
        <input
          type="checkbox"
          checked={selectedRows.size === data.length}
          onChange={toggleSelectAll}
        />
      ),
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
      cell: ({ getValue, row, column }) => (
        <div className="relative">
          <input
            className="p-1 w-full border rounded"
            value={(getValue() ?? "") as string | number}
            onChange={(e) =>
              updateExpense(row.index, column.id as keyof Expense, e.target.value)
            }
          />
          {row.original.savedOk && (
            <span className="absolute top-1 right-2 text-green-500 text-xs">✅</span>
          )}
        </div>
      )
    },
    {
      header: "Category",
      accessorKey: "category_id",
      cell: ({ getValue, row, column }) => {
        const cat = categories.find(c => c.id === getValue());
        return (
          <div className="flex items-center gap-2 relative">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: cat ? categoryColor(cat.name) : "#ddd" }}
            />
            <select
              className="p-1 flex-1 border rounded"
              value={(getValue() ?? "") as string}
              onChange={(e) =>
                updateExpense(row.index, column.id as keyof Expense, e.target.value)
              }
            >
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {row.original.savedOk && (
              <span className="absolute top-1 right-2 text-green-500 text-xs">✅</span>
            )}
          </div>
        );
      }
    },
    {
      header: "Amount",
      accessorKey: "amount",
      cell: ({ getValue, row, column }) => (
        <div className="relative">
          <input
            type="number"
            className="p-1 w-full border rounded"
            value={(getValue() ?? 0) as number}
            onChange={(e) =>
              updateExpense(row.index, column.id as keyof Expense, Number(e.target.value))
            }
          />
          {row.original.savedOk && (
            <span className="absolute top-1 right-2 text-green-500 text-xs">✅</span>
          )}
        </div>
      )
    },
    {
      header: "Date",
      accessorKey: "date",
      cell: ({ getValue, row, column }) => (
        <div className="relative">
          <input
            type="date"
            className="p-1 w-full border rounded"
            value={(getValue() ?? "") as string}
            onChange={(e) =>
              updateExpense(row.index, column.id as keyof Expense, e.target.value)
            }
          />
          {row.original.savedOk && (
            <span className="absolute top-1 right-2 text-green-500 text-xs">✅</span>
          )}
        </div>
      )
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
        <h2 className="text-3xl font-bold">Expenses for July</h2>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
          >
            Export CSV
          </button>
          <button
            onClick={bulkDelete}
            className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded disabled:opacity-50"
            disabled={selectedRows.size === 0}
          >
            Delete Selected
          </button>
          <button
            onClick={addExpense}
            className="bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded"
          >
            + Add Expense
          </button>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="border p-2 rounded w-1/3"
        />
      </div>

      <div className="overflow-x-auto rounded shadow">
        <table className="min-w-full border">
          <thead className="bg-gray-100">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="p-2 border cursor-pointer select-none"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{
                      asc: " 🔼",
                      desc: " 🔽"
                    }[header.column.getIsSorted() as string] ?? ""}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr
                key={row.id}
                className={`hover:bg-gray-50 transition ${row.original.isSaving ? "opacity-70" : ""}`}
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="p-2 border relative">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold bg-gray-50">
              <td className="p-2 border text-right" colSpan={3}>Total</td>
              <td className="p-2 border">${total.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {loading && <p className="mt-4 text-sm text-gray-500">Loading...</p>}

      {showUndo && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded shadow-lg flex gap-4 items-center">
          <span>Deleted rows</span>
          <button
            onClick={undoDelete}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
