import { contentType, decodeBody } from "@/lib/wire-codec"

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message)
    this.name = "ApiRequestError"
  }
}

export function isNetworkError(cause: unknown): boolean {
  return cause instanceof TypeError || (cause as any)?.name === "TypeError"
}

async function responseErrorMessage(response: Response): Promise<{ message: string; code?: string }> {
  try {
    const payload = await response.clone().json()
    if (payload?.error?.message) return { message: payload.error.message, code: payload.error.code }
    if (payload?.message) return { message: payload.message }
  } catch {
    const text = await response.clone().text().catch(() => "")
    if (text) return { message: text }
  }
  return { message: `Request failed with status ${response.status}` }
}

export async function apiFetch(
  input: RequestInfo | URL,
  init?: Omit<RequestInit, "body"> & { body?: any },
): Promise<Response> {
  const headers = new Headers(init?.headers)
  let body = init?.body

  if (body !== undefined && body !== null && typeof body !== "string" && !(body instanceof FormData) && !(body instanceof Blob)) {
    body = JSON.stringify(body)
    headers.set("Content-Type", contentType())
  }

  const response = await fetch(input, { ...init, body: body as BodyInit | null | undefined, headers })
  if (!response.ok) {
    const { message, code } = await responseErrorMessage(response)
    throw new ApiRequestError(response.status, message, code)
  }
  return response
}

export async function apiJson<T = unknown>(
  input: RequestInfo | URL,
  init?: Omit<RequestInit, "body"> & { body?: any },
): Promise<T> {
  const response = await apiFetch(input, init)
  const responseType = response.headers.get("content-type") ?? ""
  if (responseType.includes("application/x-msgpack")) {
    const bytes = new Uint8Array(await response.arrayBuffer())
    return decodeBody(responseType, bytes) as T
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
