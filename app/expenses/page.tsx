"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function ExpensesPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [categories, setCategories] = useState<any[]>([]);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth");
        return;
      }
      setUser(user);
      await loadCategories(user.id);
      setLoading(false);
    };

    fetchData();
  }, [router]);

  const loadCategories = async (userId: string) => {
    const { data: categoriesData, error } = await supabase
      .from("categories")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      console.error(error);
      setMessage("❌ Failed to load categories.");
    } else {
      setCategories(categoriesData || []);
      if (categoriesData && categoriesData.length > 0) {
        setCategoryId(categoriesData[0].id); // default to first category
      }
    }
  };

  const handleAddExpense = async () => {
    setMessage("");

    if (!amount || isNaN(Number(amount))) {
      setMessage("❌ Please enter a valid amount.");
      return;
    }

    if (!categoryId) {
      setMessage("❌ Please select a category.");
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    const { error } = await supabase
      .from("expenses")
      .insert([{
        user_id: user.id,
        category_id: categoryId,
        amount: parseFloat(amount),
        description,
        date: today
      }]);

    if (error) {
      console.error(error);
      setMessage(`❌ ${error.message}`);
    } else {
      setMessage("✅ Expense added!");
      setAmount("");
      setDescription("");
      if (categories.length > 0) setCategoryId(categories[0].id);
    }
  };

  const handleSeedCategories = async () => {
    setMessage("");
    if (!user) return;

    const defaultCategories = [
      'Car', 'Loan', 'Food', 'Shopping', 'Entertainment',
      'Transport', 'Utilities', 'Credit Card', 'Travel', 
      'Education', 'Health'
    ];

    const inserts = defaultCategories.map(name => ({
      user_id: user.id,
      name
    }));

    const { error } = await supabase.from("categories").insert(inserts);
    if (error) {
      console.error(error);
      setMessage(`❌ ${error.message}`);
    } else {
      setMessage("✅ Categories seeded!");
      await loadCategories(user.id);
    }
  };

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <div className="w-full max-w-sm bg-white p-6 rounded-lg shadow-md">
        <div className="flex flex-col items-center mb-6">
          <div className="text-2xl font-bold mb-1">🍂 VitaFin</div>
          <h1 className="text-xl font-semibold text-center mb-2">Add an expense</h1>
          <p className="text-gray-500 text-center">Track your spending easily.</p>
        </div>

        <div className="flex flex-col gap-3 mb-4">
          <input
            className="p-2 border rounded w-full"
            type="number"
            step="0.01"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <input
            className="p-2 border rounded w-full"
            type="text"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <select
            className="p-2 border rounded w-full"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.length > 0 ? (
              categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))
            ) : (
              <option value="">No categories available</option>
            )}
          </select>

          <button
            onClick={handleAddExpense}
            className="bg-orange-400 text-white py-2 rounded w-full hover:bg-orange-500"
          >
            Save Expense
          </button>

          <button
            onClick={handleSeedCategories}
            className="bg-green-600 text-white py-2 rounded w-full hover:bg-green-700"
          >
            Seed Default Categories
          </button>
        </div>

        {message && (
          <div
            className={`text-center text-sm mb-4 ${
              message.startsWith("✅") ? "text-green-600" : "text-red-600"
            }`}
          >
            {message}
          </div>
        )}

        <div className="text-center text-sm">
          <a href="/welcome" className="text-blue-600 underline">Back to Dashboard</a>
        </div>
      </div>
    </main>
  );
}
