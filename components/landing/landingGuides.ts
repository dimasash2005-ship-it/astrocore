// Куди: components/landing/landingGuides.ts
// Блок "Guides" на лендингу + панель, що висувається справа.
// Сам вставляє себе перед FAQ і додає пункт "Guides" у меню. Інші файли лендингу не змінює.
// @ts-nocheck
export function initGuides(root: HTMLElement): () => void {
    var cleanups: Array<() => void> = [];
    var on = function (el: any, type: string, fn: any) { el.addEventListener(type, fn); cleanups.push(function () { el.removeEventListener(type, fn); }); };
  
    var GUIDES=[
    {slug:'what-is-astrocore',mins:3,
     en:{tag:'Product',title:'What is AstroCore AI?',desc:'A web home for your OpenClaw agent: chat, memory, files and reports in one place.',
     html:'<p><b>AstroCore AI</b> is a web workspace for OpenClaw agents. You already have an agent. AstroCore gives it a home in the browser, where you talk to it, give it tasks and get finished results back.</p><p>It is not another agent and not an AI model. It is the environment around the agent you already run.</p><h3>What you get</h3><ul><li><b>Chat in the browser</b>: text, voice and photos.</li><li><b>Memory</b> that survives restarts.</li><li><b>Reports</b>: finished work with text, charts and sources in separate tabs.</li><li><b>Vault and Gallery</b> for files and images.</li><li><b>Forum</b> to share agents and prompts.</li><li><b>Integrations</b> through MCP.</li></ul><p>Claude, OpenAI, Gemini and other APIs can be connected too, but the main focus is giving OpenClaw agents a proper home.</p><h3>Price</h3><p>Free during beta. You pay your own AI provider directly.</p><h3>Security</h3><p>Built in the EU, GDPR-aligned. Keys are stored encrypted. No ads, and your data is never sold.</p>'},
     uk:{tag:'Продукт',title:'Що таке AstroCore AI?',desc:'Веб-дім для твого OpenClaw-агента: чат, пам\'ять, файли й звіти в одному місці.',
     html:'<p><b>AstroCore AI</b> — це веб-середовище для OpenClaw-агентів. Агент у тебе вже є. AstroCore дає йому дім у браузері: тут ти з ним спілкуєшся, ставиш задачі й отримуєш готові результати.</p><p>Це не ще один агент і не AI-модель. Це середовище навколо агента, який у тебе вже працює.</p><h3>Що ти отримуєш</h3><ul><li><b>Чат у браузері</b>: текст, голос і фото.</li><li><b>Пам\'ять</b>, що не зникає після перезапуску.</li><li><b>Звіти</b>: готова робота з текстом, графіками й джерелами в окремих вкладках.</li><li><b>Сховище й Галерея</b> для файлів і зображень.</li><li><b>Форум</b>, щоб ділитися агентами й промптами.</li><li><b>Інтеграції</b> через MCP.</li></ul><p>Можна підключити й Claude, OpenAI, Gemini та інші API, але головне — дати OpenClaw-агенту нормальний дім.</p><h3>Ціна</h3><p>Безкоштовно під час бети. За токени платиш напряму своєму AI-провайдеру.</p><h3>Безпека</h3><p>Зроблено в ЄС, відповідно до GDPR. Ключі зберігаються зашифрованими. Без реклами, дані ніколи не продаються.</p>'}},
    {slug:'connect-openclaw-agent',mins:2,video:true,
     en:{tag:'Guide',title:'Connect your OpenClaw agent in about a minute',desc:'Four steps: open Providers, name the agent, run one command, done.',
     html:'<p>Your agent keeps running on your server. AstroCore connects to it with one command, and after that you manage everything in the browser.</p><h3>Step 1. Open Providers</h3><p>Sign in to AstroCore and open <code>Providers</code> in the sidebar. Press <b>Connect OpenClaw agent</b>.</p><h3>Step 2. Name your agent</h3><p>Give it a name, for example "My OpenClaw", and press <b>Create command</b>.</p><h3>Step 3. Run the command</h3><p>Copy the command and paste it into the terminal of the server where OpenClaw runs. Root access is required. The command is shown only once because it contains your personal key.</p><pre><code>curl -fsSL https://astrocore.one/connect-agent.sh | ASTROCORE_URL=https://astrocore.one ASTROCORE_API_KEY=ac_live_••••• bash</code></pre><p>The script checks the server, sets up the OpenClaw gateway, gives your agent the AstroCore tools through MCP and starts the connector so it survives restarts.</p><h3>Step 4. Your agent is ready</h3><p>You don\'t need to do anything else. The agent appears in Providers automatically with the status <b>Online</b>. Open the chat and give it the first task.</p><p>This is the only time you need the terminal. Everything after that happens in the browser.</p>'},
     uk:{tag:'Гайд',title:'Підключи OpenClaw-агента приблизно за хвилину',desc:'Чотири кроки: Providers, назва агента, одна команда, готово.',
     html:'<p>Твій агент далі працює на твоєму сервері. AstroCore підключається до нього однією командою, а далі ти керуєш усім у браузері.</p><h3>Крок 1. Відкрий Providers</h3><p>Увійди в AstroCore і відкрий <code>Providers</code> у сайдбарі. Натисни <b>Connect OpenClaw agent</b>.</p><h3>Крок 2. Назви агента</h3><p>Дай йому назву, наприклад "My OpenClaw", і натисни <b>Create command</b>.</p><h3>Крок 3. Запусти команду</h3><p>Скопіюй команду й встав її в термінал сервера, де працює OpenClaw. Потрібні root-права. Команда показується лише один раз, бо містить твій особистий ключ.</p><pre><code>curl -fsSL https://astrocore.one/connect-agent.sh | ASTROCORE_URL=https://astrocore.one ASTROCORE_API_KEY=ac_live_••••• bash</code></pre><p>Скрипт перевіряє сервер, налаштовує шлюз OpenClaw, дає агенту інструменти AstroCore через MCP і запускає конектор, щоб він переживав перезапуски.</p><h3>Крок 4. Агент готовий</h3><p>Більше нічого робити не треба. Агент сам з\'явиться в Providers зі статусом <b>Online</b>. Відкрий чат і дай йому першу задачу.</p><p>Термінал потрібен лише цей один раз. Усе інше відбувається в браузері.</p>'}},
    {slug:'agent-reports',mins:2,
     en:{tag:'Guide',title:'Get finished reports from your agent',desc:'Ask in chat or set a schedule. Results land in Reports, not lost in messages.',
     html:'<p>In a Telegram bot, results disappear in the chat history. In AstroCore your agent saves finished work to <b>Reports</b>.</p><h3>How to get a report</h3><ol><li>Open the chat with your agent.</li><li>Describe the task and ask for a report, for example: <i>"Compare these five tools and save a report."</i></li><li>Or ask for a regular one: <i>"Every morning, check the news about my competitors and save a short report."</i></li></ol><h3>What a report looks like</h3><p>Each report has three tabs:</p><ul><li><b>Text</b>: the summary and findings.</li><li><b>Charts</b>: numbers turned into graphs.</li><li><b>Sources</b>: every page the agent used, so you can check it.</li></ul><p>All reports are saved in one place, so you can come back to them any time.</p>'},
     uk:{tag:'Гайд',title:'Отримуй готові звіти від агента',desc:'Попроси в чаті або постав за розкладом. Результати в Звітах, а не загублені в повідомленнях.',
     html:'<p>У Telegram-боті результати губляться в історії чату. В AstroCore агент зберігає готову роботу у <b>Звіти</b>.</p><h3>Як отримати звіт</h3><ol><li>Відкрий чат зі своїм агентом.</li><li>Опиши задачу й попроси звіт, наприклад: <i>"Порівняй ці п\'ять інструментів і збережи звіт."</i></li><li>Або попроси регулярний: <i>"Щоранку перевіряй новини про конкурентів і зберігай короткий звіт."</i></li></ol><h3>Як виглядає звіт</h3><p>У кожного звіту три вкладки:</p><ul><li><b>Текст</b>: підсумок і висновки.</li><li><b>Графіки</b>: цифри у вигляді графіків.</li><li><b>Джерела</b>: усі сторінки, якими користувався агент, щоб ти міг перевірити.</li></ul><p>Усі звіти зберігаються в одному місці, тож до них можна повернутися будь-коли.</p>'}}
    ];
  
    var SECTION = '<section class="s lined" id="guides"><span class="laser"></span><div class="wrap">'
      + '<div class="head"><span class="eyebrow">Guides</span><h2 id="gd-h"></h2><p id="gd-p"></p></div>'
      + '<div class="gd-grid" id="gd-grid"></div></div></section>';
    var DRAWER = '<div class="gd-shade" id="gd-shade"></div>'
      + '<aside class="gd-panel" id="gd-panel" role="dialog" aria-modal="true" aria-labelledby="gd-title" aria-hidden="true">'
      + '<div class="gd-bar"><span class="gd-meta" id="gd-meta"></span><button type="button" class="gd-x" id="gd-x" aria-label="Close">✕</button></div>'
      + '<div class="gd-scroll" id="gd-scroll"></div></aside>';
  
    // 1) insert the section before FAQ (or at the end if FAQ is missing)
    if (!root.querySelector('#guides')) {
      var faq = root.querySelector('#faq');
      if (faq) faq.insertAdjacentHTML('beforebegin', SECTION);
      else (root.querySelector('main') || root).insertAdjacentHTML('beforeend', SECTION);
    }
    if (!root.querySelector('#gd-panel')) root.insertAdjacentHTML('beforeend', DRAWER);
  
    // 2) add "Guides" to the top menu if it isn't there yet
    var links = root.querySelector('nav .links');
    if (links && !links.querySelector('a[href="#guides"]')) {
      var a = document.createElement('a'); a.href = '#guides'; a.textContent = 'Guides'; a.setAttribute('data-gd-nav', '1');
      links.appendChild(a);
    }
  
    var $ = function (id: string) { return root.querySelector('#' + id) as any; };
    var gdGrid = $('gd-grid'), gdPanel = $('gd-panel'), gdShade = $('gd-shade'), gdScroll = $('gd-scroll'), gdMeta = $('gd-meta');
    var gdOpen: string | null = null, gdLastFocus: any = null;
  
    function lang() {
      var uk = root.querySelector('#lang-uk');
      if (uk && uk.getAttribute('aria-pressed') === 'true') return 'uk';
      return (window as any).__lang === 'uk' ? 'uk' : 'en';
    }
    function cards() {
      var l = lang();
      $('gd-h').textContent = l === 'uk' ? 'Короткі гайди для твого агента' : 'Short guides for your agent';
      $('gd-p').textContent = l === 'uk' ? 'Відкрий, прочитай за хвилину й повернись туди, де був.' : 'Open one, read it in a minute and get back to where you were.';
      var navA = root.querySelector('a[data-gd-nav]'); if (navA) navA.textContent = l === 'uk' ? 'Гайди' : 'Guides';
      gdGrid.innerHTML = GUIDES.map(function (g) {
        var t = g[l];
        return '<button type="button" class="gd-card" data-g="' + g.slug + '"><span class="gd-meta">' + t.tag + ' · ' + g.mins + (l === 'uk' ? ' хв' : ' min') + '</span><h3>' + t.title + '</h3><p>' + t.desc + '</p>'
          + (g.video ? '<span class="gd-play">▶ ' + (l === 'uk' ? 'з відео' : 'with video') + '</span>' : '')
          + '<span class="gd-go">' + (l === 'uk' ? 'Читати →' : 'Read →') + '</span></button>';
      }).join('');
      [].forEach.call(gdGrid.querySelectorAll('.gd-card'), function (c) {
        c.addEventListener('click', function () { show(c.getAttribute('data-g'), true); });
        c.addEventListener('mousemove', function (e) { var r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px'); });
      });
    }
    function render(slug: string) {
      var g = GUIDES.filter(function (x) { return x.slug === slug; })[0]; if (!g) return;
      var l = lang(), t = g[l];
      gdMeta.textContent = t.tag + ' · ' + g.mins + (l === 'uk' ? ' хв читання' : ' min read');
      gdScroll.innerHTML = '<h2 id="gd-title">' + t.title + '</h2><p class="gd-lead">' + t.desc + '</p>'
        + (g.video ? '<div class="gd-video"><video src="/astrocore-connect.mp4" poster="/astrocore-connect-poster.jpg" controls playsinline preload="metadata"></video></div>' : '')
        + '<div class="gd-body">' + t.html + '</div>'
        + '<div class="gd-cta"><b>' + (l === 'uk' ? 'Дай своєму агенту дім' : 'Give your agent a home') + '</b><a class="btn btn-red" href="/register">' + (l === 'uk' ? 'Почати безкоштовно →' : 'Start free →') + '</a></div>';
    }
    function show(slug: string, push: boolean) {
      gdOpen = slug; gdLastFocus = document.activeElement; render(slug);
      gdPanel.classList.add('open'); gdShade.classList.add('open'); gdPanel.setAttribute('aria-hidden', 'false');
      document.documentElement.style.overflow = 'hidden'; gdScroll.scrollTop = 0;
      if (push) { try { history.pushState({ gd: slug }, '', '#guide-' + slug); } catch (e) {} }
      setTimeout(function () { $('gd-x').focus(); }, 50);
    }
    function hide(fromPop: boolean) {
      if (!gdOpen) return; gdOpen = null;
      gdPanel.classList.remove('open'); gdShade.classList.remove('open'); gdPanel.setAttribute('aria-hidden', 'true');
      document.documentElement.style.overflow = '';
      var v = gdScroll.querySelector('video'); if (v) v.pause();
      if (!fromPop) { try { if (history.state && history.state.gd) history.back(); } catch (e) {} }
      if (gdLastFocus && gdLastFocus.focus) gdLastFocus.focus();
    }
  
    on($('gd-x'), 'click', function () { hide(false); });
    on(gdShade, 'click', function () { hide(false); });
    on(window, 'keydown', function (e: KeyboardEvent) { if (e.key === 'Escape') hide(false); });
    on(window, 'popstate', function () { if (gdOpen) hide(true); });
  
    // follow the EN / UA switch of the landing
    ['lang-en', 'lang-uk'].forEach(function (id) {
      var b = root.querySelector('#' + id);
      if (b) on(b, 'click', function () { setTimeout(function () { cards(); if (gdOpen) render(gdOpen); }, 0); });
    });
  
    cards();
    setTimeout(cards, 0); // after the landing restores the saved language
    if (location.hash.indexOf('#guide-') === 0) {
      var s = location.hash.slice(7);
      if (GUIDES.some(function (g) { return g.slug === s; })) show(s, false);
    }
  
    return function () { cleanups.forEach(function (c) { c(); }); document.documentElement.style.overflow = ''; };
  }