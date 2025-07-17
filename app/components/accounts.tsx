"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

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

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState("Checking");
  const [balance, setBalance] = useState<number | "">("");
  const [institution, setInstitution] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [color, setColor] = useState("#ffa500");

  useEffect(() => {
    const fetchAccounts = async () => {
      setLoading(true);
      const { data, error } = await supabase.from("accounts").select("*").order("created_at", { ascending: false });
      if (!error && data) {
        setAccounts(data);
      }
      setLoading(false);
    };

    fetchAccounts();
  }, []);

  const addAccount = async () => {
  // Insert the account and get the result
  const { data: inserted, error } = await supabase
    .from("accounts")
    .insert([
      {
        name,
        type,
        balance: Number(balance),
        institution,
        currency,
        color
      }
    ])
    .select()
    .single(); // ensures inserted is a single object

  if (error) {
    console.error("Insert error:", error);
    return;
  }

  // Insert initial balance snapshot
  const { error: balanceError } = await supabase
    .from("account_balances")
    .insert([
      {
        account_id: inserted.id,
        balance: inserted.balance,
        recorded_at: new Date().toISOString().substring(0, 10) // YYYY-MM-DD
      }
    ]);

  if (balanceError) {
    console.error("Balance snapshot insert error:", balanceError);
  }

  // Reset modal and form
  setShowModal(false);
  setName("");
  setType("Checking");
  setBalance("");
  setInstitution("");
  setCurrency("USD");
  setColor("#ffa500");

  // Refresh account list
  const { data } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at", { ascending: false });

  setAccounts(data || []);
};

const updateAccountBalance = async (accountId: string, newBalance: number) => {
  const { error } = await supabase
    .from("accounts")
    .update({ balance: newBalance })
    .eq("id", accountId);

  if (error) {
    console.error("Account update error:", error);
    return;
  }

  const { error: snapshotError } = await supabase
    .from("account_balances")
    .insert([
      {
        account_id: accountId,
        balance: newBalance,
        recorded_at: new Date().toISOString().substring(0, 10)
      }
    ]);

  if (snapshotError) {
    console.error("Snapshot insert error:", snapshotError);
  }
};

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Accounts</h2>
        <button
          onClick={() => setShowModal(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded"
        >
          + Add Account
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && <div>Loading...</div>}
        {!loading && accounts.map((account) => (
          <div key={account.id} className="border p-4 rounded shadow">
            <div className="text-sm text-gray-500">{account.type}</div>
            <div className="text-lg font-bold">{account.name}</div>
            <div className="text-green-600 font-semibold">
              {account.currency} {account.balance.toFixed(2)}
            </div>
            {account.institution && <div className="text-sm text-gray-400">{account.institution}</div>}
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Account</h2>

            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border p-2 rounded w-full mb-3"
            />

            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="border p-2 rounded w-full mb-3"
            >
              <option value="Checking">Checking</option>
              <option value="Savings">Savings</option>
              <option value="Credit Card">Credit Card</option>
              <option value="Investment">Investment</option>
              <option value="Loan">Loan</option>
            </select>

            <input
              type="number"
              placeholder="Balance"
              value={balance}
              onChange={(e) => setBalance(Number(e.target.value))}
              className="border p-2 rounded w-full mb-3"
            />

            <input
              type="text"
              placeholder="Institution (optional)"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              className="border p-2 rounded w-full mb-3"
            />

            <input
              type="text"
              placeholder="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="border p-2 rounded w-full mb-3"
            />

            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-full mb-4"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border rounded"
              >
                Cancel
              </button>
              <button
                onClick={addAccount}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
