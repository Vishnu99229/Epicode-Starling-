import Papa from 'papaparse'
import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useUploadContactList, useValidateContactList } from '@/api/contacts'
import { ContactRowStatusPill } from '@/components/contacts/ContactRowStatusPill'
import { UploadStepIndicator } from '@/components/contacts/UploadStepIndicator'
import { PageHeader } from '@/components/PageHeader'
import { toast } from '@/components/Toast'
import { Button } from '@/components/ui/button'
import { Field, Select, TextInput } from '@/components/ui/field'
import {
  attributeColumnsFromMappings,
  guessColumnMappings,
  hasPhoneMapping,
  type ColumnMapping,
  type MappingTarget,
  type ParsedCsv,
  type ValidatedContactRow,
  validateContactRows,
} from '@/lib/contact-csv'
import { cn } from '@/lib/utils'

const MAX_BYTES = 10 * 1024 * 1024
const PREVIEW_LIMIT = 50
const TABLE_PREVIEW_LIMIT = 100

const TARGET_OPTIONS: Array<{ value: MappingTarget; label: string }> = [
  { value: 'phoneNumber', label: 'Phone number (required)' },
  { value: 'name', label: 'Name (optional)' },
  { value: 'attribute', label: 'Keep as attribute' },
  { value: 'ignore', label: 'Ignore' },
]

function defaultListName(filename: string) {
  return filename.replace(/\.csv$/i, '').replace(/[_-]+/g, ' ').trim() || 'Imported contacts'
}

export function ContactUploadPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [parseError, setParseError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedCsv | null>(null)
  const [mappings, setMappings] = useState<ColumnMapping[]>([])
  const [validated, setValidated] = useState<ValidatedContactRow[]>([])
  const [summary, setSummary] = useState({ valid: 0, invalid: 0, duplicate: 0, dnd: 0 })
  const [skipInvalid, setSkipInvalid] = useState(true)
  const [listName, setListName] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const upload = useUploadContactList()
  const validate = useValidateContactList()

  const phoneMapped = hasPhoneMapping(mappings)

  const importable = useMemo(
    () => validated.filter((row) => row.status === 'valid'),
    [validated],
  )

  const skippedCount = validated.length - importable.length

  const parseFile = useCallback((file: File) => {
    setParseError(null)
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setParseError('Only .csv files are accepted.')
      return
    }
    if (file.size > MAX_BYTES) {
      setParseError('File exceeds the 10 MB limit.')
      return
    }

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors.length > 0) {
          setParseError(result.errors[0]?.message ?? 'Failed to parse CSV.')
          return
        }
        const rows = result.data.filter((row) => Object.values(row).some((v) => String(v).trim()))
        if (rows.length === 0) {
          setParseError('CSV has no data rows.')
          return
        }
        const headers = result.meta.fields ?? Object.keys(rows[0] ?? {})
        if (headers.length === 0) {
          setParseError('CSV has no header row.')
          return
        }
        const guessed = guessColumnMappings(headers)
        setParsed({
          filename: file.name,
          headers,
          rows,
          previewRows: rows.slice(0, PREVIEW_LIMIT),
        })
        setMappings(guessed)
        setListName(defaultListName(file.name))
        setStep(1)
      },
      error: (err) => setParseError(err.message),
    })
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) parseFile(file)
    },
    [parseFile],
  )

  const runValidation = () => {
    if (!parsed) return
    const result = validateContactRows(parsed.rows, mappings)
    setValidated(result.rows)
    setSummary(result.summary)
    setStep(3)
  }

  const phoneHeader = mappings.find((m) => m.target === 'phoneNumber')?.csvHeader
  const nameHeader = mappings.find((m) => m.target === 'name')?.csvHeader
  const attributeHeaders = attributeColumnsFromMappings(mappings)

  const previewColumns = useMemo(() => {
    const cols: Array<{ key: string; label: string; kind: 'phone' | 'name' | 'attr' | 'status' }> = []
    if (phoneHeader) cols.push({ key: phoneHeader, label: 'Phone', kind: 'phone' })
    if (nameHeader) cols.push({ key: nameHeader, label: 'Name', kind: 'name' })
    for (const h of attributeHeaders) cols.push({ key: h, label: h, kind: 'attr' })
    cols.push({ key: '__status', label: 'Status', kind: 'status' })
    return cols
  }, [phoneHeader, nameHeader, attributeHeaders])

  const onImport = async () => {
    if (!parsed || !listName.trim()) return
    const contacts = importable
      .filter((row) => row.phoneE164)
      .map((row) => ({
        phoneE164: row.phoneE164!,
        displayName: row.displayName,
        attributes: row.attributes,
      }))

    try {
      const list = await upload.mutateAsync({
        name: listName.trim(),
        sourceFilename: parsed.filename,
        contacts,
      })
      await validate.mutateAsync(list.id)
      toast('Contacts imported')
      navigate(`/contacts/${list.id}`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Import failed')
    }
  }

  return (
    <div>
      <PageHeader
        title="Upload contacts"
        description="Import a CSV, map columns, validate numbers, and create a contact list."
        actions={
          <Button variant="outline" asChild>
            <Link to="/contacts">Back to lists</Link>
          </Button>
        }
      />

      <UploadStepIndicator current={step} />

      {step === 1 ? (
        <section className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cn(
              'flex min-h-48 flex-col items-center justify-center border border-dashed px-6 py-10 text-center',
              dragOver ? 'border-live bg-live/5' : 'border-line bg-panel',
            )}
          >
            <p className="text-sm text-text">Drag and drop a CSV file here</p>
            <p className="mt-1 text-xs text-muted">.csv only · max 10 MB</p>
            <label className="mt-4">
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) parseFile(file)
                }}
              />
              <span className="cursor-pointer text-sm text-live underline">Choose file</span>
            </label>
          </div>

          {parseError ? <p className="text-sm text-fail">{parseError}</p> : null}

          {parsed ? (
            <div className="border border-line bg-panel px-4 py-3 text-sm">
              <p className="text-text">
                <span className="font-medium">{parsed.filename}</span>
                <span className="text-muted"> · {parsed.rows.length.toLocaleString('en-IN')} rows</span>
              </p>
              <p className="mt-1 text-xs text-muted">
                {parsed.headers.length} columns detected. Preview uses the first {PREVIEW_LIMIT} rows.
              </p>
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" disabled={!parsed} onClick={() => setStep(2)}>
              Next
            </Button>
          </div>
        </section>
      ) : null}

      {step === 2 && parsed ? (
        <section className="space-y-4">
          <p className="text-sm text-muted">
            Map each CSV column to a Starling field. Phone number is required.
          </p>

          <div className="overflow-x-auto border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-panel text-muted">
                <tr className="border-b border-line">
                  <th className="px-3 py-2 font-medium">CSV column</th>
                  <th className="px-3 py-2 font-medium">Maps to</th>
                  <th className="px-3 py-2 font-medium">Sample value</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((mapping, index) => {
                  const sample = parsed.previewRows[0]?.[mapping.csvHeader] ?? ''
                  return (
                    <tr key={mapping.csvHeader} className="border-b border-line last:border-b-0">
                      <td className="px-3 py-2 font-medium">{mapping.csvHeader}</td>
                      <td className="px-3 py-2">
                        <Select
                          value={mapping.target}
                          onChange={(e) => {
                            const target = e.target.value as MappingTarget
                            setMappings((prev) =>
                              prev.map((m, i) => {
                                if (i === index) return { ...m, target }
                                if (target === 'phoneNumber' && m.target === 'phoneNumber') {
                                  return { ...m, target: 'attribute' }
                                }
                                if (target === 'name' && m.target === 'name') {
                                  return { ...m, target: 'attribute' }
                                }
                                return m
                              }),
                            )
                          }}
                        >
                          {TARGET_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-2 text-muted">{sample || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {!phoneMapped ? (
            <p className="text-sm text-fail">Map one column to Phone number before continuing.</p>
          ) : null}

          <div className="flex justify-between gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button type="button" disabled={!phoneMapped} onClick={runValidation}>Next</Button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-4 border border-line bg-panel px-4 py-3 text-sm">
            <span className="text-live">
              <span className="metric font-medium">{summary.valid.toLocaleString('en-IN')}</span> valid
            </span>
            <span className="text-fail">
              <span className="metric font-medium">{summary.invalid.toLocaleString('en-IN')}</span> invalid
            </span>
            <span className="text-warn">
              <span className="metric font-medium">{summary.duplicate.toLocaleString('en-IN')}</span> duplicate
            </span>
            <span className="text-idle">
              <span className="metric font-medium">{summary.dnd.toLocaleString('en-IN')}</span> dnd
            </span>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={skipInvalid}
              onChange={(e) => setSkipInvalid(e.target.checked)}
            />
            Skip invalid rows on import (default)
          </label>
          {!skipInvalid && summary.invalid > 0 ? (
            <p className="text-sm text-muted">
              Re-enable skip invalid rows to continue, or cancel to fix the CSV.
            </p>
          ) : null}

          <div className="overflow-x-auto border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-panel text-muted">
                <tr className="border-b border-line">
                  {previewColumns.map((col) => (
                    <th key={col.key} className="px-3 py-2 font-medium whitespace-nowrap">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {validated.slice(0, TABLE_PREVIEW_LIMIT).map((row) => (
                  <tr key={row.rowIndex} className="border-b border-line last:border-b-0">
                    {previewColumns.map((col) => {
                      if (col.kind === 'status') {
                        return (
                          <td key={col.key} className="px-3 py-2">
                            <ContactRowStatusPill status={row.status} />
                          </td>
                        )
                      }
                      const value = row.raw[col.key] ?? ''
                      const invalid = col.kind === 'phone' && row.invalidFields.includes('phone')
                      return (
                        <td
                          key={col.key}
                          className={cn('px-3 py-2', invalid && 'bg-fail/10 text-fail')}
                        >
                          {value || '—'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {validated.length > TABLE_PREVIEW_LIMIT ? (
            <p className="text-xs text-muted">
              Showing first {TABLE_PREVIEW_LIMIT} of {validated.length.toLocaleString('en-IN')} rows.
            </p>
          ) : null}

          <div className="flex justify-between gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(2)}>Back</Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" asChild>
                <Link to="/contacts">Cancel</Link>
              </Button>
              <Button
                type="button"
                disabled={!skipInvalid || importable.length === 0}
                onClick={() => setStep(4)}
              >
                Next
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {step === 4 && parsed ? (
        <section className="space-y-4">
          <Field label="List name">
            <TextInput value={listName} onChange={(e) => setListName(e.target.value)} />
          </Field>

          <div className="border border-line bg-panel px-4 py-3 text-sm">
            <p className="text-text">
              <span className="metric font-medium">{importable.length.toLocaleString('en-IN')}</span> valid
              contacts will be imported
              {skipInvalid && skippedCount > 0 ? (
                <>
                  {' '}·{' '}
                  <span className="metric text-muted">{skippedCount.toLocaleString('en-IN')}</span> skipped
                </>
              ) : null}
            </p>
            <p className="mt-1 text-xs text-muted">
              Source: {parsed.filename}
              {attributeHeaders.length > 0
                ? ` · attributes: ${attributeHeaders.join(', ')}`
                : ''}
            </p>
          </div>

          <div className="flex justify-between gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(3)}>Back</Button>
            <Button
              type="button"
              disabled={!listName.trim() || importable.length === 0 || upload.isPending || validate.isPending}
              onClick={() => void onImport()}
            >
              {upload.isPending || validate.isPending ? 'Importing…' : 'Import contacts'}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
