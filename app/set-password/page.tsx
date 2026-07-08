"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

// Página a la que llega el invitado desde el email. El enlace de Supabase trae
// la sesión en el hash (#access_token=...); la establecemos y dejamos que elija
// su contraseña. Vale también para "recuperar contraseña".
export default function SetPasswordPage() {
  const router = useRouter();
  const [supabase] = useState(() => createBrowserClient());
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : "";
        const hp = new URLSearchParams(hash);
        const at = hp.get("access_token");
        const rt = hp.get("refresh_token");
        const code = new URLSearchParams(window.location.search).get("code");
        if (at && rt) {
          await supabase.auth.setSession({ access_token: at, refresh_token: rt });
          history.replaceState(null, "", window.location.pathname); // limpia el hash
        } else if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }
      } catch {
        // enlace inválido/caducado; se refleja en !ready abajo
      }
      const { data } = await supabase.auth.getSession();
      setReady(Boolean(data.session));
      setChecking(false);
    })();
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError("No se pudo guardar. El enlace puede haber caducado; pide otra invitación.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Image
            src="/logo.jpg"
            alt="Escudo del clan Añakleta"
            width={160}
            height={160}
            priority
            className="mx-auto h-auto w-36 rounded-3xl shadow-xl"
          />
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-xl">
          {checking ? (
            <p className="text-center text-sm font-semibold text-ink-soft">Cargando…</p>
          ) : !ready ? (
            <div className="space-y-2 text-center">
              <p className="font-bold text-ink">Enlace no válido o caducado</p>
              <p className="text-sm text-ink-soft">
                Pídele al líder que te envíe una invitación nueva.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <h1 className="font-extrabold text-ink">Elige tu contraseña</h1>
                <p className="text-sm text-ink-soft">Para entrar al panel del clan.</p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="p1" className="block text-sm font-bold text-ink">Contraseña</label>
                <input
                  id="p1"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-ink outline-none focus:border-sky"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="p2" className="block text-sm font-bold text-ink">Repite la contraseña</label>
                <input
                  id="p2"
                  type="password"
                  required
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-ink outline-none focus:border-sky"
                  autoComplete="new-password"
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
                className="w-full rounded-xl bg-grass px-4 py-3 text-base font-extrabold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {loading ? "Guardando…" : "Guardar y entrar"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
