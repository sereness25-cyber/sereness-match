export class ApiError extends Error {
  readonly status: number

  constructor(status: number) {
    super('API request failed (HTTP ' + status + ')')
    this.status = status
  }
}

type RequestOptions = { method?: string; body?: unknown; accessToken?: string; signal?: AbortSignal }

export function createApi(base: URL, publishableKey: string, transport: typeof fetch = fetch) {
  const origin = base.origin
  return {
    async request<T>(path: string, options: RequestOptions = {}): Promise<T | undefined> {
      const url = new URL(path, origin)
      if (!path.startsWith('/') || url.origin !== origin || url.hash) throw new TypeError('Invalid API path')
      const headers = new Headers({ apikey: publishableKey })
      if (options.accessToken) headers.set('Authorization', 'Bearer ' + options.accessToken)
      if (options.body !== undefined) headers.set('Content-Type', 'application/json')
      const response = await transport(url, {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal,
        credentials: 'omit',
        redirect: 'error',
      })
      if (!response.ok) throw new ApiError(response.status)
      return response.status === 204 ? undefined : await response.json() as T
    },
  }
}
