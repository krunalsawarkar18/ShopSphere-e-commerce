import { request } from "./api.js";
import { clearSession, getToken, getUser, saveSession } from "./storage.js";

export async function syncCurrentUser() {
  if (!getToken()) {
    return null;
  }

  try {
    const data = await request("/auth/me", { auth: true });
    saveSession(getToken(), data.user);
    return data.user;
  } catch (error) {
    clearSession();
    return null;
  }
}

export async function requireAuth() {
  if (!getToken()) {
    redirectToLogin();
    return null;
  }

  const user = await syncCurrentUser();

  if (!user) {
    redirectToLogin();
    return null;
  }

  return user;
}

export async function requireAdmin() {
  if (!getToken()) {
    redirectToAdminLogin();
    return null;
  }

  const user = await syncCurrentUser();

  if (!user || user.role !== "admin") {
    clearSession();
    redirectToAdminLogin();
    return null;
  }

  return user;
}

export function redirectToLogin() {
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.href = `/login.html?next=${encodeURIComponent(next)}`;
}

export function redirectToAdminLogin() {
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.href = `/admin-login.html?next=${encodeURIComponent(next)}`;
}

export function getCurrentUser() {
  return getUser();
}
