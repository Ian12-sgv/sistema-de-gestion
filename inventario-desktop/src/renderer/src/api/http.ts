import axios from 'axios'
import { API_BASE_URL } from './config'

let memToken: string | null = null

export function setMemToken(token: string | null) {
  memToken = token
}

export function getMemToken() {
  return memToken
}

type ApiBridge = {
  config?: {
    getApiBaseUrl?: () => Promise<string>
  }
}

function getBridge(): ApiBridge | null {
  const w = window as any
  return (w?.api as ApiBridge) ?? null
}

let cachedBaseUrl: string | null = null
let baseUrlPromise: Promise<string> | null = null

function sanitizeBaseUrl(raw: string | null | undefined): string {
  const v = String(raw ?? '').trim()
  if (!v) return API_BASE_URL
  // Normaliza: sin slash final
  return v.endsWith('/') ? v.slice(0, -1) : v
}

async function ensureApiBaseUrl(): Promise<string> {
  if (cachedBaseUrl) return cachedBaseUrl
  if (baseUrlPromise) return baseUrlPromise

  const bridge = getBridge()
  const getter = bridge?.config?.getApiBaseUrl

  baseUrlPromise = (async () => {
    try {
      if (typeof getter === 'function') {
        const v = await getter()
        cachedBaseUrl = sanitizeBaseUrl(v)
        return cachedBaseUrl
      }
    } catch {
      // fallback
    }
    cachedBaseUrl = sanitizeBaseUrl(API_BASE_URL)
    return cachedBaseUrl
  })()

  return baseUrlPromise
}

export const http = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' }
})

http.interceptors.request.use(async (config) => {
  const baseUrl = await ensureApiBaseUrl()
  config.baseURL = baseUrl
  http.defaults.baseURL = baseUrl

  const token = memToken
  if (token) {
    config.headers = config.headers ?? {}
    ;(config.headers as any).Authorization = `Bearer ${token}`
  }
  return config
})