/* ============================================================
   InnovateX — App Controller v2.0
   js/app.js

   All AI analysis now uses the InnovateX Intelligence Engine.
   No Gemini, no OpenAI, no external AI API references.
   ============================================================ */

/* ── Toast Notifications ──────────────────────────────────── */
function showToast(msg, type = 'default', duration = 3000) {
  const container = document.querySelector('.toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success:'✅', info:'ℹ️', warning:'⚠️', default:'🔔' };
  t.innerHTML = `<span>${icons[type]||icons.default}</span><span>${msg}</span>`;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(20px)'; t.style.transition='all 0.3s'; setTimeout(()=>t.remove(),300); }, duration);
}

/* ── Authentication + Role-Based Access Control ───────────── */
const IX_AUTH_KEY = 'ix_auth_user';
const IX_USERS_KEY = 'ix_users';
const IX_SOLUTION_KEY = 'ix_user_solutions';

const IX_DEMO_USERS = [
  { id:'demo-startup', name:'AgriNova Demo', email:'startup@innovatex.demo', password:'demo123', role:'startup', org:'AgriNova' },
  { id:'demo-org', name:'National Agriculture Innovation Lab', email:'org@innovatex.demo', password:'demo123', role:'organization', org:'National Agriculture Innovation Lab' },
  { id:'demo-admin', name:'InnovateX Admin', email:'admin@innovatex.demo', password:'demo123', role:'admin', org:'InnovateX' },
  { id:'demo-expert', name:'InnovateX Expert', email:'expert@innovatex.demo', password:'demo123', role:'expert', org:'InnovateX Expert Review' },
];

const IX_PAGE_PERMISSIONS = {
  dashboard: ['startup','organization','expert','admin'],
  'ai-analysis': ['startup','organization','expert','admin'],
  'expert-review': ['expert','admin'],
  collaborate: ['startup','organization','admin'],
  pilot: ['startup','organization','expert','admin'],
  procurement: ['organization','expert','admin'],
  'startup-verification': ['admin'],
  profile: ['startup','organization','expert','admin'],
};

function ixGetUsers() {
  try { return JSON.parse(localStorage.getItem(IX_USERS_KEY) || '[]'); } catch { return []; }
}
function ixSaveUsers(users) { localStorage.setItem(IX_USERS_KEY, JSON.stringify(users)); }
function ixCurrentUser() {
  try { return JSON.parse(localStorage.getItem(IX_AUTH_KEY) || 'null'); } catch { return null; }
}
function ixSetCurrentUser(user) {
  if (!user) localStorage.removeItem(IX_AUTH_KEY);
  else localStorage.setItem(IX_AUTH_KEY, JSON.stringify(user));
  IX.state.user = user;
  IX.state.role = user?.role || 'visitor';
}
function ixAllUsers() {
  const stored = ixGetUsers();
  const byEmail = new Map(IX_DEMO_USERS.map(u => [u.email, u]));
  stored.forEach(u => byEmail.set(u.email, u));
  return [...byEmail.values()];
}
function ixInitAuthStore() {
  if (!localStorage.getItem(IX_USERS_KEY)) ixSaveUsers(IX_DEMO_USERS);
  ixSetCurrentUser(ixCurrentUser());
}
function ixRedirectIfNeeded() {
  const page = document.body.dataset.page || 'index';
  const user = ixCurrentUser();
  const allowed = IX_PAGE_PERMISSIONS[page];
  if (allowed && (!user || !allowed.includes(user.role))) {
    const returnTo = encodeURIComponent(window.location.pathname.split('/').pop() || 'index.html');
    window.location.href = `auth.html?returnTo=${returnTo}`;
    return true;
  }
  return false;
}
function ixAuthArea() {
  const area = document.getElementById('authArea');
  if (!area) return;
  const user = ixCurrentUser();
  if (!user) {
    area.innerHTML = '<a href="auth.html" class="btn btn-outline btn-sm">Login</a><a href="auth.html?mode=register" class="btn btn-primary btn-sm">Register</a>';
    return;
  }
  const role = IX.roles[user.role] || {icon:'👤',label:user.role};
  area.innerHTML = `<a href="profile.html" class="auth-user-btn"><span class="auth-avatar">${role.icon}</span><span>${escapeHtml(user.name || user.email)}</span></a><button class="btn btn-ghost btn-sm" id="logoutBtn">Logout</button>`;
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    ixSetCurrentUser(null);
    showToast('Logged out successfully', 'success', 1800);
    setTimeout(() => { window.location.href='index.html'; }, 300);
  });
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}
function removeLegacyKpiEvidenceNav() {
  document.querySelectorAll('a,button').forEach(el => {
    const label = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const href = (el.getAttribute('href') || '').toLowerCase();
    if (label === 'kpi evidence' || href.includes('kpi-evidence')) el.remove();
  });
}

function applyRoleVisibility() {
  const role = IX.state.role || 'visitor';
  document.querySelectorAll('[data-roles]').forEach(el => {
    const allowed = el.dataset.roles.split(',').map(v=>v.trim());
    el.style.display = allowed.includes(role) ? '' : 'none';
  });
}
function initAuth() {
  ixInitAuthStore();
  if (ixRedirectIfNeeded()) return;
  ixAuthArea();
  applyRoleVisibility();
  updateRolePill();
}
function updateRolePill() {
  const user = ixCurrentUser();
  const label = document.getElementById('rolePillLabel');
  if (label) label.textContent = `${IX.roles[user?.role || 'visitor']?.icon || '👤'} ${IX.roles[user?.role || 'visitor']?.label || 'Visitor'}`;
}
function requireRole(roles, message='Please log in with the appropriate account to continue.') {
  const user = ixCurrentUser();
  if (!user) { showToast(message,'warning',2500); setTimeout(()=>location.href='auth.html',350); return false; }
  if (!roles.includes(user.role)) { showToast('Your account does not have permission for this action.','warning',2500); return false; }
  return true;
}

/* ── Duplicate top navigation removed in favor of persistent left sidebar ── */
function ensureWorkflowNav() {
  const nav = document.getElementById('navLinks');
  if (nav) nav.remove();
  document.querySelectorAll('.navbar .nav-links').forEach(el => el.remove());
}

/* ── Active Nav Link ──────────────────────────────────────── */

/* ── Global visual workflow ─────────────────────────────────
   Keeps the SIH mechanism visible without turning it into raw text.
*/
function ensureGlobalWorkflow() {
  return; // Disabled: duplicate upper workflow bar removed as requested
  const page = document.body.dataset.page;
  const steps = [
    ['challenge','Challenge','problem.html'],
    ['solutions','Solutions','ai-analysis.html'],
    ['review','AI Review','ai-analysis.html'],
    ['decision','Expert Decision','expert-review.html'],
    ['pilot','Pilot','pilot.html'],
    ['scale','Scale','procurement.html']
  ];
  const pageIndex = {
    problem:0, marketplace:1, dashboard:1, 'ai-analysis':2, 'expert-review':3, pilot:4,
    procurement:5, collaborate:3, 'startup-verification':1, profile:-1
  };
  const current = pageIndex[page] ?? -1;
  const ribbon = document.createElement('div');
  ribbon.className = 'ix-global-workflow';
  ribbon.setAttribute('aria-label','InnovateX six-step workflow');
  steps.forEach(([key,label,href], i) => {
    const a = document.createElement('a');
    a.href = href; a.className = 'ix-wf-step'; a.dataset.num = String(i + 1);
    if (i < current) a.classList.add('done');
    if (i === current) a.classList.add('current');
    a.textContent = label;
    ribbon.appendChild(a);
  });
  const nav = document.getElementById('mainNav');
  if (nav) nav.insertAdjacentElement('afterend', ribbon);
}

/* ── Persistent Shared Sidebar Component ───────────────────── */
const IX_SIDEBAR_TEMPLATE = `
  <div class="ix-sidebar-inner">
    <div class="ix-sidebar-heading">NAVIGATION</div>
    <nav class="ix-sidebar-nav" id="sidebarNav">
      <a href="index.html" class="ix-sidebar-link">
        <svg class="ix-icon" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span>Home</span>
      </a>
      <a href="problem.html" class="ix-sidebar-link">
        <svg class="ix-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>Problems</span>
      </a>
      <a href="marketplace.html" class="ix-sidebar-link">
        <svg class="ix-icon" viewBox="0 0 24 24"><path d="M3 9l2-5h14l2 5"/><path d="M21 9v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9"/><line x1="3" y1="9" x2="21" y2="9"/><path d="M10 13a2 2 0 0 0 4 0"/></svg>
        <span>Marketplace</span>
      </a>
      <a href="ai-analysis.html" class="ix-sidebar-link">
        <svg class="ix-icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 11 17 15 13"/></svg>
        <span>Solution Analysis</span>
      </a>
      <a href="collaborate.html" class="ix-sidebar-link">
        <svg class="ix-icon" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <span>Collaborate</span>
      </a>
      <a href="pilot.html" class="ix-sidebar-link">
        <svg class="ix-icon" viewBox="0 0 24 24"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>
        <span>Pilot</span>
      </a>
      <a href="dashboard.html" class="ix-sidebar-link" data-roles="startup,organization,admin">
        <svg class="ix-icon" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
        <span>Dashboard</span>
      </a>
    </nav>

    <div class="ix-sidebar-divider"></div>

    <div class="ix-sidebar-heading">WORKFLOW GATES</div>
    <div class="ix-sidebar-workflow-summary">
      <a href="procurement.html" class="ix-sidebar-sublink">
        <span class="gate-dot green"></span>
        <span>Procurement &amp; Scale</span>
      </a>
      <a href="index.html#payments-section" class="ix-sidebar-sublink">
        <span class="gate-dot amber"></span>
        <span>Startup Payments</span>
      </a>
    </div>
  </div>
`;

function initPersistentSidebar() {
  const page = document.body.dataset.page;
  if (!page || page === 'auth') return;

  // Clean up duplicate top navigation if present
  document.querySelectorAll('.navbar .nav-links, #navLinks').forEach(el => el.remove());

  let sidebar = document.getElementById('ixSidebar');
  let backdrop = document.getElementById('sidebarBackdrop');
  const mainNav = document.getElementById('mainNav');

  if (!sidebar) {
    if (!mainNav) return;

    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'ix-sidebar-backdrop';
      backdrop.id = 'sidebarBackdrop';
      mainNav.insertAdjacentElement('afterend', backdrop);
    }

    const appShell = document.createElement('div');
    appShell.className = 'ix-app-shell';

    sidebar = document.createElement('aside');
    sidebar.className = 'ix-sidebar';
    sidebar.id = 'ixSidebar';
    sidebar.innerHTML = IX_SIDEBAR_TEMPLATE;
    appShell.appendChild(sidebar);

    const mainCol = document.createElement('div');
    mainCol.className = 'ix-main-column';

    // Move all sibling content elements between mainNav/backdrop and scripts/modals into mainCol
    const elementsToMove = [];
    let curr = (backdrop || mainNav).nextSibling;
    while (curr) {
      const next = curr.nextSibling;
      if (curr.nodeType === 1) { // Element node
        const tag = curr.tagName.toLowerCase();
        const isScript = tag === 'script';
        const isStyle = tag === 'style';
        const isToast = curr.classList.contains('toast-container');
        const isModal = curr.classList.contains('ix-modal-backdrop') || curr.classList.contains('modal-overlay');
        const isAskIX = curr.id === 'askixPanel' || curr.id === 'askixFab';
        if (!isScript && !isStyle && !isToast && !isModal && !isAskIX) {
          elementsToMove.push(curr);
        }
      }
      curr = next;
    }

    elementsToMove.forEach(el => mainCol.appendChild(el));
    appShell.appendChild(mainCol);
    (backdrop || mainNav).insertAdjacentElement('afterend', appShell);
  }

  wireSidebarEvents();
  setActiveNav();
  applyRoleVisibility();
}

function wireSidebarEvents() {
  const hamburger = document.getElementById('navHamburger');
  const sidebar = document.getElementById('ixSidebar');
  const backdrop = document.getElementById('sidebarBackdrop');

  if (hamburger && sidebar && !hamburger.dataset.sidebarBound) {
    hamburger.dataset.sidebarBound = 'true';
    hamburger.addEventListener('click', () => {
      sidebar.classList.toggle('drawer-open');
      backdrop?.classList.toggle('active');
      hamburger.classList.toggle('open');
    });
  }

  if (backdrop && sidebar && !backdrop.dataset.sidebarBound) {
    backdrop.dataset.sidebarBound = 'true';
    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('drawer-open');
      backdrop.classList.remove('active');
      hamburger?.classList.remove('open');
    });
  }

  sidebar?.querySelectorAll('.ix-sidebar-link, .ix-sidebar-sublink').forEach(link => {
    if (!link.dataset.boundClose) {
      link.dataset.boundClose = 'true';
      link.addEventListener('click', () => {
        sidebar.classList.remove('drawer-open');
        backdrop?.classList.remove('active');
        hamburger?.classList.remove('open');
      });
    }
  });
}

function renameBrowseMarketplaceButtons() {
  document.querySelectorAll('a, button').forEach(el => {
    const text = el.textContent || '';
    if (/Browse\s+(E-)?Marketplace/i.test(text)) {
      el.innerHTML = el.innerHTML.replace(/Browse\s+(E-)?Marketplace/gi, 'E-Marketplace');
    }
  });
}

function setActiveNav() {
  const rawPath = window.location.pathname.split('/').pop() || 'index';
  const page = rawPath.replace('.html','').replace('./','') || 'index';
  const isPaymentsHash = window.location.hash === '#payments-section';

  document.querySelectorAll('.nav-link, .ix-sidebar-link').forEach(link => {
    const href = (link.getAttribute('href') || '').split('#')[0];
    const name = href.replace('.html','').replace('./','') || 'index';
    const isActive = (name === page) || (page === 'index' && (name === 'index' || name === ''));
    link.classList.toggle('active', isActive);
  });

  document.querySelectorAll('.ix-sidebar-sublink').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (href.includes('payments-section')) {
      link.classList.toggle('active', page === 'index' && isPaymentsHash);
    } else {
      const name = href.split('#')[0].replace('.html','').replace('./','');
      link.classList.toggle('active', name === page);
    }
  });
}

/* ── Animated Counters ────────────────────────────────────── */
function animateCounters() {
  document.querySelectorAll('[data-counter]').forEach(el => {
    const target = parseInt(el.dataset.counter, 10);
    const suffix = el.dataset.suffix || '';
    const duration = 1200;
    const steps = 50;
    const inc = target / steps;
    let current = 0;
    const interval = setInterval(() => {
      current = Math.min(current + inc, target);
      el.textContent = Math.round(current) + suffix;
      if (current >= target) clearInterval(interval);
    }, duration / steps);
  });
}

/* ── Intersection observer for animations ─────────────────── */
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.anim-fade-up').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(16px)';
    el.style.transition = `opacity 0.4s ease ${el.style.animationDelay || '0s'}, transform 0.4s ease ${el.style.animationDelay || '0s'}`;
    observer.observe(el);
  });
}

/* ── Vote buttons ─────────────────────────────────────────── */
function initVoteButtons() {
  document.querySelectorAll('.vote-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('voted')) {
        btn.classList.remove('voted');
        btn.style.color = '';
        btn.style.borderColor = '';
        const count = btn.querySelector('.vote-count');
        if (count) count.textContent = parseInt(count.textContent) - 1;
        showToast('Vote removed', 'default', 1500);
      } else {
        btn.classList.add('voted');
        btn.style.color = 'var(--blue-600)';
        btn.style.borderColor = 'var(--blue-600)';
        const count = btn.querySelector('.vote-count');
        if (count) count.textContent = parseInt(count.textContent) + 1;
        showToast('Solution upvoted!', 'success', 1500);
      }
    });
  });
}

/* ── Tab Switcher ─────────────────────────────────────────── */
function switchTab(tabId) {
  const group = event?.target?.closest('[data-tab-group]')?.dataset?.tabGroup;
  const btns = document.querySelectorAll(group ? `[data-tab-group="${group}"] .tab-btn` : '.tab-btn');
  const contents = document.querySelectorAll(group ? `[data-tab-group="${group}"] .tab-content` : '.tab-content');
  btns.forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  contents.forEach(c => c.classList.toggle('active', c.id === 'tab-' + tabId));
}

/* ── Tech tag input ───────────────────────────────────────── */
function initTechInput() {
  const input = document.getElementById('techInput');
  const list  = document.getElementById('techList');
  const hidden = document.getElementById('techTags');
  if (!input || !list) return;
  let tags = [];

  function renderTags() {
    list.innerHTML = tags.map((tag, i) =>
      `<span class="chip" style="gap:6px;">${tag} <button onclick="removeTag(${i})" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:12px">×</button></span>`
    ).join('');
    if (hidden) hidden.value = tags.join(',');
  }

  window.removeTag = function(i) { tags.splice(i, 1); renderTags(); };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = input.value.trim().replace(/,$/, '');
      if (val && !tags.includes(val) && tags.length < 8) {
        tags.push(val);
        renderTags();
        input.value = '';
      }
    }
  });
}

/* ── Solution form ────────────────────────────────────────── */
function initSolutionForm() {
  const form = document.getElementById('solutionForm');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!requireRole(['startup'], 'Only Startup / Solution Provider accounts can submit solutions.')) return;
    const title = document.getElementById('sol-title')?.value?.trim();
    const team  = document.getElementById('sol-team')?.value?.trim();
    const desc  = document.getElementById('sol-desc')?.value?.trim();
    if (!title || !team || !desc) { showToast('Please fill all required fields', 'warning'); return; }
    const user = ixCurrentUser();
    const saved = JSON.parse(localStorage.getItem(IX_SOLUTION_KEY) || '[]');
    const item = {
      id: `user-${Date.now()}`, title, team, desc,
      problem: 'Early Crop Disease Detection for Small Farmers',
      category: 'Agriculture', status: 'Submitted', aiScore: 'Pending',
      submitted: new Date().toISOString(), ownerId: user.id, ownerEmail: user.email
    };
    saved.unshift(item); localStorage.setItem(IX_SOLUTION_KEY, JSON.stringify(saved));
    const btn = form.querySelector('[type="submit"]');
    if (btn) { btn.textContent='⏳ Submitting…'; btn.disabled=true; }
    setTimeout(() => {
      showToast(`"${title}" submitted successfully!`, 'success', 4000);
      form.reset();
      document.getElementById('techList') && (document.getElementById('techList').innerHTML='');
      if (btn) { btn.textContent='🚀 Submit Solution'; btn.disabled=false; }
    }, 700);
  });
}

/* ── AI Analysis runner (InnovateX Intelligence Engine) ───── */
const BACKEND_URL = window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin;

async function checkEngineHealth() {
  try {
    const r = await fetch(`${BACKEND_URL}/api/health`, { signal: AbortSignal.timeout(2000) });
    if (!r.ok) return { engine: false, localAI: false };
    const data = await r.json();
    return { engine: data.status === 'ok', localAI: data.localAI, localAIModel: data.localAIModel };
  } catch { return { engine: false, localAI: false }; }
}

function setAIModeBadge(engineActive, localAI, model) {
  const badge = document.getElementById('aiModeBadge');
  if (!badge) return;
  badge.className = 'ai-mode-badge engine';
  if (engineActive && localAI) {
    badge.innerHTML = `⚡ IX Engine + Local AI <span style="opacity:0.7;font-weight:400">(${model || 'LLM'})</span>`;
  } else if (engineActive) {
    badge.innerHTML = '⚡ InnovateX Intelligence Engine';
  } else {
    badge.innerHTML = '⚡ InnovateX Intelligence Engine';
  }
  badge.style.display = 'inline-flex';
}

function runIntelligenceAnalysis(btn) {
  const steps = [
    'Parsing solution descriptions…',
    'InnovateX Scoring Engine: Relevance (25%)…',
    'InnovateX Scoring Engine: Innovation (20%)…',
    'InnovateX Scoring Engine: Feasibility (20%)…',
    'InnovateX Scoring Engine: Impact (15%)…',
    'InnovateX Scoring Engine: Scalability & Cost (15%)…',
    'Risk Engine: detecting solution risks…',
    'Collaboration Engine: finding complementary pairs…',
    'Recommendation Engine: generating shortlist…',
    'Analysis complete ✅',
  ];
  const statusEl   = document.getElementById('aiStatus');
  const progressEl = document.querySelector('#aiProgressBox .progress-fill');
  const box        = document.getElementById('aiProgressBox');
  if (box) box.style.display = 'block';

  let i = 0;
  const iv = setInterval(() => {
    if (i < steps.length) {
      if (statusEl)   statusEl.textContent = steps[i];
      if (progressEl) progressEl.style.width = `${((i+1)/steps.length)*100}%`;
      i++;
    } else {
      clearInterval(iv);
      if (btn) { btn.textContent = '✅ Analysis Complete'; btn.disabled = false; }
      if (box) box.style.display = 'none';
      const selectedId = document.getElementById('analysisProblemSelect')?.value || 'p001';
      renderDynamicAnalysis(selectedId);
      showToast('InnovateX Intelligence Engine analysis complete!', 'success', 4000);
      setAIModeBadge(true, false);
      const results = document.getElementById('aiResults');
      if (results) {
        results.style.display = 'block';
        results.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(initCharts, 300);
      }
    }
  }, 500);
}

function applyEngineResults(data, problemId = 'p001') {
  if (!data || !Array.isArray(data.scores)) return;
  const cards = Array.from(document.querySelectorAll('.rank-card[data-solution-id]'));
  const sorted = [...data.scores].sort((a,b) => (a.rank || 999) - (b.rank || 999)).slice(0, cards.length);
  sorted.forEach((score, index) => {
    const card = cards[index];
    const solution = typeof IX !== 'undefined' && IX.getSolutions ? IX.getSolutions(problemId).find(s => s.id === score.id) : null;
    if (!card) return;
    const titleEl = card.querySelector('.ix-solution-title');
    const metaEl  = card.querySelector('.ix-solution-meta');
    const descEl  = card.querySelector('.ix-solution-desc');
    const scoreEl = card.querySelector('.ix-total-score');
    if (titleEl) titleEl.textContent = score.title || solution?.title || titleEl.textContent;
    if (metaEl && solution) metaEl.textContent = `by ${solution.team} · ${(solution.tech||[]).slice(0,2).join(' + ') || 'Innovation Solution'}`;
    if (descEl  && solution) descEl.textContent = solution.desc;
    if (scoreEl) scoreEl.textContent = Number(score.total || 0);
    const dims = [score.relevance, score.innovation, score.feasibility, score.impact, score.scalability, score.cost];
    card.querySelectorAll('.dim-score').forEach((el, i) => { if (dims[i] !== undefined) el.textContent = `${dims[i]}/${[25,20,20,15,10,10][i]}`; });
    card.querySelector('.rank-num')?.replaceChildren(document.createTextNode(String(index + 1)));
  });
}

function initCategoryProblemSelector() {
  const category = document.getElementById('analysisCategorySelect');
  const problem = document.getElementById('analysisProblemSelect');
  if (!category || !problem || typeof IX === 'undefined') return;
  category.innerHTML = IX.categories.map(c => `<option value="${c.id}">${c.icon} ${escapeHtml(c.name)}</option>`).join('');
  const setProblems = () => {
    const list = IX.problems.filter(p => p.category === category.value);
    problem.innerHTML = list.length
      ? list.map(p => `<option value="${p.id}">${escapeHtml(p.title)}</option>`).join('')
      : '<option value="">No demo problems in this category</option>';
    if (list.length) {
      renderDynamicAnalysis(list[0].id);
      updateAIProblemHeader(list[0].id);
    }
  };
  category.addEventListener('change', setProblems);
  problem.addEventListener('change', () => { updateAIProblemHeader(problem.value); renderDynamicAnalysis(problem.value); });
  category.value = IX.getProblem('p001')?.category || IX.categories[0].id;
  setProblems();
}
function updateAIProblemHeader(id) {
  const p = IX.getProblem(id); if (!p) return;
  const title = document.getElementById('analysisProblemTitle');
  const crumb = document.getElementById('analysisProblemCrumb');
  if (title) title.textContent = `🤖 Solution Analysis & Shortlisting — ${p.title}`;
  if (crumb) crumb.textContent = p.title;
}
function renderDynamicAnalysis(problemId, aiData) {
  const box = document.getElementById('dynamicAnalysisResults');
  const legacy = document.getElementById('legacyP001Results');
  if (!box || !legacy || !problemId) return;
  const p = IX.getProblem(problemId); const solutions = IX.getSolutions(problemId);
  if (!p) return;
  if (problemId === 'p001') { legacy.style.display='block'; box.style.display='none'; return; }
  legacy.style.display='none'; box.style.display='block';
  const scoreMap = new Map((aiData?.scores || []).map(x=>[x.id,x]));
  const sorted = [...solutions].sort((a,b)=>((scoreMap.get(b.id)?.total ?? b.ai_scores?.total ?? 0) - (scoreMap.get(a.id)?.total ?? a.ai_scores?.total ?? 0)));
  const top = sorted.slice(0,3);
  const avg = Math.round(sorted.reduce((sum,s)=>sum+(scoreMap.get(s.id)?.total ?? s.ai_scores?.total ?? 0),0)/Math.max(1,sorted.length));
  const cat = IX.getCat(p.category);
  box.innerHTML = `
    <div class="card mb-8" style="border-color:var(--blue-200);background:var(--blue-50)">
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap">
        <div><div class="section-label">${cat?.icon||'📌'} ${escapeHtml(cat?.name||p.category)}</div><h2 style="font-size:var(--fs-xl);margin-bottom:6px">${escapeHtml(p.title)}</h2><p style="font-size:var(--fs-sm);color:var(--text-secondary)">${escapeHtml(p.desc)}</p></div>
        <div class="badge badge-blue">${solutions.length} solution${solutions.length===1?'':'s'} analysed</div>
      </div>
      <div class="grid-4" style="margin-top:16px">
        <div class="stat-card"><div class="stat-label">Solutions Analysed</div><div class="stat-value">${solutions.length}</div></div>
        <div class="stat-card"><div class="stat-label">Top Score</div><div class="stat-value">${top[0]?.ai_scores?.total ?? 0}<span style="font-size:12px;color:var(--text-muted)">/100</span></div></div>
        <div class="stat-card"><div class="stat-label">Average Score</div><div class="stat-value">${avg}<span style="font-size:12px;color:var(--text-muted)">/100</span></div></div>
        <div class="stat-card"><div class="stat-label">Shortlisted</div><div class="stat-value">${top.length}</div></div>
      </div>
    </div>
    <div class="section-header mb-5"><h2 style="font-size:var(--fs-xl)">🏆 ${escapeHtml(cat?.name||'Category')} — Solution Analysis</h2><span class="badge badge-green">Top ${top.length}</span></div>
    ${sorted.map((sol,idx)=>{
      const sc=scoreMap.get(sol.id)||{}; const total=sc.total ?? sol.ai_scores?.total ?? 0;
      const reason = aiData?.explanations?.find(x=>x.id===sol.id);
      return `<div class="rank-card ${idx===0?'rank-1':idx===1?'rank-2':'rank-3'}">
        <div style="display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap"><div class="rank-num ${idx===0?'r1':idx===1?'r2':'r3'}">${idx+1}</div><div style="flex:1"><h3 style="font-size:var(--fs-lg);margin-bottom:4px">${escapeHtml(sol.title)}</h3><div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">${escapeHtml(sol.team)} · ${escapeHtml((sol.tech||[]).slice(0,3).join(' + '))}</div><p style="font-size:var(--fs-sm);color:var(--text-secondary)">${escapeHtml(sol.desc)}</p></div><div class="ai-score-pill ${IX.scoreClass(total)}">${total}/100</div></div>
        <div class="dim-breakdown"><div class="dim-cell"><div class="dim-score">${sc.relevance ?? sol.ai_scores?.relevance ?? 0}/25</div><div class="dim-label">Relevance</div></div><div class="dim-cell"><div class="dim-score">${sc.innovation ?? sol.ai_scores?.innovation ?? 0}/20</div><div class="dim-label">Innovation</div></div><div class="dim-cell"><div class="dim-score">${sc.feasibility ?? sol.ai_scores?.feasibility ?? 0}/20</div><div class="dim-label">Feasibility</div></div><div class="dim-cell"><div class="dim-score">${sc.impact ?? sol.ai_scores?.impact ?? 0}/20</div><div class="dim-label">Impact</div></div><div class="dim-cell"><div class="dim-score">${sc.scalability ?? sol.ai_scores?.scalability ?? 0}/10</div><div class="dim-label">Scalability</div></div><div class="dim-cell"><div class="dim-score">${sc.cost ?? sol.ai_scores?.cost ?? 0}/5</div><div class="dim-label">Cost Efficiency</div></div></div>
        <div class="grid-2" style="gap:12px"><div><strong style="font-size:11px;color:var(--green-700)">✅ Strengths</strong><div style="font-size:12px;color:var(--text-secondary);margin-top:5px">${(reason?.strengths||sol.strengths||['Relevant approach','Clear implementation path']).slice(0,3).map(x=>'• '+escapeHtml(x)).join('<br>')}</div></div><div><strong style="font-size:11px;color:var(--amber-600)">⚠️ Weaknesses / Risks</strong><div style="font-size:12px;color:var(--text-secondary);margin-top:5px">${(reason?.weaknesses||sol.weaknesses||['Needs pilot validation']).slice(0,3).map(x=>'• '+escapeHtml(x)).join('<br>')}</div></div></div>
        <div style="margin-top:12px;padding:10px;background:var(--blue-50);border:1px solid var(--blue-100);border-radius:8px;font-size:12px;color:var(--blue-800)"><strong>What next?</strong> ${escapeHtml(reason?.what_next || (idx<3?'Consider for pilot/shortlist review.':'Keep under evaluation and compare with higher-ranked solutions.'))}</div>
      </div>`;
    }).join('')}
    <div class="card" style="margin-top:24px"><strong>🤖 Category Insight</strong><p id="dynamicInsightText" style="font-size:13px;color:var(--text-secondary);margin-top:7px">${escapeHtml(aiData?.insights?.summary || `This ${cat?.name||p.category} problem is analysed independently so decision-makers can compare solutions within the same problem context.`)}</p></div>`;
}

function initAIAnalysis() {
  const btn = document.getElementById('runAnalysisBtn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const existingResults = document.getElementById('aiResults');
    if (existingResults) existingResults.style.display = 'none';
    btn.textContent = '⏳ Checking Engine…';

    const statusEl   = document.getElementById('aiStatus');
    const progressEl = document.querySelector('#aiProgressBox .progress-fill');
    const box        = document.getElementById('aiProgressBox');

    // Check if InnovateX Intelligence Engine backend is available
    const health = await checkEngineHealth();

    if (!health.engine) {
      // Backend not available — run frontend demo mode
      btn.textContent = '⏳ Analyzing…';
      runIntelligenceAnalysis(btn);
      return;
    }

    // Engine available — call backend
    if (box) box.style.display = 'block';
    if (statusEl) statusEl.textContent = 'InnovateX Intelligence Engine starting…';
    if (progressEl) progressEl.style.width = '10%';
    btn.textContent = '⏳ Engine Running…';

    try {
      const selectedId = document.getElementById('analysisProblemSelect')?.value || 'p001';
      const problem   = IX.getProblem(selectedId);
      const solutions = IX.getSolutions(selectedId);

      if (statusEl) statusEl.textContent = 'Scoring Engine evaluating solutions…';
      if (progressEl) progressEl.style.width = '40%';

      const resp = await fetch(`${BACKEND_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem, solutions }),
        signal: AbortSignal.timeout(30000),
      });

      if (progressEl) progressEl.style.width = '80%';

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${resp.status}`);
      }

      const result = await resp.json();
      if (selectedId === 'p001') applyEngineResults(result.data, selectedId);
      renderDynamicAnalysis(selectedId, result.data);
      if (progressEl) progressEl.style.width = '100%';

      setTimeout(() => {
        if (box) box.style.display = 'none';
        btn.textContent = '✅ Analysis Complete';
        btn.disabled = false;
        setAIModeBadge(true, health.localAI, health.localAIModel);
        showToast('InnovateX Intelligence Engine analysis complete!', 'success', 4000);

        // Update insight text
        const insightEl = document.getElementById('ixInsightText');
        if (insightEl && result.data?.insights?.summary) {
          insightEl.textContent = result.data.insights.summary;
        }
        const collabEl = document.getElementById('ixCollabText');
        if (collabEl && result.data?.insights?.collaboration) {
          collabEl.textContent = result.data.insights.collaboration;
        }

        const results = document.getElementById('aiResults');
        if (results) {
          results.style.display = 'block';
          results.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setTimeout(initCharts, 300);
        }
      }, 400);

    } catch (err) {
      console.warn('Engine call failed, falling back to demo:', err.message);
      if (box) box.style.display = 'none';
      showToast('Running offline demo analysis…', 'info', 2500);
      btn.textContent = '⏳ Analyzing…';
      runIntelligenceAnalysis(btn);
    }
  });
}

/* ── Pilot recommendation buttons ────────────────────────── */
function initPilotRecommendations() {
  document.querySelectorAll('.recommend-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.closest('.pilot-final-recommendation');
      if (group) group.querySelectorAll('.recommend-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const verdict = btn.dataset.verdict || btn.textContent.trim();
      try { localStorage.setItem('ix_pilot_recommendation', verdict); } catch {}
      showToast(`Pilot recommendation recorded: ${verdict}`, 'success', 3000);
    });
  });
}

/* ── Cost display helper ─────────────────────────────────── */
function formatCostBreakdown(breakdown) {
  if (!breakdown) return '';
  return Object.entries(breakdown)
    .map(([k, v]) => `<div class="cost-breakdown-item"><strong>${v}</strong>${k.charAt(0).toUpperCase()+k.slice(1)}</div>`)
    .join('');
}

/* ── Main init ────────────────────────────────────────────── */
function runMainInit() {
  initPersistentSidebar();
  renameBrowseMarketplaceButtons();
  initAuth();
  ensureWorkflowNav();
  ensureGlobalWorkflow();
  setActiveNav();
  animateCounters();
  initScrollAnimations();
  initVoteButtons();
  initTechInput();
  initSolutionForm();
  initAIAnalysis();
  initCategoryProblemSelector();
  initChat();
  initFilters();
  initPilotRecommendations();

  // Init charts on relevant pages
  const page = document.body.dataset.page;
  if (page === 'ai-analysis') {
    const results = document.getElementById('aiResults');
    if (results && results.style.display !== 'none') setTimeout(initCharts, 300);
  }
  if (page === 'dashboard')   setTimeout(initDoughnutChart, 300);
  if (page === 'pilot')       setTimeout(initCharts, 300);

  // Set initial AI mode badge on ai-analysis page
  if (page === 'ai-analysis') {
    checkEngineHealth().then(h => setAIModeBadge(h.engine, h.localAI, h.localAIModel));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runMainInit);
} else {
  runMainInit();
}

window.addEventListener('hashchange', setActiveNav);

function initChat() {
  const input = document.getElementById('chatInput');
  const send  = document.getElementById('chatSend');
  const box   = document.getElementById('chatBox');
  if (!input || !send || !box) return;

  function sendMsg() {
    const val = input.value.trim();
    if (!val) return;
    const msg = document.createElement('div');
    msg.className = 'chat-msg self';
    msg.innerHTML = `<div class="chat-avatar">👤</div><div><div class="chat-bubble">${val}</div><div class="chat-time">Just now</div></div>`;
    box.appendChild(msg);
    box.scrollTop = box.scrollHeight;
    input.value = '';
  }

  send.addEventListener('click', sendMsg);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') sendMsg(); });
}

/* ── Charts (light theme) ─────────────────────────────────── */
function initCharts() {
  initRadarChart();
  initScoreBarChart();
  initPilotChart();
}

function initRadarChart() {
  const canvas = document.getElementById('radarChart');
  if (!canvas || !window.Chart) return;
  if (canvas._chart) canvas._chart.destroy();

  canvas._chart = new Chart(canvas, {
    type: 'radar',
    data: {
      labels: ['Innovation','Feasibility','Scalability','Impact','Cost Eff.'],
      datasets: [
        { label:'CropSense AI', data:[92,95,85,95,90], borderColor:'#2563EB', backgroundColor:'rgba(37,99,235,0.1)', pointBackgroundColor:'#2563EB', borderWidth:2 },
        { label:'FarmVision',   data:[85,72,80,88,70], borderColor:'#16A34A', backgroundColor:'rgba(22,163,74,0.08)', pointBackgroundColor:'#16A34A', borderWidth:2 },
        { label:'VoiceAgri',    data:[80,90,88,82,92], borderColor:'#D97706', backgroundColor:'rgba(217,119,6,0.06)', pointBackgroundColor:'#D97706', borderWidth:2 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position:'bottom', labels:{ font:{size:11}, padding:12 } } },
      scales: { r: { min:60, max:100, ticks:{ stepSize:10, font:{size:10} }, grid:{ color:'#E2E8F0' }, pointLabels:{ font:{size:11}, color:'#475569' } } },
    },
  });
}

function initScoreBarChart() {
  const canvas = document.getElementById('scoreBarChart');
  if (!canvas || !window.Chart) return;
  if (canvas._chart) canvas._chart.destroy();

  const labels = ['CropSense AI','FarmVision','VoiceAgri','AgroSense','CropCircle'];
  const data   = [93, 87, 85, 77, 79];
  const colors = data.map(v => v >= 88 ? '#16A34A' : v >= 80 ? '#2563EB' : '#D97706');

  canvas._chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label:'AI Score', data, backgroundColor: colors, borderRadius:6, borderWidth:0 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis:'y',
      plugins: { legend:{ display:false } },
      scales: {
        x: { min:60, max:100, grid:{ color:'#F1F5F9' }, ticks:{ font:{size:11} } },
        y: { grid:{ display:false }, ticks:{ font:{size:11} } },
      },
    },
  });
}

function initPilotChart() {
  const canvas = document.getElementById('pilotChart');
  if (!canvas || !window.Chart) return;
  if (canvas._chart) canvas._chart.destroy();

  const labels = ['Week 1','Week 2','Week 3','Week 4','Week 5','Week 6'];
  canvas._chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label:'Detection %', data:[72,78,82,86,89,91], borderColor:'#2563EB', backgroundColor:'rgba(37,99,235,0.05)', tension:0.4, fill:true, pointBackgroundColor:'#2563EB', borderWidth:2 },
        { label:'Nurse Adoption %', data:[45,58,65,72,78,84], borderColor:'#16A34A', backgroundColor:'rgba(22,163,74,0.05)', tension:0.4, fill:true, pointBackgroundColor:'#16A34A', borderWidth:2 },
        { label:'False Positive %', data:[18,15,12,9,7,6], borderColor:'#E11D48', backgroundColor:'rgba(225,29,72,0.03)', tension:0.4, fill:true, pointBackgroundColor:'#E11D48', borderWidth:2, borderDash:[4,3] },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend:{ position:'bottom', labels:{ font:{size:11}, padding:12 } } },
      scales: {
        y: { grid:{ color:'#F1F5F9' }, ticks:{ font:{size:11} } },
        x: { grid:{ display:false }, ticks:{ font:{size:11} } },
      },
    },
  });
}

function initDoughnutChart() {
  const canvas = document.getElementById('categoryChart');
  if (!canvas || !window.Chart) return;
  if (canvas._chart) canvas._chart.destroy();

  canvas._chart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Agriculture','Healthcare','Technology','Education','Environment','Others'],
      datasets: [{ data:[18,15,12,10,9,21], backgroundColor:['#16A34A','#DC2626','#2563EB','#7C3AED','#059669','#94A3B8'], borderWidth:2, borderColor:'#fff' }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend:{ position:'right', labels:{ font:{size:11}, padding:12 } } },
      cutout:'65%',
    },
  });
}

/* ── Copy to clipboard ────────────────────────────────────── */
function copyToClipboard(text) {
  navigator.clipboard.writeText(text || document.title).then(() => showToast('Copied to clipboard!', 'success', 2000));
}

/* ── Filters (problem list) ───────────────────────────────── */
function initFilters() {
  const searchInput = document.getElementById('searchProblems');
  const grid = document.getElementById('problemsGrid');
  if (!searchInput || !grid) return;

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase();
    grid.querySelectorAll('.problem-card').forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = text.includes(q) ? '' : 'none';
    });
  });

  document.querySelectorAll('[data-filter]').forEach(sel => {
    sel.addEventListener('change', applyFilters);
  });
}

function applyFilters() {
  const grid = document.getElementById('problemsGrid');
  if (!grid) return;
  const cat  = document.getElementById('filterCategory')?.value || '';
  const diff = document.getElementById('filterDifficulty')?.value || '';
  const stat = document.getElementById('filterStatus')?.value || '';
  grid.querySelectorAll('.problem-card').forEach(card => {
    let show = true;
    if (cat  && card.dataset.category  !== cat)  show = false;
    if (diff && card.dataset.difficulty !== diff) show = false;
    if (stat && card.dataset.status    !== stat)  show = false;
    card.style.display = show ? '' : 'none';
  });
}

