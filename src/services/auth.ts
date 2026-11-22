import { API_URL } from "../config";
import * as storage from "./storage";

// POST avec identifiants dans le corps JSON. Rien n'est écrit dans les logs.
export async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(res.status === 401 ? "Identifiants invalides" : "Erreur serveur");
  }
  const data = await res.json();
  await storage.saveTokens(data.accessToken, data.refreshToken);
}

// Renouvelle la session avec le jeton de rafraîchissement (usage unique côté serveur).
async function refresh(): Promise<boolean> {
  const refreshToken = await storage.getRefresh();
  if (!refreshToken) return false;
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  await storage.saveTokens(data.accessToken, data.refreshToken);
  return true;
}

// Requête protégée : jeton dans l'en-tête Authorization: Bearer.
export async function authFetch(path: string, init: RequestInit = {}) {
  const call = async () =>
    fetch(API_URL + path, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string>),
        Authorization: `Bearer ${await storage.getAccess()}`,
      },
    });

  let res = await call();
  if (res.status === 401) {
    if (await refresh()) {
      res = await call();
    } else {
      await storage.clear();
      throw new Error("SESSION_EXPIRED");
    }
  }
  return res;
}

export async function logout() {
  try {
    await authFetch("/auth/logout", { method: "POST" });
  } catch {
    // La session locale est supprimée dans tous les cas.
  }
  await storage.clear();
}
