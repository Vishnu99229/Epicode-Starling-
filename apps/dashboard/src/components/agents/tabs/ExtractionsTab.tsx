import { useFormContext, useWatch } from 'react-hook-form'

import { Field, Select, TextInput } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/Toast'
import { WEBHOOK_STATUSES } from '@/lib/agent-options'
import type { AgentCreate } from '@/types'

import { Section } from '../Section'

export function ExtractionsTab() {
  const { register, setValue, control } = useFormContext<AgentCreate>()
  const statuses = useWatch({ control, name: 'webhookTriggerStatuses' }) ?? []
  const headersOn = useWatch({ control, name: 'webhookHeadersEnabled' })
  const headers = useWatch({ control, name: 'webhookHeaders' }) ?? []
  const categories = useWatch({ control, name: 'extractionCategories' }) ?? []

  return (
    <div className="space-y-4">
      <Section title="Webhook configuration">
        {/*
          webhookUrl is the Ledger event_url. IraVoice POSTs iravoice::* lifecycle
          events and the BotCompose CDR to this same endpoint.
        */}
        <Field label="Webhook URL">
          <TextInput
            placeholder="https://starling.example/hooks/ledger"
            {...register('webhookUrl')}
          />
        </Field>
        <div>
          <p className="mb-2 text-sm">Trigger on statuses</p>
          <div className="flex flex-wrap gap-3">
            {WEBHOOK_STATUSES.map((status) => (
              <label key={status} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={statuses.includes(status)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...statuses, status]
                      : statuses.filter((s) => s !== status)
                    setValue('webhookTriggerStatuses', next)
                  }}
                />
                {status.replace('_', ' ')}
              </label>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('webhookHeadersEnabled')} />
          Add headers
        </label>
        {headersOn ? (
          <div className="space-y-2">
            {headers.map((row, i) => (
              <div key={i} className="grid grid-cols-2 gap-2">
                <TextInput
                  placeholder="Header"
                  value={row.key}
                  onChange={(e) => {
                    const next = headers.map((h, idx) =>
                      idx === i ? { ...h, key: e.target.value } : h,
                    )
                    setValue('webhookHeaders', next)
                  }}
                />
                <TextInput
                  placeholder="Value"
                  value={row.value}
                  onChange={(e) => {
                    const next = headers.map((h, idx) =>
                      idx === i ? { ...h, value: e.target.value } : h,
                    )
                    setValue('webhookHeaders', next)
                  }}
                />
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setValue('webhookHeaders', [...headers, { key: '', value: '' }])}
            >
              Add row
            </Button>
          </div>
        ) : null}
        <Button
          type="button"
          variant="outline"
          onClick={() => toast('Test payload sent')}
        >
          Send test
        </Button>
      </Section>

      <Section title="Extractions">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5" {...register('callSummary')} />
          <span>
            Call summary
            <span className="mt-0.5 block text-xs text-muted">
              Generate a call summary after each call
            </span>
          </span>
        </label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            setValue('extractionCategories', [
              ...categories,
              {
                id: crypto.randomUUID(),
                name: '',
                description: '',
                type: 'text',
              },
            ])
          }
        >
          New category
        </Button>
        <div className="space-y-3">
          {categories.map((cat, i) => (
            <div key={cat.id} className="grid gap-2 border border-line p-2 sm:grid-cols-3">
              <Field label="Name">
                <TextInput
                  value={cat.name}
                  onChange={(e) => {
                    const next = categories.map((c, idx) =>
                      idx === i ? { ...c, name: e.target.value } : c,
                    )
                    setValue('extractionCategories', next)
                  }}
                />
              </Field>
              <Field label="Description">
                <TextInput
                  value={cat.description}
                  onChange={(e) => {
                    const next = categories.map((c, idx) =>
                      idx === i ? { ...c, description: e.target.value } : c,
                    )
                    setValue('extractionCategories', next)
                  }}
                />
              </Field>
              <Field label="Type">
                <Select
                  value={cat.type}
                  onChange={(e) => {
                    const next = categories.map((c, idx) =>
                      idx === i
                        ? { ...c, type: e.target.value as typeof cat.type }
                        : c,
                    )
                    setValue('extractionCategories', next)
                  }}
                >
                  <option value="text">text</option>
                  <option value="number">number</option>
                  <option value="boolean">boolean</option>
                  <option value="enum">enum</option>
                </Select>
              </Field>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
