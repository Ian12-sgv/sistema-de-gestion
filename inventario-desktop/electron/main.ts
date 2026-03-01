import electron from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

import { getToken, setToken, clearToken } from './secure-store'
import { startBackend, stopBackend, getBackendBaseUrl } from './backend-runner'

const { app, BrowserWindow, ipcMain, Menu, shell, dialog, protocol } = electron

// ✅ Nombre estable para que la carpeta de configuración sea clara para el usuario
app.setName('Sistema de Gestion')

/**
 * ✅ FIX DEFINITIVO (Windows): usar protocolo app:// en vez de file://
 * - Evita rutas tipo file:///C:/... que rompen routing o dejan pantalla en blanco sin error.
 * - Sirve dist/ desde app.asar/dist/ con rutas limpias.
 */
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
])

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: electron.BrowserWindow | null = null

function looksLikeCjsButMjs(filePath: string): boolean {
  try {
    const txt = fs.readFileSync(filePath, 'utf8')
    return txt.includes('require(') || txt.includes('module.exports')
  } catch {
    return false
  }
}

function resolvePreloadPath() {
  const mjs = path.join(__dirname, 'preload.mjs')
  const js = path.join(__dirname, 'preload.js')
  const cjs = path.join(__dirname, 'preload.cjs')

  if (fs.existsSync(cjs)) return cjs
  if (fs.existsSync(js)) return js

  if (fs.existsSync(mjs)) {
    const bad = looksLikeCjsButMjs(mjs)
    if (bad) {
      if (!app.isPackaged) {
        try {
          fs.copyFileSync(mjs, cjs)
          return cjs
        } catch {
          // fallback a mjs
        }
      } else {
        throw new Error(
          'El preload empaquetado está en formato CommonJS pero con extensión .mjs. Debe existir dist-electron/preload.cjs en el build.'
        )
      }
    }
    return mjs
  }

  return mjs
}

function openDevTools() {
  if (!mainWindow) return
  try {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } catch {
    // ignore
  }
}

function buildMenu() {
  const configDir = path.join(app.getPath('userData'), 'config')
  const envPath = path.join(configDir, 'backend.env')

  const template: electron.MenuItemConstructorOptions[] = [
    {
      label: 'Configuración',
      submenu: [
        {
          label: 'Abrir carpeta de configuración',
          click: async () => {
            try {
              fs.mkdirSync(configDir, { recursive: true })
              await shell.openPath(configDir)
            } catch (e: any) {
              await dialog.showMessageBox({
                type: 'error',
                title: 'Error',
                message: String(e?.message ?? e),
              })
            }
          },
        },
        {
          label: 'Abrir backend.env',
          click: async () => {
            try {
              fs.mkdirSync(configDir, { recursive: true })
              const res = await shell.openPath(envPath)
              if (res) {
                await dialog.showMessageBox({
                  type: 'error',
                  title: 'No se pudo abrir backend.env',
                  message:
                    'Si es la primera vez, abre la app y espera 3 segundos para que se cree el archivo.\n\n' +
                    `Ruta:\n${envPath}\n\nDetalle:\n${res}`,
                })
              }
            } catch (e: any) {
              await dialog.showMessageBox({
                type: 'error',
                title: 'Error',
                message: String(e?.message ?? e),
              })
            }
          },
        },
        {
          label: 'Importar backend.env…',
          click: async () => {
            try {
              const picked = await dialog.showOpenDialog({
                title: 'Selecciona tu archivo backend.env',
                properties: ['openFile'],
                filters: [
                  { name: 'Archivo de configuración', extensions: ['env', 'txt'] },
                  { name: 'Todos', extensions: ['*'] },
                ],
              })

              if (picked.canceled || picked.filePaths.length === 0) return

              const src = picked.filePaths[0]
              fs.mkdirSync(configDir, { recursive: true })
              fs.copyFileSync(src, envPath)

              await dialog.showMessageBox({
                type: 'info',
                title: 'Listo',
                message:
                  'Se importó backend.env correctamente.\n\n' +
                  'Cierra y vuelve a abrir la aplicación para que el backend tome la nueva configuración.',
              })
            } catch (e: any) {
              await dialog.showMessageBox({
                type: 'error',
                title: 'Error al importar',
                message: String(e?.message ?? e),
              })
            }
          },
        },
      ],
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Herramientas de desarrollador',
          accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Control+Shift+I',
          click: () => openDevTools(),
        },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function registerAppProtocol() {
  // ✅ app.getAppPath() == ...\resources\app.asar (en PROD)
  const distRoot = path.join(app.getAppPath(), 'dist')

  protocol.registerFileProtocol('app', (request, callback) => {
    try {
      const u = new URL(request.url)
      let rel = decodeURIComponent(u.pathname || '/')
      if (rel.startsWith('/')) rel = rel.slice(1)

      // SPA fallback: si piden una ruta sin archivo real, devolvemos index.html
      let target = rel || 'index.html'
      const abs = path.join(distRoot, target)

      if (!fs.existsSync(abs)) {
        // Si no existe y no parece asset (no tiene extensión), devolvemos index.html
        const hasExt = path.extname(target) !== ''
        const fallback = path.join(distRoot, 'index.html')
        if (!hasExt && fs.existsSync(fallback)) {
          callback({ path: fallback })
          return
        }
      }

      callback({ path: abs })
    } catch (e: any) {
      callback({ error: -2 }) // FILE_NOT_FOUND
    }
  })
}

async function loadRenderer(win: electron.BrowserWindow) {
  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    await win.loadURL(devUrl)
    return
  }

  const indexHtml = path.join(app.getAppPath(), 'dist', 'index.html')
  if (!fs.existsSync(indexHtml)) {
    await dialog.showMessageBox({
      type: 'error',
      title: 'Interfaz no encontrada',
      message: `No existe:\n${indexHtml}\n\nEl build no incluyó dist/** dentro del app.asar.`,
    })
    return
  }

  // ✅ Cargamos con app:// para evitar file:///C:/...
  await win.loadURL('app://./')
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      sandbox: false,
    },
  })

  mainWindow = win

  win.webContents.on('did-fail-load', async (_e, code, desc, url) => {
    await dialog.showMessageBox({
      type: 'error',
      title: 'Error cargando interfaz',
      message: `Código: ${code}\nDetalle: ${desc}\nURL: ${url}`,
    })
  })

  loadRenderer(win)

  if (process.env.FORCE_DEVTOOLS === '1') {
    win.webContents.once('did-finish-load', () => openDevTools())
  }
}

app.whenReady().then(async () => {
  try {
    await startBackend()
  } catch (e: any) {
    console.error('[backend] failed to start:', e?.message ?? e)
  }

  // ✅ Registrar protocolo app:// antes de crear ventana
  registerAppProtocol()

  buildMenu()

  ipcMain.handle('auth:getToken', () => getToken())
  ipcMain.handle('auth:setToken', (_e, token: string) => setToken(token))
  ipcMain.handle('auth:clearToken', () => clearToken())

  ipcMain.handle('app:quit', () => app.quit())
  ipcMain.handle('config:getApiBaseUrl', () => getBackendBaseUrl())

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', async () => {
  ;(app as any).isQuiting = true
  await stopBackend()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})