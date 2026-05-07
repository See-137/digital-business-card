// Live terminal with command parser
(function(){
  const body = document.getElementById('term-body');
  const input = document.getElementById('term-input');
  if (!body || !input) return;

  const history = [];
  let histIdx = -1;

  function el(cls, txt){
    const d = document.createElement('div');
    d.className = 'term-line ' + (cls||'');
    if (txt !== undefined) d.innerHTML = txt;
    return d;
  }
  function print(html, cls){ body.appendChild(el(cls||'out', html)); body.scrollTop = body.scrollHeight; }
  function printCmd(cmd){
    const d = el('cmd');
    d.innerHTML = '<span class="term-prompt">~/c137 ❯</span>' + escapeHtml(cmd);
    body.appendChild(d);
  }
  function printBlock(lines, cls){
    lines.forEach(l => print(l, cls||'out'));
    print('&nbsp;', 'dim');
  }
  function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  const COMMANDS = {
    help: () => printBlock([
      'available commands:',
      '  <span style="color:var(--accent)">about</span>      — who is this',
      '  <span style="color:var(--accent)">projects</span>   — list deployed systems',
      '  <span style="color:var(--accent)">stack</span>      — what i ship with',
      '  <span style="color:var(--accent)">experience</span> — career trace',
      '  <span style="color:var(--accent)">hire</span>       — engagement options',
      '  <span style="color:var(--accent)">contact</span>    — reach me',
      '  <span style="color:var(--accent)">whoami</span>     — try it',
      '  <span style="color:var(--accent)">status</span>     — system uptime',
      '  <span style="color:var(--accent)">cat cv.txt</span> — short bio',
      '  <span style="color:var(--accent)">sudo --pls</span> — please',
      '  <span style="color:var(--accent)">clear</span>      — wipe screen'
    ]),
    about: () => printBlock([
      '<span class="term-prompt">$</span> oleg hanukayev — devops &amp; mlops engineer',
      '   10y inside the control planes of f500 saas, fintech unicorns,',
      '   and now my own consultancy: <span style="color:var(--accent)">c137.ops</span>',
      '',
      '   i build the unsexy infrastructure that lets ai survive contact',
      '   with production. kubernetes that doesn\'t page. rag pipelines',
      '   that don\'t hallucinate cost. agents that ship instead of demo.'
    ]),
    projects: () => printBlock([
      '5 production deployments — `projects --list`',
      '  <span style="color:var(--accent)">finpulse</span>     · saas · aws + react · <span class="ok">live</span>',
      '  <span style="color:var(--accent)">cma</span>          · llm cost monitor · docker · <span class="ok">live</span>',
      '  <span style="color:var(--accent)">polybots</span>     · trading orchestration · python+ws · <span class="ok">live</span>',
      '  <span style="color:var(--accent)">gam_trivia</span>   · learning platform · next.js · <span class="ok">live</span>',
      '  <span style="color:var(--accent)">biohacking</span>   · self-tracking · react+vite · <span class="ok">live</span>',
      '<span class="dim">→ scroll to [03] for full deployments view.</span>'
    ]),
    stack: () => printBlock([
      'aws · eks · kubernetes · docker · helm',
      'terraform · github actions · argocd · jenkins',
      'claude · mcp · bedrock · rag · agent infra',
      'datadog · grafana · elk · slo design',
      'python · bash · typescript',
      'elasticsearch · postgres · vector dbs'
    ]),
    experience: () => printBlock([
      '<span style="color:var(--accent)">2025 — now</span>  c137.ops              · mlops &amp; devops consultant (independent)',
      '<span style="color:var(--accent)">2023 — 25</span>   bmc software          · platform &amp; reliability · 86% f500',
      '<span style="color:var(--accent)">2021 — 23</span>   fireblocks            · cloud escalation lead · fintech unicorn',
      '<span style="color:var(--accent)">2019 — 21</span>   intsights (rapid7)    · tier-3 → acquisition',
      '<span style="color:var(--accent)">2016 — 19</span>   amdocs                · network &amp; security admin'
    ]),
    hire: () => printBlock([
      'three engagement shapes:',
      '  1. <span style="color:var(--accent)">fixed-scope</span>     2–8 wk · milestones · audits, migrations',
      '  2. <span style="color:var(--accent)">fractional</span>      recurring · 1–3 days/wk · acting head-of-platform',
      '  3. <span style="color:var(--accent)">full-time</span>       selectively · staff / principal / founding infra',
      '',
      'every engagement starts with a 30-min scoping call. free.',
      '<span class="dim">→ scroll to [05] or run `contact`.</span>'
    ]),
    contact: () => printBlock([
      'EMAIL    <span style="color:var(--accent)">hello@c137.ops</span>',
      'LINKEDIN in/oleg-hanukayev',
      'GITHUB   @See-137',
      'BASED    tel aviv · UTC+3 · remote-friendly',
      'RESPONSE &lt; 24h weekdays'
    ]),
    whoami: () => print('guest@c137 · session.live · privileges: read-only', 'out'),
    status: () => printBlock([
      '<span class="ok">●</span> uptime 30d ........ 99.98% (slo 99.95)',
      '<span class="ok">●</span> page-outs 90d ..... 0',
      '<span class="ok">●</span> deploy throughput.. +18% w/w',
      '<span class="ok">●</span> $ saved ytd ....... $418k',
      '<span class="warn">●</span> coffee level ...... LOW'
    ]),
    'cat cv.txt': () => printBlock([
      '----- /home/oleg/cv.txt -----',
      'name:     oleg hanukayev',
      'role:     platform &amp; mlops engineer',
      'years:    10',
      'industry: enterprise saas · fintech · cyber · ai',
      'current:  c137.ops — independent consultancy',
      'wants:    boring infra. brilliantly executed.',
      '----- EOF -----'
    ]),
    'sudo --pls': () => printBlock([
      '[sudo] password for guest: <span class="dim">**********</span>',
      '<span class="ok">access granted (because you said please).</span>',
      '🌟 unlocked: secret command → try `coffee`'
    ]),
    coffee: () => printBlock([
      '       )  )  )',
      '      (  (  (',
      '    [|        |]',
      '     |  C137  |',
      '      \\______/',
      '<span class="dim">brewing... ☕ caffeine.level += 1</span>'
    ]),
    ls: () => print('about/  projects/  stack/  experience/  hire/  contact/  cv.txt  README.md', 'out'),
    pwd: () => print('/home/oleg/c137.ops', 'out'),
    date: () => print(new Date().toString(), 'out'),
    echo: (args) => print(args.join(' '), 'out'),
    rm: () => print('<span class="err">rm: permission denied — this site is immutable infrastructure.</span>', 'err'),
    'rm -rf /': () => print('<span class="err">nice try.</span>', 'err'),
    exit: () => print('<span class="dim">cannot exit. you\'re already part of the system.</span>', 'dim'),
    clear: () => { body.innerHTML = ''; bootBanner(); }
  };

  function run(raw){
    const cmd = raw.trim();
    if (!cmd) return;
    printCmd(cmd);
    history.unshift(cmd); histIdx = -1;
    const lower = cmd.toLowerCase();
    if (COMMANDS[lower]) return COMMANDS[lower]();
    if (lower.startsWith('echo ')) return COMMANDS.echo(cmd.slice(5).split(' '));
    if (lower.startsWith('cat ')) {
      if (lower === 'cat cv.txt' || lower === 'cat /home/oleg/cv.txt') return COMMANDS['cat cv.txt']();
      return print(`cat: ${cmd.slice(4)}: no such file or directory`, 'err');
    }
    print(`zsh: command not found: ${cmd.slice(0,40)} — try <span style="color:var(--accent)">help</span>`, 'err');
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { run(input.value); input.value = ''; }
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (histIdx + 1 < history.length) { histIdx++; input.value = history[histIdx]; }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx > 0) { histIdx--; input.value = history[histIdx]; }
      else { histIdx = -1; input.value = ''; }
    } else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); COMMANDS.clear(); }
  });

  // Boot sequence
  function bootBanner(){
    const lines = [
      ['<span class="dim">c137.ops · console v3.7.2</span>', 'dim'],
      ['<span class="dim">last login: ' + new Date().toUTCString() + '</span>', 'dim'],
      ['', 'dim'],
      ['booting modules...', 'dim'],
      ['<span class="ok">✓</span> aws.eks         online', 'out'],
      ['<span class="ok">✓</span> rag.bedrock     online', 'out'],
      ['<span class="ok">✓</span> obs.datadog     online', 'out'],
      ['<span class="ok">✓</span> agent.cma       online', 'out'],
      ['', 'dim'],
      ['<span style="color:var(--accent)">welcome.</span> type <span style="color:var(--accent)">help</span> to begin · arrow keys for history', 'out'],
      ['', 'dim']
    ];
    let i = 0;
    function tick(){
      if (i >= lines.length) return;
      print(lines[i][0], lines[i][1]);
      i++;
      setTimeout(tick, 90);
    }
    tick();
  }

  // focus terminal when clicked
  document.querySelector('.terminal-wrap').addEventListener('click', () => input.focus());
  bootBanner();
})();
