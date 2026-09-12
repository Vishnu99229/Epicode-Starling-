import type { DbQueryable } from '../db.js'
import { config } from '../config.js'

export async function resolveTenantId(db: DbQueryable): Promise<string> {
  if (config.defaultTenantId) {
    return config.defaultTenantId
  }

  const existing = await db.query(`SELECT id::text FROM tenants ORDER BY created_at LIMIT 1`)
  if (existing.rows[0]?.id) {
    return existing.rows[0].id as string
  }

  const inserted = await db.query(
    `INSERT INTO tenants (name, epicode_tenant_id)
     VALUES ('Default tenant', $1)
     RETURNING id::text`,
    [config.epicodeTenant ?? 'copter'],
  )
  return inserted.rows[0].id as string
}
