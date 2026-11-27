/**
 * StudySync AI - Live Study Session Timer HUD & AI Recap Client Logic
 */
let sessionState = {
  socket: null,
  roomId: null,
  currentUser: null,
  isOwner: false,
  status: 'idle', // 'idle' | 'active' | 'paused'
  mode: 'stopwatch', // 'stopwatch' | 'pomodoro_25' | 'focus_50'
  elapsedSeconds: 0,
  intervalId: null,
  activeSessionData: null
};

function initSession(socket, roomId, currentUser, isOwner = false) {
  sessionState.socket = socket;
  sessionState.roomId = roomId;
  sessionState.currentUser = currentUser;
  sessionState.isOwner = isOwner;

  setupSessionDOMListeners();
  setupSessionSocketListeners();
  fetchInitialSession();
}

/**
 * 1. Fetch Room's Current Session from Backend
 */
async function fetchInitialSession() {
  try {
    const res = await API.getActiveSession(sessionState.roomId);
    if (res && res.success && res.data && res.data.session) {
      const s = res.data.session;
      sessionState.activeSessionData = s;
      sessionState.status = s.status;
      sessionState.mode = s.mode || 'stopwatch';
      sessionState.elapsedSeconds = res.data.elapsedSeconds || s.durationSeconds || 0;

      // Update mode select in DOM
      const modeSelect = document.getElementById('sessionModeSelect');
      if (modeSelect) modeSelect.value = sessionState.mode;

      updateSessionHUD();
      if (sessionState.status === 'active') {
        startLocalTimerInterval();
      }
    } else {
      resetSessionHUD();
    }
  } catch (err) {
    console.warn('[Session] Could not fetch active session:', err.message);
  }
}

/**
 * 2. Setup Real-Time Socket Listeners
 */
function setupSessionSocketListeners() {
  const socket = sessionState.socket;
  if (!socket) return;

  socket.on('session:started', (data) => {
    if (!data || !data.session) return;
    sessionState.activeSessionData = data.session;
    sessionState.status = 'active';
    sessionState.mode = data.session.mode || 'stopwatch';
    sessionState.elapsedSeconds = 0;

    const modeSelect = document.getElementById('sessionModeSelect');
    if (modeSelect) modeSelect.value = sessionState.mode;

    updateSessionHUD();
    startLocalTimerInterval();
  });

  socket.on('session:paused', (data) => {
    sessionState.status = 'paused';
    if (data && typeof data.durationSeconds === 'number') {
      sessionState.elapsedSeconds = data.durationSeconds;
    }
    stopLocalTimerInterval();
    updateSessionHUD();
  });

  socket.on('session:resumed', (data) => {
    sessionState.status = 'active';
    updateSessionHUD();
    startLocalTimerInterval();
  });

  socket.on('session:ended', (data) => {
    stopLocalTimerInterval();
    resetSessionHUD();
    if (data && data.session) {
      openSessionRecapModal(data.session);
    }
  });
}

/**
 * 3. Setup DOM Listeners
 */
function setupSessionDOMListeners() {
  const btnToggle = document.getElementById('btnToggleSession');
  const btnEnd = document.getElementById('btnEndSession');
  const modeSelect = document.getElementById('sessionModeSelect');

  btnToggle?.addEventListener('click', handleSessionToggle);
  btnEnd?.addEventListener('click', handleSessionEnd);

  modeSelect?.addEventListener('change', (e) => {
    sessionState.mode = e.target.value;
    updateSessionDisplay();
  });
}

/**
 * 4. Handle Toggle (Start / Pause / Resume)
 */
async function handleSessionToggle() {
  if (!sessionState.isOwner) {
    alert('Permission denied: Only the room host who created the room can control the study session timer.');
    return;
  }

  const btn = document.getElementById('btnToggleSession');
  if (btn) btn.disabled = true;

  try {
    if (sessionState.status === 'idle') {
      const modeSelect = document.getElementById('sessionModeSelect');
      const mode = modeSelect ? modeSelect.value : 'stopwatch';
      const res = await API.startSession(sessionState.roomId, mode);
      if (res && res.success && res.data && res.data.session) {
        sessionState.activeSessionData = res.data.session;
        sessionState.status = 'active';
        sessionState.mode = mode;
        sessionState.elapsedSeconds = 0;
        updateSessionHUD();
        startLocalTimerInterval();
      }
    } else if (sessionState.status === 'active') {
      const res = await API.pauseSession(sessionState.roomId);
      if (res && res.success) {
        sessionState.status = 'paused';
        stopLocalTimerInterval();
        updateSessionHUD();
      }
    } else if (sessionState.status === 'paused') {
      const res = await API.resumeSession(sessionState.roomId);
      if (res && res.success) {
        sessionState.status = 'active';
        updateSessionHUD();
        startLocalTimerInterval();
      }
    }
  } catch (err) {
    alert(err.message || 'Failed to update study session.');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/**
 * 5. Handle End Session & Trigger AI Recap
 */
async function handleSessionEnd() {
  if (!sessionState.isOwner) {
    alert('Permission denied: Only the room host who created the study room can end the session and generate the AI recap.');
    return;
  }

  if (!confirm('End study session and close room? This will generate your AI study recap, save it to your Knowledge Base, and archive the room in read-only mode.')) return;

  const btnEnd = document.getElementById('btnEndSession');
  const topbarEnd = document.getElementById('btnTopbarEndSession');
  if (btnEnd) {
    btnEnd.disabled = true;
    btnEnd.textContent = '⏳ AI Recap...';
  }
  if (topbarEnd) {
    topbarEnd.disabled = true;
    topbarEnd.textContent = '⏳ Ending...';
  }

  try {
    const res = await API.endSession(sessionState.roomId);
    if (res && res.success && res.data && res.data.session) {
      stopLocalTimerInterval();
      resetSessionHUD();
      openSessionRecapModal(res.data.session);
      if (typeof window.enableReadOnlyMode === 'function') {
        window.enableReadOnlyMode(true);
      }
    }
  } catch (err) {
    alert(err.message || 'Failed to end study session.');
    if (btnEnd) {
      btnEnd.disabled = false;
      btnEnd.textContent = '🏁 Recap';
    }
    if (topbarEnd) {
      topbarEnd.disabled = false;
      topbarEnd.textContent = '🏁 End Session';
    }
  }
}
window.handleSessionEnd = handleSessionEnd;

/**
 * 6. Timer Engine & HUD Controls
 */
function startLocalTimerInterval() {
  stopLocalTimerInterval();
  sessionState.intervalId = setInterval(() => {
    sessionState.elapsedSeconds += 1;
    updateSessionDisplay();

    // Check countdown limits for Pomodoro
    if (sessionState.mode === 'pomodoro_25' && sessionState.elapsedSeconds >= 25 * 60) {
      playChime();
      alert('🍅 Pomodoro Complete (25 min)! Great focus. Take a 5-minute break or end your session.');
    } else if (sessionState.mode === 'focus_50' && sessionState.elapsedSeconds >= 50 * 60) {
      playChime();
      alert('⚡ Deep Focus Block Complete (50 min)! Excellent job.');
    }
  }, 1000);
}

function stopLocalTimerInterval() {
  if (sessionState.intervalId) {
    clearInterval(sessionState.intervalId);
    sessionState.intervalId = null;
  }
}

function updateSessionHUD() {
  const dot = document.getElementById('sessionStatusDot');
  const btnToggle = document.getElementById('btnToggleSession');
  const btnEnd = document.getElementById('btnEndSession');
  const modeSelect = document.getElementById('sessionModeSelect');

  if (dot) {
    if (sessionState.status === 'active') {
      dot.className = 'session-status-dot active';
    } else if (sessionState.status === 'paused') {
      dot.className = 'session-status-dot paused';
    } else {
      dot.className = 'session-status-dot';
    }
  }

  if (btnToggle) {
    if (sessionState.status === 'active') {
      btnToggle.textContent = '⏸ Pause';
      btnToggle.className = 'btn-session-control btn-session-toggle active';
    } else if (sessionState.status === 'paused') {
      btnToggle.textContent = '▶ Resume';
      btnToggle.className = 'btn-session-control btn-session-toggle';
    } else {
      btnToggle.textContent = '▶ Start';
      btnToggle.className = 'btn-session-control btn-session-toggle';
    }
  }

  if (btnEnd) {
    btnEnd.disabled = sessionState.status === 'idle';
  }

  if (modeSelect) {
    modeSelect.disabled = sessionState.status === 'active';
  }

  // Enforce host-only permissions for timer control
  if (!sessionState.isOwner) {
    const hudControls = document.querySelector('.session-hud-controls');
    if (hudControls) {
      hudControls.style.display = 'none';
    }
    if (btnToggle) {
      btnToggle.style.display = 'none';
    }
    if (btnEnd) {
      btnEnd.style.display = 'none';
    }
    if (modeSelect) {
      modeSelect.disabled = true;
    }
  }

  updateSessionDisplay();
}

function resetSessionHUD() {
  sessionState.status = 'idle';
  sessionState.elapsedSeconds = 0;
  sessionState.activeSessionData = null;
  stopLocalTimerInterval();
  updateSessionHUD();
}

function updateSessionDisplay() {
  const display = document.getElementById('sessionTimerDisplay');
  if (!display) return;

  let seconds = sessionState.elapsedSeconds;

  // Countdown display for Pomodoro modes
  if (sessionState.mode === 'pomodoro_25') {
    const remain = Math.max(0, 25 * 60 - seconds);
    const m = Math.floor(remain / 60);
    const s = remain % 60;
    display.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return;
  }

  if (sessionState.mode === 'focus_50') {
    const remain = Math.max(0, 50 * 60 - seconds);
    const m = Math.floor(remain / 60);
    const s = remain % 60;
    display.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return;
  }

  // Count-up display for Stopwatch
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    display.textContent = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  } else {
    display.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
}

/**
 * 7. Post-Session AI Recap Modal
 */
let lastCompletedSession = null;

function openSessionRecapModal(session) {
  lastCompletedSession = session;
  const modal = document.getElementById('sessionRecapModal');
  if (!modal) return;

  const durationMins = Math.max(1, Math.round((session.durationSeconds || 0) / 60));
  const stats = session.stats || {};

  document.getElementById('recapDurationVal').textContent = `${durationMins} min`;
  document.getElementById('recapDoubtsVal').textContent = stats.doubtsSolvedCount || 0;
  document.getElementById('recapMessagesVal').textContent = stats.chatMessagesCount || 0;

  const contentContainer = document.getElementById('recapContentArea');
  if (contentContainer) {
    const recapText = session.aiSummary && session.aiSummary.content 
      ? session.aiSummary.content 
      : 'No summary generated.';
    contentContainer.innerHTML = renderMarkdownRecap(recapText);
  }

  const saveBtn = document.getElementById('btnSaveRecapToKB');
  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 Save to Knowledge Base';
    saveBtn.style.backgroundColor = '';
    saveBtn.style.borderColor = '';
    saveBtn.style.color = '';
  }

  modal.classList.remove('hidden');
}

function closeSessionRecapModal() {
  const modal = document.getElementById('sessionRecapModal');
  if (modal) modal.classList.add('hidden');
}

async function saveRecapToKnowledgeBase() {
  if (!lastCompletedSession || !lastCompletedSession.aiSummary || !lastCompletedSession.aiSummary.content) {
    alert('No summary content to save.');
    return;
  }

  const btn = document.getElementById('btnSaveRecapToKB');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Saving...';
  }

  try {
    const subject = document.getElementById('workspaceSubjectTag')?.textContent || 'General Studies';
    const roomTitle = document.getElementById('workspaceRoomTitle')?.textContent || 'Study Room';

    await API.createKnowledgeItem({
      title: `Study Session Recap: ${roomTitle}`,
      subject: subject,
      category: 'summary',
      content: lastCompletedSession.aiSummary.content,
      tags: ['session-recap', 'summary'],
      source: 'Gemini AI Study Session'
    });

    if (btn) {
      btn.textContent = '✓ Saved to Knowledge Base!';
      btn.style.backgroundColor = '#10B981';
      btn.style.borderColor = '#10B981';
      btn.style.color = '#FFFFFF';
    }
  } catch (err) {
    alert(err.message || 'Failed to save to Knowledge Base.');
    if (btn) {
      btn.disabled = false;
      btn.textContent = '💾 Save to Knowledge Base';
    }
  }
}

function copyRecapToClipboard() {
  const area = document.getElementById('recapContentArea');
  if (!area) return;
  navigator.clipboard.writeText(area.innerText);
  alert('Study session recap copied to clipboard!');
}

/**
 * Built-in Web Audio Chime (no external files)
 */
function playChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) {
    // Ignore audio permission restrictions
  }
}

function renderMarkdownRecap(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.*$)/gim, '<h3 style="font-size:16px; font-weight:700; color:#1E1B4B; margin: 12px 0 6px;">$1</h3>')
    .replace(/^#### (.*$)/gim, '<h4 style="font-size:14px; font-weight:700; color:#312E81; margin: 10px 0 4px;">$1</h4>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- \[( |x)\] (.*$)/gim, '<li><input type="checkbox" disabled checked> $2</li>')
    .replace(/^\* (.*$)/gim, '• $1')
    .replace(/^- (.*$)/gim, '• $1')
    .replace(/^> (.*$)/gim, '<blockquote style="border-left: 3px solid #6366F1; padding-left: 10px; color: #4338CA; margin: 8px 0; font-style: italic;">$1</blockquote>');
}
