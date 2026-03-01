export {}

declare global {
  interface Window {
    api: {
      auth: {
        getToken: () => Promise<string | null>
        setToken: (token: string) => Promise<void>
        clearToken: () => Promise<void>
      }
      app: {
        quit: () => Promise<void>
      }
    }
  }
}export {}

declare global {
  interface Window {
    api: {
      auth: {
        getToken: () => Promise<string | null>
        setToken: (token: string) => Promise<void>
        clearToken: () => Promise<void>
      }
      app: {
        quit: () => Promise<void>
      }
    }
  }
}