"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Auth() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const sendCode = async () => {
    setErr(null);
    setMsg(null);
    if (!email) {
      setErr("Ingresa tu correo.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true, // signup si no existe
        // Si también usas magic link, puedes setear emailRedirectTo: window.location.origin
      },
    });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setMsg("Te enviamos un código al correo.");
    setStep("code");
  };

  const verifyCode = async () => {
    setErr(null);
    setMsg(null);
    if (!email || !token) {
      setErr("Completa el correo y el código.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email", // OTP por email
    });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    // Si todo ok, Supabase setea la sesión y page.tsx mostrará la app
    setMsg("¡Listo! Ingresando…");
  };

  return (
    <div className="grid min-h-screen place-items-center bg-[#f3f4f6] dark:bg-zinc-900">
      <div
        className={[
          "w-[min(92vw,420px)] rounded-2xl border p-6 shadow-xl",
          "border-white/30 bg-white/70 backdrop-blur-2xl",
          "dark:border-zinc-700/40 dark:bg-zinc-900/60",
        ].join(" ")}
      >
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Accede a VitaFin
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Te enviaremos un código a tu correo para iniciar sesión.
          </p>
        </div>

        {step === "email" && (
          <div className="space-y-3">
            <input
              type="email"
              placeholder="tuemail@ejemplo.com"
              className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              onClick={sendCode}
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-tr from-blue-600 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? "Enviando…" : "Enviar código"}
            </button>
          </div>
        )}

        {step === "code" && (
          <div className="space-y-3">
            <div className="text-sm text-zinc-600 dark:text-zinc-300">
              Enviamos un código a: <b>{email}</b>
            </div>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Código de 6 dígitos"
              className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm shadow-sm outline-none backdrop-blur dark:border-zinc-700/40 dark:bg-zinc-800/60"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <button
              onClick={verifyCode}
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-tr from-blue-600 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? "Verificando…" : "Ingresar"}
            </button>

            <button
              type="button"
              onClick={() => setStep("email")}
              className="w-full rounded-xl border border-white/30 bg-white/70 px-4 py-2 text-sm text-zinc-800 shadow-sm transition hover:bg-white dark:border-zinc-700/40 dark:bg-zinc-800/60 dark:text-zinc-200"
            >
              Cambiar correo
            </button>
          </div>
        )}

        {(err || msg) && (
          <div className="mt-4 text-sm">
            {err && (
              <div className="rounded-xl border border-rose-300/50 bg-rose-50/70 px-3 py-2 text-rose-700">
                {err}
              </div>
            )}
            {msg && (
              <div className="rounded-xl border border-emerald-300/50 bg-emerald-50/70 px-3 py-2 text-emerald-700">
                {msg}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
