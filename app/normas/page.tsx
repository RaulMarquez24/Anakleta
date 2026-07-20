import {
  getRulesConfig,
  getRulesText,
  getAllTokenValues,
  RULE_FIELDS,
  RULE_TEXT_FIELDS,
  ALL_RULE_FIELDS,
  RULE_TEXT_BLOCKS,
} from "@/lib/rules";
import { discordConfigured } from "@/lib/discord";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { AppShell } from "@/components/AppShell";
import { RulesEditor, type RuleFieldView } from "@/components/RulesEditor";
import { RulesTextEditor, type RuleTextView } from "@/components/RulesTextEditor";

export const dynamic = "force-dynamic";

export default async function NormasPage() {
  const [user, cfg, text, tokens] = await Promise.all([
    getCurrentUser(),
    getRulesConfig(),
    getRulesText(),
    getAllTokenValues(),
  ]);

  const appFields: RuleFieldView[] = RULE_FIELDS.map((f) => ({
    key: f.key,
    label: f.label,
    help: f.help,
    min: f.min,
    max: f.max,
    unit: f.unit,
    value: f.prop ? cfg[f.prop] : (tokens[f.token] ?? 0),
  }));

  const textFields: RuleFieldView[] = RULE_TEXT_FIELDS.map((f) => ({
    key: f.key,
    label: f.label,
    help: f.help,
    min: f.min,
    max: f.max,
    unit: f.unit,
    value: tokens[f.token] ?? f.default ?? 0,
  }));

  const blocks: RuleTextView[] = RULE_TEXT_BLOCKS.map((b) => ({
    key: b.key,
    title: b.title,
    value: text[b.key] ?? b.default,
  }));

  const legend = ALL_RULE_FIELDS.map((f) => ({
    token: f.token,
    label: f.label,
    value: tokens[f.token] ?? 0,
  }));

  return (
    <AppShell email={user?.email} title="Normas" back="/">
      {/* Texto de las normas + publicación en Discord */}
      <h2 className="mb-1 text-lg font-extrabold text-ink">Reglas del clan</h2>
      <p className="mb-3 text-sm text-ink-soft">
        Edita el texto de las normas y publícalo en Discord con un clic. Los tokens{" "}
        <code className="text-gold-deep">{"{…}"}</code> se sustituyen por el valor configurado abajo,
        así el texto se mantiene solo.
      </p>
      <RulesTextEditor
        blocks={blocks}
        discordReady={discordConfigured}
        tokens={tokens}
        legend={legend}
      />

      {/* Valores que aparecen en el texto (solo afectan al texto) */}
      <h2 className="mb-1 mt-8 text-lg font-extrabold text-ink">Valores de las normas</h2>
      <p className="mb-3 text-sm text-ink-soft">
        Números que aparecen en el texto (puntos de Juegos del Clan, ataques obligatorios, días para
        avisar…). Cambian el texto publicado, no la lógica de la app.
      </p>
      <RulesEditor fields={textFields} />

      {/* Ajustes con los que la app aplica las normas */}
      <h2 className="mb-1 mt-8 text-lg font-extrabold text-ink">Cómo la app aplica las normas</h2>
      <p className="mb-3 text-sm text-ink-soft">
        Estos valores controlan la ventana para robar espejo, el umbral de warns, la inactividad y el
        balance de donaciones. Afectan a Actividad, a las fichas y al detalle de guerra (y también
        aparecen como tokens en el texto).
      </p>
      <RulesEditor fields={appFields} />
    </AppShell>
  );
}
