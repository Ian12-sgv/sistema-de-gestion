// electron/backend-runner.ts
import * as electron from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import net from 'node:net'

const { app, dialog } = electron

let backendProc: ChildProcessWithoutNullStreams | null = null
let backendPort = 3000

let isQuitting = false
app.on('before-quit', () => {
  isQuitting = true
})

function parseEnvFile(envFilePath: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!fs.existsSync(envFilePath)) return out

  const content = fs.readFileSync(envFilePath, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx <= 0) continue
    const k = line.slice(0, idx).trim()
    let v = line.slice(idx + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    out[k] = v
  }
  return out
}

function appendEnvLine(envPath: string, key: string, value: string) {
  const line = `${key}="${value.replace(/"/g, '\\"')}"`
  const needsLeadingNewline = fs.existsSync(envPath) && !fs.readFileSync(envPath, 'utf8').endsWith('\n')
  fs.appendFileSync(envPath, (needsLeadingNewline ? '\n' : '') + line + '\n', 'utf8')
}

function ensureRequiredEnv(envPath: string, env: Record<string, string>) {
  // JWT_SECRET es requerido por passport-jwt (tu error actual)
  if (!env.JWT_SECRET || !env.JWT_SECRET.trim()) {
    const generated = crypto.randomBytes(32).toString('hex')
    appendEnvLine(envPath, 'JWT_SECRET', generated)
    env.JWT_SECRET = generated
  }
}

function ensureBackendEnvFile(): { envPath: string; env: Record<string, string> } {
  const configDir = path.join(app.getPath('userData'), 'config')
  const envPath = path.join(configDir, 'backend.env')

  if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true })

  if (!fs.existsSync(envPath)) {
    const template = [
      '# Configuración del backend (NestJS) embebido en Electron',
      '#',
      '# IMPORTANTE:',
      '# - Debes tener PostgreSQL instalado en esta PC.',
      '# - Ajusta DATABASE_URL.',
      '# - JWT_SECRET es obligatorio para autenticación.',
      '#',
      '# Ejemplo:',
      '# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/inventario?schema=public"',
      '# PORT="3000"',
      '# JWT_SECRET="cambia_este_valor_por_uno_seguro"',
      '',
      'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/inventario?schema=public"',
      'PORT="3000"',
      'JWT_SECRET=""',
      ''
    ].join('\n')
    fs.writeFileSync(envPath, template, 'utf8')
  }

  const env = parseEnvFile(envPath)

  // Si el archivo existe pero le falta JWT_SECRET, lo agregamos (o lo generamos)
  ensureRequiredEnv(envPath, env)

  const portRaw = env.PORT?.trim()
  const p = portRaw ? Number(portRaw) : 3000
  backendPort = Number.isFinite(p) && p > 0 ? p : 3000

  return { envPath, env }
}

function findBackendEntry(): { backendRoot: string; entry: string } {
  // En PROD: extraResources -> process.resourcesPath/backend
  if (app.isPackaged) {
    const backendRoot = path.join(process.resourcesPath, 'backend')
    return { backendRoot, entry: path.join(backendRoot, 'dist', 'main.js') }
  }

  // En DEV: tu estructura ideal es inventario-desktop/backend
  const candidates = [
    path.join(app.getAppPath(), 'backend'),
    path.join(process.cwd(), 'backend'),
    path.resolve(app.getAppPath(), '..', 'backend'),
  ]

  for (const backendRoot of candidates) {
    const entry = path.join(backendRoot, 'dist', 'main.js')
    if (fs.existsSync(entry)) return { backendRoot, entry }
  }

  const backendRoot = candidates[0]
  return { backendRoot, entry: path.join(backendRoot, 'dist', 'main.js') }
}

function waitForPort(host: string, port: number, timeoutMs: number): Promise<void> {
  const startedAt = Date.now()

  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const socket = new net.Socket()

      const onError = () => {
        socket.destroy()
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timeout esperando backend en ${host}:${port}`))
          return
        }
        setTimeout(tryOnce, 250)
      }

      socket.setTimeout(1500)
      socket.once('error', onError)
      socket.once('timeout', onError)
      socket.connect(port, host, () => {
        socket.end()
        resolve()
      })
    }

    tryOnce()
  })
}

export function getBackendBaseUrl(): string {
  return `http://127.0.0.1:${backendPort}`
}

export async function startBackend(): Promise<void> {
  if (backendProc) return

  const { envPath, env } = ensureBackendEnvFile()
  const { backendRoot, entry } = findBackendEntry()

  if (!fs.existsSync(entry)) {
    await dialog.showMessageBox({
      type: 'error',
      title: 'Backend no encontrado',
      message:
        'No se encontró el backend compilado dentro de la app.\n\n' +
        `Se esperaba: ${entry}\n\n` +
        'Solución:\n' +
        '1) Ejecuta en inventario-desktop:\n' +
        '   - npm run sync:backend\n\n' +
        '2) Verifica que exista:\n' +
        '   - inventario-desktop/backend/dist/main.js\n'
    })
    return
  }

  const logDir = path.join(app.getPath('userData'), 'logs')
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
  const logPath = path.join(logDir, 'backend.log')
  const logStream = fs.createWriteStream(logPath, { flags: 'a' })

  const host = env.HOST ?? '127.0.0.1'

  const childEnv = {
    ...process.env,
    ...env,
    PORT: String(backendPort),
    HOST: host,
    ELECTRON_RUN_AS_NODE: '1',
  }

  backendProc = spawn(process.execPath, [entry], {
    cwd: backendRoot,
    env: childEnv,
    stdio: 'pipe'
  })

  backendProc.stdout.on('data', (buf) => logStream.write(buf))
  backendProc.stderr.on('data', (buf) => logStream.write(buf))

  backendProc.on('exit', async (code) => {
    backendProc = null
    logStream.write(`\n[backend] exit code=${code}\n`)
    logStream.end()

    if (!isQuitting) {
      await dialog.showMessageBox({
        type: 'error',
        title: 'Backend detenido',
        message:
          'El backend se detuvo inesperadamente.\n\n' +
          `Revisa el log: ${logPath}\n` +
          `Config: ${envPath}\n\n` +
          'Causas típicas:\n' +
          '- PostgreSQL no está corriendo\n' +
          '- DATABASE_URL incorrecta\n' +
          '- JWT_SECRET faltante\n' +
          '- Prisma/engines no incluidos en el build'
      })
    }
  })

  await waitForPort(host, backendPort, 20000)
}

export async function stopBackend(): Promise<void> {
  if (!backendProc) return
  try {
    backendProc.kill()
  } catch {
    // ignore
  } finally {
    backendProc = null
  }
}
