import { config } from '../config.js'

/** True when IraVoice HTTP API env is present (makecall + dropcall). */
export function isConfigured(): boolean {
  return Boolean(
    config.iraVoiceBaseUrl?.trim() && config.iraVoiceBearerToken?.trim(),
  )
}
