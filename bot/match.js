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

function fuzzyHas(toks, word, maxD = word.length <= 5 ? 1 : 2) {
  return toks.some((t) => t === word || lev(t, word) <= maxD);
}

const anyPhrase = (text, arr) => arr.some((p) => text.includes(normalize(p)));

// --- Diccionarios ---

// Desapuntarse (se comprueba antes que apuntarse).
const REMOVE_PHRASES = [
  "me desapunto", "desapuntame", "me borro", "borrame", "me salgo", "me bajo",
  "quitame", "quitadme", "sacame", "me quito", "me retiro", "me caigo",
  "ya no juego", "ya no voy", "ya no participo", "no me apunto", "no participo",
  "no voy a jugar", "no puedo jugar", "no podre", "no voy a poder", "al final no",
  "no cuenten conmigo", "cancelo", "anulame", "fuera", "-1",
];
// "salgo" fuera: en fuzzy chocaba con "algo".
const REMOVE_WORDS = [
  "desapunto", "desapuntame", "desapuntarme", "borrame", "quitame",
  "sacame", "retiro", "cancelo", "anulame",
];

// Estado (preguntas): frases explícitas, o pregunta ("?") + palabra clave.
const STATUS_PHRASES = [
  "estoy apuntad", "estoy en la lista", "estoy dentro", "sigo apuntad",
  "estoy anotad", "me apunte", "me apuntaste", "me pusiste", "me metiste",
  "estoy incluid", "aparezco", "figuro",
];

// Apuntarse — frases (subcadena) en 1ª persona.
const JOIN_PHRASES = [
  "me apunto", "me uno", "unirme", "quiero unirme", "me sumo", "sumame",
  "me meto", "meteme", "cuenta conmigo", "cuenten conmigo", "contad conmigo",
  "quiero jugar", "quiero participar", "quiero entrar", "quiero cwl",
  "quiero la cwl", "voy a la cwl", "voy a jugar", "voy a participar",
  "yo juego", "yo participo", "yo entro", "yo voy", "estoy dentro",
  "me anoto", "me pongo", "me ofrezco", "pongo mi cuenta", "meto mi cuenta",
];
// Palabras clave (token, maxD=1: no confundir 1ª persona con "apuntan"/"se apunta").
const JOIN_WORDS = [
  "participo", "apuntame", "apuntarme", "apuntenme", "entro", "entrar",
  "anoto", "anotame", "anotadme", "sumame", "meteme", "+1",
];

// Afirmaciones cortas: valen SOLO si el mensaje es corto (≤3 palabras) y sin
// negación. Así "yo/voy/dentro/presente" cuentan sueltos, pero no en frases largas.
const AFFIRM = [
  "yo", "voy", "presente", "aqui", "dentro", "entro", "apunto", "participo",
  "tambien", "conmigo", "in",
];

function affirmHit(toks) {
  if (toks.length === 0 || toks.length > 3) return false;
  return toks.some((t) =>
    AFFIRM.some((a) => t === a || (a.length >= 5 && lev(t, a) <= 1)),
  );
}

// Devuelve "status" | "unsignup" | "signup" | null.
export function classifyIntent(raw) {
  const text = normalize(raw);
  const toks = tokens(text);
  const isQuestion = /\?/.test(raw) || /^(estoy|sigo)\b/.test(text);
  const hasStem = (s) => text.includes(s);
  const negated = /(^|\s)(no|ya no|tampoco)(\s|$)/.test(text);
  // Negación PEGADA a un verbo de juego en 1ª persona ("no voy", "ya no juego").
  // No usamos "liga"/"cwl" aquí: "no hay liga" no es desapuntarse.
  const negatedPlay =
    /(^|\s)(no|ya no|tampoco)\s+(voy|juego|jugare|jugar|participo|participar|apunto|entro|cuento|puedo|podre)\b/.test(
      text,
    );

  // 1) Pregunta de estado
  if (
    anyPhrase(text, STATUS_PHRASES) ||
    (isQuestion &&
      (hasStem("apunt") || hasStem("particip") || text.includes("lista") ||
        text.includes("dentro") || text.includes("anotad") ||
        text.includes("aparezc") || text.includes("figur") || text.includes("incluid")))
  ) {
    return "status";
  }

  // 2) Desapuntarse (incluye negación + palabra de juego: "no voy", "no puedo jugar").
  if (
    anyPhrase(text, REMOVE_PHRASES) ||
    REMOVE_WORDS.some((w) => fuzzyHas(toks, w)) ||
    negatedPlay
  ) {
    return "unsignup";
  }

  // 3) Apuntarse (frases 1ª persona o palabras clave con erratas ajustadas)
  if (anyPhrase(text, JOIN_PHRASES) || JOIN_WORDS.some((w) => fuzzyHas(toks, w, 1))) {
    return "signup";
  }

  // 4) Afirmación corta ("yo", "voy", "dentro"…), sin negación
  if (!negated && affirmHit(toks)) return "signup";

  return null;
}
