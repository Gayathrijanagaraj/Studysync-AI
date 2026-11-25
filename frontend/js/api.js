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
  }
};
