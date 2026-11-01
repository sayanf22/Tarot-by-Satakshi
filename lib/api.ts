// Small JSON helper for calls to the Worker API (/api/*), same origin only.

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export async function api<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<ApiResult<T>> {
  const { json, headers, ...rest } = init;
  try {
    const res = await fetch(path, {
      credentials: "same-origin",
      ...rest,
      headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
    const type = res.headers.get("Content-Type") ?? "";
    const data = type.includes("application/json") ? ((await res.json()) as unknown) : null;
    if (!res.ok) {
      const error = (data as { error?: string } | null)?.error ?? "Something went wrong. Please try again.";
      return { ok: false, status: res.status, error };
    }
    return { ok: true, data: data as T };
  } catch {
    return {
      ok: false,
      status: 0,
      error: "You seem to be offline. Please check your connection and try again.",
    };
  }
}
