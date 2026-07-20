import {
  getRulesText,
  getAllTokenValues,
  ALL_RULE_FIELDS,
  RULE_GROUP_ORDER,
  RULE_TEXT_BLOCKS,
} from "@/lib/rules";
import { discordConfigured } from "@/lib/discord";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { AppShell } from "@/components/AppShell";
import { RulesEditor, type RuleFieldView } from "@/components/RulesEditor";
import { RulesTextEditor, type RuleTextView } from "@/components/RulesTextEditor";

export const dynamic = "force-dynamic";

export default async function NormasPage() {
  const [user, text, tokens] = await Promise.all([
    getCurrentUser(),
    getRulesText(),
    getAllTokenValues(),
  ]);

  // Todos los valores en un único panel, ordenados por grupo temático.
  const ordered = [...ALL_RULE_FIELDS].sort((a, b) => {
    const ga = RULE_GROUP_ORDER.indexOf(a.group);
    const gb = RULE_GROUP_ORDER.indexOf(b.group);
    return (ga < 0 ? 99 : ga) - (gb < 0 ? 99 : gb);
  });
  const fields: RuleFieldView[] = ordered.map((f) => ({
    key: f.key,
    group: f.group,
    token: f.token,
    affectsApp: f.affectsApp,
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
        Edita las normas y publícalas en Discord. Toca un token{" "}
        <code className="text-gold-deep">{"{…}"}</code> para insertarlo: se sustituye por su valor
        configurado, así el texto se mantiene solo.
      </p>
      <RulesTextEditor
        blocks={blocks}
        discordReady={discordConfigured}
        tokens={tokens}
        legend={legend}
      />

      {/* Configuración de valores (unificada) */}
      <h2 className="mb-1 mt-8 text-lg font-extrabold text-ink">Valores de las normas</h2>
      <p className="mb-3 text-sm text-ink-soft">
        Ajusta cada valor con los botones. Se usan en el texto (como tokens) y algunos también
        controlan cómo la app aplica las normas (robo de espejo, warns, inactividad, donaciones).
      </p>
      <RulesEditor fields={fields} />
    </AppShell>
  );
}
