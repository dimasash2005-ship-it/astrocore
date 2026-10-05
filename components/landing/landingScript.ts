// Куди: components/landing/landingScript.ts
// Вся анімація лендингу: тунель, планети, зірки, переходи, мова, відео.
// @ts-nocheck
export function initLanding(root: HTMLElement): () => void {
    var dead = false;
    var cleanups: Array<() => void> = [];
    var $id = function (i: string) { return root.querySelector('#' + i); };
    var raf = function (f: FrameRequestCallback) { if (!dead) requestAnimationFrame(f); };
    var onWin = function (type: string, fn: any, opts?: any) { window.addEventListener(type, fn, opts); cleanups.push(function () { window.removeEventListener(type, fn, opts); }); };
    var mkIO = function (cb: any, opts?: any) { var io = new IntersectionObserver(cb, opts); cleanups.push(function () { io.disconnect(); }); return io; };
  
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var fine = window.matchMedia && matchMedia('(pointer: fine)').matches;
    function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
  
    /* hero floor */
    var cv=$id('floor');
    if(cv&&!reduce){
      var cx=cv.getContext('2d'),W=0,H=0,dpr=Math.min(window.devicePixelRatio||1,2),t=0,run=true,stars=[];
      for(var i=0;i<90;i++)stars.push([Math.random(),Math.random()*.55,Math.random()*1.2+.2,Math.random()*6]);
      function size(){var r=cv.getBoundingClientRect();W=r.width;H=r.height;cv.width=W*dpr;cv.height=H*dpr;cx.setTransform(dpr,0,0,dpr,0,0)}
      size();onWin('resize',size);
      (function draw(){
        if(run){
          t+=.004;cx.clearRect(0,0,W,H);var hz=H*.58,vx=W/2;
          for(var i=0;i<stars.length;i++){var s=stars[i];cx.fillStyle='rgba(240,237,248,'+(.25+.35*Math.sin(t*3+s[3])).toFixed(3)+')';cx.fillRect(s[0]*W,s[1]*H,s[2],s[2])}
          var g=cx.createLinearGradient(0,hz,0,H);g.addColorStop(0,'rgba(232,0,42,0)');g.addColorStop(1,'rgba(232,0,42,.10)');cx.fillStyle=g;cx.fillRect(0,hz,W,H-hz);
          cx.lineWidth=1;
          for(var k=-18;k<=18;k++){var x=vx+k*(W/14);cx.strokeStyle='rgba(232,0,42,'+Math.max(0,.32-Math.abs(k)*.014).toFixed(3)+')';cx.beginPath();cx.moveTo(vx+k*6,hz);cx.lineTo(x+(x-vx)*1.6,H);cx.stroke()}
          for(var j=0;j<16;j++){var f=((j/16)+t)%1,y=hz+(H-hz)*Math.pow(f,2.4);cx.strokeStyle='rgba(232,0,42,'+(Math.pow(f,1.3)*.55).toFixed(3)+')';cx.beginPath();cx.moveTo(0,y);cx.lineTo(W,y);cx.stroke()}
          cx.fillStyle='rgba(255,40,70,.55)';cx.shadowColor='rgba(232,0,42,.9)';cx.shadowBlur=18;cx.fillRect(0,hz-.5,W,1);cx.shadowBlur=0;
        }
        raf(draw);
      })();
      if('IntersectionObserver' in window)mkIO(function(e){run=e[0].isIntersecting}).observe(cv);
    }
  
    /* hero mock tilt */
    var mock=$id('mock'),hover=false;
    if(mock&&fine&&!reduce){
      mock.addEventListener('mousemove',function(e){hover=true;var r=mock.getBoundingClientRect(),px=(e.clientX-r.left)/r.width,py=(e.clientY-r.top)/r.height;
        mock.style.transition='transform .12s ease-out';mock.style.transform='rotateX('+((.5-py)*10).toFixed(2)+'deg) rotateY('+((px-.5)*12).toFixed(2)+'deg)';
        mock.style.setProperty('--gx',(px*100)+'%');mock.style.setProperty('--gy',(py*100)+'%')});
      mock.addEventListener('mouseleave',function(){hover=false;mock.style.transition='';onScroll()});
    }
  
    /* solar system */
    var ICONS={
      chat:'<path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
      agent:'<rect x="5" y="8" width="14" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 4v4M9 13h.01M15 13h.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
      memory:'<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/>',
      reports:'<path d="M5 20V10M12 20V4M19 20v-7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
      vault:'<path d="M5 4h11l3 3v13H5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 11h6M9 15h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      gallery:'<rect x="4" y="5" width="16" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 17l4-5 3 3 2-2 3 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
      forum:'<circle cx="9" cy="9" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="10" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 19c1-3 3.5-4.5 6-4.5s5 1.5 6 4.5M15 15c2.3 0 4.2 1.2 5 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      integrations:'<path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'
    };
    var P=[
      {id:'chat',name:'Chat',ring:0,a:0.3,s:.32,d:'Talk to any model and switch between Claude, GPT and Gemini inside one thread.',b:['One thread, many models','Attach files and images','History is searchable'],un:'Чат',ud:'Спілкуйся з будь-якою моделлю й перемикайся між Claude, GPT і Gemini в одній розмові.',ub:['Одна розмова, багато моделей','Файли й зображення','Пошук по історії']},
      {id:'agent',name:'Agents',ring:0,a:3.4,s:.32,d:'Give an agent a goal. It plans the steps, searches and works through them on its own.',b:['Pick model and tools','Runs in the background','Saves results to Reports'],un:'Агенти',ud:'Дай агенту мету. Він сам спланує кроки, пошукає інформацію і виконає роботу.',ub:['Обираєш модель і інструменти','Працює у фоні','Зберігає результат у Звіти']},
      {id:'memory',name:'Memory',ring:1,a:1.2,s:.22,d:'Your context, preferences and projects travel with every agent and every chat.',b:['Remembers across sessions','You decide what it keeps','Shared by all tools'],un:"Пам'ять",ud:'Твій контекст, вподобання й проєкти доступні кожному агенту і в кожному чаті.',ub:['Пам\'ятає між сесіями','Ти вирішуєш, що зберігати','Спільна для всіх інструментів']},
      {id:'reports',name:'Reports',ring:1,a:3.3,s:.22,d:'Finished work arrives as a report with text, charts and sources in separate tabs.',b:['Text, charts, sources','Saved automatically','Share or export'],un:'Звіти',ud:'Готова робота приходить звітом з текстом, графіками й джерелами в окремих вкладках.',ub:['Текст, графіки, джерела','Зберігаються автоматично','Можна поділитися']},
      {id:'vault',name:'Vault',ring:1,a:5.3,s:.22,d:'Store documents and notes your agents can read and cite.',b:['Docs and notes','Agents cite them','Private by default'],un:'Сховище',ud:'Зберігай документи й нотатки, які агенти можуть читати й цитувати.',ub:['Документи й нотатки','Агенти їх цитують','Приватно за замовчуванням']},
      {id:'gallery',name:'Gallery',ring:2,a:0.8,s:.15,d:'Every image you generate, organised and ready to reuse.',b:['All generations in one place','Reuse in chats','Download any time'],un:'Галерея',ud:'Усі згенеровані зображення в одному місці, готові до використання.',ub:['Всі генерації разом','Використовуй у чатах','Завантажуй будь-коли']},
      {id:'forum',name:'Forum',ring:2,a:2.9,s:.15,d:'Share agents and prompts with other AstroCore users and learn from theirs.',b:['Share your agents','Copy others in one click','Ask the community'],un:'Форум',ud:'Діліться агентами й промптами з іншими користувачами AstroCore.',ub:['Публікуй своїх агентів','Копіюй чужих в один клік','Питай спільноту']},
      {id:'integrations',name:'Integrations',ring:2,a:5.0,s:.15,d:'Connect your tools through MCP and plug agents into your workflow.',b:['MCP connectors','Bring your own tools','Custom providers'],un:'Інтеграції',ud:'Підключай свої інструменти через MCP і вбудовуй агентів у свою роботу.',ub:['MCP-конектори','Свої інструменти','Власні провайдери']}
    ];
    var orbit=$id('orbit'),pinfo=$id('pinfo'),rings=orbit.querySelectorAll('.ring'),active='reports',paused=false,oVis=true;
    P.forEach(function(p){
      var b=document.createElement('button');b.type='button';b.className='planet';b.setAttribute('aria-label',p.name);
      b.innerHTML='<span class="pi"><svg viewBox="0 0 24 24" aria-hidden="true">'+ICONS[p.id]+'</svg></span>'+p.name;
      b.addEventListener('mouseenter',function(){paused=true;setActive(p.id)});
      b.addEventListener('mouseleave',function(){paused=false});
      b.addEventListener('focus',function(){paused=true;setActive(p.id)});
      b.addEventListener('blur',function(){paused=false});
      b.addEventListener('click',function(){setActive(p.id)});
      orbit.appendChild(b);p.el=b;
    });
    function setActive(id){
      active=id;var p=P.filter(function(x){return x.id===id})[0],uk=window.__lang==='uk';
      P.forEach(function(x){x.el.classList.toggle('on',x.id===id)});
      pinfo.innerHTML='<span class="k">'+(id==='reports'?(uk?'Головна фішка':'Core feature'):(uk?'Інструмент':'Tool'))+'</span><h3>'+(uk?p.un:p.name)+'</h3><p>'+(uk?p.ud:p.d)+'</p><ul>'+(uk?p.ub:p.b).map(function(x){return '<li>'+x+'</li>'}).join('')+'</ul><span class="hint">'+(uk?'Наведи або натисни на планету':'Hover or tap a planet to explore')+'</span>';
    }
    window.__planets=function(){P.forEach(function(p){p.el.lastChild.textContent=window.__lang==='uk'?p.un:p.name});setActive(active)};
    setActive('reports');
    var R=[[.27,.40],[.40,.40],[.55,.40]];
    function layoutOrbit(dt){
      var w=orbit.clientWidth,h=orbit.clientHeight,cxp=w/2,cyp=h/2,base=Math.min(w,h*1.9);
      for(var i=0;i<rings.length;i++){var rx=base*R[i][0],ry=rx*R[i][1];rings[i].style.width=(rx*2)+'px';rings[i].style.height=(ry*2)+'px'}
      P.forEach(function(p){
        if(dt&&!paused&&!reduce)p.a+=p.s*dt;
        var rx=base*R[p.ring][0],ry=rx*R[p.ring][1];
        var x=cxp+Math.cos(p.a)*rx,y=cyp+Math.sin(p.a)*ry,depth=(Math.sin(p.a)+1)/2;
        var sc=.72+.38*depth;
        p.el.style.transform='translate('+(x-p.el.offsetWidth/2).toFixed(1)+'px,'+(y-p.el.offsetHeight/2).toFixed(1)+'px) scale('+sc.toFixed(3)+')';
        p.el.style.zIndex=depth>.5?60+Math.round(depth*20):Math.round(depth*40);
        p.el.style.opacity=(p.id===active?1:(.45+.55*depth)).toFixed(3);
      });
    }
    if('IntersectionObserver' in window)mkIO(function(e){oVis=e[0].isIntersecting}).observe(orbit);
    onWin('resize',function(){layoutOrbit(0)});
  
    /* the void: a slow 3D starfield drifting out of the core */
    var sp=$id('space');
    if(sp){
      var sx=sp.getContext('2d'),SW=0,SH=0,sdpr=Math.min(window.devicePixelRatio||1,2),st=[],sRun=true,sLast=0,CX=0,CY=0;
      function star(fresh){return {x:(Math.random()*2-1),y:(Math.random()*2-1),z:fresh?Math.random()*.9+.1:1,tw:Math.random()*6.3}}
      function sSize(){var r=sp.getBoundingClientRect();SW=r.width;SH=r.height;sp.width=SW*sdpr;sp.height=SH*sdpr;sx.setTransform(sdpr,0,0,sdpr,0,0);
        var o=orbit.getBoundingClientRect();CX=o.left-r.left+o.width/2;CY=o.top-r.top+o.height/2;
        if(!st.length){for(var i=0;i<520;i++)st.push(star(true))}}
      sSize();onWin('resize',sSize);
      (function sDraw(ts){
        var dt=sLast?Math.min((ts-sLast)/1000,.05):0;sLast=ts;
        if(sRun){
          sx.fillStyle='#030306';sx.fillRect(0,0,SW,SH);
          var f=Math.max(SW,SH)*.55;
          for(var i=0;i<st.length;i++){var s=st[i];
            if(!reduce)s.z-=.028*dt;
            if(s.z<=.04){st[i]=s=star(false)}
            var px=CX+s.x/s.z*f*.5,py=CY+s.y/s.z*f*.5;
            if(px<-10||px>SW+10||py<-10||py>SH+10){st[i]=star(false);continue}
            var near=1-s.z,r=.25+near*near*1.9,a=Math.min(1,.12+near*1.1)*(.75+.25*Math.sin(ts/600+s.tw));
            sx.fillStyle='rgba(235,235,255,'+a.toFixed(3)+')';
            sx.beginPath();sx.arc(px,py,r,0,6.283);sx.fill();
          }
        }
        raf(sDraw);
      })(0);
      if('IntersectionObserver' in window)mkIO(function(e){sRun=e[0].isIntersecting;if(sRun)sSize()}).observe(sp);
    }
  
    /* orbiting words around the core */
    var WORDS=['research','automate','remember','analyse','create','report','connect','write','plan','summarise'];
    var wordEls=WORDS.map(function(w,i){var el=document.createElement('span');el.className='oword';el.textContent=w;orbit.appendChild(el);return {el:el,a:i/WORDS.length*6.283}});
    function layoutWords(dt){
      var w=orbit.clientWidth,h=orbit.clientHeight,base=Math.min(w,h*1.9),rx=base*.19,ry=rx*.52;
      wordEls.forEach(function(o){if(dt&&!reduce)o.a-=.45*dt;var depth=(Math.sin(o.a)+1)/2;
        o.el.style.transform='translate('+(w/2+Math.cos(o.a)*rx-o.el.offsetWidth/2).toFixed(1)+'px,'+(h/2+Math.sin(o.a)*ry-6).toFixed(1)+'px) scale('+(.75+.4*depth).toFixed(3)+')';
        o.el.style.opacity=(.15+.75*depth).toFixed(3);o.el.style.zIndex=depth>.5?55:45;});
    }
  
    /* start the solar system only after planets and words exist */
    var last=0;
    (function spin(ts){var dt=last?Math.min((ts-last)/1000,.05):0;last=ts;if(oVis){layoutOrbit(dt);layoutWords(dt)}raf(spin)})(0);
  
    /* report tabs */
    var tabs=[].slice.call(root.querySelectorAll('.rtabs [role=tab]'));
    var bars=[].slice.call(root.querySelectorAll('.chart rect.b'));
    function showTab(tab){
      tabs.forEach(function(t){var on=t===tab;t.setAttribute('aria-selected',on);$id(t.getAttribute('aria-controls')).hidden=!on});
      if(tab.id==='t-charts'&&!reduce){bars.forEach(function(b){b.style.transition='none';b.style.transform='scaleY(.05)'});
        raf(function(){raf(function(){bars.forEach(function(b,i){b.style.transition='transform .8s cubic-bezier(.2,.8,.2,1) '+(i*70)+'ms';b.style.transform='scaleY(1)'})})})}
    }
    tabs.forEach(function(t,i){
      t.addEventListener('click',function(){showTab(t)});
      t.addEventListener('keydown',function(e){if(e.key==='ArrowRight'||e.key==='ArrowLeft'){var n=tabs[(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length];n.focus();showTab(n)}});
    });
  
    /* conveyor */
    var track=$id('track'),trail=$id('trail'),dot=$id('cdot'),conv=$id('conv');
    var L=track.getTotalLength();trail.style.strokeDasharray=L;trail.style.strokeDashoffset=L;
    var nodes=[0,1,2].map(function(i){return $id('n'+i)}),cards=[0,1,2].map(function(i){return $id('c'+i)});
    var marks=[0,.5,1];
  
    /* collapse scene */
    var collapse=$id('problem'),ctabs=[].slice.call(root.querySelectorAll('.ctab')),cwin=$id('cwin');
  
    /* sheets + spine */
    var stage=$id('stage'),sheets=[].slice.call(root.querySelectorAll('.sheet'));
    var ticking=false;
    function onScroll(){
      if(ticking)return;ticking=true;
      raf(function(){
        ticking=false;var vh=innerHeight,wide=innerWidth>460;
        /* spine */
        var sr=stage.getBoundingClientRect();stage.style.setProperty('--sp',(clamp((vh*.55-sr.top)/sr.height,0,1)*100).toFixed(2)+'%');
        /* sheets */
        sheets.forEach(function(el){
          if(reduce||!wide){el.style.transform='';el.style.opacity='';el.style.setProperty('--p',1);return}
          var r=el.getBoundingClientRect(),pin=clamp((vh-r.top)/(vh*.75),0,1),pout=clamp((vh*.3-r.bottom)/(vh*.5),0,1),e=1-Math.pow(1-pin,3);
          el.style.transformOrigin=pout>0?'50% 100%':'50% 0%';
          el.style.transform='translateY('+((1-e)*90).toFixed(1)+'px) rotateX('+((1-e)*16-pout*8).toFixed(2)+'deg) scale('+((.92+.08*e)-pout*.06).toFixed(3)+')';
          el.style.opacity=(.35+.65*e-pout*.45).toFixed(3);el.style.setProperty('--p',e.toFixed(3));
        });
        [].forEach.call(root.querySelectorAll('.lined'),function(el){var r=el.getBoundingClientRect();var e=reduce?1:1-Math.pow(1-clamp((vh-r.top)/(vh*.75),0,1),3);el.style.setProperty('--p',e.toFixed(3))});
        /* hero mock */
        if(mock&&!hover&&wide&&!reduce){var m=clamp(scrollY/(vh*.5),0,1);mock.style.transform='rotateX('+(14*(1-m)).toFixed(2)+'deg) scale('+(.96+.04*m).toFixed(3)+')'}
        /* collapse */
        if(wide&&!reduce){
          var cr=collapse.getBoundingClientRect(),cp=clamp(-cr.top/(cr.height-vh),0,1),q=clamp((cp-.08)/.72,0,1),qe=q<.5?2*q*q:1-Math.pow(-2*q+2,2)/2;
          ctabs.forEach(function(el,i){
            var x=parseFloat(el.style.getPropertyValue('--x')),y=parseFloat(el.style.getPropertyValue('--y')),st=el.parentNode;
            var dx=(50-x)/100*st.clientWidth*qe,dy=(50-y)/100*st.clientHeight*qe,rot=parseFloat(el.style.getPropertyValue('--r'))*(1-qe);
            el.style.transform='translate(calc(-50% + '+dx.toFixed(1)+'px),calc(-50% + '+dy.toFixed(1)+'px)) rotate('+rot.toFixed(2)+'deg) scale('+(1-.6*qe).toFixed(3)+')';
            el.style.opacity=(1-clamp((qe-.6)/.35,0,1)).toFixed(3);
          });
          var wq=clamp((q-.45)/.5,0,1);cwin.style.setProperty('--ws',(.55+.45*wq).toFixed(3));cwin.style.setProperty('--wo',(.15+.85*wq).toFixed(3));
        } else {ctabs.forEach(function(el){el.style.transform='';el.style.opacity=''});cwin.style.setProperty('--ws',1);cwin.style.setProperty('--wo',1)}
        /* conveyor */
        var vr=conv.getBoundingClientRect(),vp=reduce?1:clamp((vh*.8-vr.top)/(vh*.55),0,1);
        var pt=track.getPointAtLength(L*vp);dot.setAttribute('cx',pt.x.toFixed(1));dot.setAttribute('cy',pt.y.toFixed(1));trail.style.strokeDashoffset=(L*(1-vp)).toFixed(1);
        marks.forEach(function(m,i){var on=vp>=m-.01;nodes[i].classList.toggle('lit',on);cards[i].classList.toggle('lit',on)});
      });
    }
    onWin('scroll',onScroll,{passive:true});onWin('resize',onScroll);onScroll();
  
    /* sticky nav */
    var nav=$id('nav');
    function navState(){nav.classList.toggle('scrolled',scrollY>40)}
    onWin('scroll',navState,{passive:true});navState();
  
    /* demo video */
    var vid=$id('demo-video'),snd=$id('sound');
    function setSoundLabel(){snd.textContent=vid.muted?(window.__lang==='uk'?'🔊 Увімкнути звук':'🔊 Sound on'):(window.__lang==='uk'?'🔇 Вимкнути звук':'🔇 Sound off')}
    if(vid){
      if('IntersectionObserver' in window)mkIO(function(e){if(e[0].isIntersecting){if(vid.paused&&!reduce){var pr=vid.play();if(pr&&pr.catch)pr.catch(function(){})}}else if(!vid.paused&&vid.muted)vid.pause()},{threshold:.35}).observe(vid);
      snd.addEventListener('click',function(){vid.muted=!vid.muted;if(vid.paused){var pr=vid.play();if(pr&&pr.catch)pr.catch(function(){})}setSoundLabel()});
      vid.addEventListener('volumechange',setSoundLabel);
      $id('watch').addEventListener('click',function(e){e.preventDefault();$id('demo').scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'});vid.muted=false;vid.currentTime=0;var pr=vid.play();if(pr&&pr.catch)pr.catch(function(){vid.muted=true;vid.play()});setSoundLabel()});
    }
  
    /* language */
    var UK={
      'Demo':'Демо','Features':'Можливості','Reports':'Звіти','How it works':'Як це працює','FAQ':'FAQ','Blog':'Блог','Forum':'Форум','Sign in':'Увійти','Start free':'Почати безкоштовно',
      '<i></i>Free during beta':'<i></i>Безкоштовно під час бети',
      'The workspace for <em>AI agents</em>':'Робочий простір для <em>AI-агентів</em>',
      'Chat, agents, memory and reports in one place. Connect Claude, OpenAI or Gemini, give an agent a task, and get a finished report with sources and charts.':'Чат, агенти, пам\'ять і звіти в одному місці. Підключи Claude, OpenAI або Gemini, дай агенту задачу й отримай готовий звіт з джерелами та графіками.',
      'Start free →':'Почати безкоштовно →','▶ Watch the demo':'▶ Дивитись демо','Works with':'Працює з',
      'See it in action':'Подивись у дії','AstroCore in 46 seconds':'AstroCore за 46 секунд',
      'From a scattered agent in a terminal and Telegram to one workspace with agents, providers and reports.':'Від агента, розкиданого між терміналом і Telegram, до одного простору з агентами, провайдерами та звітами.',
      'length':'тривалість','Plays muted when you scroll here':'Вмикається без звуку, коли докручуєш сюди',
      'The problem':'Проблема','Ten tabs and three subscriptions, or one workspace':'Десять вкладок і три підписки або один робочий простір',
      'Keep scrolling and watch them fold into one.':'Скроль далі й дивись, як вони складаються в одне.',
      'One <em>AstroCore</em>':'Один <em>AstroCore</em>',
      'Every model in one chat':'Усі моделі в одному чаті','Agents that remember your context':'Агенти, що пам\'ятають твій контекст','Results land in Reports automatically':'Результати самі потрапляють у Звіти','Files, images and notes in one vault':'Файли, зображення й нотатки в одному сховищі',
      'Everything in one environment':'Усе в одному середовищі','Eight tools orbiting one core':'Вісім інструментів навколо одного ядра',
      'Every tool shares the same memory, so an agent can read your vault, write to Reports and post to the forum without you copying anything.':'Усі інструменти мають спільну пам\'ять, тож агент може читати твоє сховище, писати у Звіти й публікувати на форумі, а тобі не треба нічого копіювати.',
      'ASTROCORE MEMORY':'ПАМ\'ЯТЬ ASTROCORE',
      'Core feature · Reports':'Головна фішка · Звіти',
      "Agents don't just reply. They hand you a finished report.":'Агенти не просто відповідають. Вони віддають готовий звіт.',
      'Give an agent a task in chat. When it finishes, the result is saved to Reports with the text, the charts and every source it used in separate tabs.':'Дай агенту задачу в чаті. Коли він закінчить, результат збережеться у Звіти: текст, графіки й усі використані джерела в окремих вкладках.',
      'Task':'Задача','Compare 5 agent platforms':'Порівняти 5 платформ для агентів','Agent':'Агент','Research · Claude':'Дослідник · Claude','Run time':'Час роботи','6 min 12 s':'6 хв 12 с','Sources':'Джерела','14 pages':'14 сторінок','Output':'Результат','1 summary · 2 charts':'1 підсумок · 2 графіки',
      'Try it free →':'Спробувати безкоштовно →','Example report':'Приклад звіту','AI agent platforms: pricing compared':'Платформи для AI-агентів: порівняння цін',
      '<b>Summary.</b> Five platforms were compared on monthly price per seat, supported models and usage limits. Prices range from $12 to $40 per seat. Two platforms let you bring your own API key, which lowers cost for heavy users.':'<b>Підсумок.</b> П\'ять платформ порівняно за місячною ціною за місце, підтримуваними моделями й лімітами. Ціни від $12 до $40 за місце. Дві платформи дозволяють свій API-ключ, і для активних користувачів це дешевше.',
      'Platform C is the most expensive but includes the highest usage limit. Platform D is the cheapest and supports only one model family.':'Платформа C найдорожча, але має найвищий ліміт. Платформа D найдешевша й підтримує лише одну сім\'ю моделей.',
      'price per seat / month':'ціна за місце / місяць','allow your own API key':'дозволяють свій API-ключ','sources checked':'перевірених джерел',
      'From sign-up to first report in three steps':'Від реєстрації до першого звіту за три кроки',
      'Connect a provider':'Підключи провайдера','Paste your Claude, OpenAI or Gemini key in <code>Providers</code>. Keys are stored encrypted.':'Встав ключ Claude, OpenAI або Gemini у <code>Providers</code>. Ключі зберігаються зашифрованими.',
      'Create an agent':'Створи агента','Pick a model, describe the job and choose which memory and files it can use.':'Обери модель, опиши задачу й вибери, яку пам\'ять і файли він може використовувати.',
      'Get the report':'Отримай звіт','The agent does the work and saves the result to <code>Reports</code> with sources and charts.':'Агент виконує роботу й зберігає результат у <code>Reports</code> з джерелами та графіками.',
      'Encrypted API keys':'Зашифровані API-ключі','Stored encrypted and used only to call the provider you chose.':'Зберігаються зашифрованими й використовуються лише для запитів до обраного провайдера.',
      'Built in the EU':'Створено в ЄС','GDPR-aligned. No ads, and we never sell your data.':'Відповідно до GDPR. Без реклами, і ми ніколи не продаємо твої дані.',
      'You own your content':'Твій контент належить тобі','Chats, agents and reports are yours. Delete everything any time.':'Чати, агенти й звіти твої. Видаляй усе будь-коли.',
      'Questions people ask first':'Що питають найчастіше',
      'Is AstroCore free?':'AstroCore безкоштовний?','Yes, AstroCore is free during beta. You pay your AI provider directly for the tokens you use with your own key.':'Так, під час бети AstroCore безкоштовний. За токени ти платиш напряму своєму AI-провайдеру через свій ключ.',
      'Which models can I use?':'Які моделі можна використовувати?','Claude, OpenAI, Gemini and any OpenAI-compatible custom endpoint.':'Claude, OpenAI, Gemini і будь-який сумісний з OpenAI власний ендпоінт.',
      'Does AstroCore only work with OpenClaw?':'Чи AstroCore працює тільки з OpenClaw?',
      'No. OpenClaw is where we started, but we are building a larger ecosystem. We keep adding new features, and support for connecting other agents is on the way.':'Ні. Ми почали з OpenClaw, але будуємо велику екосистему: постійно додаємо нові можливості, і вже робимо підключення інших агентів.',
      'Do I need to know how to code?':'Чи треба вміти програмувати?','No. You create agents by describing the task in plain language.':'Ні. Агентів створюєш, просто описуючи задачу звичайними словами.',
      'Where are my API keys stored?':'Де зберігаються мої API-ключі?','Encrypted in our database, never shown again after you save them, and used only for your requests.':'Зашифровано в нашій базі. Після збереження їх більше не видно, і вони використовуються лише для твоїх запитів.',
      'Free during beta':'Безкоштовно під час бети','Give your first agent a task <em>today</em>':'Дай першому агенту задачу <em>сьогодні</em>',
      'No card needed. Bring your own API key.':'Картка не потрібна. Потрібен лише твій API-ключ.','Join on Telegram':'Приєднатись у Telegram',
      'Terms':'Умови','Privacy':'Конфіденційність'
    };
    var SEL='nav.top .links a, nav.top .nav-cta .btn, .hero .status, .hero h1, .hero .lead, .hero .btn, .hero .lbl, main h2, main h3, main p, main li, main summary, main .eyebrow, main .btn, main dt, main dd, main .kf span, main .rhead .ex, .core small, .vlen, .vauto, footer a';
    function norm(h){return h.replace(/\s+/g,' ').trim()}
    var i18nEls=[].slice.call(root.querySelectorAll(SEL)).filter(function(el){return !el.closest('.note')&&!el.closest('#pinfo')});
    i18nEls.forEach(function(el){el.__en=el.innerHTML});
    function setLang(l){
      window.__lang=l;
      i18nEls.forEach(function(el){var en=el.__en,k=norm(en);el.innerHTML=(l==='uk'&&UK[k])?UK[k]:en});
      $id('lang-en').setAttribute('aria-pressed',l==='en');$id('lang-uk').setAttribute('aria-pressed',l==='uk');
      if(window.__planets)window.__planets();if(snd)setSoundLabel();
      try{localStorage.setItem('ac-lang',l)}catch(e){}
    }
    $id('lang-en').addEventListener('click',function(){setLang('en')});
    $id('lang-uk').addEventListener('click',function(){setLang('uk')});
    var saved='en';try{saved=localStorage.getItem('ac-lang')||'en'}catch(e){}
    setLang(saved==='uk'?'uk':'en');
  
    return function () { dead = true; cleanups.forEach(function (c) { c(); }); };
  }