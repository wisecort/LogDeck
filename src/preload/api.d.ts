export interface LogDeckApi {
  readonly appName: string
}

declare global {
  interface Window {
    readonly logdeck: LogDeckApi
  }
}
