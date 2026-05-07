// Live status board — clocks, sparklines, deploy log, animated counters
(function(){
  // ===== UTC + city clocks
  function tick(){
    const now = new Date();
    const utc = now.toISOString().slice(11, 19);
    const utcEl = document.getElementById('utc-clock');
    if (utcEl) utcEl.textContent = ' ' + utc;

    function fmtTz(tz){
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).format(now);
    }
    const tzMap = {
      'clock-tlv': 'Asia/Jerusalem',
      'clock-nyc': 'America/New_York',
      'clock-lon': 'Europe/London',
      'clock-sfo': 'America/Los_Angeles'
    };
    Object.entries(tzMap).forEach(([id, tz]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = fmtTz(tz);
    });
    const fc = document.getElementById('footer-clock');
    if (fc) fc.textContent = utc + ' UTC';
  }
  tick(); setInterval(tick, 1000);

  // ===== sparkline
  const spark = document.getElementById('spark-deploy');
  const SPARK_BARS = 28;
  let sparkData = Array.from({length: SPARK_BARS}, () => 30 + Math.random()*70);
  function renderSpark(){
    if (!spark) return;
    spark.innerHTML = '';
    const max = Math.max(...sparkData);
    sparkData.forEach((v, i) => {
      const b = document.createElement('span');
      b.style.height = (v / max * 100) + '%';
      if (i === sparkData.length - 1) b.classList.add('live');
      spark.appendChild(b);
    });
  }
  renderSpark();
  setInterval(() => {
    sparkData.shift();
    sparkData.push(20 + Math.random()*80);
    renderSpark();
    const dc = document.getElementById('deploy-count');
    if (dc) dc.textContent = String(140 + Math.floor(Math.random()*8));
  }, 2400);

  // ===== uptime jitter
  setInterval(() => {
    const el = document.getElementById('uptime-decimal');
    if (!el) return;
    const v = (97 + Math.random()*2.5).toFixed(0);
    el.textContent = v;
  }, 4000);

  // ===== cost saved counter (animated up)
  let costTarget = 418;
  setInterval(() => {
    costTarget += Math.floor(Math.random()*2);
    const el = document.getElementById('cost-saved');
    if (el) el.textContent = costTarget;
  }, 6000);

  // ===== deploy log stream
  const log = document.getElementById('deploy-log');
  const services = ['eks-prod-eu', 'rag-bedrock-pipe', 'cma-agent', 'finpulse-api', 'lambda-contact', 'argo-rollout', 'datadog-shipper', 'helm-release', 'tf-apply', 'cloudfront-inv'];
  const verbs = ['deployed', 'rolled out', 'scaled', 'patched', 'reconciled', 'invalidated', 'rotated', 'applied'];
  const statuses = [['ok', 'OK'], ['ok', 'OK'], ['ok', 'OK'], ['ok', 'OK'], ['warn', '5xx<1%'], ['ok', '200ms']];

  function ts(){
    const d = new Date();
    return String(d.getUTCHours()).padStart(2,'0') + ':' + String(d.getUTCMinutes()).padStart(2,'0') + ':' + String(d.getUTCSeconds()).padStart(2,'0');
  }
  function pushLog(){
    if (!log) return;
    const svc = services[Math.floor(Math.random()*services.length)];
    const verb = verbs[Math.floor(Math.random()*verbs.length)];
    const [stCls, stTxt] = statuses[Math.floor(Math.random()*statuses.length)];
    const ver = 'v' + (3 + Math.floor(Math.random()*4)) + '.' + Math.floor(Math.random()*20) + '.' + Math.floor(Math.random()*30);
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<span class="ts">${ts()}</span><span class="msg">${verb} <b style="color:var(--accent)">${svc}</b> · ${ver}</span><span class="st ${stCls}">${stTxt}</span>`;
    log.prepend(row);
    while (log.children.length > 8) log.removeChild(log.lastChild);
  }
  // Seed with a few rows immediately
  for (let i=0; i<5; i++) pushLog();
  setInterval(pushLog, 2200);

  // ===== reveal on scroll
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); });
  }, { threshold: 0.05, rootMargin: '0px 0px -10% 0px' });
  document.querySelectorAll('.reveal').forEach(el => {
    obs.observe(el);
    // immediate check — anything already in viewport reveals on first paint
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('in');
  });
})();
