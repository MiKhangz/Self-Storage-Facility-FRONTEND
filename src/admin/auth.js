const SESSION_KEY = 'storease.auth';
const staffRoles = ['SystemAdministrator', 'BusinessOperationsManager', 'FacilityManager', 'FacilityStaff'];
const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

export function readSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    clearSession();
    return null;
  }
}

export async function apiRequest(path, options = {}) {
  const session = readSession();
  let response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
        ...options.headers,
      },
      signal: options.signal || AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error('Cannot reach the server. Check that the backend is running and try again.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) clearSession();
    const details = data?.errors ? Object.values(data.errors).flat().join(' ') : '';
    const error = new Error(details || data?.title || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function login(email, password, remember) {
  clearSession();
  const session = await apiRequest('/api/auth/login', {
    method: 'POST', body: JSON.stringify({ email: email.trim(), password }),
  });
  if (!session?.token || !staffRoles.includes(session.role)) {
    throw new Error('A staff or administrator account is required for this portal.');
  }
  (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function restoreSession() {
  const session = readSession();
  if (!session?.token) return null;
  const user = await apiRequest('/api/users/me');
  if (!staffRoles.includes(user.role)) {
    clearSession();
    return null;
  }
  return { ...session, ...user };
}
