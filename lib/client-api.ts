import { t } from '@/lib/i18n';

/**
 * The browser side of the §8 contract. Every admin screen talks to the API
 * through this, so error handling is uniform: a failed call always yields a
 * Hebrew sentence, never a raw code or an unhandled rejection.
 */
export class ApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | T
    | { error: { code: string; message: string } }
    | null;

  if (!response.ok || (payload && typeof payload === 'object' && 'error' in payload)) {
    const error =
      payload && typeof payload === 'object' && 'error' in payload
        ? payload.error
        : { code: 'ERR_INTERNAL', message: t('error.generic') };
    throw new ApiError(error.code, error.message);
  }

  return payload as T;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};

  const response = await fetch(path, {
    ...rest,
    headers: {
      ...(json !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(rest.headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  return parseResponse<T>(response);
}

/**
 * Multipart upload. `apiFetch` always JSON-encodes its body, which a `File`
 * can't survive — this sends the `FormData` as-is and shares the same error
 * handling.
 */
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(path, { method: 'POST', body: formData });
  return parseResponse<T>(response);
}

/** Reduce any thrown value to something safe to render. */
export function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : t('error.generic');
}
