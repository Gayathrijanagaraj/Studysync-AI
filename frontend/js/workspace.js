/**
 * StudySync AI - Workspace Shell Coordinator
 */
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Parse roomId from query string
  const urlParams = new URLSearchParams(window.location.search);
  const roomId = urlParams.get('roomId');

  if (!roomId) {
    alert('No study room specified. Redirecting to My Rooms...');
    window.location.replace('/pages/rooms.html');
    return;
  }

  // 2. Verify Session
  let currentUser = null;
  try {
    const meRes = await API.getMe();
    if (!meRes || !meRes.success || !meRes.data || !meRes.data.user) {
      window.location.replace('/pages/login.html');
      return;
    }
    currentUser = meRes.data.user;
  } catch (err) {
    window.location.replace('/pages/login.html');
    return;
  }

  // 3. Load Room Information
  let currentRoom = null;
  try {
    const roomRes = await API.getRoom(roomId);
    if (!roomRes || !roomRes.success || !roomRes.data) {
      alert('Could not access this study room. You might not be a member.');
      window.location.replace('/pages/rooms.html');
      return;
    }
    currentRoom = roomRes.data.room;

    // Populate Top Bar & Sidebar
    document.getElementById('workspaceRoomTitle').textContent = currentRoom.name;
    document.getElementById('workspaceSubjectTag').textContent = currentRoom.subject;
    document.getElementById('workspaceRoomCode').textContent = currentRoom.roomCode;
    document.getElementById('sidebarRoomName').textContent = currentRoom.name;
    document.getElementById('sidebarRoomDesc').textContent = currentRoom.description || 'No description provided.';
    document.getElementById('sidebarRoomCode').textContent = currentRoom.roomCode;

    // Room Code click-to-copy
    const copyCodeHandler = () => {
      navigator.clipboard.writeText(currentRoom.roomCode);
      alert(`Room code ${currentRoom.roomCode} copied to clipboard!`);
    };
    document.getElementById('workspaceRoomCode')?.addEventListener('click', copyCodeHandler);
    document.getElementById('sidebarRoomCode')?.addEventListener('click', copyCodeHandler);

    // Initial member roster
    renderParticipantsRoster(roomRes.data.members || [], []);
  } catch (err) {
    alert(err.message || 'Error loading study room.');
    window.location.replace('/pages/rooms.html');
    return;
  }

  // 4. Initialize Socket.IO Client Connection
  // Include Socket.IO client script in HTML: /socket.io/socket.io.js
  const socket = io({
    withCredentials: true
  });

  const connDot = document.getElementById('connectionDot');
  const connText = document.getElementById('connectionText');

  socket.on('connect', () => {
    console.log('[Socket.IO] Connected to server.');
    if (connDot) connDot.className = 'connection-dot';
    if (connText) connText.textContent = 'Connected';
    // Join study room channel
    socket.emit('room:join', { roomId });
  });

  socket.on('disconnect', () => {
    console.log('[Socket.IO] Disconnected.');
    if (connDot) connDot.className = 'connection-dot offline';
    if (connText) connText.textContent = 'Disconnected';
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket.IO] Connection error:', err.message);
    if (connDot) connDot.className = 'connection-dot reconnecting';
    if (connText) connText.textContent = 'Reconnecting';
  });

  // 5. Active Presence Listener
  socket.on('presence:update', (data) => {
    const activeUsers = data && data.activeUsers ? data.activeUsers : [];
    const countBadge = document.getElementById('onlineCountBadge');
    if (countBadge) countBadge.textContent = `${activeUsers.length} online`;

    // Re-render presence dots in left roster
    updatePresenceDots(activeUsers);
  });

  // 6. Tab Switching Logic
  setupTabSwitching();

  // 7. Initialize Sub-modules
  const isOwner = !!roomRes.data.isOwner || (currentRoom.ownerId && (currentRoom.ownerId._id || currentRoom.ownerId).toString() === currentUser.id.toString());

  if (typeof initChat === 'function') {
    initChat(socket, roomId, currentUser);
  }
  if (typeof initNotes === 'function') {
    initNotes(socket, roomId);
  }
  if (typeof initWhiteboard === 'function') {
    initWhiteboard(socket, roomId);
  }
  if (typeof initDoubts === 'function') {
    initDoubts(socket, roomId, currentUser, isOwner);
  }
  if (typeof initSession === 'function') {
    initSession(socket, roomId, currentUser, isOwner);
  }
  if (typeof initAI === 'function') {
    initAI(roomId);
  }

  // 8. Check if Room is Closed (Read-Only Mode)
  if (currentRoom.status === 'closed') {
    enableReadOnlyMode(isOwner);
  }

  // Socket listener for live room closure & reopening
  socket.on('room:closed', () => {
    enableReadOnlyMode(isOwner);
  });

  socket.on('room:reopened', () => {
    window.location.reload();
  });

  function enableReadOnlyMode(isHost = false) {
    const banner = document.getElementById('closedRoomBanner');
    if (banner) {
      banner.classList.remove('hidden');
    }

    const reopenBtn = document.getElementById('btnReopenWorkspaceRoom');
    if (reopenBtn && isHost) {
      reopenBtn.classList.remove('hidden');
      reopenBtn.addEventListener('click', async () => {
        try {
          await API.reopenRoom(roomId);
          window.location.reload();
        } catch (err) {
          alert(err.message || 'Could not reopen room.');
        }
      });
    }

    // 1. Lock Notes (Disable textarea/contenteditable and tools)
    const notesEditor = document.getElementById('notesEditor');
    if (notesEditor) {
      notesEditor.disabled = true;
      notesEditor.readOnly = true;
      notesEditor.setAttribute('contenteditable', 'false');
    }
    document.querySelectorAll('.notes-tool-btn').forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.4';
      btn.style.cursor = 'not-allowed';
    });

    // 2. Lock Whiteboard (Disable canvas drawing and tools)
    const wbCanvas = document.getElementById('whiteboardCanvas');
    if (wbCanvas) {
      wbCanvas.style.pointerEvents = 'none';
      wbCanvas.style.opacity = '0.9';
    }
    document.querySelectorAll('.btn-wb-tool, #wbColorPicker, #wbBrushSize').forEach(el => {
      el.disabled = true;
      el.style.opacity = '0.4';
      el.style.pointerEvents = 'none';
    });

    // 3. Lock Group Chat
    const chatInput = document.getElementById('chatInput');
    const chatSendBtn = document.querySelector('.btn-chat-send');
    if (chatInput) {
      chatInput.disabled = true;
      chatInput.placeholder = '🔒 This study room is closed. Chat is read-only.';
    }
    if (chatSendBtn) {
      chatSendBtn.disabled = true;
      chatSendBtn.style.opacity = '0.4';
      chatSendBtn.style.cursor = 'not-allowed';
    }

    // 4. Lock Doubts
    const raiseDoubtBtn = document.getElementById('btnOpenRaiseDoubtModal');
    if (raiseDoubtBtn) {
      raiseDoubtBtn.style.display = 'none';
    }

    // 5. Lock Session HUD
    const btnToggle = document.getElementById('btnToggleSession');
    const btnEnd = document.getElementById('btnEndSession');
    const modeSelect = document.getElementById('sessionModeSelect');
    if (btnToggle) btnToggle.style.display = 'none';
    if (btnEnd) btnEnd.style.display = 'none';
    if (modeSelect) modeSelect.disabled = true;
    const timerDisplay = document.getElementById('sessionTimerDisplay');
    if (timerDisplay) timerDisplay.textContent = 'Room Closed';
  }

  function renderParticipantsRoster(allMembers, onlineUsers) {
    const list = document.getElementById('participantsList');
    if (!list) return;

    list.innerHTML = allMembers.map(m => {
      const isOnline = onlineUsers.some(u => u.id.toString() === m.id.toString());
      const initials = (m.name || 'ST').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
      return `
        <div class="participant-item" id="participant-${m.id}">
          <div class="participant-avatar-small">${initials}</div>
          <span>${escapeHTML(m.name)}${m.id.toString() === currentUser.id.toString() ? ' (You)' : ''}</span>
          <div class="presence-dot ${isOnline ? '' : 'offline'}"></div>
        </div>
      `;
    }).join('');
  }

  function updatePresenceDots(onlineUsers) {
    document.querySelectorAll('.participant-item').forEach(item => {
      const dot = item.querySelector('.presence-dot');
      const userId = item.id.replace('participant-', '');
      const isOnline = onlineUsers.some(u => u.id.toString() === userId.toString());
      if (dot) {
        dot.className = `presence-dot ${isOnline ? '' : 'offline'}`;
      }
    });
  }

  function setupTabSwitching() {
    // Center Stage Switcher (Shared Notes vs Whiteboard vs Doubt Tracker)
    const btnTabNotes = document.getElementById('tabBtnNotes');
    const btnTabWhiteboard = document.getElementById('tabBtnWhiteboard');
    const btnTabDoubts = document.getElementById('tabBtnDoubts');
    const viewNotes = document.getElementById('notesView');
    const viewWhiteboard = document.getElementById('whiteboardView');
    const viewDoubts = document.getElementById('doubtsView');
    const notesSaveStatus = document.getElementById('notesSaveStatus');

    btnTabNotes?.addEventListener('click', () => {
      btnTabNotes.classList.add('active');
      btnTabWhiteboard?.classList.remove('active');
      btnTabDoubts?.classList.remove('active');

      viewNotes?.classList.remove('hidden');
      viewWhiteboard?.classList.add('hidden');
      viewDoubts?.classList.add('hidden');

      if (notesSaveStatus) notesSaveStatus.style.display = 'block';
    });

    btnTabWhiteboard?.addEventListener('click', () => {
      btnTabWhiteboard.classList.add('active');
      btnTabNotes?.classList.remove('active');
      btnTabDoubts?.classList.remove('active');

      viewWhiteboard?.classList.remove('hidden');
      viewNotes?.classList.add('hidden');
      viewDoubts?.classList.add('hidden');

      if (notesSaveStatus) notesSaveStatus.style.display = 'none';
      // Trigger canvas resize when made visible
      window.dispatchEvent(new Event('resize'));
    });

    btnTabDoubts?.addEventListener('click', () => {
      btnTabDoubts.classList.add('active');
      btnTabNotes?.classList.remove('active');
      btnTabWhiteboard?.classList.remove('active');

      viewDoubts?.classList.remove('hidden');
      viewNotes?.classList.add('hidden');
      viewWhiteboard?.classList.add('hidden');

      if (notesSaveStatus) notesSaveStatus.style.display = 'none';
    });

    // Right Drawer Switcher (Group Chat vs AI Assistant)
    const btnTabChat = document.getElementById('tabBtnChat');
    const btnTabAI = document.getElementById('tabBtnAI');
    const viewChat = document.getElementById('chatView');
    const viewAI = document.getElementById('aiView');

    btnTabChat?.addEventListener('click', () => {
      btnTabChat.classList.add('active');
      btnTabAI.classList.remove('active');
      viewChat.classList.remove('hidden');
      viewAI.classList.add('hidden');
    });

    btnTabAI?.addEventListener('click', () => {
      btnTabAI.classList.add('active');
      btnTabChat.classList.remove('active');
      viewAI.classList.remove('hidden');
      viewChat.classList.add('hidden');
    });
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
});
