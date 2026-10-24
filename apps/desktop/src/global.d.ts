import type { ZequelBridge } from '../electron/preload'

declare global {
  interface Window {
    zequel: ZequelBridge
  }
}

export {}
