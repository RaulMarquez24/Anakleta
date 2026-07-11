# Bot de Añakleta (Fly.io)

Proceso 24/7 conectado al gateway de Discord. Comparte la BD de Supabase con la app.

## Requisitos previos (una vez)

1. **Intents privilegiados**: en el Discord Developer Portal → tu app → **Bot** →
   activa **MESSAGE CONTENT INTENT** y **SERVER MEMBERS INTENT** y guarda.
   (Server Members hace falta para saludar cuando alguien entra al servidor.)
2. Instala **flyctl**: https://fly.io/docs/hactl/install/ y `fly auth login`.

## Desplegar

Desde esta carpeta (`bot/`):

```bash
fly launch --no-deploy      # crea la app (elige nombre y región, p.ej. mad). Acepta el Dockerfile.
```

Pon los secretos (mismos valores de Supabase que en Vercel):

```bash
fly secrets set \
  DISCORD_BOT_TOKEN=xxxxx \
  DISCORD_GUILD_ID=1234567890 \
  SUPABASE_URL=https://xxxx.supabase.co \
  SUPABASE_SECRET_KEY=xxxxx \
  COC_API_BASE_URL=https://cocproxy.royaleapi.dev/v1 \
  COC_API_TOKEN=xxxxx \
  WELCOME_CHANNEL_ID=1234567890 \
  SIGNUP_CHANNEL_ID=1234567890   # opcional
```

`COC_API_TOKEN` (mismo que Vercel) es para la bienvenida: traduce el tag que pega
el usuario a su nombre de CoC. `WELCOME_CHANNEL_ID` = el general (saludo de
respaldo si tiene los MD cerrados). Para poner el apodo, el bot necesita el
permiso **Gestionar apodos** y su rol por encima del de esa persona.

`DISCORD_GUILD_ID` es opcional pero recomendado: registra los slash commands
(`/apuntar`, `/desapuntar`, `/lista-cwl`) al instante en ese servidor. Sin él se
registran globalmente y tardan ~1 h en aparecer.

Despliega:

```bash
fly deploy
```

Comprueba que arrancó:

```bash
fly logs        # deberías ver "Bot conectado como ..."
```

## Comandos

- **Texto libre** (en el canal de inscripciones): «me apunto», «me desapunto»,
  «¿estoy apuntado?», «¿cómo me apunto?» — con tolerancia a erratas.
- **Slash commands** (en cualquier canal): `/apuntar`, `/desapuntar`, `/lista-cwl`.

> Para que aparezcan los slash commands, el bot debe haberse invitado con el scope
> **`applications.commands`** (además de `bot`). Si lo invitaste solo con `bot`,
> vuelve a generar el enlace en el portal (OAuth2 → URL Generator) marcando ambos.

## Notas

- Debe estar **siempre encendido** (el gateway es una conexión persistente). El
  `fly.toml` no define auto-stop; si Fly te lo apagara, usa
  `fly scale count 1` y evita `auto_stop_machines`.
- Las inscripciones van atadas a la **temporada activa**: hay que ejecutar
  `supabase/cwl.sql` (crea `cwl_lists` + `cwl_signups` y siembra la config en
  `settings`). Sin una lista creada, el bot responde «inscripciones no abiertas».
- Para asignar el **rol CWL** al inscribirse, el bot necesita el permiso
  **Manage Roles** y que su rol esté **por encima** del rol CWL en la jerarquía
  del servidor. Sin eso, la inscripción funciona igual pero no asigna rol.
- Para probar en local: `npm install`, copia `.env.example` a `.env`, `npm start`.
