const base = import.meta.env.BASE_URL.replace(/\/$/, "");
export const apiUrl = (path: string) => `${base}/api${path}`;

export async function apiFetch<T = unknown>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    headers: { "Content-Type": "application/json", ...opts?.headers },
    credentials: "include",
    ...opts,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error((data as any).error ?? (data as any).message ?? res.statusText);
  return data as T;
}
