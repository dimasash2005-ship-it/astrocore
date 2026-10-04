---
name: astrocore
description: Connect this agent to AstroCore (astrocore.one) — a web workspace where the owner chats with the agent (text, voice, photos) and the agent saves memory, reports and gallery items. Use when the owner asks to connect to AstroCore, or to save/read AstroCore memory, reports or gallery.
version: 1.0.0
metadata:
  openclaw:
    requires:
      env:
        - ASTROCORE_API_KEY
      bins:
        - curl
    primaryEnv: ASTROCORE_API_KEY
    emoji: "🪐"
    homepage: https://astrocore.one
    envVars:
      - name: ASTROCORE_API_KEY
        required: true
        description: The owner's AstroCore agent key (starts with ac_live_). Get it in AstroCore → Agents → Connect agent.
      - name: ASTROCORE_URL
        required: false
        description: AstroCore address. Defaults to https://astrocore.one.
---

# AstroCore

AstroCore is the owner's workspace for this agent: a chat in the browser and on
the phone (text, voice messages, photos), plus **Memory**, **Reports** and
**Gallery** that the agent can read and write.

Base URL: `${ASTROCORE_URL:-https://astrocore.one}`.
Every API call sends the owner's key in the `X-Api-Key` header. The key only
gives access to that owner's own data. Never print the key in a reply.

## 1. Connect the chat (one time, needs the owner's OK)

The AstroCore chat reaches this agent through a small service,
`ascore-connector`, that runs next to OpenClaw and connects *out* to AstroCore
(no open ports, no domain needed). It is installed by AstroCore's script.

Before running anything, tell the owner what will happen and ask for
confirmation: the script needs root, installs a systemd service
`ascore-connector` (Node 18+) and an MCP server `astrocore` for OpenClaw.

```bash
URL="${ASTROCORE_URL:-https://astrocore.one}"
curl -fsSL "$URL/connect-agent.sh" -o /tmp/astrocore-connect.sh
# let the owner review it if they want: less /tmp/astrocore-connect.sh
sudo ASTROCORE_URL="$URL" ASTROCORE_API_KEY="$ASTROCORE_API_KEY" bash /tmp/astrocore-connect.sh
```

Success ends with `✓ Готово` (the script waits until the connector reports in). Check any time:

```bash
systemctl status ascore-connector --no-pager
journalctl -u ascore-connector -n 30 --no-pager
```

After that the owner opens AstroCore → Chat, picks this agent and writes.
To update the connector later, run the same script again (the key is kept).

## 2. Voice replies in the AstroCore chat

If the owner wants a spoken answer and TTS is set up in OpenClaw (for example
ElevenLabs), generate the audio, save it to a file and put **one line** in the
reply:

```
MEDIA: /absolute/path/to/reply.mp3
```

The connector uploads it and the chat shows a voice message. Formats: mp3, ogg,
opus, m4a, wav, webm, up to 4 MB. Any other text in the reply is shown under it.

## 3. Memory, Reports, Gallery (HTTP API)

All endpoints: `GET` (list, `?id=&limit=&offset=`), `POST` (create),
`PATCH` (update, JSON with `id`), `DELETE` (JSON `{"id": "..."}`).

```bash
URL="${ASTROCORE_URL:-https://astrocore.one}"
H=(-H "X-Api-Key: $ASTROCORE_API_KEY" -H "Content-Type: application/json")
```

**Memory** — facts the owner wants the agent to remember (AstroCore adds them
to the agent's context in chat):

```bash
curl -s "${H[@]}" "$URL/api/agent/memory?limit=20"
curl -s "${H[@]}" -X POST "$URL/api/agent/memory" \
  -d '{"title":"Client: Acme","content":"Prefers short weekly updates.","source":"agent","tags":["client"]}'
```

**Reports** — finished work the owner should see (summary + optional chart):

```bash
curl -s "${H[@]}" -X POST "$URL/api/agent/reports" \
  -d '{"company_name":"Acme Q3 review","summary":"## Key points\n- Revenue +12%\n- Churn down","chart_data":{"labels":["Jul","Aug","Sep"],"values":[10,12,14]}}'
```

**Gallery** — images/videos made for the owner:

```bash
curl -s "${H[@]}" -X POST "$URL/api/agent/gallery" \
  -d '{"title":"Logo idea","content":"Red planet mark","type":"image","media_type":"image","status":"done","media_url":"https://example.com/logo.png"}'
```

Responses are JSON. `401` = wrong or revoked key (ask the owner for a new one in
AstroCore), `403` = the key lacks that permission, `400` = check the fields.

## Rules

- Ask before installing or restarting services; never run the installer silently.
- Save to Memory only what the owner wants remembered; no passwords or card numbers.
- Put long results in a Report and tell the owner it's in AstroCore → Reports.