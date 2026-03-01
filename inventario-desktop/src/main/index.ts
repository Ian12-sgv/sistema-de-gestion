import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { getToken, setToken, clearToken } from './secure-store'

let mainWindow: BrowserWindow | null = null

function resolvePreloadPath() {
  // electron-vite a veces compila preload a index.js o index.mjs según config
  const base = path.join(__dirname, '../preload')
  const js = path.join(base, 'index.js')
  const mjs = path.join(base, 'index.mjs')

  if (fs.existsSync(js)) return js
  if (fs.existsSync(mjs)) return mjs

  // fallback (para ver rápido en logs si algo está raro)
  return js
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      sandbox: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // IPC Auth
  ipcMain.handle('auth:getToken', () => getToken())
  ipcMain.handle('auth:setToken', (_e, token: string) => setToken(token))
  ipcMain.handle('auth:clearToken', () => clearToken())

  // IPC App
  ipcMain.handle('app:quit', () => app.quit())

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})