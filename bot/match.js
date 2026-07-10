// Detección de intención (apuntarse / preguntar / desapuntarse) tolerante a
// erratas. Diccionarios de frases y palabras clave + distancia de Levenshtein.

export function normalize(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // sin tildes
    .replace(/(.)\1{2,}/g, "$1$1"); // "apuntoooo" -> "apuntoo"
}

function tokens(text) {
  return text.replace(/[^a-z0-9+\s]/g, " ").split(/\s+/).filter(Boolean);
}

function lev(a, b) {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 2) return 3; // corta pronto: nos basta con "<=2"
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

// ¿algún token se parece a `word` (tolerando erratas según su longitud)?
function fuzzyHas(toks, word) {
  const maxD = word.length <= 5 ? 1 : 2;
  return toks.some((t) => t === word || lev(t, word) <= maxD);
}

// --- Diccionarios ---
// Desapuntarse (se comprueba antes que apuntarse por los "no me apunto", etc.)
const REMOVE_PHRASES = [
  "me desapunto", "desapuntame", "me borro", "borrame", "me salgo", "me bajo",
  "quitame", "me quito", "ya no juego", "ya no voy", "ya no participo",
  "no me apunto", "no participo", "no voy a jugar", "-1",
];
const REMOVE_WORDS = ["desapunto", "desapuntame", "desapuntarme", "borrame", "salgo", "quitame"];

// Estado (preguntas). Frases explícitas o pregunta ("?") + palabra clave.
const STATUS_PHRASES = [
  "estoy apuntad", "estoy en la lista", "estoy dentro", "sigo apuntad",
  "estoy anotad", "me apunte",
];

// Apuntarse.
const JOIN_PHRASES = [
  "me apunto", "apuntame", "apuntarme", "me uno", "unirme", "me sumo",
  "cuenta conmigo", "cuenten conmigo", "quiero jugar", "quiero participar",
  "quiero cwl", "voy a la cwl", "voy a jugar", "yo juego", "yo voy",
  "estoy dentro", "me anoto", "anotame", "+1",
];
const JOIN_WORDS = ["apunto", "apuntame", "apuntarme", "participo", "participar", "anotame", "anoto"];

const anyPhrase = (text, arr) => arr.some((p) => text.includes(normalize(p)));

// Devuelve "status" | "unsignup" | "signup" | null.
export function classifyIntent(raw) {
  const isQuestion = /\?/.test(raw) || /^(estoy|voy|sigo)\b/.test(normalize(raw));
  const text = normalize(raw);
  const toks = tokens(text);
  const hasStem = (stem) => text.includes(stem);

  // 1) Pregunta de estado
  if (
    anyPhrase(text, STATUS_PHRASES) ||
    (isQuestion &&
      (hasStem("apunt") || hasStem("particip") || text.includes("lista") ||
        text.includes("dentro") || text.includes("anotad")))
  ) {
    return "status";
  }

  // 2) Desapuntarse
  if (anyPhrase(text, REMOVE_PHRASES) || fuzzyHas(toks, "desapunto") || REMOVE_WORDS.some((w) => fuzzyHas(toks, w))) {
    return "unsignup";
  }

  // 3) Apuntarse
  if (
    anyPhrase(text, JOIN_PHRASES) ||
    hasStem("apunt") ||
    hasStem("particip") ||
    JOIN_WORDS.some((w) => fuzzyHas(toks, w))
  ) {
    return "signup";
  }

  return null;
}
