/**
 * StudySync AI - Student Dashboard Controller
 */
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Verify Authentication
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

  // 2. Populate Header & Greeting
  const userGreetingName = document.getElementById('userGreetingName');
  const userNavName = document.getElementById('userNavName');
  const userAvatar = document.getElementById('userAvatar');

  if (userGreetingName) userGreetingName.textContent = currentUser.name || 'Student';
  if (userNavName) userNavName.textContent = currentUser.name || 'Student';
  if (userAvatar) {
    // Generate initials (e.g. GK)
    const initials = (currentUser.name || 'ST')
      .split(' ')
      .map(part => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    userAvatar.textContent = initials || 'GK';
  }

  // 3. Logout Button Handler
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await API.logout();
        window.location.replace('/pages/login.html');
      } catch (err) {
        console.error('Logout failed:', err);
      }
    });
  }

  // 4. Load Dashboard Statistics & Recent Rooms
  await loadDashboardData();

  // 5. Setup Create & Join Room Modals
  setupModals();

  async function loadDashboardData() {
    try {
      const statsRes = await API.getDashboardStats();
      if (statsRes.success && statsRes.data) {
        const { metrics, recentRooms } = statsRes.data;

        // Update metric cards
        const metricRooms = document.getElementById('metricRoomsCount');
        const metricCreated = document.getElementById('metricCreatedCount');
        const metricSessions = document.getElementById('metricSessionsCount');
        const metricDoubts = document.getElementById('metricDoubtsCount');

        if (metricRooms) metricRooms.textContent = metrics.roomsJoined || 0;
        if (metricCreated) metricCreated.textContent = metrics.roomsCreated || 0;
        if (metricSessions) metricSessions.textContent = metrics.sessionsCompleted || 0;
        if (metricDoubts) metricDoubts.textContent = metrics.doubtsResolved || 0;

        // Render recent rooms grid
        renderRecentRooms(recentRooms);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  }

  function renderRecentRooms(rooms) {
    const container = document.getElementById('recentRoomsContainer');
    if (!container) return;

    if (!rooms || rooms.length === 0) {
      container.innerHTML = `
        <div class="empty-state-box">
          <div class="empty-state-icon">📚</div>
          <h3 class="empty-state-title">No study rooms yet</h3>
          <p class="empty-state-desc">You haven't joined or created any study rooms. Create your first room or join a friend's room with a room code.</p>
          <div style="display:flex; justify-content:center; gap:12px;">
            <button type="button" class="btn-hero-action btn-hero-primary" id="emptyCreateBtn">
              + Create Room
            </button>
            <button type="button" class="btn-hero-action btn-hero-secondary" id="emptyJoinBtn">
              Join with Code
            </button>
          </div>
        </div>
      `;

      document.getElementById('emptyCreateBtn')?.addEventListener('click', () => openModal('createRoomModal'));
      document.getElementById('emptyJoinBtn')?.addEventListener('click', () => openModal('joinRoomModal'));
      return;
    }

    container.innerHTML = rooms.map(room => `
      <div class="room-card">
        <div class="room-card-top">
          <span class="room-subject-badge">${escapeHTML(room.subject)}</span>
          <h4 class="room-title">${escapeHTML(room.name)}</h4>
          <p class="room-desc">Led by ${escapeHTML(room.ownerName)}${room.isOwner ? ' (You)' : ''}</p>
        </div>
        <div class="room-card-meta">
          <span>Code: <strong class="room-code-badge" title="Click to copy" onclick="navigator.clipboard.writeText('${room.roomCode}'); alert('Copied room code: ${room.roomCode}')">${room.roomCode}</strong></span>
          <span class="room-members-count">👥 ${room.memberCount} members</span>
        </div>
        <div class="room-card-actions">
          <a href="/pages/workspace.html?roomId=${room.id}" class="btn-enter-room">
            Enter Workspace →
          </a>
        </div>
      </div>
    `).join('');
  }

  function setupModals() {
    // Open Buttons
    document.getElementById('btnOpenCreateModal')?.addEventListener('click', () => openModal('createRoomModal'));
    document.getElementById('btnOpenJoinModal')?.addEventListener('click', () => openModal('joinRoomModal'));

    // Close Buttons
    document.querySelectorAll('.btn-modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal-overlay');
        if (modal) modal.classList.add('hidden');
      });
    });

    // Close on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.add('hidden');
      });
    });

    // Create Room Form Submit
    const createForm = document.getElementById('createRoomForm');
    if (createForm) {
      createForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('createRoomName').value.trim();
        const subject = document.getElementById('createRoomSubject').value.trim();
        const description = document.getElementById('createRoomDesc').value.trim();
        const visibility = document.getElementById('createRoomVisibility').value;
        const maxParticipants = document.getElementById('createRoomMax').value;
        const submitBtn = document.getElementById('btnSubmitCreate');

        if (!name || !subject) {
          alert('Room name and subject are required.');
          return;
        }

        try {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Creating...';
          const res = await API.createRoom({
            name,
            subject,
            description,
            visibility,
            maxParticipants
          });

          if (res.success && res.data && res.data.room) {
            closeModal('createRoomModal');
            // Route directly into the newly created room workspace
            window.location.href = `/pages/workspace.html?roomId=${res.data.room._id}`;
          }
        } catch (err) {
          alert(err.message || 'Could not create study room.');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Create Room';
        }
      });
    }

    // Join Room Form Submit
    const joinForm = document.getElementById('joinRoomForm');
    if (joinForm) {
      joinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const codeInput = document.getElementById('joinRoomCode');
        const roomCode = codeInput ? codeInput.value.trim().toUpperCase() : '';
        const submitBtn = document.getElementById('btnSubmitJoin');

        if (!roomCode) {
          alert('Please enter a room code.');
          return;
        }

        try {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Joining...';
          const res = await API.joinRoom(roomCode);

          if (res.success && res.data && res.data.roomId) {
            closeModal('joinRoomModal');
            window.location.href = `/pages/workspace.html?roomId=${res.data.roomId}`;
          }
        } catch (err) {
          alert(err.message || 'Could not join room. Please check the code.');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Join Room';
        }
      });
    }
  }

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('hidden');
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
});