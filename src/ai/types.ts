/** A configured AI backend, already bound to its credentials (main process only). */
export interface AiProvider {
  /** Shown in the preview modal before sending (F7.2). */
  destination: string
  /** True when the text never leaves the machine (Ollama, LM Studio). */
  local: boolean
  complete(system: string, user: string): Promise<string>
}
