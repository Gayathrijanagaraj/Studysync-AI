/**
 * StudySync AI - Study Sessions & AI Recap Controller
 */
document.addEventListener('DOMContentLoaded', async () => {
  let currentUser = null;
  let allSessions = [];
  let currentFilter = 'all';
  let activeRecapData = null;

  // 1. Authenticate user & init navbar
  try {
    const meRes = await API.getMe();
    if (!meRes || !meRes.success || !meRes.data || !meRes.data.user) {
      window.location.replace('/pages/login.html');
      return;
    }
    currentUser = meRes.data.user;
    API.initNavbar('sessions');
  } catch (err) {
    window.location.replace('/pages/login.html');
    return;
  }

  // 2. Fetch Sessions and render
  await loadAndRenderSessions();

  // 3. Bind Filter Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.getAttribute('data-filter') || 'all';
      filterAndRenderSessions();
    });
  });

  // 4. Modal Event Listeners
  setupModalEvents();

  async function loadAndRenderSessions() {
    const container = document.getElementById('sessionsContainer');
    if (!container) return;

    try {
      container.innerHTML = '<p style="color:var(--color-text-muted); padding:30px; text-align:center;">Loading study sessions...</p>';
      const res = await API.getAllSessions('all');

      if (res && res.success && res.data) {
        allSessions = res.data.sessions || [];
        updateMetrics();
        filterAndRenderSessions();
      }
    } catch (err) {
      container.innerHTML = `<div class="alert alert-error">Error loading sessions: ${err.message}</div>`;
    }
  }

  function updateMetrics() {
    let totalSeconds = 0;
    let pomodoroCount = 0;
    let doubtsCount = 0;

    allSessions.forEach(s => {
      totalSeconds += s.durationSeconds || 0;
      if (s.mode === 'pomodoro_25' || s.mode === 'pomodoro') pomodoroCount++;
      if (s.stats && s.stats.doubtsSolvedCount) doubtsCount += s.stats.doubtsSolvedCount;
    });

    const hours = (totalSeconds / 3600).toFixed(1);
    const hoursEl = document.getElementById('totalFocusHours');
    const sessionsEl = document.getElementById('totalSessionsCount');
    const pomodoroEl = document.getElementById('totalPomodoroCount');
    const doubtsEl = document.getElementById('totalDoubtsDiscussed');

    if (hoursEl) hoursEl.textContent = `${hours}h`;
    if (sessionsEl) sessionsEl.textContent = allSessions.length;
    if (pomodoroEl) pomodoroEl.textContent = pomodoroCount;
    if (doubtsEl) doubtsEl.textContent = doubtsCount;
  }

  function filterAndRenderSessions() {
    const container = document.getElementById('sessionsContainer');
    if (!container) return;

    let filtered = allSessions;
    if (currentFilter !== 'all') {
      filtered = allSessions.filter(s => s.mode === currentFilter);
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; background:#fff; border:1px solid #E2E8F0; border-radius:16px; padding:48px; text-align:center;">
          <div style="font-size:36px; margin-bottom:12px;">⏱️</div>
          <h3 style="font-size:18px; font-weight:800; color:var(--color-text-navy); margin-bottom:6px;">No Study Sessions Found</h3>
          <p style="font-size:14px; color:var(--color-text-muted); max-width:440px; margin:0 auto 20px;">
            Start a study session timer inside any of your collaborative study rooms to automatically record your focus time and generate an AI study synthesis.
          </p>
          <a href="/pages/rooms.html" class="btn-hero-action btn-hero-primary" style="display:inline-flex;">
            Browse Study Rooms
          </a>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(session => {
      const room = session.roomId || {};
      const roomName = room.name || 'Study Room';
      const subject = room.subject || 'General Studies';
      const roomCode = room.roomCode || '';
      const mode = session.mode || 'stopwatch';
      const durationMins = Math.max(1, Math.round((session.durationSeconds || 0) / 60));
      const formattedDate = session.createdAt
        ? new Date(session.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'Recent';

      const modeLabel = mode === 'pomodoro_25' ? '🍅 Pomodoro' : (mode === 'focus_50' ? '⚡ Focus 50m' : '⏱️ Stopwatch');
      const modeClass = mode === 'pomodoro_25' ? 'pomodoro' : (mode === 'focus_50' ? 'focus' : '');

      const messagesCount = session.stats?.chatMessagesCount || 0;
      const doubtsSolved = session.stats?.doubtsSolvedCount || 0;
      const notesWordCount = session.stats?.notesWordCount || 0;

      const hasAiSummary = !!session.aiSummary?.content;

      return `
        <div class="session-history-card">
          <div>
            <div class="session-card-top">
              <div class="session-pills-row">
                <span class="session-subject-badge">${escapeHtml(subject)}</span>
                <span class="session-mode-badge ${modeClass}">${modeLabel}</span>
              </div>
              <span style="font-size:12px; font-weight:600; color:var(--color-text-muted);">${durationMins} min</span>
            </div>

            <h3 class="session-room-title">${escapeHtml(roomName)}</h3>
            <div class="session-meta-row">
              <span>📅 ${formattedDate}</span>
              ${roomCode ? `<span>🔑 ${escapeHtml(roomCode)}</span>` : ''}
            </div>
          </div>

          <div class="session-metrics-box">
            <div class="session-metric-item">
              <span>${messagesCount}</span>
              <span>Messages</span>
            </div>
            <div class="session-metric-item">
              <span>${doubtsSolved}</span>
              <span>Doubts Solved</span>
            </div>
            <div class="session-metric-item">
              <span>${notesWordCount}</span>
              <span>Notes Words</span>
            </div>
          </div>

          <div class="session-card-actions">
            ${hasAiSummary ? `
              <button type="button" class="btn-view-recap" data-session-id="${session._id}">
                🎓 View AI Recap
              </button>
            ` : `
              <span style="font-size:12px; color:var(--color-text-muted); text-align:center; width:100%;">No AI summary recorded</span>
            `}
          </div>
        </div>
      `;
    }).join('');

    // Bind recap buttons
    document.querySelectorAll('.btn-view-recap').forEach(btn => {
      btn.addEventListener('click', () => {
        const sessionId = btn.getAttribute('data-session-id');
        const session = allSessions.find(s => s._id === sessionId);
        if (session && session.aiSummary) {
          openRecapModal(session);
        }
      });
    });
  }

  function setupModalEvents() {
    const modal = document.getElementById('sessionRecapModal');
    const closeBtn1 = document.getElementById('btnCloseRecapModal');
    const closeBtn2 = document.getElementById('btnCloseRecapBtn');
    const saveToKbBtn = document.getElementById('btnSaveRecapToKb');

    const closeModal = () => {
      modal?.classList.add('hidden');
      activeRecapData = null;
    };

    closeBtn1?.addEventListener('click', closeModal);
    closeBtn2?.addEventListener('click', closeModal);

    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    saveToKbBtn?.addEventListener('click', async () => {
      if (!activeRecapData) return;
      try {
        saveToKbBtn.disabled = true;
        saveToKbBtn.textContent = 'Saving...';

        const room = activeRecapData.roomId || {};
        await API.createKnowledgeItem({
          title: `Study Session Recap: ${room.name || 'Study Room'}`,
          content: activeRecapData.aiSummary.content,
          category: 'summary',
          subject: room.subject || 'General Studies',
          tags: ['session-recap', 'summary'],
          source: 'Gemini AI Study Session',
          roomId: room._id
        });

        saveToKbBtn.textContent = '✅ Saved to Knowledge Base!';
        setTimeout(() => {
          saveToKbBtn.textContent = '📌 Save to Knowledge Base';
          saveToKbBtn.disabled = false;
        }, 2500);
      } catch (err) {
        alert('Failed to save to Knowledge Base: ' + err.message);
        saveToKbBtn.textContent = '📌 Save to Knowledge Base';
        saveToKbBtn.disabled = false;
      }
    });
  }

  function openRecapModal(session) {
    activeRecapData = session;
    const modal = document.getElementById('sessionRecapModal');
    const body = document.getElementById('sessionRecapBody');
    const titleEl = document.getElementById('recapModalTitle');
    const room = session.roomId || {};

    if (titleEl) {
      titleEl.textContent = `🎓 AI Recap: ${room.name || 'Study Session'}`;
    }

    if (body) {
      body.innerHTML = parseSimpleMarkdown(session.aiSummary.content);
    }

    modal?.classList.remove('hidden');
  }

  function parseSimpleMarkdown(md) {
    if (!md) return '<p>No content</p>';
    return md
      .replace(/^### (.*$)/gim, '<h4>$1</h4>')
      .replace(/^## (.*$)/gim, '<h3>$1</h3>')
      .replace(/^# (.*$)/gim, '<h2>$1</h2>')
      .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/- \[ \] (.*$)/gim, '<li>☐ $1</li>')
      .replace(/- \[x\] (.*$)/gim, '<li>☑ $1</li>')
      .replace(/^\- (.*$)/gim, '<li>$1</li>')
      .replace(/\n\n/gim, '<br><br>');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
});
