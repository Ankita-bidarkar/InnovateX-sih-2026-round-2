/* ============================================================
   InnovateX — Ask IX Chatbot Frontend
   js/askix.js

   Handles the Ask IX floating chat panel UI.
   Communicates with POST /api/chat on the backend.
   ============================================================ */

(function() {
  'use strict';

  const BACKEND_URL = window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin;

  /* ── State ────────────────────────────────────────────────── */
  let isOpen = false;
  let isLoading = false;
  let conversationHistory = [];

  /* ── Page context detection ───────────────────────────────── */
  function getPageContext() {
    const page = document.body.dataset.page || 'index';
    const context = { page };

    // Try to pull current solution/pilot context from the page
    if (page === 'ai-analysis') {
      const probSel = document.getElementById('analysisProblemSelect');
      if (probSel) context.currentProblemId = probSel.value;
    }
    if (page === 'pilot') {
      context.currentPage = 'pilot';
    }
    if (page === 'collaborate') {
      context.currentPage = 'collaborate';
    }
    if (page === 'startup-verification') {
      context.currentPage = 'verification';
    }
    return context;
  }

  /* ── Render helpers ───────────────────────────────────────── */
  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>'\"]/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[ch]));
  }

  function formatAnswer(answer) {
    if (!answer || typeof answer !== 'object') return escapeHtml(String(answer || ''));

    const parts = [];
    const text = answer.text || answer.answer || '';
    if (text) {
      // Convert markdown-style bullets
      const formatted = escapeHtml(text)
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/`(.*?)`/g, '<code style="background:var(--bg-section);padding:1px 5px;border-radius:4px;font-size:12px">$1</code>');
      parts.push(`<div style="line-height:1.6">${formatted}</div>`);
    }

    // Solution list
    if (answer.solutions?.length) {
      const items = answer.solutions.map(s => `
        <div class="chat-sol-card">
          <div style="flex:1">
            <div style="font-weight:700;font-size:13px">${escapeHtml(s.title)}</div>
            <div style="font-size:11px;color:var(--text-muted)">${escapeHtml(s.team)}</div>
          </div>
          <div class="chat-sol-score">${s.score}/100</div>
          <span class="badge ${s.status === 'shortlisted' || s.status === 'Shortlisted' ? 'badge-green' : 'badge-blue'}" style="font-size:10px">${escapeHtml(s.status || '')}</span>
        </div>
      `).join('');
      parts.push(`<div style="margin-top:8px">${items}</div>`);
      if (answer.totalCount > 5) {
        parts.push(`<div style="font-size:11px;color:var(--text-muted);margin-top:4px">Showing top 5 of ${answer.totalCount} solutions.</div>`);
      }
    }

    // Pilot list
    if (answer.pilots?.length) {
      const items = answer.pilots.map(p => `
        <div class="chat-sol-card">
          <div style="flex:1">
            <div style="font-weight:700;font-size:12px">${escapeHtml(p.title)}</div>
            <div style="font-size:11px;color:var(--text-muted)">${escapeHtml(p.stage || '')}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;font-weight:700;color:var(--blue-600)">${p.progress}%</div>
            <div style="font-size:10px;color:var(--text-muted)">complete</div>
          </div>
        </div>
      `).join('');
      parts.push(`<div style="margin-top:8px">${items}</div>`);
    }

    // Dimension scores
    if (answer.dimensions) {
      const dims = answer.dimensions;
      const dimHtml = Object.entries(dims).map(([k, v]) => `
        <div class="dim-bar-wrap" style="margin-bottom:6px">
          <div class="dim-bar-header">
            <span class="dim-bar-label">${k.charAt(0).toUpperCase() + k.slice(1)}</span>
            <span class="dim-bar-score">${v}</span>
          </div>
          <div class="progress-track sm">
            <div class="progress-fill ${v >= 80 ? 'green' : v >= 60 ? '' : 'amber'}" style="width:${v}%;animation:none"></div>
          </div>
        </div>
      `).join('');
      parts.push(`<div style="margin-top:10px;padding:10px;background:var(--bg-section);border-radius:12px">${dimHtml}</div>`);
    }

    // Disclaimer
    if (answer.disclaimer) {
      parts.push(`<div style="font-size:10px;color:var(--text-muted);margin-top:8px;font-style:italic">ℹ️ ${escapeHtml(answer.disclaimer)}</div>`);
    }

    return parts.join('');
  }

  function renderFollowUps(suggestions) {
    if (!suggestions?.length) return '';
    const btns = suggestions.map(s =>
      `<button class="askix-followup" data-suggestion="${escapeHtml(s)}">${escapeHtml(s)}</button>`
    ).join('');
    return `<div class="askix-followups">${btns}</div>`;
  }

  /* ── Message rendering ────────────────────────────────────── */
  function appendMessage(role, contentHtml, followUps = []) {
    const messagesEl = document.getElementById('askixMessages');
    if (!messagesEl) return;

    // Remove welcome state
    const welcome = document.getElementById('askixWelcome');
    if (welcome) welcome.style.display = 'none';

    const now = new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });

    const msgEl = document.createElement('div');
    msgEl.className = `askix-msg ${role}`;

    if (role === 'ix') {
      msgEl.innerHTML = `
        <div class="askix-msg-avatar">IX</div>
        <div style="flex:1;min-width:0">
          <div class="askix-msg-bubble">${contentHtml}</div>
          ${followUps.length ? renderFollowUps(followUps) : ''}
          <div class="askix-msg-time">${now}</div>
        </div>
      `;
    } else {
      msgEl.innerHTML = `
        <div class="askix-msg-avatar">👤</div>
        <div style="flex:1;min-width:0">
          <div class="askix-msg-bubble">${contentHtml}</div>
          <div class="askix-msg-time" style="text-align:right">${now}</div>
        </div>
      `;
    }

    messagesEl.appendChild(msgEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    // Wire up follow-up buttons
    msgEl.querySelectorAll('.askix-followup, .askix-suggestion').forEach(btn => {
      btn.addEventListener('click', () => {
        const question = btn.dataset.suggestion || btn.textContent.trim();
        sendMessage(question);
      });
    });

    return msgEl;
  }

  function showTyping() {
    const messagesEl = document.getElementById('askixMessages');
    if (!messagesEl) return null;
    const welcome = document.getElementById('askixWelcome');
    if (welcome) welcome.style.display = 'none';
    const el = document.createElement('div');
    el.className = 'askix-msg ix';
    el.id = 'askixTyping';
    el.innerHTML = `
      <div class="askix-msg-avatar">IX</div>
      <div class="askix-msg-bubble" style="background:var(--bg-section)">
        <div class="askix-typing"><span></span><span></span><span></span></div>
      </div>
    `;
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return el;
  }

  function removeTyping() {
    document.getElementById('askixTyping')?.remove();
  }

  /* ── Send message ─────────────────────────────────────────── */
  async function sendMessage(question) {
    if (!question?.trim() || isLoading) return;
    isLoading = true;

    // Clear input
    const inputEl = document.getElementById('askixInput');
    if (inputEl) inputEl.value = '';

    // Add user message
    appendMessage('user', escapeHtml(question));
    conversationHistory.push({ role: 'user', content: question });

    // Show typing
    const typingEl = showTyping();

    try {
      const context = getPageContext();
      const resp = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, context }),
        signal: AbortSignal.timeout(30000),
      });

      removeTyping();

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      const contentHtml = formatAnswer(data);
      const followUps = data.followUpSuggestions || [];
      appendMessage('ix', contentHtml, followUps);
      conversationHistory.push({ role: 'ix', content: data.text || '' });

    } catch (err) {
      removeTyping();

      // Deterministic fallback using frontend data
      const fallback = getFallbackAnswer(question);
      appendMessage('ix', `<div>${escapeHtml(fallback.text)}</div>`, fallback.followUps);
    } finally {
      isLoading = false;
      const sendBtn = document.getElementById('askixSend');
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  /* ── Deterministic frontend fallback ──────────────────────── */
  function getFallbackAnswer(question) {
    const lower = question.toLowerCase();

    if (lower.includes('score') || lower.includes('how') && lower.includes('work')) {
      return {
        text: 'InnovateX scores solutions across 6 dimensions: Relevance (25%), Innovation (20%), Feasibility (20%), Impact (15%), Scalability (10%), and Cost Efficiency (10%). Scores are calculated from structured solution data — not randomly generated.',
        followUps: ['What does shortlisted mean?', 'How does collaboration work?'],
      };
    }
    if (lower.includes('pilot') || lower.includes('kpi')) {
      return {
        text: 'A pilot is a real-world test of a shortlisted solution with defined KPIs. KPI results form the evidence base for procurement decisions. The final call always belongs to the authorised organisation representative.',
        followUps: ['What happens after a pilot?', 'What are KPIs?'],
      };
    }
    if (lower.includes('collaborat')) {
      return {
        text: 'InnovateX detects when two solutions complement each other. For example: one startup collects sensor data, another does ML prediction — together they cover more ground. IP and legal arrangements are handled separately by the parties.',
        followUps: ['Show me collaboration opportunities', 'What is an evolved solution?'],
      };
    }
    if (lower.includes('shortlist')) {
      return {
        text: 'Solutions scoring 85+ are shortlisted. 70–84 are flagged for improvement. Below 70 are not shortlisted at this stage. These thresholds are deterministic — not decided by a chatbot.',
        followUps: ['How are scores calculated?', 'What happens after shortlisting?'],
      };
    }
    if (lower.includes('dpiit') || lower.includes('verif')) {
      return {
        text: 'InnovateX Verification is a platform-level review. It is NOT equivalent to DPIIT government recognition. DPIIT is a Government of India programme — verify at startupindia.gov.in.',
        followUps: ['What is startup eligibility?', 'How does verification affect scoring?'],
      };
    }
    const stats = typeof IX !== 'undefined' ? IX.stats : null;
    if (lower.includes('how many') || lower.includes('statistics')) {
      if (stats) {
        return {
          text: `Platform stats: ${stats.total_problems} problems, ${stats.total_solutions} solutions, ${stats.active_pilots} active pilots, ${stats.collaborations} collaboration opportunities, ${stats.success_rate}% success rate.`,
          followUps: ['Show me active pilots', 'Show me shortlisted solutions'],
        };
      }
    }

    return {
      text: 'I\'m Ask IX. The backend API is temporarily unavailable, but I\'m here to help. Try asking about scoring, pilots, collaboration, or startup verification — or explore the platform directly.',
      followUps: ['How does InnovateX score solutions?', 'What is a pilot?', 'How does collaboration work?'],
    };
  }

  /* ── Build UI ─────────────────────────────────────────────── */
  function buildUI() {
    // FAB button
    const fab = document.createElement('button');
    fab.className = 'askix-fab';
    fab.id = 'askixFab';
    fab.setAttribute('aria-label', 'Open Ask IX assistant');
    fab.innerHTML = `
      <div class="askix-fab-icon">✦</div>
      <span class="askix-fab-label">Ask IX</span>
    `;

    // Chat panel
    const panel = document.createElement('div');
    panel.className = 'askix-panel';
    panel.id = 'askixPanel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Ask IX InnovateX Assistant');
    panel.innerHTML = `
      <div class="askix-header">
        <div class="askix-header-left">
          <div class="askix-header-icon">✦</div>
          <div>
            <div class="askix-header-title">Ask IX</div>
            <div class="askix-header-sub">InnovateX Intelligence</div>
          </div>
        </div>
        <button class="askix-close" id="askixClose" aria-label="Close Ask IX">✕</button>
      </div>

      <div class="askix-messages" id="askixMessages">
        <div id="askixWelcome" class="askix-welcome">
          <div class="askix-welcome-icon">✦</div>
          <h3>How can I help you explore InnovateX?</h3>
          <p>I can explain solutions, AI analysis, collaboration, pilots, verification and the InnovateX workflow.</p>
          <div class="askix-suggestions">
            <button class="askix-suggestion" data-suggestion="How does InnovateX score solutions?">How does InnovateX score solutions?</button>
            <button class="askix-suggestion" data-suggestion="What happens during a pilot?">What happens during a pilot?</button>
            <button class="askix-suggestion" data-suggestion="How are startups verified?">How are startups verified?</button>
            <button class="askix-suggestion" data-suggestion="Why are solutions matched for collaboration?">Why are solutions matched for collaboration?</button>
          </div>
        </div>
      </div>

      <div class="askix-input-area">
        <input type="text" class="askix-input" id="askixInput"
          placeholder="Ask about solutions, pilots, scoring…"
          autocomplete="off" maxlength="500" />
        <button class="askix-send" id="askixSend" aria-label="Send message">➤</button>
      </div>
      <div class="askix-disclaimer">Ask IX can make mistakes. Verify important procurement information.</div>
    `;

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    /* ── Event listeners ── */
    // FAB toggle
    fab.addEventListener('click', togglePanel);

    // Close button
    document.getElementById('askixClose').addEventListener('click', closePanel);

    // Send on button click
    document.getElementById('askixSend').addEventListener('click', () => {
      const input = document.getElementById('askixInput');
      if (input?.value?.trim()) sendMessage(input.value.trim());
    });

    // Send on Enter
    document.getElementById('askixInput').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const input = e.target;
        if (input.value?.trim()) sendMessage(input.value.trim());
      }
    });

    // Welcome suggestions
    panel.querySelectorAll('.askix-suggestion').forEach(btn => {
      btn.addEventListener('click', () => sendMessage(btn.dataset.suggestion));
    });

    // Close on outside click
    document.addEventListener('click', e => {
      if (isOpen && !panel.contains(e.target) && !fab.contains(e.target)) {
        closePanel();
      }
    });

    // Close on Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && isOpen) closePanel();
    });

    // Nav "Ask IX" button (if present)
    document.getElementById('navAskIX')?.addEventListener('click', e => {
      e.preventDefault();
      togglePanel();
    });
  }

  /* ── Panel open/close ─────────────────────────────────────── */
  function togglePanel() {
    isOpen ? closePanel() : openPanel();
  }

  function openPanel() {
    const panel = document.getElementById('askixPanel');
    const fab   = document.getElementById('askixFab');
    if (!panel) return;
    panel.classList.add('open');
    fab?.classList.add('panel-open');
    isOpen = true;
    setTimeout(() => document.getElementById('askixInput')?.focus(), 100);
  }

  function closePanel() {
    const panel = document.getElementById('askixPanel');
    const fab   = document.getElementById('askixFab');
    if (!panel) return;
    panel.classList.remove('open');
    fab?.classList.remove('panel-open');
    isOpen = false;
  }

  /* ── Scroll-triggered navbar ──────────────────────────────── */
  function initNavbarScroll() {
    const nav = document.querySelector('.navbar');
    if (!nav) return;
    const handler = () => {
      nav.classList.toggle('scrolled', window.scrollY > 10);
    };
    window.addEventListener('scroll', handler, { passive: true });
    handler();
  }

  /* ── Init ─────────────────────────────────────────────────── */
  function init() {
    buildUI();
    initNavbarScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for external triggering
  window.AskIX = { open: openPanel, close: closePanel, toggle: togglePanel, send: sendMessage };

})();
