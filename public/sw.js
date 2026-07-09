// Service worker mínimo: su única función es habilitar la instalación de la PWA
// (Chrome exige un SW con manejador de fetch). No cachea nada: deja pasar todas
// las peticiones tal cual, así los datos siguen siendo siempre frescos.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // Passthrough: no llamamos a respondWith, el navegador gestiona la petición.
});
