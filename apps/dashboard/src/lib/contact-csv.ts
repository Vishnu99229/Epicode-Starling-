import type { ContactRowStatus } from '@/types'

export type MappingTarget = 'phoneNumber' | 'name' | 'attribute' | 'ignore'

export type ColumnMapping = {
  csvHeader: string
  target: MappingTarget
}

export type ParsedCsv = {
  filename: string
  headers: string[]
  rows: Record<string, string>[]
  previewRows: Record<string, string>[]
}

export type ValidatedContactRow = {
  rowIndex: number
  raw: Record<string, string>
  phoneE164: string | null
  displayName?: string
  attributes: Record<string, string | number | boolean>
  status: ContactRowStatus
  invalidFields: string[]
}

export type ValidationSummary = {
  valid: number
  invalid: number
  duplicate: number
  dnd: number
}

const PHONE_KEYWORDS = [
  'phone',
  'mobile',
  'mobilenumber',
  'cell',
  'cellphone',
  'contactnumber',
  'phoneno',
  'phonenumber',
  'tel',
  'telephone',
  'msisdn',
  'whatsapp',
  'contact',
  'number',
]

const NAME_KEYWORDS = [
  'name',
  'fullname',
  'full name',
  'customername',
  'customer',
  'contactname',
  'firstname',
  'displayname',
  'borrower',
  'client',
]

function normalizeHeader(header: string) {
  return header
    .trim()
    .toLowerCase()
    .replace(/[\s_\-./]+/g, '')
}

function scoreHeader(header: string, keywords: string[]) {
  const norm = normalizeHeader(header)
  if (!norm) return 0
  let best = 0
  for (const keyword of keywords) {
    const key = keyword.replace(/\s+/g, '')
    if (norm === key) best = Math.max(best, 100)
    else if (norm.includes(key) || key.includes(norm)) best = Math.max(best, 70)
    else if (norm.endsWith(key) || norm.startsWith(key)) best = Math.max(best, 50)
  }
  return best
}

export function guessColumnMappings(headers: string[]): ColumnMapping[] {
  const phoneScores = headers.map((h) => ({ header: h, score: scoreHeader(h, PHONE_KEYWORDS) }))
  const nameScores = headers.map((h) => ({ header: h, score: scoreHeader(h, NAME_KEYWORDS) }))

  const phoneHeader =
    phoneScores.sort((a, b) => b.score - a.score).find((h) => h.score >= 50)?.header ?? null
  const nameHeader =
    nameScores
      .filter((h) => h.header !== phoneHeader)
      .sort((a, b) => b.score - a.score)
      .find((h) => h.score >= 50)?.header ?? null

  return headers.map((header) => {
    if (header === phoneHeader) return { csvHeader: header, target: 'phoneNumber' }
    if (header === nameHeader) return { csvHeader: header, target: 'name' }
    return { csvHeader: header, target: 'attribute' }
  })
}

export function hasPhoneMapping(mappings: ColumnMapping[]) {
  return mappings.some((m) => m.target === 'phoneNumber')
}

function stripPhoneSeparators(value: string) {
  return value.replace(/[\s().\-./]/g, '')
}

const INDIA_MOBILE = /^\+91[6-9]\d{9}$/
const E164 = /^\+[1-9]\d{7,14}$/

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

function coerceAttributeValue(value: string): string | number | boolean {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase() === 'true'
  const num = Number(trimmed.replace(/,/g, ''))
  if (trimmed !== '' && !Number.isNaN(num) && /^-?\d[\d,]*(\.\d+)?$/.test(trimmed.replace(/,/g, ''))) {
    return num
  }
  return trimmed
}

function mappingByHeader(mappings: ColumnMapping[]) {
  return new Map(mappings.map((m) => [m.csvHeader, m]))
}

export function validateContactRows(
  rows: Record<string, string>[],
  mappings: ColumnMapping[],
): { rows: ValidatedContactRow[]; summary: ValidationSummary } {
  const byHeader = mappingByHeader(mappings)
  const seenPhones = new Set<string>()
  const validated: ValidatedContactRow[] = []
  const summary: ValidationSummary = { valid: 0, invalid: 0, duplicate: 0, dnd: 0 }

  rows.forEach((raw, rowIndex) => {
    const invalidFields: string[] = []
    const attributes: Record<string, string | number | boolean> = {}
    let displayName: string | undefined
    let phoneRaw = ''

    for (const [header, value] of Object.entries(raw)) {
      const mapping = byHeader.get(header)
      if (!mapping || mapping.target === 'ignore') continue

      if (mapping.target === 'phoneNumber') {
        phoneRaw = value
        continue
      }
      if (mapping.target === 'name') {
        const name = value.trim()
        if (name) displayName = name
        continue
      }
      if (mapping.target === 'attribute') {
        const key = header.trim()
        if (key) attributes[key] = coerceAttributeValue(value)
      }
    }

    const phoneE164 = normalizePhoneE164(phoneRaw)
    let status: ContactRowStatus = 'valid'

    if (!phoneRaw.trim()) {
      status = 'invalid_number'
      invalidFields.push('phone')
    } else if (!phoneE164) {
      status = 'invalid_number'
      invalidFields.push('phone')
    } else if (seenPhones.has(phoneE164)) {
      status = 'duplicate'
      invalidFields.push('phone')
    } else {
      seenPhones.add(phoneE164)
      // DND detection stub — never fires for now.
      status = 'valid'
    }

    summary[status === 'invalid_number' ? 'invalid' : status] += 1

    validated.push({
      rowIndex,
      raw,
      phoneE164,
      displayName,
      attributes,
      status,
      invalidFields,
    })
  })

  return { rows: validated, summary }
}

export function attributeColumnsFromMappings(mappings: ColumnMapping[]) {
  return mappings
    .filter((m) => m.target === 'attribute')
    .map((m) => m.csvHeader.trim())
    .filter(Boolean)
}
