import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  auth: {
    getToken: () => ipcRenderer.invoke('auth:getToken') as Promise<string | null>,
    setToken: (token: string) => ipcRenderer.invoke('auth:setToken', token) as Promise<void>,
    clearToken: () => ipcRenderer.invoke('auth:clearToken') as Promise<void>
  },
  app: {
    quit: () => ipcRenderer.invoke('app:quit') as Promise<void>
  }
})