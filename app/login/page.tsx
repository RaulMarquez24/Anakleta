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
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10"
      style={{
        background:
          "radial-gradient(125% 80% at 50% -8%, #45301b 0%, #241608 52%, #140c06 100%)",
      }}
    >
      {/* Luz de antorcha tras el escudo (la apuesta atmosférica) */}
      <div
        aria-hidden
        className="ember-glow pointer-events-none absolute left-1/2 top-[14%] h-72 w-72 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(244,183,64,0.4), transparent 70%)" }}
      />
      {/* Viñeta para dar profundidad */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: "inset 0 0 220px rgba(0,0,0,0.65)" }}
      />

      <div className="relative z-10 w-full max-w-sm">
        {/* Escudo (lleva el nombre y el lema del clan) */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="crest-float crest-in">
            <Image
              src="/logo.jpg"
              alt="Escudo del clan Añakleta"
              width={200}
              height={200}
              priority
              className="h-32 w-32 rounded-3xl shadow-[0_0_55px_rgba(244,183,64,0.35)] ring-2 ring-gold/50 sm:h-36 sm:w-36"
            />
          </div>
          <p className="rise-in mt-5 text-[11px] font-extrabold uppercase tracking-[0.42em] text-[#e7c78e]">
            Sala de mando
          </p>
        </div>

        {/* Panel de acceso */}
        <form
          onSubmit={onSubmit}
          className="rise-in space-y-4 rounded-2xl border border-gold/25 bg-white/[0.045] p-6 shadow-2xl backdrop-blur-sm"
          style={{ animationDelay: "0.08s" }}
        >
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wide text-[#c9af84]">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="tu@email.com"
              className="w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-2.5 text-[#f6e9d2] placeholder-[#8a7a5c] outline-none transition focus:border-gold/70 focus:ring-2 focus:ring-gold/25"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wide text-[#c9af84]">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-2.5 text-[#f6e9d2] placeholder-[#8a7a5c] outline-none transition focus:border-gold/70 focus:ring-2 focus:ring-gold/25"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-banner/40 bg-banner/20 px-3 py-2 text-sm font-semibold text-[#ffc2bb]"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl px-4 py-3 text-base font-extrabold text-[#2a1808] shadow-lg transition hover:brightness-105 active:translate-y-px disabled:opacity-60"
            style={{ backgroundImage: "linear-gradient(to bottom, #f7c34e, #c9860f)" }}
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="rise-in mt-5 text-center text-[11px] text-[#a8916e]" style={{ animationDelay: "0.16s" }}>
          Acceso por invitación · líder y colíderes
        </p>
      </div>
    </main>
  );
}
