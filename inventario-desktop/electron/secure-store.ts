// electron/secure-store.ts
import * as electron from 'electron'
import fs from 'node:fs'
import path from 'node:path'

const { app, safeStorage } = electron

type TokenPayloadV1 = {
  v: 1
  encrypted: boolean
  data: string // base64 si encrypted=true, texto plano si encrypted=false
}

function storePath(): string {
  // IMPORTANTE: esto se debe llamar cuando app ya está ready (tú lo haces, porque lo usas desde IPC)
  return path.join(app.getPath('userData'), 'auth-token.json')
}

function readPayload(): TokenPayloadV1 | null {
  try {
    const p = storePath()
    if (!fs.existsSync(p)) return null
    const raw = fs.readFileSync(p, 'utf-8')
    const json = JSON.parse(raw) as TokenPayloadV1
    if (!json || json.v !== 1 || typeof json.data !== 'string') return null
    return json
  } catch {
    return null
  }
}

function writePayload(payload: TokenPayloadV1): void {
  const p = storePath()
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(payload, null, 2), 'utf-8')
}

export function getToken(): string | null {
  const payload = readPayload()
  if (!payload) return null

  try {
    if (payload.encrypted) {
      // data viene como base64
      const buf = Buffer.from(payload.data, 'base64')
      return safeStorage.decryptString(buf)
    }
    return payload.data || null
  } catch {
    // si falla decrypt o el formato es inválido
    return null
  }
}

export function setToken(token: string): void {
  const t = String(token ?? '').trim()
  if (!t) {
    clearToken()
    return
  }

  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(t) // Buffer
    writePayload({
      v: 1,
      encrypted: true,
      data: encrypted.toString('base64')
    })
  } else {
    // fallback (menos seguro)
    writePayload({
      v: 1,
      encrypted: false,
      data: t
    })
  }
}

export function clearToken(): void {
  try {
    const p = storePath()
    if (fs.existsSync(p)) fs.unlinkSync(p)
  } catch {
    // ignore
  }
}