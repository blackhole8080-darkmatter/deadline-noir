import type { SuspectId, ViewId } from '../deadline/story'
import { drawArms, drawBody, line, SEATED, type Place } from './figure'
import {
  AMBER,
  box,
  clock,
  ctx,
  dust,
  glow,
  H,
  INK,
  layer,
  pointer,
  poly,
  RED,
  W,
  type Light,
  type Rect,
} from './stage'

/**
 * The five places you can stand, drawn as silhouette noir.
 *
 * A room is black shapes, a few surfaces that catch light, and the lights
 * themselves. Evidence is the exception: the things worth examining are drawn
 * pale or in colour, so a sweep of the torch finds them. Each room is built in
 * layers that slide against the torch, which is all the depth there is.
 *
 * `spots` are the hit areas for the things story.ts says can be examined here,
 * keyed by the same ids, in this file's 1280x720 coordinates.
 */

export type Room = {
  caption: string
  /** How dark the room is away from its lights, 0..1. */
  darkness: number
  lights: Light[]
  figure?: { who: SuspectId; place: Place }
  spots: Record<string, Rect>
  draw: (flash: number) => void
}

const OUTLINE = '#07080d'
const SHADE = 'rgba(14,10,34,0.40)'
const COLD = '150,176,235'

// ---- pieces shared between rooms ------------------------------------------------------

function wall(top: string, mid: string, bottom: string): void {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, top)
  g.addColorStop(0.55, mid)
  g.addColorStop(1, bottom)
  box(g, -60, -60, W + 120, H + 120)
}

function floor(y: number, near = '#030407', far = '#0c0f1b'): void {
  const g = ctx.createLinearGradient(0, y, 0, H)
  g.addColorStop(0, far)
  g.addColorStop(1, near)
  box(g, -80, y, W + 160, H)
}

function ell(cx: number, cy: number, rx: number, ry: number, fill: string, rot = 0, inked = false): void {
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
  if (inked) {
    ctx.strokeStyle = OUTLINE
    ctx.lineWidth = 2.4
    ctx.stroke()
  }
}

/** A window at night: the city out of focus, rain, and blinds if it has them. */
function rainWindow(r: Rect, flash: number, blinds: boolean): void {
  const { x, y, w, h } = r
  const time = clock.time
  const sky = ctx.createLinearGradient(0, y, 0, y + h)
  sky.addColorStop(0, flash > 0 ? '#cfdcff' : '#2c3c63')
  sky.addColorStop(1, flash > 0 ? '#7f93c9' : '#111829')
  box(sky, x, y, w, h)

  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  for (let i = 0; i < 16; i++) {
    const seed = (i * 2654435761 + x * 13) % 1000
    const bx = x + (seed % w)
    const by = y + h * 0.45 + ((seed * 7) % (h * 0.5))
    const flicker = 0.55 + Math.sin(time * 0.6 + i) * 0.12
    glow(bx, by, (6 + (seed % 14)) * 2.2, i % 3 === 0 ? '#7fa2e8' : '#f0b56a', 0.32 * flicker)
  }
  ctx.strokeStyle = 'rgba(210,222,255,0.30)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  for (let i = 0; i < Math.floor(w / 6); i++) {
    const seed = (i * 1597334677 + x * 7) % 997
    const rx = x + (seed % w)
    const ry = y + ((seed * 3 + time * (260 + (seed % 180))) % (h + 40)) - 20
    ctx.moveTo(rx, ry)
    ctx.lineTo(rx - 3, ry + 18)
  }
  ctx.stroke()
  ctx.restore()

  ctx.fillStyle = INK
  if (blinds) for (let sy = y; sy < y + h; sy += 17) ctx.fillRect(x - 4, sy, w + 8, 9.5)
  ctx.fillRect(x - 10, y - 10, w + 20, 10)
  ctx.fillRect(x - 10, y + h, w + 20, 12)
  ctx.fillRect(x - 10, y - 10, 10, h + 22)
  ctx.fillRect(x + w, y - 10, 10, h + 22)
  ctx.fillRect(x + w * 0.5 - 2, y, 4, h)
  if (!blinds) ctx.fillRect(x, y + h * 0.5 - 2, w, 4)
}

/** What blinds throw across a wall: slanted bars of cold light. */
function blindLight(r: Rect, flash: number): void {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.beginPath()
  ctx.rect(-60, 0, W + 120, 560)
  ctx.clip()
  for (let i = 0; i < Math.floor(r.h / 17); i++) {
    const sy = r.y + 9.5 + i * 17
    const g = ctx.createLinearGradient(r.x, sy, r.x - 620, sy + 250)
    g.addColorStop(0, `rgba(${COLD},${0.16 + flash * 0.4})`)
    g.addColorStop(1, `rgba(${COLD},0)`)
    poly(
      [
        [r.x, sy],
        [r.x, sy + 7.5],
        [r.x - 620, sy + 264],
        [r.x - 620, sy + 250],
      ],
      g,
    )
  }
  ctx.restore()
}

/** A banker's lamp standing on `base`, with its halo. `k` shrinks it for distance. */
function lamp(x: number, base: number, k = 1): void {
  glow(x, base - 12 * k, 300 * k, AMBER, 0.34)
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.ellipse(x, base, 44 * k, 8 * k, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillRect(x - 4 * k, base - 86 * k, 8 * k, 86 * k)
  ctx.beginPath()
  ctx.moveTo(x - 60 * k, base - 80 * k)
  ctx.quadraticCurveTo(x, base - 136 * k, x + 60 * k, base - 80 * k)
  ctx.closePath()
  ctx.fill()
  box('rgba(255,217,160,0.95)', x - 54 * k, base - 80 * k, 108 * k, 3 * k)
  glow(x, base - 74 * k, 60 * k, '#ffd9a0', 0.85)
}

/** The warm pool a lamp leaves on a desk top. */
function lampPool(x: number, y: number, top: [number, number][]): void {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.beginPath()
  top.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)))
  ctx.closePath()
  ctx.clip()
  ctx.translate(x, y)
  ctx.scale(1, 0.34)
  const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, 230)
  pool.addColorStop(0, 'rgba(255,217,160,0.50)')
  pool.addColorStop(1, 'rgba(255,217,160,0)')
  ctx.fillStyle = pool
  ctx.fillRect(-300, -300, 600, 600)
  ctx.restore()
}

const DESK_TOP: [number, number][] = [
  [252, 500],
  [948, 500],
  [1016, 566],
  [168, 566],
]

/**
 * The desk a seated suspect is questioned across. The figure rig places its
 * hands on this surface, so both interview rooms share it exactly.
 */
function interviewDesk(items: () => void): void {
  floor(556)
  const top = ctx.createLinearGradient(0, 500, 0, 566)
  top.addColorStop(0, '#1a2136')
  top.addColorStop(1, '#0b0e19')
  poly(DESK_TOP, top)
  box(INK, 168, 566, 848, 220)
  box('rgba(230,163,76,0.22)', 168, 566, 848, 1.5)
  lampPool(372, 530, DESK_TOP)
  lamp(372, 532)
  items()
}

/** A framed front page. */
function frontPage(fx: number, fy: number): void {
  box(INK, fx, fy, 66, 92)
  box('#1b2338', fx + 6, fy + 6, 54, 80)
  ctx.fillStyle = 'rgba(233,228,214,0.16)'
  ctx.fillRect(fx + 12, fy + 14, 42, 9)
  ctx.fillRect(fx + 12, fy + 30, 30, 2)
  ctx.fillRect(fx + 12, fy + 37, 38, 2)
  ctx.fillRect(fx + 12, fy + 48, 42, 26)
}

function wallClock(cx: number, cy: number, r: number): void {
  ell(cx, cy, r + 4, r + 4, INK)
  ell(cx, cy, r, r, '#bdb8a8')
  line([[cx, cy], [cx - r * 0.18, cy - r * 0.62]], INK, r * 0.12)
  line([[cx, cy], [cx + r * 0.72, cy + r * 0.08]], INK, r * 0.09)
}

/** Text with real letter-spacing, centred, for signs and door glass. */
function sign(text: string, cx: number, y: number, size: number, gap: number, fill: string): void {
  ctx.font = `600 ${size}px "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif`
  ctx.textBaseline = 'middle'
  const widths = [...text].map((ch) => ctx.measureText(ch).width)
  let x = cx - (widths.reduce((a, b) => a + b, 0) + gap * (text.length - 1)) / 2
  ctx.fillStyle = fill
  ;[...text].forEach((ch, i) => {
    ctx.fillText(ch, x, y)
    x += widths[i]! + gap
  })
}

/** Paper pinned to something: a pale sheet, a few lines, a pin. */
function note(x: number, y: number, w: number, h: number, tilt: number): void {
  ctx.save()
  ctx.translate(x + w / 2, y + h / 2)
  ctx.rotate(tilt)
  box('rgba(233,228,214,0.82)', -w / 2, -h / 2, w, h)
  ctx.fillStyle = 'rgba(5,6,10,0.4)'
  for (let i = 0; i < Math.floor(h / 12) - 1; i++) ctx.fillRect(-w / 2 + 6, -h / 2 + 10 + i * 10, w - 12 - ((i * 11) % 14), 1.6)
  ell(0, -h / 2 + 4, 2.6, 2.6, AMBER)
  ctx.restore()
}

// ---- the lobby -----------------------------------------------------------------------

const LOBBY_WINDOW: Rect = { x: 930, y: 110, w: 290, h: 420 }
const CRANE_PLACE: Place = { x: 300, y: 60, s: 1.08, standing: true }

function lobby(flash: number): void {
  layer(8, () => {
    wall('#1b2236', '#27324f', '#121829')
    floor(560, '#05060a', '#1a2135')
    // The floor is polished: it keeps a little of the ceiling light.
    const shine = ctx.createLinearGradient(0, 560, 0, H)
    shine.addColorStop(0, 'rgba(230,163,76,0.12)')
    shine.addColorStop(1, 'rgba(230,163,76,0)')
    poly(
      [
        [300, 560],
        [700, 560],
        [860, H],
        [140, H],
      ],
      shine,
    )

    // The paper's name in brass, and the clock every alibi is measured by.
    box('rgba(4,5,9,0.5)', 220, 132, 420, 64)
    sign('CITY LEDGER', 430, 165, 36, 12, '#e2b354')
    box('#a8802f', 250, 198, 360, 2)
    wallClock(430, 262, 28)
    frontPage(240, 226)
    frontPage(554, 226)

    // The stairs up. Nothing above the lobby is lit.
    box('#06070c', 690, 180, 150, 380)
    box(INK, 682, 172, 166, 8)
    for (let i = 0; i < 9; i++) {
      box(`rgba(${COLD},${0.16 - i * 0.014})`, 700 + i * 4, 544 - i * 26, 130 - i * 8, 3)
    }
    line([[826, 300], [826, 556]], `rgba(${COLD},0.25)`, 2)

    // A pendant lamp over reception.
    box(INK, 498, -20, 4, 96)
    poly(
      [
        [450, 96],
        [550, 96],
        [526, 70],
        [474, 70],
      ],
      INK,
    )
    box('rgba(255,217,160,0.95)', 456, 96, 88, 3)
    glow(500, 110, 260, '#ffd9a0', 0.4)
  })

  layer(10, () => {
    rainWindow(LOBBY_WINDOW, flash, false)
    // What the window lays on the floor.
    poly(
      [
        [930, 560],
        [1220, 560],
        [1100, H],
        [700, H],
      ],
      `rgba(${COLD},${0.06 + flash * 0.3})`,
    )
  })

  layer(26, () => {
    drawBody()
    drawArms()
  })

  layer(36, () => {
    // Reception: a long desk, the night book, a bell nobody rang.
    const top: [number, number][] = [
      [-80, 470],
      [520, 470],
      [596, 540],
      [-80, 540],
    ]
    const g = ctx.createLinearGradient(0, 470, 0, 540)
    g.addColorStop(0, '#222b45')
    g.addColorStop(1, '#0e1220')
    poly(top, g)
    box(INK, -80, 540, 676, 260)
    box('rgba(230,163,76,0.25)', -80, 540, 676, 1.5)
    for (const x of [60, 250, 440]) box('rgba(255,255,255,0.03)', x, 560, 150, 130)
    lampPool(430, 500, top)
    lamp(430, 502, 0.85)

    // The visitor log, open at tonight.
    poly(
      [
        [246, 490],
        [300, 486],
        [304, 516],
        [240, 520],
      ],
      'rgba(233,228,214,0.92)',
    )
    poly(
      [
        [300, 486],
        [356, 490],
        [362, 520],
        [304, 516],
      ],
      'rgba(233,228,214,0.80)',
    )
    line([[300, 486], [304, 516]], OUTLINE, 2)
    ctx.fillStyle = 'rgba(5,6,10,0.5)'
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(254, 496 + i * 6, 38, 1.4)
      ctx.fillRect(312, 496 + i * 6, 40, 1.4)
    }
    line([[376, 512], [412, 506]], OUTLINE, 3)
    ell(120, 494, 16, 9, '#b8892a')
    ell(120, 486, 4, 4, '#e2b354')
    // His phone, left charging on the desk, screen still lit.
    poly(
      [
        [170, 496],
        [206, 494],
        [210, 514],
        [172, 516],
      ],
      INK,
    )
    poly(
      [
        [175, 499],
        [202, 497],
        [205, 511],
        [177, 513],
      ],
      '#6f8fd0',
    )
    glow(190, 505, 46, '#6f8fd0', 0.35)
    line([[210, 506], [232, 512], [240, 540]], OUTLINE, 2)
  })

  layer(20, () => dust(500, 300, 'rgba(255,217,160,ALPHA)', 26))
}

// ---- the newsroom --------------------------------------------------------------------

function newsroom(flash: number): void {
  layer(8, () => {
    wall('#0f1424', '#182036', '#0a0d18')
    floor(520)
    for (const x of [250, 545, 840]) rainWindow({ x, y: 130, w: 190, h: 210 }, flash, false)
    wallClock(492, 96, 18)
    // Strip lights, off for the night.
    box('rgba(120,140,190,0.10)', 290, 54, 250, 7)
    box('rgba(120,140,190,0.10)', 740, 54, 250, 7)
    // Cold light from the windows, lying along the floor.
    for (const x of [250, 545, 840]) {
      poly(
        [
          [x, 520],
          [x + 190, 520],
          [x + 130, H],
          [x - 160, H],
        ],
        `rgba(${COLD},${0.035 + flash * 0.25})`,
      )
    }
  })

  layer(12, () => {
    // Rows of empty desks, every monitor dark.
    for (const x of [96, 236, 846, 968]) {
      box('#141a2c', x, 430, 132, 9)
      box(INK, x + 4, 439, 124, 74)
      box(INK, x + 44, 392, 46, 32)
      box(`rgba(${COLD},0.10)`, x + 44, 392, 46, 1.5)
      box(INK, x + 63, 424, 8, 8)
    }
  })

  layer(14, () => {
    // The editor's door. The only room on the floor with its light on.
    box(INK, 1070, 160, 150, 400)
    const glass = ctx.createLinearGradient(0, 180, 0, 390)
    glass.addColorStop(0, '#f2b968')
    glass.addColorStop(1, '#a5702f')
    box(glass, 1086, 180, 118, 210)
    box(INK, 1143, 180, 4, 210)
    sign('EDITOR', 1145, 250, 17, 5, 'rgba(5,6,10,0.8)')
    glow(1145, 290, 230, AMBER, 0.4)
    box('#b8892a', 1090, 420, 6, 22)
    poly(
      [
        [1070, 560],
        [1220, 560],
        [1120, H],
        [760, H],
      ],
      'rgba(230,163,76,0.07)',
    )
  })

  layer(16, () => {
    // Sam, small and far off, at the only other desk with a lamp on.
    box('#141a2c', 40, 452, 190, 9)
    box(INK, 44, 461, 182, 80)
    lamp(176, 454, 0.5)
    box('#5b7a43', 92, 410, 40, 46)
    ell(112, 396, 13, 15, '#b0754d')
    ell(112, 386, 14, 9, '#2c1b12')
  })

  layer(24, () => {
    // Nora's desk: her lamp, her screen still awake.
    const top: [number, number][] = [
      [470, 432],
      [810, 432],
      [852, 472],
      [428, 472],
    ]
    const g = ctx.createLinearGradient(0, 432, 0, 472)
    g.addColorStop(0, '#1d2540')
    g.addColorStop(1, '#0c0f1b')
    poly(top, g)
    box(INK, 428, 472, 424, 116)
    box('rgba(230,163,76,0.22)', 428, 472, 424, 1.5)
    lampPool(520, 452, top)
    box(INK, 610, 352, 116, 78)
    box('#33426a', 617, 359, 102, 62)
    ctx.fillStyle = 'rgba(233,228,214,0.35)'
    for (let i = 0; i < 5; i++) ctx.fillRect(624, 368 + i * 9, 40 + ((i * 23) % 44), 2)
    box(INK, 660, 430, 16, 10)
    glow(668, 390, 150, '#6f8fd0', 0.25)
    lamp(520, 456, 0.7)
  })

  layer(30, () => {
    // Her chair on its side, and what is on the floor in front of the desk.
    ctx.translate(-30, -44)
    ctx.save()
    ctx.translate(900, 600)
    ctx.rotate(0.5)
    ctx.fillStyle = INK
    ctx.beginPath()
    ctx.roundRect(-40, -34, 80, 60, 12)
    ctx.fill()
    ctx.fillRect(-6, 26, 12, 40)
    ctx.restore()

    ell(756, 648, 62, 12, '#6e1820')
    ell(790, 656, 30, 6, '#6e1820')
    ell(742, 646, 22, 3, '#c8433c')
    ell(626, 634, 112, 22, '#2a3352', -0.03, true)
    ell(742, 628, 22, 17, '#3a2418', 0, true)
    ell(506, 640, 12, 7, '#e6bd9d', 0, true)
    poly(
      [
        [640, 614],
        [738, 618],
        [738, 652],
        [640, 656],
      ],
      SHADE,
    )
  })

  layer(20, () => dust(520, 400, 'rgba(255,217,160,ALPHA)', 22))
}

// ---- Nora's desk ----------------------------------------------------------------------

function noraDesk(): void {
  layer(8, () => {
    wall('#0f1424', '#1a2238', '#0b0e19')
    floor(520)
    // Pinned to the wall: eight months of the story, and the string between two names.
    box(INK, 772, 104, 416, 244)
    box('#2a1f16', 784, 116, 392, 220)
    note(800, 132, 86, 104, -0.05)
    note(904, 126, 104, 66, 0.03)
    note(1026, 138, 74, 96, 0.06)
    note(1110, 128, 56, 70, -0.04)
    note(904, 208, 92, 104, -0.02)
    note(1014, 250, 70, 70, 0.05)
    note(1098, 214, 68, 104, 0.02)
    note(808, 250, 78, 70, 0.04)
    line([[843, 136], [956, 130], [1063, 142], [1132, 218]], RED, 1.6)
  })

  layer(20, () => {
    // Her desk fills the left of frame.
    const top: [number, number][] = [
      [-80, 440],
      [700, 440],
      [772, 512],
      [-80, 512],
    ]
    const g = ctx.createLinearGradient(0, 440, 0, 512)
    g.addColorStop(0, '#1d2540')
    g.addColorStop(1, '#0c0f1b')
    poly(top, g)
    box(INK, -80, 512, 852, 300)
    box('rgba(230,163,76,0.22)', -80, 512, 852, 1.5)
    lampPool(650, 480, top)

    // Her screen, still awake.
    ctx.fillStyle = INK
    ctx.beginPath()
    ctx.roundRect(190, 140, 390, 280, 10)
    ctx.fill()
    box('#26324f', 204, 154, 362, 246)
    ctx.fillStyle = 'rgba(233,228,214,0.30)'
    for (let i = 0; i < 8; i++) ctx.fillRect(224, 176 + i * 18, 110 + ((i * 53) % 170), 3)
    // The print queue: one job, still listed.
    box('#0f1524', 224, 326, 322, 58)
    box('rgba(230,163,76,0.95)', 238, 340, 230, 3)
    box('rgba(255,217,160,0.95)', 238, 354, 170, 3)
    box('rgba(230,163,76,0.95)', 238, 368, 270, 3)
    glow(385, 280, 320, '#6f8fd0', 0.26)
    box(INK, 360, 420, 50, 24)
    box(INK, 320, 440, 130, 6)

    // Keyboard, a mug gone cold, her notebook.
    poly(
      [
        [250, 458],
        [520, 458],
        [536, 490],
        [240, 490],
      ],
      '#090c15',
    )
    ctx.fillStyle = `rgba(${COLD},0.14)`
    for (let r = 0; r < 3; r++) for (let i = 0; i < 16; i++) ctx.fillRect(258 + i * 16 - r * 2, 464 + r * 8, 10, 3)
    box(INK, 92, 400, 44, 50)
    box('rgba(233,228,214,0.5)', 92, 400, 44, 3)
    poly(
      [
        [30, 468],
        [150, 464],
        [160, 498],
        [26, 500],
      ],
      'rgba(233,228,214,0.72)',
    )
    lamp(650, 482)
  })

  layer(30, () => {
    // Everything on the floor sits a little up the frame, clear of the bottom line.
    ctx.translate(0, -40)
    // Blood: a pool under her head, and the spatter thrown toward the award.
    ell(838, 640, 92, 20, '#6e1820')
    ell(776, 654, 54, 11, '#6e1820')
    ell(812, 636, 34, 4, '#c8433c')
    for (const [x, y] of [
      [872, 572],
      [884, 556],
      [860, 548],
      [896, 540],
      [850, 580],
    ] as [number, number][]) {
      ell(x, y, 3.4, 2.2, '#8f1f24')
    }

    // The award where it was dropped: a brass figure on marble, wiped.
    glow(903, 450, 120, AMBER, 0.3)
    poly(
      [
        [866, 486],
        [940, 486],
        [948, 508],
        [858, 508],
      ],
      '#d9d6cc',
    )
    box('#f4f2ea', 866, 486, 74, 3)
    box('#b0ada2', 858, 502, 90, 6)
    box('#dba93a', 894, 420, 18, 66)
    box('#ffe2a0', 896, 420, 5, 66)
    poly(
      [
        [870, 430],
        [894, 438],
        [894, 458],
      ],
      '#dba93a',
    )
    poly(
      [
        [936, 430],
        [912, 438],
        [912, 458],
      ],
      '#b8892a',
    )
    ell(903, 408, 12, 12, '#dba93a')
    ell(899, 404, 4, 4, '#ffe2a0')

    // Nora, face down, one arm out toward it.
    poly(
      [
        [1150, 594],
        [1268, 588],
        [1270, 632],
        [1150, 638],
      ],
      '#1b2238',
    )
    ell(1270, 610, 16, 24, INK)
    ell(1040, 614, 172, 34, '#2a3352', -0.02, true)
    poly(
      [
        [1040, 582],
        [1212, 590],
        [1212, 640],
        [1040, 648],
      ],
      SHADE,
    )
    ctx.lineCap = 'round'
    line([[904, 606], [882, 548]], OUTLINE, 31)
    line([[904, 606], [882, 548]], '#2a3352', 26)
    ell(878, 530, 15, 11, '#e6bd9d', -0.3, true)
    ell(852, 606, 36, 29, '#3a2418', 0, true)
    line([[836, 590], [862, 584]], '#6b452c', 2.4)
  })

  layer(40, () => {
    // The chair, where it went over.
    ctx.save()
    ctx.translate(1130, 660)
    ctx.rotate(-0.35)
    ctx.fillStyle = INK
    ctx.beginPath()
    ctx.roundRect(-90, -50, 180, 90, 18)
    ctx.fill()
    ctx.fillRect(80, -10, 70, 14)
    ctx.restore()
  })

  layer(24, () => dust(650, 420, 'rgba(255,217,160,ALPHA)', 22))
}

// ---- Sam's desk ---------------------------------------------------------------------

const SAM_WINDOW: Rect = { x: 150, y: 120, w: 250, h: 240 }

function samDesk(flash: number): void {
  layer(10, () => {
    wall('#111727', '#1b233a', '#0c101c')
    rainWindow(SAM_WINDOW, flash, false)
    // A corkboard with nothing of his own on it.
    box(INK, 812, 142, 336, 204)
    box('#2a1f16', 824, 154, 312, 180)
    note(846, 172, 78, 96, -0.04)
    note(946, 168, 78, 60, 0.05)
    note(1046, 176, 70, 92, 0.03)
    // Filing cabinets against the wall.
    box(INK, 1010, 380, 180, 200)
    for (let i = 0; i < 3; i++) {
      box(`rgba(${COLD},0.10)`, 1018, 392 + i * 62, 164, 1.5)
      box(`rgba(${COLD},0.22)`, 1088, 414 + i * 62, 24, 3)
    }
  })

  layer(30, () => {
    // An office chair, lower than Helen's.
    ctx.fillStyle = '#141a2c'
    ctx.beginPath()
    ctx.roundRect(588, 262, 154, 300, 26)
    ctx.fill()
    drawBody()
  })

  layer(34, () =>
    interviewDesk(() => {
      // A desk with almost nothing on it: a closed laptop and one pen.
      poly(
        [
          [770, 516],
          [900, 516],
          [916, 548],
          [762, 548],
        ],
        '#080a12',
      )
      box(`rgba(${COLD},0.25)`, 770, 516, 130, 1.5)
      line([[500, 540], [546, 532]], 'rgba(233,228,214,0.8)', 3)
    }),
  )
  layer(34, drawArms)

  layer(44, () => {
    // His raincoat over the next chair, still wet at the shoulders.
    box(INK, 1044, 380, 10, 400)
    box(INK, 1186, 380, 10, 400)
    box(INK, 1044, 380, 152, 10)
    const coat = new Path2D()
    coat.moveTo(1034, 420)
    coat.quadraticCurveTo(1060, 392, 1100, 394)
    coat.lineTo(1140, 394)
    coat.quadraticCurveTo(1180, 392, 1206, 420)
    coat.lineTo(1222, 640)
    coat.lineTo(1196, 644)
    coat.lineTo(1190, 664)
    coat.lineTo(1050, 664)
    coat.lineTo(1044, 644)
    coat.lineTo(1018, 640)
    coat.closePath()
    ctx.fillStyle = '#c08d44'
    ctx.fill(coat)
    ctx.save()
    ctx.clip(coat)
    box(SHADE, 1140, 380, 100, 300)
    box('#8a6230', 1034, 396, 180, 22)
    ctx.restore()
    ctx.strokeStyle = OUTLINE
    ctx.lineWidth = 2.6
    ctx.stroke(coat)
    line([[1120, 398], [1120, 664]], OUTLINE, 2)
    line([[1100, 396], [1086, 470], [1120, 500]], OUTLINE, 1.8)
    line([[1140, 396], [1154, 470], [1120, 500]], OUTLINE, 1.8)
    line([[1044, 440], [1050, 640]], OUTLINE, 1.6)
    line([[1196, 440], [1190, 640]], OUTLINE, 1.6)
    box(OUTLINE, 1140, 560, 44, 2)
    // Rain, still beaded on it.
    for (const [x, y] of [
      [1052, 410],
      [1070, 402],
      [1094, 408],
      [1150, 404],
      [1176, 408],
      [1196, 416],
      [1062, 424],
      [1184, 426],
    ] as [number, number][]) {
      ell(x, y, 2, 2, 'rgba(233,240,255,0.85)')
    }
  })

  layer(26, () => dust(372, 440, 'rgba(255,217,160,ALPHA)', 22))
}

// ---- the editor's office ----------------------------------------------------------------

const OFFICE_WINDOW: Rect = { x: 820, y: 118, w: 270, h: 250 }

function office(flash: number): void {
  layer(10, () => {
    wall('#121829', '#1c2540', '#0d111f')
    // Panelling to waist height: a darker band and one thin line of polish.
    box('rgba(4,5,9,0.55)', -60, 420, W + 120, 140)
    box('rgba(230,163,76,0.10)', -60, 420, W + 120, 1.5)
    for (let x = 40; x < W; x += 150) box('rgba(0,0,0,0.5)', x, 424, 1.5, 132)
    rainWindow(OFFICE_WINDOW, flash, true)
    blindLight(OFFICE_WINDOW, flash)
  })

  layer(14, () => {
    // Thirty years of front pages, and one clean square in the dust.
    for (const fx of [168, 248, 446]) frontPage(fx, 204)
    box(INK, 140, 296, 400, 12)
    box(INK, 160, 308, 8, 26)
    box(INK, 512, 308, 8, 26)
    box('rgba(233,228,214,0.10)', 140, 294, 400, 2)
    // An envelope gone soft with handling, tucked behind where a frame should hang.
    ctx.save()
    ctx.translate(372, 262)
    ctx.rotate(-0.07)
    box('rgba(226,214,186,0.9)', -34, -24, 68, 48)
    line([[-34, -24], [0, 2], [34, -24]], 'rgba(5,6,10,0.45)', 1.6)
    ell(0, 6, 4, 4, RED)
    ctx.restore()
  })

  layer(18, () => {
    // The printer on its cabinet, and the page it printed at 10:20.
    box(INK, 1096, 384, 170, 250)
    box('#0c0f1a', 1108, 340, 140, 46)
    poly(
      [
        [1128, 326],
        [1222, 322],
        [1226, 340],
        [1124, 340],
      ],
      'rgba(233,228,214,0.72)',
    )
    glow(1232, 362, 14, AMBER, 0.9)
  })

  layer(30, () => {
    // Her chair: a high back, a line of polish down one edge.
    ctx.fillStyle = '#161c30'
    ctx.beginPath()
    ctx.roundRect(574, 204, 182, 372, 30)
    ctx.fill()
    box('rgba(230,163,76,0.16)', 574, 232, 2, 300)
    drawBody()
  })

  layer(34, () =>
    interviewDesk(() => {
      // Blotter, the pages she says she never read, and her red pen.
      poly(
        [
          [560, 512],
          [770, 512],
          [792, 552],
          [546, 552],
        ],
        '#080a12',
      )
      poly(
        [
          [596, 518],
          [700, 516],
          [712, 544],
          [590, 546],
        ],
        'rgba(233,228,214,0.80)',
      )
      line([[726, 528], [772, 522]], RED, 3)
      // Her desk phone. The display keeps the last call.
      poly(
        [
          [812, 512],
          [896, 512],
          [906, 548],
          [806, 548],
        ],
        INK,
      )
      box('#6f8fd0', 822, 518, 40, 12)
      box(`rgba(${COLD},0.3)`, 868, 520, 24, 3)
      box(`rgba(${COLD},0.3)`, 868, 527, 24, 3)
      glow(842, 524, 40, '#6f8fd0', 0.3)
    }),
  )
  layer(34, drawArms)

  layer(46, () => {
    // The one page that would not go through the shredder.
    ctx.save()
    ctx.translate(1092, 560)
    ctx.rotate(-0.16)
    box('rgba(233,228,214,0.92)', -34, -44, 70, 96)
    ctx.fillStyle = 'rgba(5,6,10,0.45)'
    for (let i = 0; i < 6; i++) ctx.fillRect(-24, -30 + i * 10, 34 + ((i * 13) % 16), 2)
    ctx.strokeStyle = RED
    ctx.lineWidth = 2.4
    ctx.beginPath()
    ctx.ellipse(-2, 34, 26, 9, -0.08, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(-1, 35, 29, 11, 0.1, 0.3, Math.PI * 2.1)
    ctx.stroke()
    ctx.restore()
    poly(
      [
        [1036, 590],
        [1150, 590],
        [1136, 730],
        [1050, 730],
      ],
      INK,
    )
    box(`rgba(${COLD},0.28)`, 1036, 590, 114, 2)
    for (let i = 0; i < 6; i++) box(`rgba(${COLD},0.07)`, 1052 + i * 15, 600, 2, 120)
  })

  layer(26, () => dust(372, 440, 'rgba(255,217,160,ALPHA)', 22))
}

// ---- the building -----------------------------------------------------------------------

const KEY: Light = { x: 665, y: 350, r: 250, strength: 0.82 }
const DESK_LAMP: Light = { x: 372, y: 500, r: 430, strength: 0.95 }

export const ROOMS: Record<ViewId, Room> = {
  lobby: {
    caption: 'The lobby',
    darkness: 0.42,
    lights: [
      { x: 500, y: 130, r: 700, strength: 0.9 },
      { x: 430, y: 470, r: 300, strength: 0.9 },
      { x: 965, y: 380, r: 320, strength: 0.86 },
      { x: 1075, y: 320, r: 320, strength: 0.5 },
    ],
    figure: { who: 'crane', place: CRANE_PLACE },
    spots: {
      'lobby.log': { x: 228, y: 462, w: 146, h: 72 },
      'lobby.phone': { x: 150, y: 470, w: 74, h: 62 },
      'lobby.crane': { x: 862, y: 176, w: 210, h: 470 },
    },
    draw: lobby,
  },
  newsroom: {
    caption: 'The newsroom',
    darkness: 0.66,
    lights: [
      { x: 520, y: 440, r: 340, strength: 0.95 },
      { x: 1145, y: 330, r: 320, strength: 0.85 },
      { x: 176, y: 440, r: 180, strength: 0.75 },
      { x: 640, y: 230, r: 480, strength: 0.3 },
    ],
    spots: {},
    draw: newsroom,
  },
  desk: {
    caption: "Nora Hale's desk",
    darkness: 0.66,
    lights: [
      { x: 650, y: 440, r: 390, strength: 0.95 },
      { x: 385, y: 280, r: 330, strength: 0.8 },
      { x: 903, y: 410, r: 140, strength: 0.55 },
      { x: 960, y: 590, r: 260, strength: 0.4 },
    ],
    spots: {
      'desk.screen': { x: 180, y: 130, w: 410, h: 300 },
      'desk.award': { x: 848, y: 344, w: 112, h: 132 },
      'desk.body': { x: 800, y: 530, w: 480, h: 100 },
    },
    draw: noraDesk,
  },
  samdesk: {
    caption: "Sam Ortiz's desk",
    darkness: 0.6,
    lights: [DESK_LAMP, { x: 275, y: 240, r: 300, strength: 0.55 }, KEY, { x: 1120, y: 500, r: 200, strength: 0.5 }],
    figure: { who: 'sam', place: SEATED },
    spots: {
      'sam.jacket': { x: 1004, y: 376, w: 232, h: 296 },
      'sam.sam': { x: 572, y: 150, w: 186, h: 330 },
    },
    draw: samDesk,
  },
  office: {
    caption: "The editor's office",
    darkness: 0.58,
    lights: [
      DESK_LAMP,
      { x: OFFICE_WINDOW.x + OFFICE_WINDOW.w / 2, y: OFFICE_WINDOW.y + OFFICE_WINDOW.h / 2, r: 330, strength: 0.7 },
      KEY,
    ],
    figure: { who: 'helen', place: SEATED },
    spots: {
      'office.shelf': { x: 318, y: 196, w: 110, h: 120 },
      'office.bin': { x: 1030, y: 500, w: 130, h: 210 },
      'office.phone': { x: 796, y: 496, w: 124, h: 66 },
      'office.helen': { x: 572, y: 170, w: 186, h: 310 },
    },
    draw: office,
  },
}

/** Dust in the torch beam, drawn in every room. */
export function torchDust(): void {
  dust(pointer.x, pointer.y, 'rgba(220,228,255,ALPHA)', 16, 50)
}
