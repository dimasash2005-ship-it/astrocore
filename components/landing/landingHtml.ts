// Куди: components/landing/landingHtml.ts
// Розмітка лендингу (англійська за замовчуванням, українська вмикається перемикачем).
export const LANDING_HTML = `
<nav class="top" id="nav"><div class="wrap">
  <a class="brand" href="#top" aria-label="AstroCore">
    <span class="mark"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 3 20h5.5L12 13l2.2 4.2H11L12.6 20H21z" fill="#E8002A"/></svg></span>
    <span>Astro<em>Core</em></span>
  </a>
  <div class="links"><a href="#demo">Demo</a><a href="#features">Features</a><a href="#reports">Reports</a><a href="#how">How it works</a><a href="#faq">FAQ</a><a href="/guides">Guides</a></div>
  <div class="nav-cta"><div class="lang" role="group" aria-label="Language"><button type="button" id="lang-en" aria-pressed="true">EN</button><button type="button" id="lang-uk" aria-pressed="false">UA</button></div><a class="btn btn-text" href="/login">Sign in</a><a class="btn btn-red" href="/register">Start free</a></div>
</div></nav>

<header class="hero" id="top"><canvas id="floor" aria-hidden="true"></canvas><div class="wrap">
  <span class="status"><i></i>Free during beta</span>
  <h1>The home for your <em>AI agent</em></h1>
  <p class="lead">You already have an agent. AstroCore gives it a workspace: chat, memory, files and reports in one place. Connect your OpenClaw agent, Claude or your own API, and stop living in a terminal and Telegram.</p>
  <div class="ctas"><a class="btn btn-red" href="/register">Start free →</a><a class="btn btn-ghost" href="#demo" id="watch">▶ Watch the demo</a></div>
  <div class="chips"><span class="lbl">Works with</span>
    <span class="chip" style="background:rgba(232,0,42,.12);color:#FF4D6A"><i style="background:#E8002A"></i>OpenClaw</span>
    <span class="chip" style="background:rgba(217,119,87,.12);color:var(--claude)"><i style="background:var(--claude)"></i>Claude</span>
    <span class="chip" style="background:rgba(16,163,127,.12);color:var(--openai)"><i style="background:var(--openai)"></i>OpenAI</span>
    <span class="chip" style="background:rgba(66,133,244,.12);color:var(--gemini)"><i style="background:var(--gemini)"></i>Gemini</span>
    <span class="chip" style="background:rgba(139,92,246,.12);color:var(--custom)"><i style="background:var(--custom)"></i>Custom</span>
  </div>
  <div class="mock-wrap"><div class="mock" id="mock" role="img" aria-label="AstroCore app: chat with an agent and a finished report">
    <div class="win-top"><i></i><i></i><i></i><span>astrocore.one/chat</span></div>
    <div class="mock-body">
      <div class="m-rail"><b></b><b class="on"></b><b></b><b></b><b></b><b></b></div>
      <div class="m-chat">
        <div class="bub u">Research the top 5 AI agent platforms and compare their pricing.</div>
        <div class="step">Searching 14 sources…</div>
        <div class="step">Building comparison table…</div>
        <div class="step">Report saved to Reports</div>
        <div class="bub a">Done. I compared 5 platforms on price, models and limits. The full report with charts is in Reports.</div>
      </div>
      <div class="m-report">
        <div class="mtabs"><span>TEXT</span><span class="on">CHARTS</span><span>SOURCES</span></div>
        <h4>Agent platforms · price per seat</h4>
        <div class="mbars"><i style="height:78%"></i><i style="height:52%"></i><i style="height:94%"></i><i style="height:36%"></i><i style="height:61%"></i><i style="height:45%"></i></div>
        <div class="src"><span>docs.example.com/pricing</span><span>blog.example.ai/agents</span><span>+12 more</span></div>
      </div>
    </div>
    <div class="glare"></div>
  </div></div>
</div></header>


<main class="stage" id="stage">
<div class="spine" aria-hidden="true"><div class="fill"></div><div class="head"></div></div>


<section class="s sheet" id="demo"><span class="laser"></span><div class="wrap">
  <div class="head"><span class="eyebrow">See it in action</span><h2>AstroCore in 46 seconds</h2><p>From a scattered agent in a terminal and Telegram to one workspace with agents, providers and reports.</p></div>
  <div class="vwin">
    <div class="win-top"><i></i><i></i><i></i><span>astrocore.one · demo</span></div>
    <video id="demo-video" src="/astrocore-demo.mp4" poster="/astrocore-demo-poster.jpg" muted loop playsinline preload="metadata" controls></video>
  </div>
  <div class="vmeta"><span><b>0:46</b> <span class="vlen">length</span></span><span class="vauto">Plays muted when you scroll here</span><button type="button" class="sound" id="sound">🔊 Sound on</button></div>
</div></section>



<section class="ac-collapse" id="problem"><div class="pin"><div class="wrap">
  <div class="head"><span class="eyebrow">The problem</span><h2>Your agent lives in a terminal, Telegram and ten tabs</h2><p>Keep scrolling and watch them fold into one home for your agent.</p></div>
  <div class="cstage" id="cstage">
    <span class="ctab" style="--x:8%;--y:12%;--r:-8deg">Terminal</span>
    <span class="ctab" style="--x:30%;--y:4%;--r:5deg">SSH root@vps</span>
    <span class="ctab" style="--x:72%;--y:8%;--r:-4deg">Telegram bot</span>
    <span class="ctab" style="--x:92%;--y:22%;--r:9deg">config.yaml</span>
    <span class="ctab" style="--x:4%;--y:52%;--r:6deg">.env</span>
    <span class="ctab" style="--x:95%;--y:58%;--r:-7deg">API keys.txt</span>
    <span class="ctab" style="--x:12%;--y:90%;--r:-5deg">Error logs</span>
    <span class="ctab" style="--x:38%;--y:96%;--r:7deg">Notion</span>
    <span class="ctab" style="--x:66%;--y:94%;--r:-9deg">Google Docs</span>
    <span class="ctab" style="--x:88%;--y:88%;--r:4deg">Screenshots</span>
    <div class="cwin" id="cwin">
      <div class="win-top"><i></i><i></i><i></i><span>astrocore.one</span></div>
      <h3>One <em>AstroCore</em></h3>
      <ul><li>Your agent in one window</li><li>Memory that survives restarts</li><li>Results land in Reports automatically</li><li>Files, keys and notes in one place</li></ul>
    </div>
  </div>
</div></div></section>



<section class="s sheet" id="features"><canvas id="space" aria-hidden="true"></canvas><span class="laser"></span><div class="wrap">
  <div class="head"><span class="eyebrow">Everything in one environment</span><h2>Your agent at the core, eight tools around it</h2><p>AstroCore is not another agent. It is the environment around the one you already have. Every tool shares its memory, so your agent can read your vault, write to Reports and post to the forum without you copying anything.</p></div>
  <div class="sys">
    <div class="orbit" id="orbit">
      <div class="orb-ring r1"></div><div class="orb-ring r2"></div><div class="orb-ring r3"></div>
      <div class="core"><svg width="54" height="54" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 3 20h5.5L12 13l2.2 4.2H11L12.6 20H21z" fill="#E8002A"/></svg><small>YOUR AGENT</small></div>
    </div>
    <div class="pinfo" id="pinfo" aria-live="polite"></div>
  </div>
</div></section>



<section class="s sheet" id="reports"><span class="laser"></span><div class="wrap">
  <div class="head"><span class="eyebrow">Core feature · Reports</span><h2>Your OpenClaw agent hands you a finished report</h2></div>
  <div class="rstage">
    <div class="rmeta">
      <p class="muted" style="margin:0">Give your agent a task in chat or let it run on a schedule. When it finishes, the result lands in Reports with the text, the charts and every source it used in separate tabs. No more digging through Telegram messages.</p>
      <dl><dt>Task</dt><dd>Compare 5 agent platforms</dd><dt>Agent</dt><dd>My OpenClaw</dd><dt>Run time</dt><dd>6 min 12 s</dd><dt>Sources</dt><dd>14 pages</dd><dt>Output</dt><dd>1 summary · 2 charts</dd></dl>
      <a class="btn btn-red" href="/register" style="justify-self:start">Try it free →</a>
    </div>
    <div class="rwin">
      <div class="win-top"><i></i><i></i><i></i><span>astrocore.one/reports/my-openclaw</span></div>
      <div class="rhead"><span class="ex">Example report · My OpenClaw</span><h3>AI agent platforms: pricing compared</h3></div>
      <div class="rtabs" role="tablist" aria-label="Report sections">
        <button role="tab" id="t-text" aria-selected="true" aria-controls="p-text">TEXT</button>
        <button role="tab" id="t-charts" aria-selected="false" aria-controls="p-charts">CHARTS</button>
        <button role="tab" id="t-sources" aria-selected="false" aria-controls="p-sources">SOURCES</button>
      </div>
      <div class="rpanel" id="p-text" role="tabpanel" aria-labelledby="t-text">
        <p><b>Summary.</b> Five platforms were compared on monthly price per seat, supported models and usage limits. Prices range from $12 to $40 per seat. Two platforms let you bring your own API key, which lowers cost for heavy users.</p>
        <p>Platform C is the most expensive but includes the highest usage limit. Platform D is the cheapest and supports only one model family.</p>
        <div class="kf"><div><b>$12–40</b><span>price per seat / month</span></div><div><b>2 of 5</b><span>allow your own API key</span></div><div><b>14</b><span>sources checked</span></div></div>
      </div>
      <div class="rpanel" id="p-charts" role="tabpanel" aria-labelledby="t-charts" hidden>
        <svg class="chart" viewBox="0 0 600 300" role="img" aria-label="Bar chart of price per seat: A $32, B $22, C $40, D $12, E $26">
          <defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF1A3E"/><stop offset="1" stop-color="rgba(232,0,42,.25)"/></linearGradient></defs>
          <g stroke="rgba(255,255,255,.08)"><line x1="50" y1="250" x2="580" y2="250"/><line x1="50" y1="190" x2="580" y2="190"/><line x1="50" y1="130" x2="580" y2="130"/><line x1="50" y1="70" x2="580" y2="70"/></g>
          <text x="40" y="254" text-anchor="end">$0</text><text x="40" y="194" text-anchor="end">$10</text><text x="40" y="134" text-anchor="end">$20</text><text x="40" y="74" text-anchor="end">$30</text><text x="40" y="14" text-anchor="end">$40</text>
          <line x1="50" y1="10" x2="580" y2="10" stroke="rgba(255,255,255,.08)"/>
          <rect class="b" x="80"  y="58"  width="64" height="192" rx="5"/><text class="val" x="112" y="50" text-anchor="middle">$32</text><text x="112" y="272" text-anchor="middle">A</text>
          <rect class="b" x="185" y="118" width="64" height="132" rx="5"/><text class="val" x="217" y="110" text-anchor="middle">$22</text><text x="217" y="272" text-anchor="middle">B</text>
          <rect class="b" x="290" y="10"  width="64" height="240" rx="5"/><text class="val" x="322" y="26" text-anchor="middle" style="fill:#fff">$40</text><text x="322" y="272" text-anchor="middle">C</text>
          <rect class="b" x="395" y="178" width="64" height="72"  rx="5"/><text class="val" x="427" y="170" text-anchor="middle">$12</text><text x="427" y="272" text-anchor="middle">D</text>
          <rect class="b" x="500" y="94"  width="64" height="156" rx="5"/><text class="val" x="532" y="86" text-anchor="middle">$26</text><text x="532" y="272" text-anchor="middle">E</text>
          <text class="cap" x="315" y="294" text-anchor="middle">Price per seat per month, platforms A–E (example data)</text>
        </svg>
      </div>
      <div class="rpanel" id="p-sources" role="tabpanel" aria-labelledby="t-sources" hidden>
        <ol class="srcs">
          <li><span class="n">01</span>Platform A pricing page<span class="d">example.com</span></li>
          <li><span class="n">02</span>Platform B docs: usage limits<span class="d">example.org</span></li>
          <li><span class="n">03</span>Platform C plans and seats<span class="d">example.net</span></li>
          <li><span class="n">04</span>Review: agent tools in 2026<span class="d">example.blog</span></li>
          <li><span class="n">05</span>Platform E changelog<span class="d">example.dev</span></li>
          <li><span class="n">··</span>9 more sources<span class="d"></span></li>
        </ol>
      </div>
    </div>
  </div>
</div></section>



<section class="s sheet" id="how"><span class="laser"></span><div class="wrap">
  <div class="head"><span class="eyebrow">How it works</span><h2>Connect your OpenClaw agent in 3 clicks</h2><p>Then manage it from one place: chat, memory, files and reports. No terminal and no SSH.</p></div>
  <div class="conv" id="conv">
    <svg viewBox="0 0 1000 110" aria-hidden="true">
      <path id="track" class="track" d="M60 55 C 230 5, 330 105, 500 55 S 770 5, 940 55"/>
      <path id="trail" class="trail" d="M60 55 C 230 5, 330 105, 500 55 S 770 5, 940 55"/>
      <circle class="node" id="n0" cx="60" cy="55" r="13"/><circle class="node" id="n1" cx="500" cy="55" r="13"/><circle class="node" id="n2" cx="940" cy="55" r="13"/>
      <circle class="dot" id="cdot" cx="60" cy="55" r="7"/>
    </svg>
    <div class="csteps">
      <div class="cs" id="c0"><span class="n">STEP 1 · CONNECT</span><h3>Connect your OpenClaw agent</h3><p>Pick OpenClaw, paste your key and press Launch. Three clicks and no terminal.</p></div>
      <div class="cs" id="c1"><span class="n">STEP 2 · WORKSPACE</span><h3>Give it a workspace</h3><p>Choose which memory, files and tools your agent can use. No terminal and no config files.</p></div>
      <div class="cs" id="c2"><span class="n">STEP 3 · REPORT</span><h3>Get the report</h3><p>The agent does the work and saves the result to <code>Reports</code> with sources and charts.</p></div>
    </div>
  </div>
</div></section>



<section class="s lined" id="security"><span class="laser"></span><div class="wrap">
  <div class="strip">
    <div><h3>Encrypted API keys</h3><p>Stored encrypted and used only to call the provider you chose.</p></div>
    <div><h3>Built in the EU</h3><p>GDPR-aligned. No ads, and we never sell your data.</p></div>
    <div><h3>You own your content</h3><p>Chats, agents and reports are yours. Delete everything any time.</p></div>
  </div>
</div></section>

<section class="s lined" id="faq"><span class="laser"></span><div class="wrap">
  <div class="head"><span class="eyebrow">FAQ</span><h2>Questions people ask first</h2></div>
  <div class="faq">
    <details open><summary>Is AstroCore free?</summary><p>Yes, AstroCore is free during beta. You pay your AI provider directly for the tokens you use with your own key.</p></details>
    <details><summary>What can I connect?</summary><p>Your OpenClaw agent, Claude, OpenAI, Gemini and any OpenAI-compatible custom endpoint.</p></details>
    <details><summary>Does AstroCore only work with OpenClaw?</summary><p>No. OpenClaw is where we started, but we are building a larger ecosystem. We keep adding new features, and support for connecting other agents is on the way.</p></details>
    <details><summary>Do I need to know how to code?</summary><p>No. You connect your agent in a few clicks and work with it in a normal interface instead of a terminal.</p></details>
    <details><summary>Where are my API keys stored?</summary><p>Encrypted in our database, never shown again after you save them, and used only for your requests.</p></details>
  </div>
</div></section>


<section class="final sheet"><span class="laser"></span><div class="wrap">
  <span class="eyebrow">Free during beta</span>
  <h2>Give your agent a real <em>home</em></h2>
  <p class="muted" style="margin:0">No card needed. Bring your own API key.</p>
  <div class="ctas"><a class="btn btn-red" href="/register">Start free →</a><a class="btn btn-ghost" href="https://t.me/AstroCore_Manager" target="_blank" rel="noopener">Join on Telegram</a></div>
</div></section>
</main>

<footer><div class="wrap">
  <span>© 2026 AstroCore AI</span>
  <a href="/guides">Guides</a><a href="/terms">Terms</a><a href="/privacy-policy">Privacy</a><a href="https://t.me/AstroCore_Manager" target="_blank" rel="noopener">Telegram</a>
  <span class="sp">astrocore.one@outlook.cz</span>
</div></footer>
`;