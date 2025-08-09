"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Profile, Theme, CurrencyCode, HomePage } from "@/types/profile";

/* ========== Glass UI helpers ========== */
function Card({
  className = "",
  children,
  title,
  subtitle,
  footer,
}: {
  className?: string;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
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
      {(title || subtitle) && (
        <div className="mb-3">
          {title && (
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
          )}
          {subtitle && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
          )}
        </div>
      )}
      {children}
      {footer && <div className="mt-3">{footer}</div>}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1">
      <span className="text-sm text-zinc-600 dark:text-zinc-300">{label}</span>
      {children}
    </label>
  );
}

/* ========== Settings ========== */
export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  // profile state
  const [profile, setProfile] = useState<Profile | null>(null);

  // local form state (for optimistic editing)
  const [displayName, setDisplayName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [timezone, setTimezone] = useState<string>("UTC");
  const [country, setCountry] = useState<string>("");
  const [theme, setTheme] = useState<Theme>("system");
  const [homePage, setHomePage] = useState<HomePage>("Dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [currencyPrimary, setCurrencyPrimary] = useState<CurrencyCode>("USD");
  const [dateFormat, setDateFormat] =
    useState<"YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY">("YYYY-MM-DD");
  const [numberFormat, setNumberFormat] =
    useState<"1,234.56" | "1.234,56">("1,234.56");
  const [reportsDefaultRange, setReportsDefaultRange] =
    useState<"30d" | "month" | "ytd">("month");

  // load current user + profile
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id ?? null;
      const em = sessionData.session?.user?.email ?? null;
      if (!uid || !mounted) {
        setLoading(false);
        return;
      }
      setUserId(uid);
      setEmail(em);

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();

      let prof = data as Profile | null;

      // if not exists, create defaults
      if (!prof) {
        const defaults = {
          user_id: uid,
          display_name: null,
          avatar_url: null,
          timezone: "UTC",
          country: null,
          theme: "system" as Theme,
          language: "en",
          home_page: "Dashboard" as HomePage,
          sidebar_collapsed: false,
          currency_primary: "USD" as CurrencyCode,
          date_format: "YYYY-MM-DD" as const,
          number_format: "1,234.56" as const,
          reports_default_range: "month" as const,
          chart_prefs: {},
          notifications: {},
        };
        const { data: created, error } = await supabase
          .from("profiles")
          .insert([defaults])
          .select()
          .single();
        if (!error) prof = created as Profile;
      }

      if (mounted && prof) {
        setProfile(prof);
        setDisplayName(prof.display_name ?? "");
        setAvatarUrl(prof.avatar_url ?? "");
        setTimezone(prof.timezone ?? "UTC");
        setCountry(prof.country ?? "");
        setTheme(prof.theme);
        setHomePage(prof.home_page);
        setSidebarCollapsed(prof.sidebar_collapsed);
        setCurrencyPrimary(prof.currency_primary);
        setDateFormat(prof.date_format);
        setNumberFormat(prof.number_format);
        setReportsDefaultRange(prof.reports_default_range);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const lastUpdated = useMemo(
    () => (profile?.updated_at ? new Date(profile.updated_at).toLocaleString() : "—"),
    [profile?.updated_at]
  );

  async function saveProfile(partial: Partial<Profile>) {
    if (!userId) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("profiles")
      .update(partial)
      .eq("user_id", userId)
      .select()
      .single();

    setSaving(false);
    if (error) {
      alert(error.message);
      return;
    }
    const p = data as Profile;
    setProfile(p);
  }

  async function handleAvatarChange(file: File) {
    if (!userId) return;
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${userId}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, cacheControl: "3600" });
    if (upErr) {
      alert(upErr.message);
      return;
    }

    const { data: publicURL } = supabase.storage
      .from("avatars")
      .getPublicUrl(path);

    const url = publicURL.publicUrl;
    setAvatarUrl(url);
    await saveProfile({ avatar_url: url });
  }

  if (loading) {
    return (
      <div className="text-zinc-500 dark:text-zinc-400">Loading settings…</div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 sm:p-8">
      <Card
        title="Settings"
        subtitle="Customize your experience, manage your account and your data."
        footer={
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Last updated: {lastUpdated}
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Profile & Account */}
          <Card title="Profile & Account" subtitle="Visibility and basic info.">
            <Row>
              <Labeled label="Email">
                <input
                  value={email ?? ""}
                  disabled
                  className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none dark:border-zinc-700/40 dark:bg-zinc-800/60"
                />
              </Labeled>
              <Labeled label="Display name">
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none dark:border-zinc-700/40 dark:bg-zinc-800/60"
                />
              </Labeled>
              <Labeled label="Time zone">
                <input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="e.g., America/Costa_Rica"
                  className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none dark:border-zinc-700/40 dark:bg-zinc-800/60"
                />
              </Labeled>
              <Labeled label="Country">
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none dark:border-zinc-700/40 dark:bg-zinc-800/60"
                />
              </Labeled>
              <Labeled label="Avatar">
                <div className="flex items-center gap-3">
                  <img
                    src={avatarUrl || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="}
                    alt="avatar"
                    className="h-12 w-12 rounded-xl object-cover border border-white/30 dark:border-zinc-700/40"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.currentTarget.files?.[0];
                      if (f) void handleAvatarChange(f);
                    }}
                    className="text-sm text-zinc-600 dark:text-zinc-300"
                  />
                </div>
              </Labeled>
            </Row>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() =>
                  saveProfile({
                    display_name: displayName || null,
                    timezone: timezone || null,
                    country: country || null,
                  })
                }
                disabled={saving}
                className="rounded-xl bg-gradient-to-tr from-blue-600 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save profile"}
              </button>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                }}
                className="rounded-xl border border-white/30 bg-white/70 px-4 py-2 text-sm shadow-sm transition hover:bg-white dark:border-zinc-700/40 dark:bg-zinc-800/60"
              >
                Sign out
              </button>
            </div>
          </Card>

          {/* Appearance */}
          <Card title="Appearance" subtitle="Theme, language and start page.">
            <Row>
              <Labeled label="Theme">
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as Theme)}
                  className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none dark:border-zinc-700/40 dark:bg-zinc-800/60"
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </Labeled>
              <Labeled label="Start page">
                <select
                  value={homePage}
                  onChange={(e) => setHomePage(e.target.value as HomePage)}
                  className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none dark:border-zinc-700/40 dark:bg-zinc-800/60"
                >
                  {[
                    "Dashboard","Accounts","Transactions","Cash Flow",
                    "Reports","Budget","Recurring","Goals","Investments","Settings",
                  ].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </Labeled>
              <Labeled label="Collapse sidebar by default">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={sidebarCollapsed}
                    onChange={(e) => setSidebarCollapsed(e.target.checked)}
                  />
                  <span className="text-sm text-zinc-600 dark:text-zinc-300">Collapse</span>
                </div>
              </Labeled>
              <Labeled label="Language (UI)">
                <select
                  value={profile?.language ?? "en"}
                  onChange={(e) =>
                    setProfile((prev) =>
                      prev ? { ...prev, language: e.target.value } : prev
                    )
                  }
                  className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none dark:border-zinc-700/40 dark:bg-zinc-800/60"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                </select>
              </Labeled>
            </Row>
            <div className="mt-3">
              <button
                onClick={() =>
                  saveProfile({
                    theme,
                    home_page: homePage,
                    sidebar_collapsed: sidebarCollapsed,
                    language: profile?.language ?? "en",
                  })
                }
                disabled={saving}
                className="rounded-xl bg-gradient-to-tr from-blue-600 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save appearance"}
              </button>
            </div>
          </Card>

          {/* Currency & Formatting */}
          <Card title="Currency & Formatting" subtitle="Number and date preferences.">
            <Row>
              <Labeled label="Primary currency">
                <select
                  value={currencyPrimary}
                  onChange={(e) => setCurrencyPrimary(e.target.value as CurrencyCode)}
                  className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none dark:border-zinc-700/40 dark:bg-zinc-800/60"
                >
                  <option value="USD">USD ($)</option>
                  <option value="CRC">CRC (₡)</option>
                </select>
              </Labeled>
              <Labeled label="Date format">
                <select
                  value={dateFormat}
                  onChange={(e) =>
                    setDateFormat(e.target.value as "YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY")
                  }
                  className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none dark:border-zinc-700/40 dark:bg-zinc-800/60"
                >
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                </select>
              </Labeled>
              <Labeled label="Number format">
                <select
                  value={numberFormat}
                  onChange={(e) =>
                    setNumberFormat(e.target.value as "1,234.56" | "1.234,56")
                  }
                  className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none dark:border-zinc-700/40 dark:bg-zinc-800/60"
                >
                  <option value="1,234.56">1,234.56</option>
                  <option value="1.234,56">1.234,56</option>
                </select>
              </Labeled>
              <Labeled label="Default Reports range">
                <select
                  value={reportsDefaultRange}
                  onChange={(e) =>
                    setReportsDefaultRange(e.target.value as "30d" | "month" | "ytd")
                  }
                  className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none dark:border-zinc-700/40 dark:bg-zinc-800/60"
                >
                  <option value="30d">Last 30 days</option>
                  <option value="month">Current month</option>
                  <option value="ytd">YTD</option>
                </select>
              </Labeled>
            </Row>
            <div className="mt-3">
              <button
                onClick={() =>
                  saveProfile({
                    currency_primary: currencyPrimary,
                    date_format: dateFormat,
                    number_format: numberFormat,
                    reports_default_range: reportsDefaultRange,
                  })
                }
                disabled={saving}
                className="rounded-xl bg-gradient-to-tr from-blue-600 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save formatting"}
              </button>
            </div>
          </Card>

          {/* Data */}
          <Card title="Data" subtitle="Export or delete your data.">
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-xl border border-white/30 bg-white/70 px-4 py-2 text-sm shadow-sm transition hover:bg-white dark:border-zinc-700/40 dark:bg-zinc-800/60"
                onClick={async () => {
                  // Simple export: basic JSON dump
                  const [acc, exp, inc, goals, budgets] = await Promise.all([
                    supabase.from("accounts").select("*"),
                    supabase.from("expenses").select("*"),
                    supabase.from("incomes").select("*"),
                    supabase.from("goals").select("*"),
                    supabase.from("budgets").select("*"),
                  ]);
                  const payload = {
                    accounts: acc.data ?? [],
                    expenses: exp.data ?? [],
                    incomes: inc.data ?? [],
                    goals: goals.data ?? [],
                    budgets: budgets.data ?? [],
                  };
                  const blob = new Blob([JSON.stringify(payload, null, 2)], {
                    type: "application/json",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "vitafin-export.json";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Export JSON
              </button>

              <button
                className="rounded-xl border border-rose-300/50 bg-rose-50/70 px-4 py-2 text-sm text-rose-700 shadow-sm transition hover:bg-rose-100 dark:border-rose-800/40 dark:bg-rose-900/20 dark:text-rose-300"
                onClick={async () => {
                  const sure = confirm(
                    "This will delete your profile (not your financial records). Continue?"
                  );
                  if (!sure || !userId) return;
                  const { error } = await supabase
                    .from("profiles")
                    .delete()
                    .eq("user_id", userId);
                  if (error) alert(error.message);
                  else {
                    alert("Profile deleted. It will be recreated with defaults on reload.");
                    location.reload();
                  }
                }}
              >
                Delete profile
              </button>
            </div>
          </Card>

          {/* Danger zone */}
          <Card
            title="Danger zone"
            subtitle="Destructive actions. Use with care."
          >
            <div className="space-y-2">
              <button
                className="rounded-xl border border-rose-300/50 bg-rose-50/70 px-4 py-2 text-sm text-rose-700 shadow-sm transition hover:bg-rose-100 dark:border-rose-800/40 dark:bg-rose-900/20 dark:text-rose-300"
                onClick={async () => {
                  const sure = confirm(
                    "Delete ALL your accounts, expenses, incomes, budgets and goals. This cannot be undone. Continue?"
                  );
                  if (!sure) return;
                  // Careful order if you have FKs
                  await supabase.from("goal_contributions").delete().neq("id", "");
                  await supabase.from("goals").delete().neq("id", "");
                  await supabase.from("recurring_payments").delete().neq("id", "");
                  await supabase.from("recurrings").delete().neq("id", "");
                  await supabase.from("expenses").delete().neq("id", "");
                  await supabase.from("incomes").delete().neq("id", "");
                  await supabase.from("budgets").delete().neq("id", "");
                  await supabase.from("account_balances").delete().neq("id", "");
                  await supabase.from("accounts").delete().neq("id", "");
                  alert("All data deleted");
                }}
              >
                Delete all my data
              </button>
            </div>
          </Card>
        </div>
      </Card>
    </div>
  );
}
