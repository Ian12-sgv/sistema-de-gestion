import { app, safeStorage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

type StoreShape = { token?: string } // token encrypted base64

function storePath() {
  return path.join(app.getPath('userData'), 'secure-store.json')
}

function readStore(): StoreShape {
  try {
    const p = storePath()
    if (!fs.existsSync(p)) return {}
    const raw = fs.readFileSync(p, 'utf8')
    return JSON.parse(raw) as StoreShape
  } catch {
    return {}
  }
}

function writeStore(data: StoreShape) {
  const p = storePath()
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8')
}

export function getToken(): string | null {
  const st = readStore()
  if (!st.token) return null
  if (!safeStorage.isEncryptionAvailable()) {
    // fallback: si no hay encryption, se guarda en texto (evitamos romper la app)
    return st.token
  }
  try {
    const buf = Buffer.from(st.token, 'base64')
    return safeStorage.decryptString(buf)
  } catch {
    return null
  }
}

export function setToken(token: string) {
  const st = readStore()
  if (!safeStorage.isEncryptionAvailable()) {
    st.token = token
    writeStore(st)
    return
  }
  const encrypted = safeStorage.encryptString(token)
  st.token = encrypted.toString('base64')
  writeStore(st)
}

export function clearToken() {
  writeStore({})
}