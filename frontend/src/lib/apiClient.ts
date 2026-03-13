const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export type ApiError = { error: { code: string; message: string; details?: unknown } };

export function getToken() {
  return localStorage.getItem("bty_token");
}

export function setToken(token: string | null) {
  if (!token) localStorage.removeItem("bty_token");
  else localStorage.setItem("bty_token", token);
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data as ApiError;
  return data as T;
}

export function apiErrorMessage(e: unknown) {
  const anyE = e as any;
  return anyE?.error?.message ?? anyE?.message ?? "Request failed";
}

export async function uploadImage(itemId: string, file: File) {
  const token = getToken();
  const fd = new FormData();
  fd.append("image", file);
  const res = await fetch(`${API_URL}/api/uploads/items/${itemId}/images`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data as ApiError;
  return data as { url: string };
}
