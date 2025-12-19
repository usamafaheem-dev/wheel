// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

export const API_ENDPOINTS = {
  SPINS: {
    LIST: `${API_BASE_URL}/spins/list/`,
    UPLOAD: `${API_BASE_URL}/spins/upload/`,
    SPIN: (id) => `${API_BASE_URL}/spins/spin/${id}/`,
    FILENAMES: `${API_BASE_URL}/spins/filenames/`,
    DELETE: (id) => `${API_BASE_URL}/spins/delete/${id}/`,
    TOGGLE_ACTIVE: (id) => `${API_BASE_URL}/spins/toggle-active/${id}/`,
    CHECK_PASSWORD: `${API_BASE_URL}/spins/check-password/`,
    ADMIN_LIST: `${API_BASE_URL}/spins/admin-list/`,
    SET_FIXED_WINNER: (id) => `${API_BASE_URL}/spins/set-fixed-winner/${id}/`,
  }
}

export default API_BASE_URL

