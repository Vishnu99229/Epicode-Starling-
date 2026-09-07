import { useState } from 'react'
import { Controller, useFormContext, useWatch } from 'react-hook-form'

import { Field, Select, TextArea } from '@/components/ui/field'
import type { AgentCreate } from '@/types'

import { RangeRow, Section } from '../Section'

const RATE_HELP: Record<string, string> = {
  rapid: 'Lowest latency. May interrupt more often.',
  balanced: 'Default tradeoff between speed and accuracy.',
  patient: 'Waits longer for the caller. Better for digit strings and KYC.',
}

export function EngineTab() {
  const { register, control } = useFormContext<AgentCreate>()
  const rate = useWatch({ control, name: 'responseRate' })
  const onlineOn = useWatch({ control, name: 'userOnlineDetectionEnabled' })
  const hangupOn = useWatch({ control, name: 'hangupOnSilenceEnabled' })
  const repromptOn = useWatch({ control, name: 'botInactivityEnabled' })
  const [onlineLang, setOnlineLang] = useState<'en' | 'hi'>('en')
  const [finalLang, setFinalLang] = useState<'en' | 'hi'>('en')

  return (
    <div className="space-y-4">
      <Section title="Response latency">
        <Field label="Response rate" hint={RATE_HELP[rate] ?? RATE_HELP.balanced}>
          <Select {...register('responseRate')}>
            <option value="rapid">Rapid</option>
            <option value="balanced">Balanced</option>
            <option value="patient">Patient</option>
          </Select>
        </Field>
      </Section>

      <Section title="Transcription and interruptions">
        <Field label="Number of words to wait before interrupting">
          <Controller
            control={control}
            name="interruptWordCount"
            render={({ field }) => (
              <RangeRow
                min={0}
                max={10}
                step={1}
                value={Number(field.value)}
                onChange={field.onChange}
              />
            )}
          />
        </Field>
      </Section>

      <Section title="User online detection">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('userOnlineDetectionEnabled')} />
          Enable
        </label>
        {onlineOn ? (
          <>
            <div className="flex gap-2">
              {(['en', 'hi'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  className={
                    onlineLang === lang
                      ? 'border border-line px-2 py-0.5 text-xs text-text'
                      : 'px-2 py-0.5 text-xs text-muted'
                  }
                  onClick={() => setOnlineLang(lang)}
                >
                  {lang === 'en' ? 'English' : 'Hindi'}
                </button>
              ))}
            </div>
            <Field label="Message">
              <TextArea rows={3} {...register(`userOnlineMessages.${onlineLang}`)} />
            </Field>
            <Field label="Invoke message after (s)">
              <Controller
                control={control}
                name="userOnlineInvokeAfterSec"
                render={({ field }) => (
                  <RangeRow
                    min={1}
                    max={30}
                    step={1}
                    value={Number(field.value)}
                    onChange={field.onChange}
                  />
                )}
              />
            </Field>
          </>
        ) : null}
      </Section>

      <Section title="Final call message">
        <div className="flex gap-2">
          {(['en', 'hi'] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              className={
                finalLang === lang
                  ? 'border border-line px-2 py-0.5 text-xs text-text'
                  : 'px-2 py-0.5 text-xs text-muted'
              }
              onClick={() => setFinalLang(lang)}
            >
              {lang === 'en' ? 'English' : 'Hindi'}
            </button>
          ))}
        </div>
        <Field label="Message">
          <TextArea rows={3} {...register(`finalCallMessages.${finalLang}`)} />
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
            hint="Unprompted bot turn when the caller goes idle. Does not end the call."
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
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('hangupOnSilenceEnabled')} />
          Hangup on user silence
        </label>
        {hangupOn ? (
          <Field label="Hangup on user silence (s)">
            <Controller
              control={control}
              name="hangupOnSilenceSec"
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
        <Field label="Total call timeout (s)">
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
