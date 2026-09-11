import { Controller, useFormContext, useWatch } from 'react-hook-form'

import { Field } from '@/components/ui/field'
import type { AgentCreate } from '@/types'

import { RangeRow, Section } from '../Section'

export function EngineTab() {
  const { register, control } = useFormContext<AgentCreate>()
  const repromptOn = useWatch({ control, name: 'botInactivityEnabled' })

  return (
    <div className="space-y-4">
      <Section title="Transcription and interruptions">
        <Field
          label="Words before interrupting"
          hint="Fixed at 3 words for now. BotCompose handles barge-in via the STT streaming pipeline."
        >
          <p className="text-sm text-text">3 words</p>
        </Field>
      </Section>

      <Section title="Call management">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('botInactivityEnabled')} />
          Bot re-prompt after silence
        </label>
        {repromptOn ? (
          <Field
            label="Bot re-prompt after silence (s)"
            hint="Maps to IraVoice call_params bot_inactivity_limit — drops the call if the bot sends no audio for this duration."
          >
            <Controller
              control={control}
              name="botInactivityLimitSec"
              render={({ field }) => (
                <RangeRow
                  min={3}
                  max={60}
                  step={1}
                  value={Number(field.value)}
                  onChange={field.onChange}
                />
              )}
            />
          </Field>
        ) : null}
        <Field
          label="Total call timeout (s)"
          hint="Maps to IraVoice makecall dial_timeout."
        >
          <Controller
            control={control}
            name="totalCallTimeoutSec"
            render={({ field }) => (
              <RangeRow
                min={30}
                max={900}
                step={10}
                value={Number(field.value)}
                onChange={field.onChange}
              />
            )}
          />
        </Field>
      </Section>
    </div>
  )
}
