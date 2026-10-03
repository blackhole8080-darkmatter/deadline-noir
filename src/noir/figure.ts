import type { Mood, SuspectId } from '../deadline/story'
import { ctx, poly, W } from './stage'

/**
 * The suspects, drawn and acted.
 *
 * A suspect is a puppet in full colour: a body that leans, a head that tilts,
 * two arms with an elbow each, and a face. The room around them is black
 * shapes and light, so the person is the one thing the eye cannot leave.
 *
 * There is one figure on stage at a time. `setFigure` says who and where,
 * `setMood` says how they feel, and the pose eases toward that mood every
 * frame, so nothing is animated frame by frame.
 */

/** How each suspect is drawn. Costume details live in `costume`. */
type Design = {
  name: string
  skin: string
  skinShade: string
  hair: string
  hairLight: string
  outfit: string
  iris: string
}

const CAST: Record<SuspectId, Design> = {
  // Wine blazer, cream silk, pearls, tortoiseshell glasses.
  helen: {
    name: 'Helen Marsh',
    skin: '#e6bd9d',
    skinShade: '#b07f66',
    hair: '#b9bdc9',
    hairLight: '#eceef4',
    outfit: '#7c2335',
    iris: '#5f7fa8',
  },
  // Camel overcoat over a navy suit, gold tie, red pocket square.
  crane: {
    name: 'Victor Crane',
    skin: '#cf9569',
    skinShade: '#93603f',
    hair: '#17181f',
    hairLight: '#565d78',
    outfit: '#c08d44',
    iris: '#3a2a1c',
  },
  // Olive bomber over a mustard T-shirt, press pass on a teal lanyard.
  sam: {
    name: 'Sam Ortiz',
    skin: '#b0754d',
    skinShade: '#74482e',
    hair: '#2c1b12',
    hairLight: '#6b452c',
    outfit: '#5b7a43',
    iris: '#2a1a10',
  },
}

/**
 * Acting. A suspect is a puppet: a body that leans, a head that tilts, two
 * arms with an elbow each, and a face. A mood is one set of numbers for all of
 * that, and the figure eases from whatever it is doing now toward the mood it
 * has been given, so nothing is ever animated frame by frame.
 */
type HandShape = 'folded' | 'tucked' | 'grip' | 'face' | 'open' | 'pocket'
type MouthShape = 'neutral' | 'tight' | 'part' | 'down' | 'talk'

/** Everything that can be eased. Elbows and wrists are in scene coordinates. */
type Pose = {
  /** Leaning in makes the figure larger and lower, leaning back smaller. */
  scale: number
  drop: number
  tilt: number
  /** How far the head sinks between the shoulders. */
  hunch: number
  headTilt: number
  /** Features slide down the face as the head bows. */
  nod: number
  lids: number
  /** Above zero the inner brows lift (worry). Below, they come down (anger). */
  brow: number
  gazeY: number
  elx: number
  ely: number
  lx: number
  ly: number
  erx: number
  ery: number
  rx: number
  ry: number
}

type MoodSpec = {
  pose: Pose
  left: HandShape
  right: HandShape
  mouth: MouthShape
  /** Seconds between blinks. Liars blink more. */
  blink: number
  /** Where the eyes go, -1 (away, to her right) to 1, over time. */
  gaze: (t: number) => number
}

const MOODS: Record<Mood, MoodSpec> = {
  // Upright, hands folded, eyes on you.
  composed: {
    pose: {
      scale: 1, drop: 0, tilt: 0, hunch: 0, headTilt: 0, nod: 0, lids: 1, brow: 0, gazeY: 0,
      elx: 560, ely: 512, lx: 648, ly: 506, erx: 770, ery: 512, rx: 682, ry: 506,
    },
    left: 'folded',
    right: 'folded',
    mouth: 'neutral',
    blink: 5.1,
    gaze: () => 0,
  },
  // Leaning back, arms crossed, chin up, eyes narrowed.
  defensive: {
    pose: {
      scale: 0.962, drop: -7, tilt: 0.012, hunch: -2, headTilt: 0.05, nod: -3, lids: 0.58, brow: -0.8, gazeY: 0,
      elx: 552, ely: 488, lx: 716, ly: 466, erx: 778, ery: 492, rx: 616, ry: 478,
    },
    left: 'tucked',
    right: 'tucked',
    mouth: 'tight',
    blink: 7.5,
    gaze: () => 0,
  },
  // Leaning in, shoulders up, hands planted on the desk, eyes that will not stay.
  caught: {
    pose: {
      scale: 1.05, drop: 8, tilt: -0.012, hunch: 7, headTilt: -0.04, nod: 1, lids: 1.12, brow: 0.7, gazeY: 0,
      elx: 546, ely: 486, lx: 580, ly: 516, erx: 784, ery: 486, rx: 750, ry: 516,
    },
    left: 'grip',
    right: 'grip',
    mouth: 'part',
    blink: 1.7,
    gaze: (t) => (t % 2.6 < 1.7 ? -0.95 : 0),
  },
  // Slumped, head down in one hand, the other open on the desk.
  broken: {
    pose: {
      scale: 0.99, drop: 16, tilt: 0.03, hunch: 12, headTilt: 0.11, nod: 8, lids: 0.42, brow: 1, gazeY: 0.9,
      elx: 556, ely: 514, lx: 614, ly: 518, erx: 762, ery: 512, rx: 704, ry: 296,
    },
    left: 'open',
    right: 'face',
    mouth: 'down',
    blink: 2.3,
    gaze: () => 0,
  },
}

/** Where the figure stands. Seated figures sit at the shared interview desk. */
export type Place = { x: number; y: number; s: number; standing: boolean }

export const SEATED: Place = { x: 0, y: 0, s: 1, standing: false }

/**
 * The same four moods for someone on their feet with no desk to lean on:
 * hands in coat pockets, arms crossed, or one hand up at the collar.
 */
const STANDING: Record<Mood, MoodSpec> = {
  composed: {
    ...MOODS.composed,
    pose: { ...MOODS.composed.pose, elx: 542, ely: 552, lx: 566, ly: 636, erx: 788, ery: 552, rx: 764, ry: 636 },
    left: 'pocket',
    right: 'pocket',
  },
  defensive: MOODS.defensive,
  caught: {
    ...MOODS.caught,
    pose: {
      ...MOODS.caught.pose,
      scale: 1.03, drop: 4, hunch: 5,
      elx: 546, ely: 548, lx: 574, ly: 640, erx: 794, ery: 506, rx: 690, ry: 404,
    },
    left: 'pocket',
    right: 'grip',
  },
  broken: {
    ...MOODS.broken,
    pose: {
      ...MOODS.broken.pose,
      drop: 8, hunch: 8,
      elx: 546, ely: 548, lx: 574, ly: 640, erx: 794, ery: 506, rx: 690, ry: 404,
    },
    left: 'pocket',
    right: 'grip',
  },
}

let who: SuspectId = 'helen'
let place: Place = SEATED
let mood: Mood = 'composed'
let time = 0
let talking = false
const pose: Pose = { ...MOODS.composed.pose }

function moodSpec(): MoodSpec {
  return (place.standing ? STANDING : MOODS)[mood]
}

function enterPlace(): void {
  ctx.translate(place.x, place.y)
  ctx.translate(665, 600)
  ctx.scale(place.s, place.s)
  ctx.translate(-665, -600)
}

/** Put a suspect on stage. */
export function setFigure(next: SuspectId, where: Place): void {
  who = next
  place = where
}

/** Change how they feel. `snap` skips the ease, for walking into a room. */
export function setMood(next: Mood, snap = false): void {
  mood = next
  if (snap) Object.assign(pose, moodSpec().pose)
}

/** Advance the acting by one frame. `speaking` works the mouth. */
export function updateFigure(dt: number, now: number, speaking: boolean): void {
  time = now
  talking = speaking
  const target = moodSpec().pose
  const ease = 1 - Math.exp(-dt * 5.5)
  for (const key of Object.keys(pose) as (keyof Pose)[]) {
    pose[key] += (target[key] - pose[key]) * ease
  }
}

export function suspectName(id: SuspectId): string {
  return CAST[id].name
}

const OUTLINE = '#07080d'
/** One hard-edged shadow tone laid over skin and cloth alike, comic-style. */
const SHADE = 'rgba(14,10,34,0.40)'

function ink(path: Path2D, width = 2.6): void {
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = width
  ctx.lineJoin = 'round'
  ctx.stroke(path)
}

export function line(points: [number, number][], color: string, width: number): void {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
  ctx.stroke()
}

/** Mirror a list of points across the figure's centre line. */
const flip = (points: [number, number][]): [number, number][] => points.map(([x, y]) => [1330 - x, y])

/** What each of them is wearing. Drawn inside the torso, so nothing spills. */
function costume(): void {
  if (who === 'helen') {
    poly(
      [
        [641, 374],
        [689, 374],
        [673, 474],
        [657, 474],
      ],
      '#eadfc8',
    )
    const lapel: [number, number][] = [
      [641, 374],
      [620, 392],
      [634, 456],
      [657, 474],
    ]
    poly(lapel, '#5e1827')
    poly(flip(lapel), '#5e1827')
    line(lapel, OUTLINE, 1.6)
    line(flip(lapel), OUTLINE, 1.6)
    line(
      [
        [665, 474],
        [665, 600],
      ],
      OUTLINE,
      1.6,
    )
    // A gold brooch, and one button.
    ctx.fillStyle = '#e2b354'
    ctx.beginPath()
    ctx.arc(610, 440, 6, 0, Math.PI * 2)
    ctx.arc(665, 500, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#f3ede2'
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath()
      ctx.arc(665 + i * 8, 384 + (3 - Math.abs(i)) * 3, 2.6, 0, Math.PI * 2)
      ctx.fill()
    }
    return
  }

  if (who === 'crane') {
    poly(
      [
        [634, 376],
        [696, 376],
        [698, 610],
        [632, 610],
      ],
      '#1f2c4f',
    )
    poly(
      [
        [645, 374],
        [685, 374],
        [665, 446],
      ],
      '#f3ede2',
    )
    // Gold tie, with a pin.
    poly(
      [
        [659, 380],
        [671, 380],
        [669, 392],
        [661, 392],
      ],
      '#b8892a',
    )
    poly(
      [
        [661, 392],
        [669, 392],
        [674, 476],
        [665, 490],
        [656, 476],
      ],
      '#dba93a',
    )
    line(
      [
        [658, 440],
        [672, 440],
      ],
      '#f3ede2',
      2,
    )
    const lapel: [number, number][] = [
      [641, 374],
      [616, 394],
      [598, 478],
      [634, 540],
      [634, 380],
    ]
    poly(lapel, '#a3762f')
    poly(flip(lapel), '#a3762f')
    line(lapel.slice(0, 4), OUTLINE, 1.8)
    line(flip(lapel).slice(0, 4), OUTLINE, 1.8)
    // Pocket square, and two coat buttons.
    poly(
      [
        [712, 452],
        [732, 448],
        [730, 462],
        [714, 464],
      ],
      '#b3362f',
    )
    ctx.fillStyle = '#3a2a16'
    ctx.beginPath()
    ctx.arc(624, 566, 5, 0, Math.PI * 2)
    ctx.arc(706, 566, 5, 0, Math.PI * 2)
    ctx.fill()
    return
  }

  poly(
    [
      [632, 376],
      [698, 376],
      [708, 610],
      [622, 610],
    ],
    '#d7a63c',
  )
  ctx.strokeStyle = '#a87a22'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(665, 368, 26, 0.25, Math.PI - 0.25)
  ctx.stroke()
  // Ribbed collar, and the zip hanging open.
  const collar: [number, number][] = [
    [641, 374],
    [622, 390],
    [630, 410],
    [646, 384],
  ]
  poly(collar, '#3d5430')
  poly(flip(collar), '#3d5430')
  line(
    [
      [630, 410],
      [622, 610],
    ],
    '#2a3a20',
    3,
  )
  line(
    [
      [700, 410],
      [708, 610],
    ],
    '#2a3a20',
    3,
  )
  // Press pass.
  line(
    [
      [648, 380],
      [665, 470],
      [682, 380],
    ],
    '#3aa79b',
    3,
  )
  ctx.fillStyle = '#ece7da'
  ctx.beginPath()
  ctx.roundRect(647, 468, 36, 46, 3)
  ctx.fill()
  ctx.fillStyle = '#8a6a55'
  ctx.fillRect(653, 475, 13, 16)
  ctx.fillStyle = '#b3362f'
  ctx.fillRect(670, 475, 8, 4)
  ctx.fillStyle = 'rgba(5,6,10,0.5)'
  ctx.fillRect(653, 497, 24, 2)
  ctx.fillRect(653, 503, 18, 2)
}

function eye(cx: number, cy: number, d: Design, shut: boolean, gazeX: number): void {
  const ry = (who === 'sam' ? 5.6 : 4.4) * Math.min(1.15, pose.lids)
  if (shut || ry < 1.2) {
    line(
      [
        [cx - 8, cy + 1],
        [cx, cy + 3],
        [cx + 8, cy + 1],
      ],
      OUTLINE,
      2,
    )
    return
  }
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, cy, 8.5, ry, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#f3ede2'
  ctx.fill()
  ctx.clip()
  // The iris slides inside the white. That is all a glance is.
  const ix = cx + gazeX * 4.2
  const iy = cy + pose.gazeY * 2.6
  ctx.fillStyle = d.iris
  ctx.beginPath()
  ctx.arc(ix, iy, 3.8, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = OUTLINE
  ctx.beginPath()
  ctx.arc(ix, iy, 1.9, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(ix - 1.4, iy - 1.4, 1, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  // The upper lid carries the expression: it comes down as the eye narrows.
  line(
    [
      [cx - 9.5, cy - 0.5],
      [cx - 4, cy - ry - 0.2],
      [cx + 4, cy - ry - 0.2],
      [cx + 9.5, cy - 0.5],
    ],
    OUTLINE,
    pose.lids < 0.8 ? 2.8 : 2,
  )
}

function brows(color: string, width: number, baseY: number, amount: number): void {
  const inner = baseY - 5 * amount
  const outer = baseY + 2 + 2 * amount
  line([[636, outer], [648, (inner + outer) / 2 - 2], [659, inner]], color, width)
  line([[694, outer], [682, (inner + outer) / 2 - 2], [671, inner]], color, width)
}

function mouth(shape: MouthShape, lip: string | null): void {
  const y = who === 'crane' ? 321 : 317
  const color = lip ?? OUTLINE
  if (shape === 'talk' || shape === 'part') {
    ctx.fillStyle = '#2a0f14'
    ctx.beginPath()
    ctx.ellipse(665, y + 1, shape === 'talk' ? 6.5 : 7, shape === 'talk' ? 4.2 : 2.4, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.8
    ctx.stroke()
    return
  }
  if (shape === 'down') {
    ctx.strokeStyle = color
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(654, y + 3)
    ctx.quadraticCurveTo(665, y - 4, 676, y + 3)
    ctx.stroke()
    return
  }
  if (shape === 'tight') {
    line([[657, y], [673, y]], color, 2.4)
    return
  }
  if (lip) {
    ctx.fillStyle = lip
    ctx.beginPath()
    ctx.moveTo(653, y)
    ctx.quadraticCurveTo(665, y - 6, 677, y)
    ctx.quadraticCurveTo(665, y + 5, 653, y)
    ctx.fill()
  } else {
    line([[655, y], [675, y]], OUTLINE, 2)
  }
}

/** Lean, sink and sway: the transform everything above the hips shares. */
function enterBody(): void {
  const breathe = Math.sin(time * 1.1) * 1.6
  enterPlace()
  ctx.translate(665, 600)
  ctx.rotate(pose.tilt + Math.sin(time * 0.31) * 0.004)
  ctx.scale(pose.scale, pose.scale)
  ctx.translate(-665, -600 + pose.drop + breathe)
}

/** Where a point on the body ends up on screen, for hanging arms off shoulders. */
function bodyPoint(x: number, y: number): { x: number; y: number } {
  const breathe = Math.sin(time * 1.1) * 1.6
  const px = (x - 665) * pose.scale
  const py = (y - 600 + pose.drop + breathe) * pose.scale
  const a = pose.tilt
  return { x: 665 + px * Math.cos(a) - py * Math.sin(a), y: 600 + px * Math.sin(a) + py * Math.cos(a) }
}

/** The head turns on the neck, and sinks into the shoulders when she hunches. */
function enterHead(): void {
  ctx.translate(665, 372 + pose.hunch)
  ctx.rotate(pose.headTilt)
  ctx.translate(-665, -372)
}

export function drawBody(): void {
  const d = CAST[who]
  const spec = moodSpec()

  ctx.save()
  enterBody()

  // Helen's bob sits behind her face and falls past the jaw.
  if (who === 'helen') {
    ctx.save()
    enterHead()
    const bob = new Path2D()
    bob.moveTo(598, 352)
    bob.bezierCurveTo(588, 296, 594, 184, 665, 182)
    bob.bezierCurveTo(736, 184, 742, 296, 732, 352)
    bob.closePath()
    ctx.fillStyle = d.hair
    ctx.fill(bob)
    ctx.save()
    ctx.clip(bob)
    poly(
      [
        [676, 170],
        [760, 170],
        [760, 360],
        [690, 360],
      ],
      SHADE,
    )
    ctx.restore()
    ink(bob)
    ctx.restore()
  }

  const torso = new Path2D()
  torso.moveTo(480, 600)
  torso.bezierCurveTo(486, 470, 540, 404, 624, 390)
  torso.lineTo(641, 374)
  torso.lineTo(689, 374)
  torso.lineTo(706, 390)
  torso.bezierCurveTo(790, 404, 842, 470, 848, 600)
  torso.closePath()
  ctx.fillStyle = d.outfit
  ctx.fill(torso)
  if (place.standing) {
    // On their feet, the coat carries on down and out of frame.
    poly(
      [
        [480, 596],
        [848, 596],
        [872, 1100],
        [456, 1100],
      ],
      d.outfit,
    )
    poly(
      [
        [700, 596],
        [848, 596],
        [872, 1100],
        [716, 1100],
      ],
      SHADE,
    )
    line([[665, 600], [665, 1100]], OUTLINE, 2)
    line([[480, 596], [456, 1100]], OUTLINE, 2.6)
    line([[848, 596], [872, 1100]], OUTLINE, 2.6)
  }

  // Neck, in the shadow of the chin.
  ctx.fillStyle = d.skinShade
  ctx.fillRect(645, 326, 40, 56)

  ctx.save()
  ctx.clip(torso)
  costume()
  // The shadow side, then warm rim light from the lamp and cold from the window.
  poly(
    [
      [690, 360],
      [870, 360],
      [870, 620],
      [704, 620],
      [680, 480],
    ],
    SHADE,
  )
  ctx.globalCompositeOperation = 'lighter'
  const warm = ctx.createLinearGradient(480, 0, 590, 0)
  warm.addColorStop(0, 'rgba(255,190,110,0.55)')
  warm.addColorStop(1, 'rgba(255,190,110,0)')
  ctx.fillStyle = warm
  ctx.fillRect(470, 380, 130, 240)
  const cold = ctx.createLinearGradient(850, 0, 790, 0)
  cold.addColorStop(0, 'rgba(150,176,235,0.6)')
  cold.addColorStop(1, 'rgba(150,176,235,0)')
  ctx.fillStyle = cold
  ctx.fillRect(780, 380, 80, 240)
  ctx.restore()
  ink(torso)

  enterHead()

  // Ears, then the face.
  ctx.fillStyle = d.skin
  ctx.beginPath()
  ctx.ellipse(621, 274, 7, 13, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = d.skinShade
  ctx.beginPath()
  ctx.ellipse(709, 274, 7, 13, 0, 0, Math.PI * 2)
  ctx.fill()

  const face = new Path2D()
  face.moveTo(624, 246)
  face.bezierCurveTo(622, 302, 640, 338, 665, 342)
  face.bezierCurveTo(690, 338, 708, 302, 706, 246)
  face.bezierCurveTo(704, 198, 626, 198, 624, 246)
  face.closePath()
  ctx.fillStyle = d.skin
  ctx.fill(face)

  ctx.save()
  ctx.clip(face)
  ctx.save()
  // Bowing the head slides every feature down the face.
  ctx.translate(0, pose.nod)
  if (who === 'sam') {
    // A day without a razor.
    ctx.fillStyle = 'rgba(30,18,12,0.20)'
    ctx.fillRect(620, 300, 92, 50)
  }
  // Nose: a wedge of shadow and one line.
  poly(
    [
      [667, 262],
      [678, 294],
      [668, 298],
    ],
    d.skinShade,
  )
  line(
    [
      [664, 264],
      [660, 292],
      [669, 296],
    ],
    OUTLINE,
    1.6,
  )
  const offset = who === 'crane' ? 1.3 : who === 'sam' ? 2.9 : 0
  const shut = (time + offset) % spec.blink < 0.13
  const gazeX = spec.gaze(time)
  eye(647, 266, d, shut, gazeX)
  eye(683, 266, d, shut, gazeX)

  // While a line of theirs is typing out, the mouth works.
  const speaking = talking
  const shape: MouthShape = speaking && Math.floor(time * 9) % 2 === 0 ? 'talk' : spec.mouth

  if (who === 'helen') {
    brows('#7d8192', 2.4, 249, pose.brow)
    mouth(shape, '#9b2f35')
    line([[648, 300], [644, 312]], 'rgba(7,8,13,0.35)', 1.2)
    line([[682, 300], [686, 312]], 'rgba(7,8,13,0.35)', 1.2)
  } else if (who === 'crane') {
    brows(d.hair, 5, 253, pose.brow - 0.2)
    line([[640, 226], [690, 226]], 'rgba(7,8,13,0.28)', 1.2)
    line([[644, 234], [686, 234]], 'rgba(7,8,13,0.28)', 1.2)
    ctx.fillStyle = d.hair
    ctx.beginPath()
    ctx.moveTo(646, 306)
    ctx.quadraticCurveTo(665, 296, 684, 306)
    ctx.quadraticCurveTo(665, 313, 646, 306)
    ctx.fill()
    mouth(shape, null)
  } else {
    brows(d.hair, 3.4, 252, pose.brow + 0.4)
    mouth(shape === 'neutral' ? 'down' : shape, null)
  }
  ctx.restore()
  poly(
    [
      [678, 196],
      [716, 196],
      [716, 350],
      [670, 350],
      [686, 302],
      [674, 264],
    ],
    SHADE,
  )
  ctx.restore()
  ink(face)

  // Hair over the forehead.
  const hair = new Path2D()
  if (who === 'helen') {
    hair.moveTo(618, 262)
    hair.bezierCurveTo(636, 226, 684, 214, 712, 244)
    hair.lineTo(716, 206)
    hair.bezierCurveTo(694, 174, 636, 174, 614, 208)
    hair.closePath()
  } else if (who === 'crane') {
    hair.moveTo(619, 254)
    hair.lineTo(626, 226)
    hair.bezierCurveTo(650, 212, 684, 212, 704, 226)
    hair.lineTo(711, 254)
    hair.bezierCurveTo(722, 184, 608, 184, 619, 254)
    hair.closePath()
  } else {
    hair.moveTo(616, 258)
    for (const [x, y] of [
      [624, 226],
      [634, 236],
      [644, 216],
      [656, 232],
      [668, 212],
      [680, 232],
      [692, 218],
      [702, 236],
      [714, 258],
    ] as [number, number][]) {
      hair.lineTo(x, y)
    }
    hair.bezierCurveTo(730, 204, 704, 176, 690, 180)
    hair.lineTo(684, 164)
    hair.lineTo(672, 176)
    hair.lineTo(660, 160)
    hair.lineTo(650, 176)
    hair.lineTo(636, 166)
    hair.bezierCurveTo(612, 184, 604, 214, 616, 258)
    hair.closePath()
  }
  ctx.fillStyle = d.hair
  ctx.fill(hair)
  ctx.save()
  ctx.clip(hair)
  poly(
    [
      [680, 150],
      [740, 150],
      [740, 270],
      [692, 270],
    ],
    SHADE,
  )
  ctx.restore()
  ink(hair, 2.2)
  // One streak where the lamp catches it.
  ctx.strokeStyle = d.hairLight
  ctx.lineWidth = 2.4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(636, 214)
  ctx.quadraticCurveTo(654, 196, 678, 198)
  ctx.stroke()
  if (who === 'crane') {
    // Grey at the temples.
    ctx.fillStyle = '#8f95a6'
    ctx.fillRect(620, 240, 6, 16)
    ctx.fillRect(704, 240, 6, 16)
  }

  if (who === 'helen') {
    // Tortoiseshell frames, a glint on each lens, small gold earrings.
    ctx.save()
    ctx.translate(0, pose.nod)
    ctx.strokeStyle = '#3a2216'
    ctx.lineWidth = 3
    for (const gx of [632, 668]) {
      ctx.beginPath()
      ctx.roundRect(gx, 254, 30, 22, 7)
      ctx.stroke()
      line(
        [
          [gx + 6, 271],
          [gx + 15, 258],
        ],
        'rgba(255,255,255,0.55)',
        2.4,
      )
    }
    line(
      [
        [662, 262],
        [668, 262],
      ],
      '#3a2216',
      3,
    )
    ctx.restore()
    ctx.fillStyle = '#e2b354'
    ctx.beginPath()
    ctx.arc(618, 290, 3.4, 0, Math.PI * 2)
    ctx.arc(712, 290, 3.4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

const CUFF: Record<SuspectId, string> = { helen: '#eadfc8', crane: '#f3ede2', sam: '#3d5430' }

/** One hand, drawn pointing along +x from the wrist. */
function hand(shape: HandShape, d: Design, shaded: boolean): void {
  const reach = shape === 'open' ? 22 : shape === 'face' ? 20 : 17
  const girth = shape === 'open' ? 10 : shape === 'face' ? 14 : 12
  ctx.beginPath()
  ctx.ellipse(reach - 5, 0, reach, girth, 0, 0, Math.PI * 2)
  ctx.fillStyle = d.skin
  ctx.fill()
  if (shaded) {
    ctx.fillStyle = SHADE
    ctx.fill()
  }
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 2.2
  ctx.stroke()
  // Fingers: splayed when the hand is open, closed otherwise.
  const spread = shape === 'open' ? 5 : 3.4
  for (let i = -1; i <= 1; i++) {
    line(
      [
        [reach - 2, i * spread],
        [reach * 2 - 8, i * spread * (shape === 'open' ? 1.5 : 1)],
      ],
      'rgba(7,8,13,0.5)',
      1.4,
    )
  }
}

type Point = { x: number; y: number }

/** One segment of an arm: wide at `a`, narrower at `b`, rounded at both ends. */
function limb(a: Point, b: Point, wa: number, wb: number): Path2D {
  const angle = Math.atan2(b.y - a.y, b.x - a.x)
  const nx = -Math.sin(angle)
  const ny = Math.cos(angle)
  const path = new Path2D()
  path.moveTo(a.x + (nx * wa) / 2, a.y + (ny * wa) / 2)
  path.lineTo(b.x + (nx * wb) / 2, b.y + (ny * wb) / 2)
  path.arc(b.x, b.y, wb / 2, angle + Math.PI / 2, angle - Math.PI / 2, true)
  path.lineTo(a.x - (nx * wa) / 2, a.y - (ny * wa) / 2)
  path.arc(a.x, a.y, wa / 2, angle - Math.PI / 2, angle + Math.PI / 2, true)
  path.closePath()
  return path
}

/**
 * Arms and hands. Each arm is shoulder, elbow, wrist: the shoulder rides on the
 * body, and the elbow and wrist go wherever the mood puts them. A sleeve is
 * widest at the shoulder and narrowest at the cuff. They are drawn after the
 * desk so that forearms and hands rest on top of it.
 */
export function drawArms(): void {
  const d = CAST[who]
  const spec = moodSpec()
  const arms = [
    { s: bodyPoint(556, 452), e: { x: pose.elx, y: pose.ely }, w: { x: pose.lx, y: pose.ly }, shape: spec.left, shaded: false },
    { s: bodyPoint(774, 452), e: { x: pose.erx, y: pose.ery }, w: { x: pose.rx, y: pose.ry }, shape: spec.right, shaded: true },
  ]

  ctx.save()
  if (place.standing) {
    enterPlace()
  } else {
    // Seated: nothing of an arm shows below the front edge of the desk.
    ctx.beginPath()
    ctx.rect(-200, -200, W + 400, 766)
    ctx.clip()
  }
  ctx.lineJoin = 'round'

  for (const arm of arms) {
    const upper = limb(arm.s, arm.e, 46, 40)
    const fore = limb(arm.e, arm.w, 40, 30)
    // Outline both first, then fill both, so no line is drawn across the elbow.
    ctx.strokeStyle = OUTLINE
    ctx.lineWidth = 5
    ctx.stroke(upper)
    ctx.stroke(fore)
    for (const part of [upper, fore]) {
      ctx.fillStyle = d.outfit
      ctx.fill(part)
      if (arm.shaded) {
        ctx.fillStyle = SHADE
        ctx.fill(part)
      }
    }

    // A crease on the inside of the elbow, when the arm is bent enough to have one.
    const toS = Math.atan2(arm.s.y - arm.e.y, arm.s.x - arm.e.x)
    const toW = Math.atan2(arm.w.y - arm.e.y, arm.w.x - arm.e.x)
    const ix = Math.cos(toS) + Math.cos(toW)
    const iy = Math.sin(toS) + Math.sin(toW)
    const bend = Math.hypot(ix, iy)
    if (bend > 0.5) {
      line(
        [
          [arm.e.x + (ix / bend) * 3, arm.e.y + (iy / bend) * 3],
          [arm.e.x + (ix / bend) * 17, arm.e.y + (iy / bend) * 17],
        ],
        'rgba(7,8,13,0.5)',
        1.8,
      )
    }

    ctx.save()
    ctx.translate(arm.w.x, arm.w.y)
    ctx.rotate(toW)
    if (arm.shape === 'pocket') {
      // The hand is in a coat pocket: all that shows is the pocket's edge.
      line(
        [
          [-3, -17],
          [1, 17],
        ],
        OUTLINE,
        2.4,
      )
    } else {
      // Cuff, then the hand beyond it.
      ctx.fillStyle = OUTLINE
      ctx.fillRect(-8, -17, 13, 34)
      ctx.fillStyle = CUFF[who]
      ctx.fillRect(-6, -15, 9, 30)
      if (arm.shape !== 'folded') {
        ctx.translate(8, 0)
        hand(arm.shape, d, arm.shaded)
      }
    }
    ctx.restore()
  }

  // Folded hands are one shape: two hands with the fingers laced.
  if (spec.left === 'folded' && spec.right === 'folded') {
    const cx = (pose.lx + pose.rx) / 2
    const cy = (pose.ly + pose.ry) / 2
    ctx.beginPath()
    ctx.ellipse(cx, cy, 30, 13, 0, 0, Math.PI * 2)
    ctx.fillStyle = d.skin
    ctx.fill()
    ctx.strokeStyle = OUTLINE
    ctx.lineWidth = 2.2
    ctx.stroke()
    for (let i = -2; i <= 2; i++) {
      line(
        [
          [cx + i * 7 - 2, cy - 7],
          [cx + i * 7 + 2, cy + 3],
        ],
        'rgba(7,8,13,0.5)',
        1.4,
      )
    }
  }
  ctx.restore()
}
