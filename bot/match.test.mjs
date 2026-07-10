// Batería de casos para el clasificador de intención de la CWL.
// Ejecutar con:  npm test   (desde bot/)
// Añade aquí cada frase nueva que quieras cubrir antes de tocar el diccionario:
// si una entrada mete un falso positivo, este test lo caza al instante.

import { classifyIntent } from "./match.js";

const cases = [
  // --- apuntarse ---
  ["me apunto", "signup"],
  ["Me apunto!!!", "signup"],
  ["me apuntoooo", "signup"],
  ["me apunte", "signup"],
  ["me anoto", "signup"],
  ["me uno", "signup"],
  ["me sumo", "signup"],
  ["me meto", "signup"],
  ["me inscribo", "signup"],
  ["quiero apuntarme", "signup"],
  ["quiero unirme", "signup"],
  ["quiero jugar la cwl", "signup"],
  ["me gustaria participar", "signup"],
  ["participo", "signup"],
  ["Participó", "signup"],
  ["yo participo", "signup"],
  ["yo voy", "signup"],
  ["yo me apunto", "signup"],
  ["entro", "signup"],
  ["Entro", "signup"],
  ["cuenta conmigo", "signup"],
  ["contad conmigo", "signup"],
  ["apuntame", "signup"],
  ["ponme en la lista", "signup"],
  ["añademe", "signup"],
  ["estoy dentro", "signup"],
  ["+1", "signup"],
  ["me apunto +1", "signup"],
  ["partisipo", "signup"],
  ["me apunt", "signup"],
  // afirmaciones cortas
  ["voy", "signup"],
  ["yo", "signup"],
  ["dentro", "signup"],
  ["presente", "signup"],
  ["claro", "signup"],
  // --- desapuntarse ---
  ["me desapunto", "unsignup"],
  ["desapuntame", "unsignup"],
  ["me borro", "unsignup"],
  ["quitame", "unsignup"],
  ["me salgo", "unsignup"],
  ["me doy de baja", "unsignup"],
  ["me bajo de la cwl", "unsignup"],
  ["al final no voy a jugar", "unsignup"],
  ["no puedo jugar", "unsignup"],
  ["ya no juego", "unsignup"],
  ["no voy", "unsignup"],
  ["paso de la cwl", "unsignup"],
  ["-1", "unsignup"],
  // --- estado (¿estoy apuntado?) ---
  ["¿estoy apuntado?", "status"],
  ["estoy apuntado?", "status"],
  ["yo estoy apuntado?", "status"],
  ["sigo apuntado", "status"],
  ["estoy en la lista?", "status"],
  ["me apuntaste?", "status"],
  ["me tienes en la lista?", "status"],
  ["aparezco en la lista?", "status"],
  ["mira si estoy apuntado", "status"],
  ["participo?", "status"],
  // --- ayuda (¿cómo me apunto?) ---
  ["como me apunto?", "help"],
  ["¿cómo me apunto?", "help"],
  ["como participo", "help"],
  ["donde me apunto", "help"],
  ["como se apunta uno", "help"],
  ["que hago para apuntarme", "help"],
  ["como funciona la cwl", "help"],
  ["alguien sabe como me uno a la cwl?", "help"],
  // --- ruido / null ---
  ["si no se apuntan 9 mas no hay liga", null],
  ["alguien sabe algo", null],
  ["buenas a todos", null],
  ["que tal la guerra", null],
  ["gg equipo", null],
  ["como va la guerra", null],
  ["ya casi ganamos", null],
];

let ok = 0;
const fails = [];
for (const [input, expected] of cases) {
  const got = classifyIntent(input);
  if (got === expected) ok++;
  else fails.push(`  FAIL  ${JSON.stringify(input)}  esperado=${expected}  got=${got}`);
}

if (fails.length) console.log(fails.join("\n"));
console.log(`\n${ok}/${cases.length} correctos`);
if (fails.length) process.exit(1);
