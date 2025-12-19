// API URL - Use Vercel backend
const API_URL = import.meta.env.VITE_API_URL || 'https://wheel1-gray.vercel.app/api'

// Log API URL for debugging (only in development)
if (import.meta.env.DEV) {
  console.log('🔗 Using API URL:', API_URL)
}

export const getWheelData = async (wheelId) => {
  const response = await fetch(`${API_URL}/wheel/${wheelId}`)
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Wheel not found')
    }
    throw new Error('Failed to load wheel data')
  }
  return await response.json()
}

export const saveWheelData = async (wheelId, data) => {
  const response = await fetch(`${API_URL}/wheel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wheelId, ...data })
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to save wheel data')
  }
  return await response.json()
}

export const updateWheelData = async (wheelId, data) => {
  const response = await fetch(`${API_URL}/wheel/${wheelId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to update wheel data')
  }
  return await response.json()
}

export const resetWheel = async (wheelId) => {
  const response = await fetch(`${API_URL}/wheel/${wheelId}`, {
    method: 'DELETE'
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to reset wheel')
  }
  return await response.json()
}

