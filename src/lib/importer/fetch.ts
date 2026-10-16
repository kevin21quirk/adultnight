export class FetchError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = "FetchError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function backoffMs(attempt: number, retryAfter?: string | null): number {
  if (retryAfter) {
    const secs = Number(retryAfter);
    if (Number.isFinite(secs)) return Math.min(secs * 1000, 60_000);
    const date = Date.parse(retryAfter);
    if (!Number.isNaN(date)) return Math.min(Math.max(date - Date.now(), 0), 60_000);
  }
  return Math.min(500 * 2 ** attempt + Math.random() * 250, 30_000);
}

/**
 * Fetch with exponential backoff on transient failures (network errors,
 * HTTP 429 and 5xx). Honors Retry-After. Non-retryable statuses (4xx other
 * than 429) throw immediately.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  maxAttempts = 4,
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetchImpl(url, {
        ...init,
        headers: {
          "user-agent": "av-discovery/0.1 (+catalogue-importer)",
          ...(init.headers ?? {}),
        },
      });
      if (res.ok) return res;
      if (res.status === 429 || res.status >= 500) {
        if (attempt === maxAttempts - 1) {
          throw new FetchError(`HTTP ${res.status} after ${maxAttempts} attempts`, res.status, true);
        }
        await sleep(backoffMs(attempt, res.headers.get("retry-after")));
        continue;
      }
      throw new FetchError(`HTTP ${res.status}`, res.status, false);
    } catch (err) {
      if (err instanceof FetchError && !err.retryable) throw err;
      lastError = err;
      if (attempt === maxAttempts - 1) break;
      await sleep(backoffMs(attempt));
    }
  }
  if (lastError instanceof FetchError) throw lastError;
  throw new FetchError(
    `network failure: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    undefined,
    true
  );
}
