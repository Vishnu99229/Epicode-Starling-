export type ContactRowStatus = 'valid' | 'invalid_number' | 'duplicate' | 'dnd'

export type UploadContactInput = {
  phoneNumber: string
  name?: string
  attributes?: Record<string, string | number | boolean>
}

export type ValidatedUploadContact = {
  phoneE164: string | null
  displayName?: string
  attributes: Record<string, string | number | boolean>
  status: ContactRowStatus
}

export type ContactValidationSummary = {
  valid: number
  invalid: number
  duplicate: number
  dnd: number
}

const INDIA_MOBILE = /^\+91[6-9]\d{9}$/
const E164 = /^\+[1-9]\d{7,14}$/

function stripPhoneSeparators(value: string) {
  return value.replace(/[\s().\-./]/g, '')
}

/** Normalise to E.164 with +91 as the default country code for Indian mobiles. */
export function normalizePhoneE164(raw: string, defaultCountryCode = '91'): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  let digits = stripPhoneSeparators(trimmed)
  if (!digits) return null

  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`
  if (digits.startsWith('+')) {
    const candidate = digits
    if (candidate.startsWith('+91')) {
      return INDIA_MOBILE.test(candidate) ? candidate : null
    }
    return E164.test(candidate) ? candidate : null
  }

  digits = digits.replace(/\D/g, '')
  if (!digits) return null

  if (digits.startsWith(defaultCountryCode) && digits.length === defaultCountryCode.length + 10) {
    const candidate = `+${digits}`
    return INDIA_MOBILE.test(candidate) ? candidate : null
  }

  if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1)
  }

  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    const candidate = `+${defaultCountryCode}${digits}`
    return INDIA_MOBILE.test(candidate) ? candidate : null
  }

  if (digits.length > 10 && digits.startsWith(defaultCountryCode)) {
    const candidate = `+${digits}`
    return INDIA_MOBILE.test(candidate) ? candidate : null
  }

  return null
}

/**
 * Validate upload rows server-side. Marks duplicates within the batch and against
 * `existingPhonesInList` (e.g. rows already stored for the same list).
 *
 * TODO: DND scrub is performed by Starling before dial (contacts.dnd / row_status),
 * not by the IraVoice gateway — wire a registry check here in a later phase.
 */
export function validateUploadContacts(
  rows: UploadContactInput[],
  existingPhonesInList: ReadonlySet<string> = new Set(),
): { rows: ValidatedUploadContact[]; summary: ContactValidationSummary } {
  const seenInBatch = new Set<string>()
  const validated: ValidatedUploadContact[] = []
  const summary: ContactValidationSummary = { valid: 0, invalid: 0, duplicate: 0, dnd: 0 }

  for (const row of rows) {
    const attributes = row.attributes ?? {}
    const displayName = row.name?.trim() || undefined
    const phoneE164 = normalizePhoneE164(row.phoneNumber)
    let status: ContactRowStatus = 'valid'

    if (!row.phoneNumber.trim()) {
      status = 'invalid_number'
    } else if (!phoneE164) {
      status = 'invalid_number'
    } else if (seenInBatch.has(phoneE164) || existingPhonesInList.has(phoneE164)) {
      status = 'duplicate'
    } else {
      seenInBatch.add(phoneE164)
      status = 'valid'
    }

    if (status === 'valid') summary.valid += 1
    else if (status === 'invalid_number') summary.invalid += 1
    else if (status === 'duplicate') summary.duplicate += 1
    else if (status === 'dnd') summary.dnd += 1

    validated.push({
      phoneE164,
      displayName,
      attributes,
      status,
    })
  }

  return { rows: validated, summary }
}

/** Re-validate stored phone numbers (validate endpoint). */
export function revalidateStoredContacts(
  rows: Array<{
    id: string
    phoneNumber: string
    displayName?: string | null
    attributes: Record<string, string | number | boolean>
    rowStatus: ContactRowStatus
  }>,
): {
  updates: Array<{ id: string; phoneNumber: string; rowStatus: ContactRowStatus }>
  summary: ContactValidationSummary
} {
  const seen = new Set<string>()
  const updates: Array<{ id: string; phoneNumber: string; rowStatus: ContactRowStatus }> = []
  const summary: ContactValidationSummary = { valid: 0, invalid: 0, duplicate: 0, dnd: 0 }

  for (const row of rows) {
    const phoneE164 = normalizePhoneE164(row.phoneNumber)
    let rowStatus: ContactRowStatus = 'valid'

    if (!phoneE164) {
      rowStatus = 'invalid_number'
    } else if (seen.has(phoneE164)) {
      rowStatus = 'duplicate'
    } else {
      seen.add(phoneE164)
      // TODO: DND scrub (Starling-side, pre-dial) — preserve dnd when already set.
      rowStatus = row.rowStatus === 'dnd' ? 'dnd' : 'valid'
    }

    if (rowStatus === 'valid') summary.valid += 1
    else if (rowStatus === 'invalid_number') summary.invalid += 1
    else if (rowStatus === 'duplicate') summary.duplicate += 1
    else if (rowStatus === 'dnd') summary.dnd += 1

    updates.push({
      id: row.id,
      phoneNumber:
        phoneE164 ??
        (rowStatus === 'invalid_number'
          ? row.phoneNumber.startsWith('+')
            ? row.phoneNumber
            : `+910${row.id.replace(/\D/g, '').slice(-9).padStart(9, '0')}`
          : row.phoneNumber),
      rowStatus,
    })
  }

  return { updates, summary }
}
