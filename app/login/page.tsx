"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      const rateLimited = error.status === 429 || /rate limit/i.test(error.message);
      setError(
        rateLimited
          ? "Demasiados intentos. Espera un momento y vuelve a intentarlo."
          : "Email o contraseña incorrectos.",
      );
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm">
        {/* Logo del clan (ya incluye nombre y lema) */}
        <div className="mb-6 text-center">
          <h1 className="sr-only">Añakleta · Fuerza y Unión</h1>
          <Image
            src="/logo.jpg"
            alt="Escudo del clan Añakleta"
            width={200}
            height={200}
            priority
            className="mx-auto h-auto w-44 rounded-3xl shadow-xl sm:w-48"
          />
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-xl"
        >
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-bold text-ink">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-ink outline-none focus:border-sky"
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-bold text-ink">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-ink outline-none focus:border-sky"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-banner/12 px-3 py-2 text-sm font-semibold text-banner">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-grass px-4 py-3 text-base font-extrabold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
