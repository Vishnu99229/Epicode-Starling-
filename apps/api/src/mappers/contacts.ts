import type { ContactRowStatus } from '@starling/shared'

type ContactListRow = {
  id: string
  name: string
  status: string
  columns: string[]
  contact_count: number
  valid_count: number
  invalid_count: number
  duplicate_count: number
  source_filename: string | null
  uploaded_at: Date | null
  created_at: Date
}

type ContactRow = {
  id: string
  list_id: string
  phone_number: string
  name: string | null
  attributes: Record<string, string | number | boolean>
  row_status: ContactRowStatus
  created_at: Date
}

function toIso(value: Date | null): string | undefined {
  return value ? value.toISOString() : undefined
}

export function mapContactList(row: ContactListRow) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    contactCount: row.contact_count,
    validCount: row.valid_count,
    invalidCount: row.invalid_count,
    duplicateCount: row.duplicate_count,
    columns: row.columns ?? [],
    ...(row.source_filename ? { sourceFilename: row.source_filename } : {}),
    uploadedAt: toIso(row.uploaded_at) ?? row.created_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  }
}

function publicAttributes(
  attributes: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  const { _rawPhone: _omit, ...rest } = attributes
  return rest
}

export function mapContact(row: ContactRow) {
  const attrs = row.attributes ?? {}
  const rawPhone = attrs._rawPhone
  const phoneE164 =
    row.row_status === 'invalid_number' && rawPhone != null && String(rawPhone).trim()
      ? String(rawPhone).trim()
      : row.phone_number

  return {
    id: row.id,
    listId: row.list_id,
    phoneE164,
    ...(row.name ? { displayName: row.name } : {}),
    status: row.row_status,
    dndFlag: row.row_status === 'dnd',
    attributes: publicAttributes(attrs),
    createdAt: row.created_at.toISOString(),
  }
}

export function mapValidateResult(
  listId: string,
  row: Pick<ContactListRow, 'status' | 'contact_count' | 'valid_count' | 'invalid_count' | 'duplicate_count'>,
) {
  return {
    listId,
    status: row.status,
    contactCount: row.contact_count,
    validCount: row.valid_count,
    invalidCount: row.invalid_count,
    duplicateCount: row.duplicate_count,
  }
}
