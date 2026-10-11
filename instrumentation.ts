// instrumentation.ts  (in the project root, next to package.json)
//
// Next.js calls onRequestError for every unhandled server error: a crashed page,
// API route or server action. We forward it to your Telegram (see lib/server/alert.ts).

export async function register() {
    // nothing to set up
  }
  
  export async function onRequestError(
    err: unknown,
    request: { path: string; method: string },
    context: { routerKind: string; routePath: string; routeType: string },
  ) {
    const { notifyAdmin } = await import("./lib/server/alert")
    const e = err as { message?: string; digest?: string; stack?: string }
    const firstStackLine = (e?.stack ?? "").split("\n").slice(1, 2).join("").trim()
    await notifyAdmin({
      title: "Помилка на сервері",
      key: `server:${context.routePath}:${(e?.message ?? "").slice(0, 80)}`,
      lines: [
        `📄 ${request.method} ${request.path}`,
        `🧩 ${context.routeType} · ${context.routePath}`,
        `❌ ${e?.message ?? String(err)}`,
        firstStackLine ? `↳ ${firstStackLine}` : "",
        e?.digest ? `digest: ${e.digest}` : "",
      ],
    })
  }