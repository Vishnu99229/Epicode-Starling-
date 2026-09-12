import type { UploadContactInput } from '@starling/shared'
import { revalidateStoredContacts, validateUploadContacts } from '@starling/shared'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { pool, withTransaction, type DbClient, type DbQueryable } from '../db.js'
import { badRequest, notFound } from '../errors.js'
import { mapContact, mapContactList, mapValidateResult } from '../mappers/contacts.js'
import {
  contactListUploadSchema,
  listContactsQuerySchema,
  type ContactListUploadBody,
} from '../schemas/contacts.js'

const idParamsSchema = z.object({
  id: z.string().uuid(),
})

function toUploadRows(body: ContactListUploadBody): UploadContactInput[] {
  if (body.rows?.length) {
    return body.rows.map((row) => ({
      phoneNumber: row.phoneNumber,
      name: row.name,
      attributes: row.attributes,
    }))
  }

  return (body.contacts ?? []).map((row) => ({
    phoneNumber: row.phoneNumber ?? row.phoneE164 ?? '',
    name: row.name ?? row.displayName,
    attributes: row.attributes,
  }))
}

/** Placeholder E.164 for rows that fail normalisation (DB CHECK requires +[1-9]…). */
function storagePhoneNumber(
  row: { phoneE164: string | null; status: string },
  rawPhone: string,
  index: number,
): string {
  if (row.phoneE164) return row.phoneE164
  return `+910${String(index + 1).padStart(9, '0')}`
}

function attributeColumns(
  rows: UploadContactInput[],
  explicit?: string[],
): string[] {
  if (explicit?.length) return [...new Set(explicit.map((c) => c.trim()).filter(Boolean))].sort()
  const keys = new Set<string>()
  for (const row of rows) {
    if (row.attributes) {
      for (const key of Object.keys(row.attributes)) keys.add(key)
    }
  }
  return [...keys].sort()
}

async function fetchContactList(client: DbQueryable, id: string) {
  const result = await client.query(
    `SELECT id, name, status, columns, contact_count, valid_count, invalid_count,
            duplicate_count, source_filename, uploaded_at, created_at
     FROM contact_lists
     WHERE id = $1`,
    [id],
  )
  return result.rows[0] ?? null
}

export async function registerContactListRoutes(app: FastifyInstance) {
  app.get('/contact-lists', async () => {
    const result = await pool.query(
      `SELECT id, name, status, columns, contact_count, valid_count, invalid_count,
              duplicate_count, source_filename, uploaded_at, created_at
       FROM contact_lists
       ORDER BY created_at DESC`,
    )
    return result.rows.map(mapContactList)
  })

  app.get('/contact-lists/:id', async (request) => {
    const { id } = idParamsSchema.parse(request.params)
    const row = await fetchContactList(pool, id)
    if (!row) throw notFound('Contact list not found')
    return mapContactList(row)
  })

  app.get('/contact-lists/:id/contacts', async (request) => {
    const { id } = idParamsSchema.parse(request.params)
    const query = listContactsQuerySchema.parse(request.query)

    const list = await fetchContactList(pool, id)
    if (!list) throw notFound('Contact list not found')

    const conditions = ['list_id = $1']
    const params: unknown[] = [id]

    if (query.status) {
      params.push(query.status)
      conditions.push(`row_status = $${params.length}`)
    }

    if (query.search?.trim()) {
      params.push(`%${query.search.trim()}%`)
      conditions.push(
        `(phone_number ILIKE $${params.length}
          OR COALESCE(name, '') ILIKE $${params.length}
          OR attributes::text ILIKE $${params.length})`,
      )
    }

    const limit = query.limit ?? 10_000
    const page = query.page ?? 1
    const offset = (page - 1) * limit

    params.push(limit, offset)

    const result = await pool.query(
      `SELECT id, list_id, phone_number, name, attributes, row_status, created_at
       FROM contacts
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    )

    return result.rows.map(mapContact)
  })

  app.post('/contact-lists/upload', async (request, reply) => {
    const body = contactListUploadSchema.parse(request.body)
    const uploadRows = toUploadRows(body)

    if (uploadRows.some((row) => !row.phoneNumber?.trim())) {
      throw badRequest('Every row must include a phone number')
    }

    const { rows: validated, summary } = validateUploadContacts(uploadRows)
    const columns = attributeColumns(uploadRows, body.columns)
    const now = new Date()

    const list = await withTransaction(async (client) => {
      const listInsert = await client.query(
        `INSERT INTO contact_lists (
           name, status, columns, contact_count, valid_count, invalid_count,
           duplicate_count, source_filename, uploaded_at
         )
         VALUES ($1, 'processing', $2, 0, 0, 0, 0, $3, $4)
         RETURNING id, name, status, columns, contact_count, valid_count, invalid_count,
                   duplicate_count, source_filename, uploaded_at, created_at`,
        [body.name.trim(), columns, body.sourceFilename ?? null, now],
      )

      const listRow = listInsert.rows[0]
      const listId = listRow.id as string

      try {
        for (let i = 0; i < validated.length; i += 1) {
          const row = validated[i]!
          const rawPhone = uploadRows[i]?.phoneNumber ?? ''
          const attributes = { ...row.attributes }
          if (row.status === 'invalid_number' && rawPhone.trim()) {
            attributes._rawPhone = rawPhone.trim()
          }
          await client.query(
            `INSERT INTO contacts (list_id, phone_number, name, attributes, row_status)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              listId,
              storagePhoneNumber(row, rawPhone, i),
              row.displayName ?? null,
              JSON.stringify(attributes),
              row.status,
            ],
          )
        }

        const updated = await client.query(
          `UPDATE contact_lists
           SET status = 'ready',
               contact_count = $2,
               valid_count = $3,
               invalid_count = $4,
               duplicate_count = $5,
               uploaded_at = $6
           WHERE id = $1
           RETURNING id, name, status, columns, contact_count, valid_count, invalid_count,
                     duplicate_count, source_filename, uploaded_at, created_at`,
          [
            listId,
            validated.length,
            summary.valid,
            summary.invalid,
            summary.duplicate,
            now,
          ],
        )

        return updated.rows[0]
      } catch (err) {
        await client.query(
          `UPDATE contact_lists SET status = 'failed' WHERE id = $1`,
          [listId],
        )
        throw err
      }
    })

    return reply.status(201).send(mapContactList(list))
  })

  app.post('/contact-lists/:id/validate', async (request) => {
    const { id } = idParamsSchema.parse(request.params)

    const result = await withTransaction(async (client) => {
      const list = await fetchContactList(client, id)
      if (!list) throw notFound('Contact list not found')

      const contactsResult = await client.query(
        `SELECT id, phone_number, name, attributes, row_status
         FROM contacts
         WHERE list_id = $1
         ORDER BY created_at ASC`,
        [id],
      )

      const stored = contactsResult.rows.map((row) => ({
        id: row.id as string,
        phoneNumber: row.phone_number as string,
        displayName: row.name as string | null,
        attributes: row.attributes as Record<string, string | number | boolean>,
        rowStatus: row.row_status as 'valid' | 'invalid_number' | 'duplicate' | 'dnd',
      }))

      const { updates, summary } = revalidateStoredContacts(stored)

      for (const update of updates) {
        await client.query(
          `UPDATE contacts
           SET phone_number = $2, row_status = $3
           WHERE id = $1`,
          [update.id, update.phoneNumber, update.rowStatus],
        )
      }

      const updatedList = await client.query(
        `UPDATE contact_lists
         SET status = 'ready',
             contact_count = $2,
             valid_count = $3,
             invalid_count = $4,
             duplicate_count = $5
         WHERE id = $1
         RETURNING status, contact_count, valid_count, invalid_count, duplicate_count`,
        [id, stored.length, summary.valid, summary.invalid, summary.duplicate],
      )

      return updatedList.rows[0]
    })

    return mapValidateResult(id, result)
  })
}
