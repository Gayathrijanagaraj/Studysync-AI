/**
 * StudySync AI - Room Management Controller
 */
document.addEventListener('DOMContentLoaded', async () => {
  let currentUser = null;
  let currentFilter = 'all';

  // 1. Check Auth
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

  // Populate nav details
  const userNavName = document.getElementById('userNavName');
  const userAvatar = document.getElementById('userAvatar');
  if (userNavName) userNavName.textContent = currentUser.name;
  if (userAvatar) {
    const initials = (currentUser.name || 'ST')
      .split(' ')
      .map(p => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    userAvatar.textContent = initials || 'GK';
  }

  // Logout handler
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try {
      await API.logout();
      window.location.replace('/pages/login.html');
    } catch (e) {}
  });

  // 2. Load Rooms
  await fetchAndRenderRooms(currentFilter);

  // 3. Tab Filters Handler
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.getAttribute('data-filter') || 'all';
      await fetchAndRenderRooms(currentFilter);
    });
  });

  // 4. Modals setup
  setupModals();

  async function fetchAndRenderRooms(filter) {
    const container = document.getElementById('allRoomsContainer');
    if (!container) return;

    try {
      container.innerHTML = '<p style="color:var(--color-text-muted); padding:20px;">Loading rooms...</p>';
      const res = await API.getRooms(filter);

      if (res.success && res.data) {
        const rooms = res.data.rooms;
        renderRooms(rooms, container);
      }
    } catch (err) {
      container.innerHTML = `<div class="alert alert-error">Error loading rooms: ${err.message}</div>`;
    }
  }

  function renderRooms(rooms, container) {
    if (!rooms || rooms.length === 0) {
      container.innerHTML = `
        <div class="empty-state-box">
          <div class="empty-state-icon">🔍</div>
          <h3 class="empty-state-title">No rooms found</h3>
          <p class="empty-state-desc">You do not have any rooms under this category. Create a new room or join an existing study group.</p>
          <div style="display:flex; justify-content:center; gap:12px;">
            <button type="button" class="btn-hero-action btn-hero-primary" id="emptyRoomsCreateBtn">
              + Create Room
            </button>
            <button type="button" class="btn-hero-action btn-hero-secondary" id="emptyRoomsJoinBtn">
              Join with Code
            </button>
          </div>
        </div>
      `;
      document.getElementById('emptyRoomsCreateBtn')?.addEventListener('click', () => openModal('createRoomModal'));
      document.getElementById('emptyRoomsJoinBtn')?.addEventListener('click', () => openModal('joinRoomModal'));
      return;
    }

    container.innerHTML = rooms.map(room => `
      <div class="room-card">
        <div class="room-card-top">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span class="room-subject-badge">${escapeHTML(room.subject)}</span>
            <div style="display:flex; align-items:center; gap:6px;">
              ${room.status === 'closed' ? '<span style="font-size:11px; font-weight:700; color:#DC2626; background:#FEF2F2; padding:3px 8px; border-radius:12px; border:1px solid #FECACA;">🔒 Closed</span>' : ''}
              ${room.isOwner ? '<span style="font-size:11px; font-weight:700; color:#4F46E5; background:#EEF2FF; padding:3px 8px; border-radius:12px;">Owner</span>' : ''}
            </div>
          </div>
          <h4 class="room-title">${escapeHTML(room.name)}</h4>
          <p class="room-desc">${escapeHTML(room.description || 'No description provided.')}</p>
        </div>

        <div class="room-card-meta">
          <span>Code: <strong class="room-code-badge" title="Click to copy" onclick="navigator.clipboard.writeText('${room.roomCode}'); alert('Copied room code: ${room.roomCode}')">${room.roomCode}</strong></span>
          <span class="room-members-count">👥 ${room.memberCount} members</span>
        </div>

        <div class="room-card-actions">
          <a href="/pages/workspace.html?roomId=${room.id}" class="btn-enter-room" style="${room.status === 'closed' ? 'background:#64748B;' : ''}">
            ${room.status === 'closed' ? 'View Archive 🔒' : 'Enter Workspace →'}
          </a>
          ${room.isOwner ? `
            ${room.status === 'closed' ? `
              <button type="button" class="btn-reopen-room" data-room-id="${room.id}" title="Reopen study room" style="padding:8px 14px; border:1.5px solid #A7F3D0; background:#ECFDF5; border-radius:9999px; font-size:12px; font-weight:700; color:#065F46; cursor:pointer;">
                ↺ Reopen
              </button>
            ` : `
              <button type="button" class="btn-close-room" data-room-id="${room.id}" title="Close room" style="padding:8px 12px; border:1px solid #CBD5E1; border-radius:9999px; font-size:12px; font-weight:600; color:#64748B; cursor:pointer;">
                Close
              </button>
            `}
          ` : `
            ${room.status === 'closed' ? `
              <span style="font-size:12px; color:#94A3B8; font-weight:600; padding:8px 4px;">Read-Only</span>
            ` : `
              <button type="button" class="btn-leave-room" data-room-id="${room.id}" title="Leave room" style="padding:8px 12px; border:1px solid #CBD5E1; border-radius:9999px; font-size:12px; font-weight:600; color:#64748B; cursor:pointer;">
                Leave
              </button>
            `}
          `}
        </div>
      </div>
    `).join('');

    // Attach leave / close / reopen event listeners
    document.querySelectorAll('.btn-leave-room').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const roomId = e.target.getAttribute('data-room-id');
        if (confirm('Are you sure you want to leave this study room?')) {
          try {
            await API.leaveRoom(roomId);
            await fetchAndRenderRooms(currentFilter);
          } catch (err) {
            alert(err.message || 'Could not leave room.');
          }
        }
      });
    });

    document.querySelectorAll('.btn-close-room').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const roomId = e.target.getAttribute('data-room-id');
        if (confirm('Are you sure you want to close this room? All active sessions will end and the room will become read-only.')) {
          try {
            await API.closeRoom(roomId);
            await fetchAndRenderRooms(currentFilter);
          } catch (err) {
            alert(err.message || 'Could not close room.');
          }
        }
      });
    });

    document.querySelectorAll('.btn-reopen-room').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const roomId = e.target.getAttribute('data-room-id');
        try {
          await API.reopenRoom(roomId);
          await fetchAndRenderRooms(currentFilter);
        } catch (err) {
          alert(err.message || 'Could not reopen room.');
        }
      });
    });
  }

  function setupModals() {
    document.getElementById('btnOpenCreateModal')?.addEventListener('click', () => openModal('createRoomModal'));
    document.getElementById('btnOpenJoinModal')?.addEventListener('click', () => openModal('joinRoomModal'));

    document.querySelectorAll('.btn-modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal-overlay');
        if (modal) modal.classList.add('hidden');
      });
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.add('hidden');
      });
    });

    // Create Room
    document.getElementById('createRoomForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('createRoomName').value.trim();
      const subject = document.getElementById('createRoomSubject').value.trim();
      const description = document.getElementById('createRoomDesc').value.trim();
      const visibility = document.getElementById('createRoomVisibility').value;
      const maxParticipants = document.getElementById('createRoomMax').value;
      const submitBtn = document.getElementById('btnSubmitCreate');

      try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';
        const res = await API.createRoom({ name, subject, description, visibility, maxParticipants });

        if (res.success && res.data && res.data.room) {
          closeModal('createRoomModal');
          window.location.href = `/pages/workspace.html?roomId=${res.data.room._id}`;
        }
      } catch (err) {
        alert(err.message || 'Could not create room.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Room';
      }
    });

    // Join Room
    document.getElementById('joinRoomForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const codeInput = document.getElementById('joinRoomCode');
      const roomCode = codeInput ? codeInput.value.trim().toUpperCase() : '';
      const submitBtn = document.getElementById('btnSubmitJoin');

      try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Joining...';
        const res = await API.joinRoom(roomCode);

        if (res.success && res.data && res.data.roomId) {
          closeModal('joinRoomModal');
          window.location.href = `/pages/workspace.html?roomId=${res.data.roomId}`;
        }
      } catch (err) {
        alert(err.message || 'Could not join room.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Join Room';
      }
    });
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
