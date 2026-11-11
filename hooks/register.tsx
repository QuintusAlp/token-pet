import { atom, read, update } from 'claude-code'
import type {
  EngineInterface,
  ModelUsage,
  Register,
  RenderElement,
  RenderInput,
} from 'claude-code'

import type { Feed } from '../types'
import {
  COLUMNS,
  ROWS,
  STAGES,
  framePixels,
  hex,
  rasterCells,
  stageIndexFor,
  toCells,
} from './sprites'
import type { Cell } from './sprites'

const EMPTY: Feed = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  requests: 0,
  lastFedAt: 0,
  evolvedAt: 0,
}

const feedAtom = atom({ plugin: 'token-pet', key: 'feed' } as const, EMPTY)
const hiddenAtom = atom({ plugin: 'token-pet', key: 'isHidden' } as const, false)

const FRAME_MS = 250
const EAT_MS = 3_000
const EVOLVE_MS = 4_000
const SLEEP_MS = 10 * 60_000
const RASTER_KEY = 'pet'

export const totalOf = (f: Feed) => f.input + f.output + f.cacheRead + f.cacheWrite

export function fmt(n: number): string {
  if (n < 1_000) return String(n)
  if (n < 1_000_000) return `${(n / 1_000).toFixed(n < 10_000 ? 1 : 0)}k`
  return `${(n / 1_000_000).toFixed(2)}M`
}

/** Progress from the current form to the next, 0..1; 1 at the last form. */
export function progressOf(total: number): number {
  const i = stageIndexFor(total)
  const next = STAGES[i + 1]
  if (!next) return 1
  const from = STAGES[i]!.at
  return Math.min(1, (total - from) / (next.at - from))
}

function bar(progress: number, width: number): string {
  const filled = Math.round(progress * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

// What the animation timer needs. The module's own: a reload starts it over.
type Site = { isTerminal: boolean }
const sites = new Map<string, Site>()
let pet = { stageIndex: 0, lastFedAt: 0, evolvedAt: 0 }
let isWorking = false
let frame = 0
let isBlitting = false

function moodAt(now: number) {
  return {
    frame,
    isEating: isWorking || now - pet.lastFedAt < EAT_MS,
    isEvolving: pet.evolvedAt > 0 && now - pet.evolvedAt < EVOLVE_MS,
  }
}

/** One animation frame, painted straight into each mounted Raster. */
async function tick($: EngineInterface) {
  frame += 1
  if (isBlitting || sites.size === 0) return
  isBlitting = true
  try {
    const now = await $.clock.now()
    const cells = rasterCells(toCells(framePixels(pet.stageIndex, moodAt(now))))
    for (const [requestId, site] of sites) {
      if (site.isTerminal) await $.ui.blit({ requestId, key: RASTER_KEY, cells })
    }
  } catch {
    // Not mounted right now (collapsed, redrawing): the next frame tries again.
  } finally {
    isBlitting = false
  }
}

type Site$ = RenderInput<'AbovePrompt'>

/** The creature: a Raster on the terminal, rows of colored text elsewhere. */
function drawSprite($: EngineInterface, e: Site$, cells: readonly Cell[]): RenderElement {
  if (e.surface === 'terminal') {
    const { Raster } = $.ui.resolve(e)
    return <Raster key={RASTER_KEY} columns={COLUMNS} rows={ROWS} cells={rasterCells(cells)} />
  }
  const { Box, Text } = $.ui.resolve(e)
  const rows = []
  for (let r = 0; r < ROWS; r++) {
    const runs = []
    for (let c = 0; c < COLUMNS; c++) {
      const cell = cells[r * COLUMNS + c]!
      runs.push(
        <Text
          color={cell.fg === null ? undefined : hex(cell.fg)}
          backgroundColor={cell.bg === null ? undefined : hex(cell.bg)}
        >
          {cell.char}
        </Text>,
      )
    }
    rows.push(<Box key={`r${r}`}>{runs}</Box>)
  }
  return <Box flexDirection="column">{rows}</Box>
}

/** The band: the creature on the left, five lines of numbers beside it. */
async function drawPet($: EngineInterface, e: Site$): Promise<RenderElement> {
  const f = await read($, feedAtom)
  const now = await $.clock.now()
  const total = totalOf(f)
  const stageIndex = stageIndexFor(total)
  const stage = STAGES[stageIndex]!
  const nextStage = STAGES[stageIndex + 1]
  const progress = progressOf(total)
  pet = { stageIndex, lastFedAt: f.lastFedAt, evolvedAt: f.evolvedAt }
  sites.set(e.requestId, { isTerminal: e.surface === 'terminal' })

  const mood = moodAt(now)
  const { cost } = await $.session.usage()
  const { Box, Text } = $.ui.resolve(e)
  const sprite = drawSprite($, e, toCells(framePixels(stageIndex, mood)))

  const moodLine = mood.isEvolving
    ? `✦ evolved into a ${stage.name}!`
    : isWorking
      ? stage.isEgg
        ? 'something stirs inside…'
        : 'nom nom nom…'
      : f.lastFedAt === 0
        ? 'waiting for tokens'
        : now - f.lastFedAt > SLEEP_MS
          ? 'zzz…'
          : 'digesting'
  const toNext = nextStage
    ? `${Math.floor(progress * 100)}% → ${nextStage.name} at ${fmt(nextStage.at)}`
    : 'fully evolved'
  const money = cost ? ` · $${cost.usd.toFixed(2)}` : ''

  return (
    <Box flexDirection="row" gap={2}>
      <Box flexShrink={0}>{sprite}</Box>
      <Box flexDirection="column" flexShrink={1}>
        <Text>
          <Text color={stage.color} bold>
            {stage.name.toUpperCase()}
          </Text>
          <Text dimColor>
            {'  '}form {stageIndex + 1}/{STAGES.length}
          </Text>
        </Text>
        <Text>
          <Text color={stage.color}>{bar(progress, 14)}</Text>
          <Text dimColor> {toNext}</Text>
        </Text>
        <Text>
          <Text bold>{fmt(total)}</Text>
          <Text dimColor>
            {' '}
            tokens · {f.requests} requests{money}
          </Text>
        </Text>
        <Text dimColor>
          in {fmt(f.input)} · out {fmt(f.output)} · cache read {fmt(f.cacheRead)} · write{' '}
          {fmt(f.cacheWrite)}
        </Text>
        <Text italic color={isWorking ? stage.color : undefined} dimColor={!isWorking}>
          {moodLine}
        </Text>
      </Box>
    </Box>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    $.clock.every(FRAME_MS, () => void tick($))
    await $.command.register({ name: 'pet', description: 'Show or put away the token pet' })
    // An earlier version docked the pet in a pane: close any it left open.
    for (const pane of await $.ui.panes()) await $.ui.close({ id: pane.id })
    return next(e)
  })

  on('turn.start', ($, e, next) => {
    if (!e.agentId) isWorking = true
    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    if (!e.agentId) isWorking = false
    return next(e)
  })

  // Every model request, main loop and subagents alike, is a meal.
  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    const usage: ModelUsage | null = result.usage
    if (usage) {
      const now = await $.clock.now()
      let evolvedTo: string | null = null
      await update($, feedAtom, f => {
        const before = stageIndexFor(totalOf(f))
        const fed: Feed = {
          ...f,
          input: f.input + usage.input_tokens,
          output: f.output + usage.output_tokens,
          cacheRead: f.cacheRead + usage.cache_read_input_tokens,
          cacheWrite: f.cacheWrite + usage.cache_creation_input_tokens,
          requests: f.requests + 1,
          lastFedAt: now,
        }
        const after = stageIndexFor(totalOf(fed))
        if (after > before) {
          evolvedTo = STAGES[after]!.name
          return { ...fed, evolvedAt: now }
        }
        return fed
      })
      if (evolvedTo) $.ui.toast(`✦ Your token pet evolved into a ${evolvedTo}!`)
    }
    return result
  })

  // /clear starts a new conversation: a new egg.
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') await update($, feedAtom, () => EMPTY)
    return next(e)
  })

  on('command.run', { command: 'pet' }, async $ => {
    if (await read($, hiddenAtom)) {
      await update($, hiddenAtom, () => false)
      return { text: 'Your token pet is back.' }
    }
    await update($, hiddenAtom, () => true)
    return { text: 'Token pet put away. /pet brings it back.' }
  })

  // Always the band above the prompt.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const stepAside = () => {
      sites.delete(e.requestId)
      return next(e)
    }
    if (e.props.hasSurvey || (await read($, hiddenAtom))) return stepAside()

    if (e.props.maxRows < ROWS) return stepAside()
    return drawPet($, e)
  })
}
