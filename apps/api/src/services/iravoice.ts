import { config, iraVoiceConfigured } from '../config.js'

export async function dropCall(callUuid: string): Promise<void> {
  if (!iraVoiceConfigured()) {
    throw new Error('IraVoice is not configured')
  }

  const base = config.iraVoiceBaseUrl!.replace(/\/$/, '')
  const url = `${base}/api/dropcall`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.iraVoiceBearerToken}`,
      'tenant-id': config.epicodeTenant!,
    },
    body: JSON.stringify({ call_uuid: callUuid }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`IraVoice dropcall failed (${response.status}): ${body}`)
  }
}

export async function dropCalls(callUuids: string[]): Promise<void> {
  for (const callUuid of callUuids) {
    try {
      await dropCall(callUuid)
    } catch (err) {
      console.error(`dropcall failed for ${callUuid}:`, err)
    }
  }
}
