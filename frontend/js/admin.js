/**
 * StudySync AI - Platform Administrator Dashboard Client Logic
 */
let adminState = {
  currentUser: null,
  overview: null,
  users: [],
  rooms: [],
  activeTab: 'users' // 'users' | 'rooms' | 'diagnostics'
};

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Verify Authentication & Admin Role
  try {
    const meRes = await API.getMe();
    if (!meRes || !meRes.success || !meRes.data || !meRes.data.user) {
      window.location.replace('/pages/login.html');
      return;
    }

    adminState.currentUser = meRes.data.user;

    if (adminState.currentUser.role !== 'admin' && adminState.currentUser.email !== 'gayathrijanagaraj@gmail.com') {
      alert('Access Denied: Administrator privileges required to access the Admin Console.');
      window.location.replace('/pages/dashboard.html');
      return;
    }

    const adminNavName = document.getElementById('adminNavName');
    if (adminNavName) adminNavName.textContent = adminState.currentUser.name || 'Administrator';
  } catch (err) {
    window.location.replace('/pages/login.html');
    return;
  }

  // 2. Setup Logout Handler
  document.getElementById('adminLogoutBtn')?.addEventListener('click', async () => {
    try {
      await API.logout();
    } finally {
      window.location.replace('/pages/login.html');
    }
  });

  // 3. Setup Tab Navigation
  setupAdminTabs();

  // 4. Setup Filters
  setupAdminFilters();

  // 5. Initial Data Load
  await Promise.all([
    loadOverviewMetrics(),
    loadUsersTable(),
    loadRoomsTable()
  ]);
});

/**
 * 1. Load Overview Metrics & Diagnostics
 */
async function loadOverviewMetrics() {
  try {
    const res = await API.getAdminOverview();
    if (res && res.success && res.data) {
      adminState.overview = res.data;
      const m = res.data.metrics || {};
      const d = res.data.diagnostics || {};

      document.getElementById('metricTotalUsers').textContent = m.totalUsers || 0;
      document.getElementById('metricActiveUsers').textContent = m.activeUsers || 0;
      document.getElementById('metricTotalRooms').textContent = m.totalRooms || 0;
      document.getElementById('metricActiveRooms').textContent = m.activeRooms || 0;
      document.getElementById('metricResolutionRate').textContent = `${m.doubtResolutionRate || 0}%`;
      document.getElementById('metricResolvedDoubts').textContent = m.resolvedDoubts || 0;
      document.getElementById('metricTotalDoubts').textContent = m.totalDoubts || 0;
      document.getElementById('metricStudyHours').textContent = `${m.totalStudyHours || 0}h`;
      document.getElementById('metricCompletedSessions').textContent = m.completedSessions || 0;
      document.getElementById('metricKnowledgeItems').textContent = m.totalKnowledgeItems || 0;

      // Diagnostics
      document.getElementById('diagMongoState').textContent = (d.mongoState || 'connected').toUpperCase();
      document.getElementById('diagMongoHost').textContent = d.mongoHost || 'MongoDB Atlas';

      const uptimeHours = Math.floor((d.serverUptimeSeconds || 0) / 3600);
      const uptimeMins = Math.floor(((d.serverUptimeSeconds || 0) % 3600) / 60);
      document.getElementById('diagUptime').textContent = `${uptimeHours}h ${uptimeMins}m`;

      document.getElementById('diagNodeVersion').textContent = d.nodeVersion || 'Node.js';
      document.getElementById('diagMemory').textContent = `${d.memoryHeapUsedMB || 0} MB`;
    }
  } catch (err) {
    console.error('[Admin] Failed to load overview metrics:', err.message);
  }
}

/**
 * 2. Load User Accounts Table
 */
async function loadUsersTable() {
  const search = document.getElementById('userSearchInput')?.value || '';
  const role = document.getElementById('userRoleFilter')?.value || 'all';
  const status = document.getElementById('userStatusFilter')?.value || 'all';

  try {
    const res = await API.getAdminUsers({ search, role, status });
    if (res && res.success && res.data) {
      adminState.users = res.data.users || [];
      document.getElementById('tabCountUsers').textContent = res.data.total || adminState.users.length;
      renderUsersTable();
    }
  } catch (err) {
    console.error('[Admin] Failed to load users:', err.message);
  }
}

function renderUsersTable() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  if (adminState.users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:30px; color:#64748B;">
          No matching user accounts found.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = adminState.users.map(u => {
    const initials = (u.name || 'ST').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
    const isSelf = adminState.currentUser && adminState.currentUser.id.toString() === u._id.toString();
    const joinedDate = new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const instDept = [u.institution, u.department].filter(Boolean).join(' • ') || '—';

    return `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap:10px;">
            <div class="user-avatar-circle" style="width:32px; height:32px; font-size:12px;">${initials}</div>
            <strong style="color:var(--color-text-navy);">${escapeHTML(u.name)}${isSelf ? ' (You)' : ''}</strong>
          </div>
        </td>
        <td>${escapeHTML(u.email)}</td>
        <td><span class="role-pill ${u.role}">${u.role === 'admin' ? 'Admin' : 'Student'}</span></td>
        <td>${escapeHTML(instDept)}</td>
        <td>
          <span class="status-pill ${u.isActive ? 'active' : 'inactive'}">
            ${u.isActive ? 'Active' : 'Suspended'}
          </span>
        </td>
        <td>${joinedDate}</td>
        <td>
          ${!isSelf ? `
            <button 
              type="button" 
              class="btn-table-action ${u.isActive ? 'btn-table-deactivate' : 'btn-table-activate'}" 
              data-action="toggle-user-status" 
              data-id="${u._id}"
            >
              ${u.isActive ? 'Suspend' : 'Activate'}
            </button>
          ` : '<span style="font-size:11px; color:#94A3B8;">Current Admin</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * 3. Load Study Rooms Table
 */
async function loadRoomsTable() {
  const search = document.getElementById('roomSearchInput')?.value || '';
  const status = document.getElementById('roomStatusFilter')?.value || 'all';

  try {
    const res = await API.getAdminRooms({ search, status });
    if (res && res.success && res.data) {
      adminState.rooms = res.data.rooms || [];
      document.getElementById('tabCountRooms').textContent = res.data.total || adminState.rooms.length;
      renderRoomsTable();
    }
  } catch (err) {
    console.error('[Admin] Failed to load study rooms:', err.message);
  }
}

function renderRoomsTable() {
  const tbody = document.getElementById('roomsTableBody');
  if (!tbody) return;

  if (adminState.rooms.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding:30px; color:#64748B;">
          No matching study rooms found.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = adminState.rooms.map(r => {
    const createdDate = new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const isClosed = r.status === 'closed';

    return `
      <tr>
        <td>
          <strong style="color:var(--color-text-navy); font-size:14px;">${escapeHTML(r.name)}</strong>
        </td>
        <td>${escapeHTML(r.subject)}</td>
        <td><strong style="font-family:monospace; color:var(--color-primary);">${r.roomCode}</strong></td>
        <td>${escapeHTML(r.owner.name)}</td>
        <td>${r.membersCount} student(s)</td>
        <td>
          <span class="status-pill ${isClosed ? 'closed' : 'active'}">
            ${isClosed ? 'Closed' : 'Active'}
          </span>
        </td>
        <td>${createdDate}</td>
        <td>
          ${!isClosed ? `
            <button 
              type="button" 
              class="btn-table-action btn-table-deactivate" 
              data-action="close-room" 
              data-id="${r._id}"
              data-name="${escapeHTML(r.name)}"
            >
              Close Room
            </button>
          ` : '<span style="font-size:11px; color:#94A3B8;">Closed</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * 4. Setup Tabs
 */
function setupAdminTabs() {
  const tabUsers = document.getElementById('tabBtnUsers');
  const tabRooms = document.getElementById('tabBtnRooms');
  const tabDiag = document.getElementById('tabBtnDiagnostics');

  const panelUsers = document.getElementById('panelUsers');
  const panelRooms = document.getElementById('panelRooms');
  const panelDiag = document.getElementById('panelDiagnostics');

  tabUsers?.addEventListener('click', () => {
    tabUsers.classList.add('active');
    tabRooms.classList.remove('active');
    tabDiag.classList.remove('active');

    panelUsers.classList.remove('hidden');
    panelRooms.classList.add('hidden');
    panelDiag.classList.add('hidden');
  });

  tabRooms?.addEventListener('click', () => {
    tabRooms.classList.add('active');
    tabUsers.classList.remove('active');
    tabDiag.classList.remove('active');

    panelRooms.classList.remove('hidden');
    panelUsers.classList.add('hidden');
    panelDiag.classList.add('hidden');
  });

  tabDiag?.addEventListener('click', () => {
    tabDiag.classList.add('active');
    tabUsers.classList.remove('active');
    tabRooms.classList.remove('active');

    panelDiag.classList.remove('hidden');
    panelUsers.classList.add('hidden');
    panelRooms.classList.add('hidden');
  });
}

/**
 * 5. Setup Filter & Action Listeners
 */
function setupAdminFilters() {
  // Users Filter
  let userSearchTimer = null;
  document.getElementById('userSearchInput')?.addEventListener('input', () => {
    clearTimeout(userSearchTimer);
    userSearchTimer = setTimeout(loadUsersTable, 250);
  });
  document.getElementById('userRoleFilter')?.addEventListener('change', loadUsersTable);
  document.getElementById('userStatusFilter')?.addEventListener('change', loadUsersTable);

  // Rooms Filter
  let roomSearchTimer = null;
  document.getElementById('roomSearchInput')?.addEventListener('input', () => {
    clearTimeout(roomSearchTimer);
    roomSearchTimer = setTimeout(loadRoomsTable, 250);
  });
  document.getElementById('roomStatusFilter')?.addEventListener('change', loadRoomsTable);

  // Action Click Delegation: Users
  document.getElementById('usersTableBody')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="toggle-user-status"]');
    if (!btn) return;

    const id = btn.dataset.id;
    if (!id) return;

    btn.disabled = true;
    try {
      const res = await API.toggleUserStatus(id);
      if (res && res.success) {
        await Promise.all([loadUsersTable(), loadOverviewMetrics()]);
      }
    } catch (err) {
      alert(err.message || 'Could not update user status.');
      btn.disabled = false;
    }
  });

  // Action Click Delegation: Rooms
  document.getElementById('roomsTableBody')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="close-room"]');
    if (!btn) return;

    const id = btn.dataset.id;
    const name = btn.dataset.name || 'study room';
    if (!id) return;

    if (!confirm(`Are you sure you want to close "${name}"? Active participants will be notified.`)) return;

    btn.disabled = true;
    try {
      const res = await API.closeAdminRoom(id);
      if (res && res.success) {
        await Promise.all([loadRoomsTable(), loadOverviewMetrics()]);
      }
    } catch (err) {
      alert(err.message || 'Could not close study room.');
      btn.disabled = false;
    }
  });
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
