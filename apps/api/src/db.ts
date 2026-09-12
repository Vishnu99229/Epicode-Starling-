import pg from 'pg'

import { config } from './config.js'

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
})

export type DbClient = pg.PoolClient
export type DbQueryable = Pick<pg.Pool, 'query'>

export async function withTransaction<T>(fn: (client: DbClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
