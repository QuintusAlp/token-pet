import { expect, test } from 'claude-code/testing'

import { STAGES, stageIndexFor } from '../hooks/sprites'

const BAND = {
  plugin: 'token-pet',
  component: 'AbovePrompt',
  requestId: 'above-prompt',
  viewport: { columns: 120, rows: 40, isFullscreen: false },
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 20,
    scroll: { offset: 0, bodyRows: 20 },
  },
} as const

const fed = (tokens: number) => ({
  input: 0,
  output: 0,
  cacheRead: tokens,
  cacheWrite: 0,
  requests: 7,
  lastFedAt: 0,
  evolvedAt: 0,
})

test('every sprite is 12x10 and uses only its own palette', async () => {
  for (const stage of STAGES) {
    expect(stage.rows.length).toBe(10)
    for (const row of [...stage.rows, ...Object.values(stage.chomp ?? {})]) {
      expect(row.length).toBe(12)
      for (const key of row) if (key !== '.') expect(stage.palette[key] !== undefined).toBe(true)
    }
  }
  expect(stageIndexFor(0)).toBe(0)
  expect(stageIndexFor(700_000)).toBe(3)
  expect(stageIndexFor(1e9)).toBe(STAGES.length - 1)
})

test('a fresh conversation shows an egg in the band', async ($, on) => {
  on('clock.now', () => ({ value: 1_000_000 }))
  on('session.usage', () => ({ value: { startedAt: 0, context: {}, rateLimits: [], cost: { usd: 0.12 } } }))
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /^EGG$/ }))?.text).toBe('EGG')
    expect((await ui.find({ type: 'Text', text: /waiting for tokens/ }))?.text).toBe('waiting for tokens')
    await ui.unmount()
  }
})

test('enough tokens grow it into a Muncher, fullscreen too', async ($, on) => {
  on('clock.now', () => ({ value: 1_000_000 }))
  on('session.usage', () => ({ value: { startedAt: 0, context: {}, rateLimits: [] } }))
  on('state.get', (_, e) =>
    e.key === 'isHidden'
      ? { value: { value: false, version: 1 } }
      : { value: { value: fed(700_000), version: 1 } },
  )
  const ui = await $.ui.mount({
    ...BAND,
    viewport: { columns: 160, rows: 40, isFullscreen: true },
    surface: 'terminal',
  })
  expect((await ui.find({ type: 'Text', text: /^MUNCHER$/ }))?.text).toBe('MUNCHER')
  expect((await ui.find({ type: 'Text', text: /^700k$/ }))?.text).toBe('700k')
  await ui.unmount()
})

test('a band too short for the pet steps aside', async ($, on) => {
  on('clock.now', () => ({ value: 1_000_000 }))
  on('session.usage', () => ({ value: { startedAt: 0, context: {}, rateLimits: [] } }))
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, maxRows: 3 }, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /EGG/ })) == null).toBe(true)
  await ui.unmount()
})
