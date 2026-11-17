// lib/wire-codec.ts
// Shared isomorphic serializer/deserializer used by server routes and client hooks.
// dev (NODE_ENV === 'development'): plain JSON, readable in DevTools.
// prod: MessagePack. SSE data frames use Base64-encoded MessagePack; sync routes use raw binary.

import { decode as msgpackDecode } from "@msgpack/msgpack"

export function isDev(): boolean {
  return typeof process !== "undefined" && process.env.NODE_ENV === "development"
}

export const IS_BROWSER = typeof window !== "undefined"

export function contentType(): string {
  return "application/json"
}

export function isMessagePack(): boolean {
  return false
}

// ---------- Base64 (isomorphic) ----------

function fromBase64(input: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(input, "base64"))
  }
  const binary = atob(input)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// ---------- HTTP request/response bodies ----------

export interface EncodedBody {
  body: string | Uint8Array
  contentType: string
}

export function encodeBody(value: unknown): EncodedBody {
  return { body: JSON.stringify(value), contentType: "application/json" }
}

export function decodeBody(
  contentType: string | null,
  body: string | Uint8Array,
): unknown {
  const useMsgPack = contentType?.includes("application/x-msgpack") === true

  if (useMsgPack) {
    const bytes =
      body instanceof Uint8Array ? body : fromBase64(body as string)
    return msgpackDecode(bytes)
  }

  const text =
    typeof body === "string" ? body : new TextDecoder().decode(body)
  return JSON.parse(text)
}

// ---------- SSE data frames ----------

export interface SseFrame {
  event?: string
  data: unknown
  raw: string
}

export function encodeSseFrame(data: unknown, event?: string): string {
  const payload = JSON.stringify(data)
  let frame = ""
  if (event) {
    frame += `event: ${event}\n`
  }
  frame += `data: ${payload}\n\n`
  return frame
}

export function heartbeatFrame(): string {
  return ": heartbeat\n\n"
}

export function decodeSseFrame(rawFrame: string): SseFrame {
  const trimmed = rawFrame.trim()
  let event: string | undefined
  const dataLines: string[] = []

  for (const line of trimmed.split("\n")) {
    if (line.startsWith("event: ")) {
      event = line.slice("event: ".length)
    } else if (line.startsWith("data: ")) {
      dataLines.push(line.slice("data: ".length))
    }
  }

  const dataRaw = dataLines.join("\n")
  const data = JSON.parse(dataRaw)

  return { event, data, raw: rawFrame }
}

export function encodeHeartbeat(): string {
  return heartbeatFrame()
}
