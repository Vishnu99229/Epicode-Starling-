import { useFormContext, useWatch } from 'react-hook-form'

import { Field, TextInput } from '@/components/ui/field'
import { DAYS } from '@/lib/agent-options'
import type { AgentCreate } from '@/types'

import { Section } from '../Section'

export function CallingTab() {
  const { register, setValue, control } = useFormContext<AgentCreate>()
  const outboundOn = useWatch({ control, name: 'outboundTimingEnabled' })
  const days = useWatch({ control, name: 'outboundDaysOfWeek' }) ?? []
  const vmOn = useWatch({ control, name: 'voicemailDetectionEnabled' })

  return (
    <div className="space-y-4">
      <Section title="Telephony">
        <Field label="Telephony provider">
          <input type="hidden" {...register('telephonyProvider')} />
          <div className="w-full rounded-md border border-line bg-ground px-2.5 py-1.5 text-sm text-text">
            Epicode
          </div>
        </Field>
      </Section>

      <Section title="Voicemail">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('voicemailDetectionEnabled')} />
          Voicemail detection
        </label>
        {vmOn ? (
          <Field label="Seconds">
            <TextInput type="number" min={0} {...register('voicemailDetectionSec')} />
          </Field>
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('autoReschedule')} />
          Auto reschedule
        </label>
      </Section>

      <Section title="Inbound calling">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('inboundCallingEnabled')} />
          Enable inbound calling
        </label>
      </Section>

      <Section title="Outbound call timing restrictions">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('outboundTimingEnabled')} />
          Restrict outbound hours
        </label>
        {outboundOn ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Start">
              <TextInput type="time" {...register('outboundTimingStart')} />
            </Field>
            <Field label="End">
              <TextInput type="time" {...register('outboundTimingEnd')} />
            </Field>
            <div className="sm:col-span-2">
              <p className="mb-2 text-sm">Days of week</p>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => (
                  <label key={d.value} className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={days.includes(d.value)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...days, d.value]
                          : days.filter((x) => x !== d.value)
                        setValue('outboundDaysOfWeek', next)
                      }}
                    />
                    {d.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </Section>
    </div>
  )
}
