import { config as loadEnv } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const apiRoot = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(apiRoot, '../..')

loadEnv({ path: path.join(repoRoot, '.env') })

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function optional(name: string): string | undefined {
  const value = process.env[name]
  return value && value !== 'FILL_IN' ? value : undefined
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '0.0.0.0',
  databaseUrl: required(
    'DATABASE_URL',
    'postgres://starling:starling@127.0.0.1:5433/starling?sslmode=disable',
  ),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  botComposeBaseUrl: optional('BOTCOMPOSE_BASE_URL'),
  botComposeBearerToken: optional('BOTCOMPOSE_BEARER_TOKEN'),
  epicodeTenant: optional('EPICODE_TENANT'),
  iraVoiceBaseUrl:
    optional('IRAVOICE_BASE_URL') ?? trimMakecallBase(optional('IRAVOICE_MAKECALL_URL')),
  iraVoiceBearerToken: optional('IRAVOICE_BEARER_TOKEN'),
  defaultTenantId: optional('STARLING_TENANT_ID'),
}

function trimMakecallBase(url?: string) {
  if (!url) return undefined
  return url.replace(/\/api\/makecall\/?$/, '').replace(/\/makecall\/?$/, '')
}

export function botComposeConfigured() {
  return Boolean(
    config.botComposeBaseUrl && config.botComposeBearerToken && config.epicodeTenant,
  )
}

export function iraVoiceConfigured() {
  return Boolean(
    config.iraVoiceBaseUrl && config.iraVoiceBearerToken && config.epicodeTenant,
  )
}
