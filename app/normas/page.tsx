import {
  getRulesConfig,
  getRulesText,
  ruleTokenValues,
  RULE_FIELDS,
  RULE_TEXT_BLOCKS,
} from "@/lib/rules";
import { discordConfigured } from "@/lib/discord";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { AppShell } from "@/components/AppShell";
import { RulesEditor, type RuleFieldView } from "@/components/RulesEditor";
import { RulesTextEditor, type RuleTextView } from "@/components/RulesTextEditor";

export const dynamic = "force-dynamic";

export default async function NormasPage() {
  const [user, cfg, text] = await Promise.all([
    getCurrentUser(),
    getRulesConfig(),
    getRulesText(),
  ]);

  const fields: RuleFieldView[] = RULE_FIELDS.map((f) => ({
    key: f.key,
    label: f.label,
    help: f.help,
    min: f.min,
    max: f.max,
    unit: f.unit,
    value: cfg[f.prop],
  }));

  const blocks: RuleTextView[] = RULE_TEXT_BLOCKS.map((b) => ({
    key: b.key,
    title: b.title,
    value: text[b.key] ?? b.default,
  }));

  // Tokens disponibles (con su valor actual) para insertar en el texto.
  const tokens = ruleTokenValues(cfg);
  const legend = RULE_FIELDS.map((f) => ({
    token: f.token,
    label: f.label,
    value: cfg[f.prop],
  }));

  return (
    <AppShell email={user?.email} title="Normas" back="/">
      {/* Texto de las normas + publicación en Discord */}
      <h2 className="mb-1 text-lg font-extrabold text-ink">Reglas del clan</h2>
      <p className="mb-3 text-sm text-ink-soft">
        Edita el texto de las normas y publícalo en Discord con un clic (un mensaje por bloque, en el
        canal de reglas o de anuncios).
      </p>
      <RulesTextEditor
        blocks={blocks}
        discordReady={discordConfigured}
        tokens={tokens}
        legend={legend}
      />

      {/* Ajustes con los que la app aplica las normas */}
      <h2 className="mb-1 mt-8 text-lg font-extrabold text-ink">Cómo la app aplica las normas</h2>
      <p className="mb-3 text-sm text-ink-soft">
        Estos valores controlan la ventana para robar espejo, el umbral de warns, la inactividad y el
        balance de donaciones. Afectan a Actividad, a las fichas y al detalle de guerra.
      </p>
      <RulesEditor fields={fields} />
    </AppShell>
  );
}
