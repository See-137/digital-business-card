// Projects strip — expandable rows
(function(){
  const data = [
    {
      id: '01',
      name: 'FinPulse',
      tagline: 'financial-data SaaS on AWS',
      tags: ['SaaS', 'AWS', 'React', 'Live'],
      status: ['live', 'PROD'],
      desc: 'End-to-end financial-data SaaS — AWS infrastructure, CI/CD, real-time visualization, and deployment monitoring serving real users.',
      stack: ['AWS', 'Terraform', 'Python', 'React'],
      img: 'assets/finpulse_dashboard.png',
      url: 'https://finpulse.me'
    },
    {
      id: '02',
      name: 'CMA Cost Monitor',
      tagline: 'open-source LLM spend tracker',
      tags: ['LLM Ops', 'Docker', 'OSS'],
      status: ['live', 'ACTIVE'],
      desc: 'Open-source agentic-cost monitor: tracks LLM spend, agent budgets, provider integrations, and real-time alerts. Docker-packaged for production agentic environments.',
      stack: ['React', 'TypeScript', 'Node.js', 'Docker'],
      img: 'assets/cma.png',
      url: '#'
    },
    {
      id: '03',
      name: 'POLYBOTS',
      tagline: 'real-time trading bot orchestration',
      tags: ['Trading', 'Python', 'WebSocket'],
      status: ['live', 'PROD'],
      desc: 'Polymarket bot orchestration — real-time command center with multi-bot management, live P&L tracking, and kill-switch controls.',
      stack: ['Python', 'WebSocket', 'React'],
      img: 'assets/polybots.png',
      url: '#'
    },
    {
      id: '04',
      name: 'Biohacking Tracker',
      tagline: 'self-tracking ecosystem with auto analysis',
      tags: ['Health AI', 'React'],
      status: ['live', 'LIVE'],
      desc: 'Self-tracking ecosystem for health optimization — sleep, nutrition, and cognitive markers with automated data analysis.',
      stack: ['React', 'Vite', 'Tailwind v4'],
      img: 'assets/biohacking.png',
      url: '#'
    },
    {
      id: '05',
      name: 'GAM Trivia',
      tagline: 'multiplayer trivia learning platform',
      tags: ['EdTech', 'Next.js', 'Live'],
      status: ['live', 'LIVE'],
      desc: 'Multiplayer trivia and learning platform — real-time game sessions, custom quiz creation, and leaderboard-driven engagement for educational environments.',
      stack: ['Next.js', 'React', 'TypeScript'],
      img: 'assets/gam_trivia_home.png',
      url: '#'
    }
  ];

  const root = document.getElementById('projects-strip');
  if (!root) return;

  data.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'proj-row';
    row.innerHTML = `
      <div class="proj-id">${p.id}</div>
      <div class="proj-name">
        ${p.name}
        <span class="proj-tagline">${p.tagline}</span>
      </div>
      <div class="proj-status ${p.status[0] === 'dim' ? 'dim' : ''}">${p.status[1]}</div>
      <div class="proj-arrow">→</div>
    `;
    root.appendChild(row);

    row.addEventListener('click', () => {
      const isOpen = row.classList.contains('expanded');
      // collapse all
      root.querySelectorAll('.proj-detail').forEach(d => d.remove());
      root.querySelectorAll('.proj-row').forEach(r => r.classList.remove('expanded'));

      if (!isOpen) {
        row.classList.add('expanded');
        const detail = document.createElement('div');
        detail.className = 'proj-detail';
        detail.innerHTML = `
          <div class="desc">
            <h4>${p.name}</h4>
            <p>${p.desc}</p>
            <div class="stack">
              ${p.stack.map((s,i) => i ? `<span class="arrow">→</span><span>${s}</span>` : `<span>${s}</span>`).join('')}
            </div>
            ${p.url && p.url !== '#' ? `<div style="margin-top:18px"><a href="${p.url}" target="_blank" rel="noopener" class="btn">VISIT ${p.url.replace(/^https?:\/\//,'')} <span class="arrow">↗</span></a></div>` : ''}
          </div>
          <div class="preview">
            <img src="${p.img}" alt="${p.name} preview">
            <div class="label">// ${p.name.toUpperCase()}</div>
          </div>
        `;
        // Insert after the row by re-appending after creating wrapper
        row.insertAdjacentElement('afterend', detail);
      }
    });
  });
})();
