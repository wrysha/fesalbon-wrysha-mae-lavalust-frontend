const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost/LavaLust/api')
  .replace(/\/$/, '')

const TOKEN_KEY = 'lab6_tokens'
const USER_KEY = 'lab6_user'

export class ApiError extends Error {
  constructor(message, status = 0, details = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export function getStoredSession() {
  try {
    const tokens = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null')
    const user = JSON.parse(sessionStorage.getItem(USER_KEY) || 'null')
    return tokens?.access_token && user ? { tokens, user } : null
  } catch {
    clearSession()
    return null
  }
}

export function saveSession(user, tokens) {
  sessionStorage.setItem(USER_KEY, JSON.stringify(user))
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify(tokens))
}

export function clearSession() {
  sessionStorage.removeItem(USER_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
}

function storedTokens() {
  try {
    return JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null')
  } catch {
    return null
  }
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : null

  if (!response.ok) {
    const message = payload?.message || payload?.error || `Request failed (${response.status}).`
    throw new ApiError(message, response.status, payload?.errors || null)
  }

  return payload
}

async function refreshAccessToken() {
  const tokens = storedTokens()

  if (!tokens?.refresh_token) {
    throw new ApiError('Your session has expired.', 401)
  }

  const response = await fetch(`${API_BASE_URL}/refresh`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: tokens.refresh_token }),
  })

  const payload = await parseResponse(response)
  const user = JSON.parse(sessionStorage.getItem(USER_KEY) || 'null')
  saveSession(user, payload.tokens)
  return payload.tokens
}

async function request(path, options = {}, retry = true) {
  const tokens = storedTokens()
  const headers = new Headers(options.headers || {})
  headers.set('Accept', 'application/json')

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (tokens?.access_token) {
    headers.set('Authorization', `Bearer ${tokens.access_token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })

  if (response.status === 401 && retry && tokens?.refresh_token) {
    try {
      await refreshAccessToken()
      return request(path, options, false)
    } catch (error) {
      clearSession()
      window.dispatchEvent(new Event('lab6:auth-expired'))
      throw error
    }
  }

  return parseResponse(response)
}

export async function login(credentials) {
  const response = await fetch(`${API_BASE_URL}/login`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  })

  return parseResponse(response)
}

export async function logout() {
  let tokens = storedTokens()

  const sendLogout = (currentTokens) => fetch(`${API_BASE_URL}/logout`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${currentTokens.access_token}`,
    },
    body: JSON.stringify({ refresh_token: currentTokens.refresh_token || '' }),
  })

  try {
    if (tokens?.access_token) {
      let response = await sendLogout(tokens)

      if (response.status === 401 && tokens.refresh_token) {
        tokens = await refreshAccessToken()
        response = await sendLogout(tokens)
      }

      await parseResponse(response)
    }
  } finally {
    clearSession()
  }
}

export const productsApi = {
  list: () => request('/products'),
  create: (product) => request('/products', {
    method: 'POST',
    body: JSON.stringify(product),
  }),
  update: (id, product) => request(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(product),
  }),
  remove: (id) => request(`/products/${id}`, { method: 'DELETE' }),
}

export { API_BASE_URL }
