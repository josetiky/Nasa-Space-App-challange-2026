/** Small fetch helpers with timeouts and typed errors (no retries hidden from the UI). */

export class FetchError extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "FetchError";
  }
}

export async function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = 12000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...rest, signal: rest.signal ?? controller.signal });
    if (!response.ok) throw new FetchError(`HTTP ${response.status} from ${new URL(url, "http://local").host}`, url, response.status);
    return response;
  } catch (error) {
    if (error instanceof FetchError) throw error;
    const reason = (error as Error)?.name === "AbortError" ? `timed out after ${Math.round(timeoutMs / 1000)} s` : (error as Error)?.message || "network error";
    throw new FetchError(reason, url);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T = unknown>(url: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const response = await fetchWithTimeout(url, init);
  try {
    return (await response.json()) as T;
  } catch {
    throw new FetchError("response was not valid JSON", url, response.status);
  }
}

export async function fetchArrayBuffer(url: string, init?: RequestInit & { timeoutMs?: number }): Promise<ArrayBuffer> {
  const response = await fetchWithTimeout(url, init);
  return response.arrayBuffer();
}

/** Try loaders in order; returns the first success with its origin, or throws with every reason. */
export async function firstAvailable<T, O extends string>(loaders: Array<{ origin: O; load: () => Promise<T> }>): Promise<{ value: T; origin: O; failures: string[] }> {
  const failures: string[] = [];
  for (const loader of loaders) {
    try {
      return { value: await loader.load(), origin: loader.origin, failures };
    } catch (error) {
      failures.push(`${loader.origin}: ${(error as Error).message}`);
    }
  }
  throw new Error(failures.join(" · ") || "no loaders");
}
