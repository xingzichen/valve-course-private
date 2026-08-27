import { ref } from 'vue';

export const sessionUser = ref<{ id: string; displayName: string } | null>(null);
export const apiBusy = ref(false);

function cookie(name: string): string {
  const item = document.cookie.split('; ').find((value) => value.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : '';
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  apiBusy.value = true;
  try {
    const method = (options.method ?? 'GET').toUpperCase();
    const headers = new Headers(options.headers);
    if (options.body && !(options.body instanceof FormData))
      headers.set('Content-Type', 'application/json');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method))
      headers.set('X-CSRF-Token', cookie('valve_csrf'));
    const response = await fetch(`/api/v1${path}`, { ...options, headers, credentials: 'include' });
    const payload = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      const error = payload?.error ?? payload;
      throw new ApiError(
        error?.message ?? `请求失败（${response.status}）`,
        response.status,
        error?.code
      );
    }
    return payload as T;
  } finally {
    apiBusy.value = false;
  }
}

export const post = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
