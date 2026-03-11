import * as electron from 'electron'

const { contextBridge, ipcRenderer } = electron

contextBridge.exposeInMainWorld('api', {
  auth: {
    getToken: () => ipcRenderer.invoke('auth:getToken') as Promise<string | null>,
    setToken: (token: string) => ipcRenderer.invoke('auth:setToken', token) as Promise<void>,
    clearToken: () => ipcRenderer.invoke('auth:clearToken') as Promise<void>,
  },
  app: {
    quit: () => ipcRenderer.invoke('app:quit') as Promise<void>,
  },
  config: {
    getApiBaseUrl: () => ipcRenderer.invoke('config:getApiBaseUrl') as Promise<string>,
  },
})
