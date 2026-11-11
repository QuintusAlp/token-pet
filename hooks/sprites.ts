// The creature's seven forms, 12x10 pixels each, and the drawing of one
// animation frame into a terminal cell grid (two pixels per cell, using the
// upper-half block with foreground = top pixel, background = bottom pixel).

export type Stage = {
  name: string
  /** Total tokens eaten to reach this form. */
  at: number
  /** Accent color for the name and bar. */
  color: string
  palette: Record<string, number>
  rows: readonly string[]
  /** Rows swapped in on alternate frames while it eats. */
  chomp?: Readonly<Record<number, string>>
  /** An egg wobbles instead of bobbing. */
  isEgg?: boolean
}

const K = 0x1b1b2f // outline
const W = 0xffffff
const E = 0x101018 // pupils
const CREAM = 0xf3e9d2
const CREAM_SHADE = 0xcbb994
const SPOT = 0x4fb3a9
const GOLD = 0xffd166

const eggPalette = { K, C: CREAM, A: CREAM_SHADE, D: SPOT }

export const STAGES: readonly Stage[] = [
  {
    name: 'Egg',
    at: 0,
    color: '#f3e9d2',
    isEgg: true,
    palette: eggPalette,
    rows: [
      '....KKKK....',
      '...KCCCCK...',
      '..KCCDDCCK..',
      '..KCCDDCCK..',
      '.KCDCCCCCAK.',
      '.KCDCCCCDAK.',
      '.KCCCCCCDAK.',
      '.KACCCCCCAK.',
      '..KAACCAAK..',
      '...KKKKKK...',
    ],
  },
  {
    name: 'Cracked Egg',
    at: 30_000,
    color: '#ffd166',
    isEgg: true,
    palette: { ...eggPalette, N: 0x2a2340, Y: GOLD },
    rows: [
      '....KKKK....',
      '...KCCCCK...',
      '..KCCDDCCK..',
      '.KCKCKKCKCK.',
      '.KNYNNNNYNK.',
      '.KCKNKKNKCK.',
      '.KCCKCCKCAK.',
      '.KACCCCCDAK.',
      '..KAACCAAK..',
      '...KKKKKK...',
    ],
  },
  {
    name: 'Tokling',
    at: 150_000,
    color: '#7ee0b5',
    palette: { K, W, E, A: 0x7ee0b5, B: 0xff8fab, Y: GOLD, C: CREAM, D: SPOT, R: 0xc9184a },
    rows: [
      '.....YY.....',
      '.....KK.....',
      '...KKKKKK...',
      '..KAAAAAAK..',
      '.KAWEAAWEAK.',
      '.KAEEAAEEAK.',
      '.KBAAKKAABK.',
      'KCKAAAAAAKCK',
      'KCCKKKKKKCCK',
      '.KKCCDDCCKK.',
    ],
    chomp: { 6: '.KBAKRRKABK.' },
  },
  {
    name: 'Muncher',
    at: 600_000,
    color: '#4cc9f0',
    palette: { K, W, E, Y: GOLD, A: 0x4cc9f0, B: 0xff8fab, C: 0xbdeeff, R: 0xc9184a },
    rows: [
      '.Y........Y.',
      '..K......K..',
      '.KKKKKKKKKK.',
      'KAAAAAAAAAAK',
      'KAWEAAAAWEAK',
      'KAEEAAAAEEAK',
      'KBKKKKKKKKBK',
      'KAKRWRRWRKAK',
      '.KAKKKKKKAK.',
      '..KAK..KAK..',
    ],
    chomp: {
      6: 'KBAAAAAAAABK',
      7: 'KAKKKKKKKKAK',
      8: '.KACCCCCCAK.',
    },
  },
  {
    name: 'Chomper',
    at: 2_000_000,
    color: '#b57bff',
    palette: { K, W, E, A: 0x9d4edd, B: 0x6a2c99, C: 0xd0a8ff, H: 0xe9d8a6, Y: 0xffd60a },
    rows: [
      'KK........KK',
      'KHK......KHK',
      '.KHKKKKKKHK.',
      '.KAAAAAAAAK.',
      'KAYEAAAAYEAK',
      'KABBAAAABBAK',
      'KKWKWKKWKWKK',
      'KAKKKKKKKKAK',
      '.KACCCCCCAK.',
      '..KAK..KAK..',
    ],
    chomp: {
      6: 'KAKKKKKKKKAK',
      7: 'KAAAAAAAAAAK',
    },
  },
  {
    name: 'Tokendrake',
    at: 6_000_000,
    color: '#f3722c',
    palette: { K, W, E, A: 0xf3722c, G: 0x43aa8b, C: 0xffd8a8, H: 0xfff3b0 },
    rows: [
      '...KK..KK...',
      'K..KHKKHK..K',
      'GK.KAAAAK.KG',
      'GGKAAAAAAKGG',
      'GGKWEAAWEKGG',
      'GGKEEAAEEKGG',
      '.GKAKWWKAKG.',
      '..KACCCCAK..',
      '..KACCCCAKAK',
      '..KAK..KAK.K',
    ],
    chomp: { 6: '.GKAKKKKAKG.' },
  },
  {
    name: 'Cosmic Glutton',
    at: 15_000_000,
    color: '#72efdd',
    palette: { K, W, Y: GOLD, A: 0x3a0ca3, S: 0xffffff, L: 0x72efdd },
    rows: [
      '..Y.YYYY.Y..',
      '...YYYYYY...',
      '..KKKKKKKK..',
      '.KASAAAAAAK.',
      '.KLLAAAALLK.',
      '.KAAAAAASAK.',
      '.KAAKLLKAAK.',
      'KASAAAAAAAAK',
      '.KAKAKKAKAK.',
      '..K.K..K.K..',
    ],
    chomp: { 6: '.KAAAKKAAAK.' },
  },
]

export function stageIndexFor(tokens: number): number {
  let index = 0
  STAGES.forEach((stage, i) => {
    if (tokens >= stage.at) index = i
  })
  return index
}

/** The canvas the sprite moves in: 14x10 pixels, 14 columns by 5 rows. */
export const COLUMNS = 14
export const ROWS = 5
const WIDTH = COLUMNS
const HEIGHT = ROWS * 2
const NONE = -1

export type FrameMood = {
  frame: number
  /** A model turn is running or it ate in the last few seconds. */
  isEating: boolean
  /** It evolved a moment ago: flash. */
  isEvolving: boolean
}

/** One animation frame as a grid of 0xRRGGBB pixels, NONE for transparent. */
export function framePixels(stageIndex: number, mood: FrameMood): number[] {
  const stage = STAGES[stageIndex] ?? STAGES[0]!
  const { frame, isEating, isEvolving } = mood
  const px = new Array<number>(WIDTH * HEIGHT).fill(NONE)
  const put = (x: number, y: number, color: number) => {
    if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) px[y * WIDTH + x] = color
  }

  // The canvas is as tall as the sprite, so it moves sideways: an egg
  // wobbles (constantly while eating, now and then otherwise), a creature
  // shuffles from foot to foot.
  let dx = 1
  if (stage.isEgg) {
    const wobble = [0, 1, 0, -1]
    if (isEating || frame % 16 < 4) dx += wobble[frame % 4]!
  } else if (!isEating) {
    dx += frame % 8 < 4 ? 0 : 1
  }

  const isChomping = isEating && !stage.isEgg && frame % 2 === 0
  const flash = isEvolving && frame % 2 === 0

  stage.rows.forEach((row, y) => {
    const line = (isChomping && stage.chomp?.[y]) || row
    for (let x = 0; x < line.length; x++) {
      const key = line[x]!
      if (key === '.') continue
      const color = stage.palette[key]
      if (color === undefined) continue
      put(x + dx, y, flash ? W : color)
    }
  })

  // Tokens drifting in to be eaten, from both sides toward the mouth.
  if (isEating) {
    const t = frame % 3
    const mouthY = stage.isEgg ? 5 : 7
    put(t, mouthY - (t % 2), GOLD)
    put(WIDTH - 1 - t, mouthY - 2 + (t % 2), GOLD)
  }

  // Sparkles: around the cosmic form always, around anything that just evolved.
  if (stageIndex === STAGES.length - 1 || isEvolving) {
    const stars: Array<[number, number]> = [[0, 0], [13, 2], [0, 8], [13, 7], [12, 0], [0, 4]]
    stars.forEach(([x, y], i) => {
      if ((frame + i) % 3 !== 0) put(x, y, i % 2 ? 0x72efdd : W)
    })
  }

  return px
}

const DEFAULT = 0x01000000
const UPPER = 0x2580 // ▀
const LOWER = 0x2584 // ▄
const SPACE = 0x20

export type Cell = { char: string; fg: number | null; bg: number | null }

/** Folds pixel pairs into terminal cells, null meaning the terminal's default. */
export function toCells(px: readonly number[]): Cell[] {
  const cells: Cell[] = []
  for (let row = 0; row < ROWS; row++) {
    for (let x = 0; x < WIDTH; x++) {
      const top = px[row * 2 * WIDTH + x] ?? NONE
      const bottom = px[(row * 2 + 1) * WIDTH + x] ?? NONE
      if (top === NONE && bottom === NONE) cells.push({ char: ' ', fg: null, bg: null })
      else if (bottom === NONE) cells.push({ char: '▀', fg: top, bg: null })
      else if (top === NONE) cells.push({ char: '▄', fg: bottom, bg: null })
      else cells.push({ char: '▀', fg: top, bg: bottom })
    }
  }
  return cells
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function base64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    out += B64[a >> 2]
    out += B64[((a & 3) << 4) | ((b ?? 0) >> 4)]
    out += b === undefined ? '=' : B64[((b & 15) << 2) | ((c ?? 0) >> 6)]
    out += c === undefined ? '=' : B64[c & 63]
  }
  return out
}

/** A Raster's `cells`: little-endian u32 triplets [codePoint, fg, bg]. */
export function rasterCells(cells: readonly Cell[]): string {
  const bytes = new Uint8Array(cells.length * 12)
  const view = new DataView(bytes.buffer)
  cells.forEach((cell, i) => {
    const code = cell.char === '▀' ? UPPER : cell.char === '▄' ? LOWER : SPACE
    view.setUint32(i * 12, code, true)
    view.setUint32(i * 12 + 4, cell.fg ?? DEFAULT, true)
    view.setUint32(i * 12 + 8, cell.bg ?? DEFAULT, true)
  })
  return base64(bytes)
}

export function hex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0')
}
