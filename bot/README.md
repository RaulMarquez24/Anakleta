# Bot de Añakleta (Fly.io)

Proceso 24/7 conectado al gateway de Discord. Comparte la BD de Supabase con la app.

## Requisitos previos (una vez)

1. **Message Content Intent**: en el Discord Developer Portal → tu app → **Bot** →
   activa **MESSAGE CONTENT INTENT** y guarda.
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
  SIGNUP_CHANNEL_ID=1234567890   # opcional
```

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
- La tabla `cwl_signups` debe existir en Supabase (ver `supabase/optimize.sql`).
- Para probar en local: `npm install`, copia `.env.example` a `.env`, `npm start`.
