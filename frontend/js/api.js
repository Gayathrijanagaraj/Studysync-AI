/**
 * StudySync AI - Centralized Frontend API Wrapper
 */
const API = {
  // Base request handler
  async request(endpoint, options = {}) {
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      credentials: 'include', // Ensure session cookies are sent/received
      ...options
    };

    try {
      const response = await fetch(endpoint, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`[API Request Error] ${endpoint}:`, error.message);
      throw error;
    }
  },

  // Auth Endpoints
  async register(payload) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async login(payload) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async logout() {
    return this.request('/api/auth/logout', {
      method: 'POST'
    });
  },

  async getMe() {
    return this.request('/api/auth/me', {
      method: 'GET'
    });
  },

  async getProfile() {
    return this.request('/api/auth/profile', {
      method: 'GET'
    });
  },

  async updateProfile(payload) {
    return this.request('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async changePassword(payload) {
    return this.request('/api/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async forgotPassword(email) {
    return this.request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },

  // Dashboard Endpoints
  async getDashboardStats() {
    return this.request('/api/dashboard/stats', {
      method: 'GET'
    });
  },

  // Room Endpoints
  async getRooms(filter = 'all') {
    return this.request(`/api/rooms?filter=${encodeURIComponent(filter)}`, {
      method: 'GET'
    });
  },

  async createRoom(payload) {
    return this.request('/api/rooms', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async joinRoom(roomCode) {
    return this.request('/api/rooms/join', {
      method: 'POST',
      body: JSON.stringify({ roomCode })
    });
  },

  async getRoom(roomId) {
    return this.request(`/api/rooms/${roomId}`, {
      method: 'GET'
    });
  },

  async leaveRoom(roomId) {
    return this.request(`/api/rooms/${roomId}/leave`, {
      method: 'POST'
    });
  },

  async closeRoom(roomId) {
    return this.request(`/api/rooms/${roomId}/close`, {
      method: 'POST'
    });
  },

  async reopenRoom(roomId) {
    return this.request(`/api/rooms/${roomId}/reopen`, {
      method: 'POST'
    });
  },

  async updateRoomStatus(roomId, status) {
    return this.request(`/api/rooms/${roomId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  // In-Room Doubt Tracker Endpoints
  async getDoubts(roomId) {
    return this.request(`/api/rooms/${roomId}/doubts`, {
      method: 'GET'
    });
  },

  async createDoubt(roomId, payload) {
    return this.request(`/api/rooms/${roomId}/doubts`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async toggleUpvoteDoubt(roomId, doubtId) {
    return this.request(`/api/rooms/${roomId}/doubts/${doubtId}/upvote`, {
      method: 'POST'
    });
  },

  async addDoubtAnswer(roomId, doubtId, content) {
    return this.request(`/api/rooms/${roomId}/doubts/${doubtId}/answers`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });
  },

  async resolveDoubt(roomId, doubtId) {
    return this.request(`/api/rooms/${roomId}/doubts/${doubtId}/resolve`, {
      method: 'PATCH'
    });
  },

  async solveDoubtWithAI(roomId, doubtId) {
    return this.request(`/api/rooms/${roomId}/doubts/${doubtId}/ai-solve`, {
      method: 'POST'
    });
  },

  async deleteDoubt(roomId, doubtId) {
    return this.request(`/api/rooms/${roomId}/doubts/${doubtId}`, {
      method: 'DELETE'
    });
  },

  // Study Session & AI Recap Endpoints
  async getActiveSession(roomId) {
    return this.request(`/api/rooms/${roomId}/session`, {
      method: 'GET'
    });
  },

  async startSession(roomId, mode = 'stopwatch') {
    return this.request(`/api/rooms/${roomId}/session/start`, {
      method: 'POST',
      body: JSON.stringify({ mode })
    });
  },

  async pauseSession(roomId) {
    return this.request(`/api/rooms/${roomId}/session/pause`, {
      method: 'POST'
    });
  },

  async resumeSession(roomId) {
    return this.request(`/api/rooms/${roomId}/session/resume`, {
      method: 'POST'
    });
  },

  async endSession(roomId) {
    return this.request(`/api/rooms/${roomId}/session/end`, {
      method: 'POST'
    });
  },

  async getSessionHistory(roomId) {
    return this.request(`/api/rooms/${roomId}/session/history`, {
      method: 'GET'
    });
  },

  // Knowledge Base Endpoints
  async getKnowledgeItems(filter = {}) {
    const params = new URLSearchParams();
    if (filter.category && filter.category !== 'all') params.append('category', filter.category);
    if (filter.subject && filter.subject !== 'all') params.append('subject', filter.subject);
    if (filter.search) params.append('search', filter.search);
    if (filter.isPinned) params.append('isPinned', 'true');
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/knowledge${qs}`, {
      method: 'GET'
    });
  },

  async createKnowledgeItem(payload) {
    return this.request('/api/knowledge', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async getKnowledgeItem(id) {
    return this.request(`/api/knowledge/${id}`, {
      method: 'GET'
    });
  },

  async updateKnowledgeItem(id, payload) {
    return this.request(`/api/knowledge/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async togglePinKnowledgeItem(id) {
    return this.request(`/api/knowledge/${id}/pin`, {
      method: 'PATCH'
    });
  },

  async deleteKnowledgeItem(id) {
    return this.request(`/api/knowledge/${id}`, {
      method: 'DELETE'
    });
  },

  // Admin Management Endpoints
  async getAdminOverview() {
    return this.request('/api/admin/overview', {
      method: 'GET'
    });
  },

  async getAdminUsers(params = {}) {
    const qs = new URLSearchParams();
    if (params.search) qs.append('search', params.search);
    if (params.status && params.status !== 'all') qs.append('status', params.status);
    if (params.role && params.role !== 'all') qs.append('role', params.role);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return this.request(`/api/admin/users${query}`, {
      method: 'GET'
    });
  },

  async toggleUserStatus(userId) {
    return this.request(`/api/admin/users/${userId}/toggle-status`, {
      method: 'PATCH'
    });
  },

  async getAdminRooms(params = {}) {
    const qs = new URLSearchParams();
    if (params.search) qs.append('search', params.search);
    if (params.status && params.status !== 'all') qs.append('status', params.status);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return this.request(`/api/admin/rooms${query}`, {
      method: 'GET'
    });
  },

  async closeAdminRoom(roomId) {
    return this.request(`/api/admin/rooms/${roomId}/close`, {
      method: 'PATCH'
    });
  },

  // Student Study Sessions
  async getAllSessions(mode = 'all') {
    const qs = mode && mode !== 'all' ? `?mode=${encodeURIComponent(mode)}` : '';
    return this.request(`/api/dashboard/sessions${qs}`, {
      method: 'GET'
    });
  },

  // Global Unified Navbar Initializer
  initNavbar(activePage = '') {
    this.getMe().then(res => {
      if (res && res.success && res.data && res.data.user) {
        const user = res.data.user;
        const nameEl = document.getElementById('userNavName');
        const avatarEl = document.getElementById('userAvatar');
        const adminLink = document.getElementById('adminNavLink');

        if (nameEl) nameEl.textContent = user.name || 'Student';
        if (avatarEl) {
          const initials = (user.name || 'ST')
            .split(' ')
            .map(p => p[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
          avatarEl.textContent = initials || 'ST';
        }
      }
    }).catch(() => {});

    // Bind logout button
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
      try {
        await this.logout();
        window.location.replace('/pages/login.html');
      } catch (err) {
        window.location.replace('/pages/login.html');
      }
    });
  }
};
