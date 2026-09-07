import { Controller, useFormContext, useWatch } from 'react-hook-form'

import { Field, TextArea } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import type { AgentCreate } from '@/types'

import { RangeRow, Section } from '../Section'

export function AgentTab() {
  const { register, control, formState } = useFormContext<AgentCreate>()
  const instructions = useWatch({ control, name: 'instructions' }) ?? ''
  const delayMs = useWatch({ control, name: 'welcomeDelayMs' }) ?? 0
  const tokens = Math.max(1, Math.ceil(instructions.length / 4))

  return (
    <div className="space-y-4">
      <Section title="Welcome">
        <Field
          label="Welcome message"
          hint="Define variables using {variable_name}"
          error={formState.errors.welcomeMessage?.message}
        >
          <TextArea rows={4} {...register('welcomeMessage')} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('ignoreSpeechBeforeWelcome')} />
          Ignore user speech before welcome message
        </label>
        <Field label="Welcome message delay (ms)">
          <Controller
            control={control}
            name="welcomeDelayMs"
            render={({ field }) => (
              <RangeRow
                min={0}
                max={5000}
                step={50}
                value={Number(field.value)}
                onChange={field.onChange}
              />
            )}
          />
        </Field>
      </Section>

      <Section title="Prompt canvas">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            /* stub: module browser */
          }}
        >
          Browse modules
        </Button>
        <p className="text-xs text-muted">Type {'{{'} for variables, @ for modules/functions</p>
        <div className="relative">
          <TextArea
            rows={18}
            className="min-h-72 pb-7 font-mono text-[13px] leading-relaxed"
            {...register('instructions')}
          />
          <span className="metric pointer-events-none absolute bottom-2 right-2 text-xs text-muted">
            {tokens} tokens · {delayMs} ms delay
          </span>
        </div>
        {formState.errors.instructions?.message ? (
          <p className="text-xs text-fail">{formState.errors.instructions.message}</p>
        ) : null}
      </Section>
    </div>
  )
}
