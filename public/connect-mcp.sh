#!/usr/bin/env bash
# AsCore — install the AsCore MCP tools for an OpenClaw agent.
# Normally called by connect-agent.sh (step 4). Can also be run on its own:
#   curl -fsSL https://<ascore>/connect-mcp.sh | bash
# (the key is then read from /etc/ascore-agent/agent.env)
#
# What it does (safe to re-run):
#   1. puts the MCP server into /opt/astrocore-mcp/server.js
#   2. installs its two npm dependencies there (only when missing)
#   3. registers it in OpenClaw as "astrocore" (openclaw mcp set)
#   4. checks it with openclaw mcp probe (expects 12 tools)

set -euo pipefail

ASTROCORE_URL="${ASTROCORE_URL:-https://astrocore.one}"
ASTROCORE_URL="${ASTROCORE_URL%/}"
ASTROCORE_API_KEY="${ASTROCORE_API_KEY:-}"
ENV_FILE="/etc/ascore-agent/agent.env"
MCP_DIR="/opt/astrocore-mcp"

ok()   { printf '    · %s\n' "$1"; }
fail() { printf '    ✗ %s\n' "$1" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "Запусти від root (або через sudo)."
if [ -z "$ASTROCORE_API_KEY" ] && [ -r "$ENV_FILE" ]; then
  ASTROCORE_API_KEY="$(sed -n 's/^ASTROCORE_API_KEY=//p' "$ENV_FILE" | head -n1)"
fi
case "$ASTROCORE_API_KEY" in ac_live_*) ;; *) fail "Немає ключа ASTROCORE_API_KEY (ac_live_...)." ;; esac
for cmd in node npm openclaw curl; do
  command -v "$cmd" >/dev/null 2>&1 || fail "Не знайдено «$cmd»."
done

# 1. server file
install -d -m 755 "$MCP_DIR"
curl -fsSL --max-time 30 "${ASTROCORE_URL}/astrocore-mcp.mjs" -o "${MCP_DIR}/server.new.mjs" \
  || fail "Не вдалося завантажити ${ASTROCORE_URL}/astrocore-mcp.mjs"
node --check "${MCP_DIR}/server.new.mjs" >/dev/null 2>&1 \
  || { rm -f "${MCP_DIR}/server.new.mjs"; fail "Завантажений MCP-сервер пошкоджений."; }

# server.js must run as an ES module, which package.json "type": "module" provides.
if [ ! -f "${MCP_DIR}/package.json" ]; then
  cat > "${MCP_DIR}/package.json" <<'EOF'
{
  "name": "astrocore-mcp",
  "private": true,
  "type": "module",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.17.0",
    "zod": "^3.25.0"
  }
}
EOF
fi
node -e '
  const fs = require("fs"), p = process.argv[1];
  const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
  if (pkg.type !== "module") { pkg.type = "module"; fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n"); }
' "${MCP_DIR}/package.json"
mv -f "${MCP_DIR}/server.new.mjs" "${MCP_DIR}/server.js"
chmod 644 "${MCP_DIR}/server.js"
ok "MCP-сервер: ${MCP_DIR}/server.js"

# 2. dependencies (only if missing — an existing working install is left alone)
if [ ! -d "${MCP_DIR}/node_modules/@modelcontextprotocol/sdk" ] || [ ! -d "${MCP_DIR}/node_modules/zod" ]; then
  ok "Встановлюю залежності (npm, ~30 с)…"
  if ! (cd "$MCP_DIR" && npm install --omit=dev --no-audit --no-fund --loglevel=error >/dev/null 2>&1); then
    (cd "$MCP_DIR" && npm install @modelcontextprotocol/sdk zod --omit=dev --no-audit --no-fund --loglevel=error >/dev/null 2>&1) \
      || fail "npm install не вдався. Спробуй вручну: cd ${MCP_DIR} && npm install"
  fi
fi
ok "Залежності на місці"

# 3. register in OpenClaw (JSON built by node, so the key is escaped correctly)
MCP_JSON="$(SERVER="${MCP_DIR}/server.js" KEY="$ASTROCORE_API_KEY" BASE="$ASTROCORE_URL" NODE_BIN="$(command -v node)" node -e '
  process.stdout.write(JSON.stringify({
    command: process.env.NODE_BIN,
    args: [process.env.SERVER],
    env: { ASTROCORE_API_KEY: process.env.KEY, ASTROCORE_BASE_URL: process.env.BASE },
  }))')"
openclaw mcp set astrocore "$MCP_JSON" >/dev/null 2>&1 || fail "openclaw mcp set не вдався."
ok "Зареєстровано в OpenClaw як «astrocore»"

# 4. probe
PROBE="$(openclaw mcp probe astrocore 2>&1 || true)"
TOOLS="$(printf '%s' "$PROBE" | grep -Eo 'astrocore: [0-9]+ tools' | grep -Eo '[0-9]+' | head -n1 || true)"
if [ "${TOOLS:-0}" -ge 12 ]; then
  ok "Перевірка: агент бачить ${TOOLS} інструментів AsCore"
else
  printf '%s\n' "$PROBE" | tail -n 5 >&2
  fail "openclaw mcp probe не бачить інструментів AsCore (лог вище)."
fi

# OpenClaw picks up MCP changes on restart.
openclaw gateway restart >/dev/null 2>&1 || systemctl restart openclaw-gateway 2>/dev/null || true