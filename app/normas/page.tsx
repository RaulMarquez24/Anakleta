import { getRulesConfig, RULE_FIELDS } from "@/lib/rules";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { AppShell } from "@/components/AppShell";
import { RulesEditor, type RuleFieldView } from "@/components/RulesEditor";

export const dynamic = "force-dynamic";

export default async function NormasPage() {
  const [user, cfg] = await Promise.all([getCurrentUser(), getRulesConfig()]);

  const fields: RuleFieldView[] = RULE_FIELDS.map((f) => ({
    key: f.key,
    label: f.label,
    help: f.help,
    min: f.min,
    max: f.max,
    unit: f.unit,
    value: cfg[f.prop],
  }));

  return (
    <AppShell email={user?.email} title="Normas">
      <p className="mb-4 text-sm text-ink-soft">
        Estos ajustes controlan cómo la app aplica las normas: la ventana para robar espejo, el
        umbral de warns, la inactividad y el balance de donaciones. Los cambios se reflejan en
        Actividad, en las fichas y en el detalle de guerra.
      </p>
      <RulesEditor fields={fields} />
    </AppShell>
  );
}
