"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

interface Expense {
  id: string;
  user_id: string;
  category_id: string;
  category_name?: string;
  amount: number;
  date: string;
  description: string;
}

interface Category {
  id: string;
  name: string;
}

export default function Transactions() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const { data: catData, error: catError } = await supabase
        .from("categories")
        .select("id, name");
      if (catError) console.error("Error fetching categories:", catError);
      else setCategories(catData || []);

      const { data: expData, error: expError } = await supabase
        .from("expenses")
        .select(`
          id, user_id, category_id, amount, date, description,
          categories ( name )
        `);
      if (expError) console.error("Error fetching expenses:", expError);
      else {
        const normalized = (expData || []).map((e: any) => ({
          ...e,
          category_name: e.categories?.name || "",
        }));
        setExpenses([...normalized, newBlankRow()]);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  const newBlankRow = (): Expense => ({
    id: "",
    user_id: "",
    category_id: "",
    amount: 0,
    date: new Date().toISOString().substring(0,10),
    description: "",
    category_name: "",
  });

  const handleChange = <K extends keyof Expense>(
  index: number,
  field: K,
  value: Expense[K]
) => {
  const updated = [...expenses];
  updated[index][field] = value;

  // also update category_name for dropdown
  if (field === "category_id") {
    const cat = categories.find(c => c.id === value);
    updated[index].category_name = cat ? cat.name : "";
  }

  setExpenses(updated);
};

  const handleBlur = async (index: number) => {
    const row = expenses[index];
    if (!row.description && !row.amount) return;

    if (row.id) {
      // update
      const { error } = await supabase
        .from("expenses")
        .update({
          description: row.description,
          category_id: row.category_id,
          amount: row.amount,
          date: row.date
        })
        .eq("id", row.id);
      if (error) console.error("Update failed:", error);
    } else {
      // insert
      const { data, error } = await supabase
        .from("expenses")
        .insert([{
          description: row.description,
          category_id: row.category_id,
          amount: row.amount,
          date: row.date
        }])
        .select()
        .single();
      if (error) console.error("Insert failed:", error);
      else {
        const updated = [...expenses];
        updated[index] = { ...row, id: data.id };
        updated.push(newBlankRow());
        setExpenses(updated);
      }
    }
  };

  const total = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Expenses for July</h2>
      {loading && <p>Loading...</p>}
      {!loading && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border">Description</th>
              <th className="p-2 border">Category</th>
              <th className="p-2 border">Amount</th>
              <th className="p-2 border">Date</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="border p-1">
                  <input
                    type="text"
                    value={e.description}
                    onChange={(e2) => handleChange(i, "description", e2.target.value)}
                    onBlur={() => handleBlur(i)}
                    className="w-full p-1"
                  />
                </td>
                <td className="border p-1">
                  <select
                    value={e.category_id || ""}
                    onChange={(e2) => handleChange(i, "category_id", e2.target.value)}
                    onBlur={() => handleBlur(i)}
                    className="w-full p-1"
                  >
                    <option value="">Select...</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </td>
                <td className="border p-1">
                  <input
                    type="number"
                    value={e.amount}
                    onChange={(e2) => handleChange(i, "amount", parseFloat(e2.target.value) || 0)}
                    onBlur={() => handleBlur(i)}
                    className="w-full p-1"
                  />
                </td>
                <td className="border p-1">
                  <input
                    type="date"
                    value={e.date}
                    onChange={(e2) => handleChange(i, "date", e2.target.value)}
                    onBlur={() => handleBlur(i)}
                    className="w-full p-1"
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold bg-gray-100">
              <td className="p-2 border" colSpan={2}>Total</td>
              <td className="p-2 border">${total.toFixed(2)}</td>
              <td className="border" />
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}
