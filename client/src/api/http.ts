export interface FieldError {
  field: string | null;
  message: string;
}

/** A non-2xx response from the API. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(messageFrom(body) ?? `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }

  /** Field errors from a 400 "Validation failed" response, if any. */
  get fieldErrors(): FieldError[] {
    const errors = (this.body as { errors?: unknown } | null)?.errors;
    return Array.isArray(errors) ? (errors as FieldError[]) : [];
  }
}

function messageFrom(body: unknown): string | undefined {
  const message = (body as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : undefined;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}
