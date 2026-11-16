'use strict';
/**
 * auth.js — Gestión de sesión JWT en el navegador.
 * Almacena el token en sessionStorage (pestaña) con
 * fallback a localStorage (persistente entre sesiones).
 */

const TOKEN_KEY = 'huellitas_token';
const USER_KEY  = 'huellitas_user';

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || null;
}

function getUser() {
  try {
    const raw = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSession(token, user, persistent = true) {
  const store = persistent ? localStorage : sessionStorage;
  store.setItem(TOKEN_KEY, token);
  store.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  [localStorage, sessionStorage].forEach(s => {
    s.removeItem(TOKEN_KEY);
    s.removeItem(USER_KEY);
  });
}

function isLoggedIn() {
  return !!getToken();
}

/**
 * Si no hay sesión activa, redirige a login.html.
 * Llámalo al inicio de index.html y display.html.
 */
function requireSession() {
  if (!isLoggedIn()) {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = '/login.html?next=' + redirect;
  }
}
