// Detección de intención tolerante a erratas para la inscripción a la CWL.
// Intenciones: "help" (¿cómo me apunto?) · "status" (¿estoy apuntado?) ·
// "unsignup" (me desapunto) · "signup" (me apunto) · null (ruido).
//
// Estrategia: sobre todo FRASES en subcadena (0 falsos positivos) y, solo para
// palabras largas y específicas del dominio, coincidencia difusa (Levenshtein).
// Las palabras cortas/ambiguas NUNCA van en fuzzy (chocan con el habla normal).

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

// --- Diccionarios (todo en minúscula y sin tildes: se comparan ya normalizados) ---

// AYUDA: "¿cómo me apunto?", "¿dónde participo?", "¿qué hago para apuntarme?"…
const HELP_PHRASES = [
  "como me apunto", "como me anoto", "como me uno", "como me sumo", "como me meto",
  "como me inscribo", "como me registro", "como participo", "como entro", "como juego",
  "como se apunta", "como se apunta uno", "como se participa", "como se juega",
  "como se inscribe", "como se anota", "como se entra",
  "como puedo apuntarme", "como puedo participar", "como puedo jugar", "como puedo entrar",
  "como hago para apuntarme", "como hago para participar", "como hago para jugar",
  "como hago para entrar", "como funciona la cwl", "como funciona esto",
  "como funciona la liga", "como va lo de la cwl", "como va esto de la cwl",
  "donde me apunto", "donde me anoto", "donde me inscribo", "donde participo",
  "donde me uno", "donde hay que apuntarse",
  "que hago para apuntarme", "que hago para participar", "que hago para jugar",
  "que hay que hacer para", "que tengo que hacer para", "que tengo que poner para",
  "que se pone para apuntarse", "como me apunto a la cwl", "como participo en la cwl",
];
// Regla genérica: palabra de "cómo/dónde" + raíz de apuntarse en el mismo mensaje.
const HOW_WORDS = /(^|\s)(como|komo|kmo|cmo|donde|dnd)(\s|$)/;
const SIGNUP_STEM = /(apunt|particip|unir|sumo|sumar|anot|inscrib|registr|jueg|jugar|entr|me meto|meterme)/;

// ESTADO (preguntas de si estoy dentro). Frases que casi siempre son consulta.
const STATUS_PHRASES = [
  "estoy apuntad", "estoy anotad", "estoy inscrit", "estoy incluid", "estoy metid",
  "estoy en la lista", "estoy en la cwl", "estoy en la guerra",
  "sigo apuntad", "sigo anotad", "sigo inscrit", "sigo dentro", "sigo en la lista",
  "me apuntaste", "me anotaste", "me pusiste", "me metiste", "me inscribiste",
  "me registraste", "me contaste", "me incluiste", "me apunte ya",
  "me tienes apuntad", "me tienes anotad", "me tienes en la lista", "me tienes en la cwl",
  "aparezco", "figuro", "salgo en la lista",
  "quede apuntad", "quede anotad", "quede dentro",
  "mira si estoy", "revisa si estoy", "chequea si estoy", "comprueba si estoy",
  "confirma si estoy", "confirmame si estoy", "puedes ver si estoy", "puedes mirar si estoy",
  "estoy o no", "voy o no", "cuento o no",
];

// DESAPUNTARSE (se comprueba antes que apuntarse).
const REMOVE_PHRASES = [
  "me desapunto", "desapuntame", "desapuntadme", "me borro", "borrame", "borradme",
  "me salgo", "me bajo", "me bajo de la cwl", "quitame", "quitadme", "sacame", "sacadme",
  "me quito", "me retiro", "me retiro de la cwl", "me caigo", "me piro",
  "me doy de baja", "dame de baja", "darme de baja", "me tengo que bajar",
  "tengo que desapuntarme", "borra mi cuenta", "quita mi cuenta",
  "ya no juego", "ya no voy", "ya no participo", "ya no puedo", "ya no me apunto",
  "no me apunto", "no participo", "no voy a jugar", "no voy a participar",
  "no voy a entrar", "no puedo jugar", "no puedo participar", "no podre",
  "no voy a poder", "no puedo esta cwl", "esta cwl no puedo",
  "al final no", "al final no puedo", "al final no voy",
  "no cuenten conmigo", "no conteis conmigo", "no me conteis",
  "paso de la cwl", "paso esta vez", "cancelo", "anulame", "fuera", "-1",
];
// Palabras largas y específicas (fuzzy). Nada corto ni ambiguo.
const REMOVE_WORDS = [
  "desapunto", "desapuntame", "desapuntarme", "desapuntar", "borrame",
  "quitame", "sacame", "retiro", "cancelo", "anulame",
];

// APUNTARSE — frases (subcadena) en 1ª persona / imperativas hacia el bot.
const JOIN_PHRASES = [
  "me apunto", "me apunte", "me anoto", "me anote", "me uno", "unirme", "me sumo",
  "me meto", "me pongo", "me ofrezco", "me inscribo", "me registro",
  "quiero apuntarme", "quiero apuntar", "me quiero apuntar", "quiero unirme",
  "quiero inscribirme", "quiero registrarme", "me gustaria apuntarme",
  "me gustaria participar", "me gustaria jugar", "quiero jugar", "quiero participar",
  "quiero entrar", "quiero jugar la cwl", "quiero la cwl", "quiero entrar a la cwl",
  "voy a la cwl", "voy a jugar", "voy a participar", "voy a entrar", "voy a apuntarme",
  "yo juego", "yo participo", "yo entro", "yo voy", "yo me apunto", "yo tambien juego",
  "juego la cwl", "juego yo", "estoy dentro", "me apunto a la cwl", "me apunto yo",
  "cuenta conmigo", "cuenten conmigo", "contad conmigo", "contar conmigo",
  "apuntame", "apuntadme", "anotame", "anotadme", "sumame", "meteme",
  "ponme", "ponme en la lista", "meteme en la lista", "agregame", "añademe",
  "pongo mi cuenta", "meto mi cuenta", "va me apunto", "claro que me apunto",
];
// Palabras clave (token, maxD=1). Solo verbos largos de 1ª persona / imperativos.
// OJO: nunca "apunto" suelto en fuzzy (choca con "apunta/apuntan" de 3ª persona).
const JOIN_WORDS = [
  "participo", "apuntame", "apuntarme", "apuntenme", "apuntadme", "entro", "entrar",
  "anoto", "anotame", "anotadme", "sumame", "meteme", "inscribo", "inscribirme", "+1",
];

// Afirmaciones cortas: valen SOLO en mensajes de ≤3 palabras y sin negación.
const AFFIRM = [
  "yo", "voy", "presente", "aqui", "dentro", "entro", "apunto", "participo",
  "tambien", "conmigo", "in", "sip", "claro", "vale", "obvio",
];

function affirmHit(toks) {
  if (toks.length === 0 || toks.length > 3) return false;
  return toks.some((t) =>
    AFFIRM.some((a) => t === a || (a.length >= 5 && lev(t, a) <= 1)),
  );
}

// Devuelve "help" | "status" | "unsignup" | "signup" | null.
export function classifyIntent(raw) {
  const text = normalize(raw);
  const toks = tokens(text);
  // Solo "?" cuenta como pregunta. Los estados sin "?" ("estoy apuntado") ya los
  // capta STATUS_PHRASES; así "estoy dentro" suelto queda libre para ser apunte.
  const isQuestion = /\?/.test(raw);
  const hasStem = (s) => text.includes(s);
  const negated = /(^|\s)(no|ya no|tampoco)(\s|$)/.test(text);
  // Negación PEGADA a un verbo de juego ("no voy", "ya no juego"). No usamos
  // "liga"/"cwl": "no hay liga" no es desapuntarse.
  const negatedPlay =
    /(^|\s)(no|ya no|tampoco)\s+(voy|juego|jugare|jugar|participo|participar|apunto|entro|cuento|puedo|podre)\b/.test(
      text,
    );

  // 1) Estado explícito por frase ("estoy apuntado", "me tienes en la lista").
  if (anyPhrase(text, STATUS_PHRASES)) return "status";

  // 2) Ayuda: cómo/dónde apuntarse. Antes que el resto para no confundir
  //    "¿cómo me apunto?" con un apunte real.
  if (anyPhrase(text, HELP_PHRASES) || (HOW_WORDS.test(text) && SIGNUP_STEM.test(text))) {
    return "help";
  }

  // 3) Estado por pregunta genérica (? + raíz).
  if (
    isQuestion &&
    (hasStem("apunt") || hasStem("particip") || text.includes("lista") ||
      text.includes("dentro") || text.includes("anotad") || text.includes("inscrit") ||
      text.includes("aparezc") || text.includes("figur") || text.includes("incluid") ||
      text.includes("metid") || text.includes("cuento"))
  ) {
    return "status";
  }

  // 4) Desapuntarse.
  if (
    anyPhrase(text, REMOVE_PHRASES) ||
    REMOVE_WORDS.some((w) => fuzzyHas(toks, w)) ||
    negatedPlay
  ) {
    return "unsignup";
  }

  // 5) Apuntarse (frases 1ª persona o palabras clave con erratas).
  if (anyPhrase(text, JOIN_PHRASES) || JOIN_WORDS.some((w) => fuzzyHas(toks, w, 1))) {
    return "signup";
  }

  // 6) Afirmación corta ("yo", "voy", "dentro"…), sin negación.
  if (!negated && affirmHit(toks)) return "signup";

  return null;
}
