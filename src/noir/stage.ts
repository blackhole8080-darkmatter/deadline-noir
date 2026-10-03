/**
 * The stage: one canvas, the darkness laid over it, and the handful of drawing
 * helpers every room and every figure shares.
 *
 * Everything is drawn in a fixed 1280x720 space and scaled to the window, so
 * rooms can be authored in plain numbers. The picture is built in three
 * passes: the room at full brightness, a layer of darkness with soft holes cut
 * in it for each light, then grain, vignette and letterbox on top.
 */

export const W = 1280
export const H = 720

export const INK = '#05060a'
export const PAPER = '#e9e4d6'
export const AMBER = '#e6a34c'
export const RED = '#b3362f'

export const canvas = document.getElementById('screen') as HTMLCanvasElement
const context = canvas.getContext('2d', { alpha: false })
if (!context) throw new Error('2D canvas context unavailable')
export const ctx: CanvasRenderingContext2D = context

const dark = document.createElement('canvas')
const darkCtx = dark.getContext('2d')!

function fit(): void {
  const ratio = Math.min(2, window.devicePixelRatio || 1)
  for (const c of [canvas, dark]) {
    c.width = W * ratio
    c.height = H * ratio
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  darkCtx.setTransform(ratio, 0, 0, ratio, 0, 0)
}
fit()
window.addEventListener('resize', fit)

/** Film grain: one tile of noise, slid around every frame. */
const grain = document.createElement('canvas')
grain.width = 256
grain.height = 256
{
  const g = grain.getContext('2d')!
  const image = g.createImageData(256, 256)
  for (let i = 0; i < image.data.length; i += 4) {
    const v = Math.random() * 255
    image.data[i] = v
    image.data[i + 1] = v
    image.data[i + 2] = v
    image.data[i + 3] = 26
  }
  g.putImageData(image, 0, 0)
}

/** Shared time and torch position, written by the game loop and read by all. */
export const clock = { time: 0 }
export const pointer = { x: W * 0.5, y: H * 0.45 }

export type Rect = { x: number; y: number; w: number; h: number }
export type Light = { x: number; y: number; r: number; strength: number }

/** Shift a layer against the torch. Nearer layers move further. */
export function layer(depth: number, draw: () => void): void {
  const dx = (pointer.x / W - 0.5) * depth
  const dy = (pointer.y / H - 0.5) * depth * 0.5
  ctx.save()
  ctx.translate(-dx, -dy)
  draw()
  ctx.restore()
}

export function poly(points: [number, number][], fill: string | CanvasGradient): void {
  ctx.beginPath()
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
}

export function box(fill: string | CanvasGradient, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = fill
  ctx.fillRect(x, y, w, h)
}

/** Additive light: a lamp's halo, a lit window across the road. */
export function glow(x: number, y: number, r: number, color: string, alpha: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, color)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = alpha
  ctx.fillStyle = g
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
  ctx.restore()
}

/** The storm: 0 almost always, 1 for two quick flickers every eleven seconds. */
export function lightning(): number {
  const t = clock.time % 11
  if (t < 0.08) return 1
  if (t > 0.18 && t < 0.5) return 1 - (t - 0.18) / 0.32
  return 0
}

/** Dust hanging in a light. */
export function dust(cx: number, cy: number, color: string, count = 22, seedBase = 0): void {
  const time = clock.time
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < count; i++) {
    const seed = (i + seedBase) * 91.7
    const x = cx + Math.sin(seed + time * 0.11) * 150 + Math.sin(seed * 2.3) * 40
    const y = cy + Math.cos(seed * 1.3 + time * 0.09) * 110 - ((time * 5 + seed) % 60)
    const twinkle = 0.25 + 0.25 * Math.sin(time * 1.4 + seed)
    ctx.fillStyle = color.replace('ALPHA', twinkle.toFixed(3))
    ctx.beginPath()
    ctx.arc(x, y, 0.9 + (i % 3) * 0.4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function cut(light: Light): void {
  const { x, y, r, strength } = light
  const g = darkCtx.createRadialGradient(x, y, r * 0.12, x, y, r)
  g.addColorStop(0, `rgba(0,0,0,${strength})`)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  darkCtx.fillStyle = g
  darkCtx.fillRect(x - r, y - r, r * 2, r * 2)
}

/**
 * Lay the darkness over the room, with a soft hole for every light in it and
 * one for the torch. `base` is how dark the unlit room is, 0..1.
 */
export function darkness(base: number, lights: Light[], flash: number, torch: boolean): void {
  darkCtx.globalCompositeOperation = 'source-over'
  darkCtx.clearRect(0, 0, W, H)
  darkCtx.fillStyle = `rgba(3,4,8,${Math.max(0.1, base - flash * 0.45)})`
  darkCtx.fillRect(0, 0, W, H)
  darkCtx.globalCompositeOperation = 'destination-out'
  for (const light of lights) cut(light)
  if (torch) {
    // The torch, with a hand's worth of sway.
    cut({
      x: pointer.x + Math.sin(clock.time * 1.7) * 3,
      y: pointer.y + Math.cos(clock.time * 1.3) * 3,
      r: 230,
      strength: 0.96,
    })
  }
  ctx.drawImage(dark, 0, 0, W, H)
}

/** Vignette, brackets on what the torch has found, scrim, grain, letterbox. */
export function finish(hover: Rect | null, scrim: boolean, torch: boolean, black: number): void {
  const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95)
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(0,0,0,0.78)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, W, H)

  if (hover) {
    const { x, y, w, h } = hover
    ctx.strokeStyle = 'rgba(230,163,76,0.8)'
    ctx.lineWidth = 1.5
    const arm = 16
    ctx.beginPath()
    for (const [cx, cy, sx, sy] of [
      [x, y, 1, 1],
      [x + w, y, -1, 1],
      [x, y + h, 1, -1],
      [x + w, y + h, -1, -1],
    ] as [number, number, number, number][]) {
      ctx.moveTo(cx + sx * arm, cy)
      ctx.lineTo(cx, cy)
      ctx.lineTo(cx, cy + sy * arm)
    }
    ctx.stroke()
  }

  if (torch) {
    // The torch's own point of light, in place of a cursor.
    ctx.fillStyle = 'rgba(255,240,214,0.85)'
    ctx.beginPath()
    ctx.arc(pointer.x, pointer.y, 2.2, 0, Math.PI * 2)
    ctx.fill()
  }

  if (scrim) {
    // Something to read the words against.
    const g = ctx.createLinearGradient(0, H * 0.5, 0, H)
    g.addColorStop(0, 'rgba(3,4,8,0)')
    g.addColorStop(1, 'rgba(3,4,8,0.94)')
    ctx.fillStyle = g
    ctx.fillRect(0, H * 0.5, W, H * 0.5)
  }

  if (black > 0) {
    ctx.fillStyle = `rgba(0,0,0,${Math.min(1, black)})`
    ctx.fillRect(0, 0, W, H)
  }

  ctx.save()
  ctx.globalCompositeOperation = 'overlay'
  const ox = Math.floor(Math.random() * 256)
  const oy = Math.floor(Math.random() * 256)
  for (let gx = -ox; gx < W; gx += 256) {
    for (let gy = -oy; gy < H; gy += 256) ctx.drawImage(grain, gx, gy)
  }
  ctx.restore()

  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, 34)
  ctx.fillRect(0, H - 34, W, 34)
}
