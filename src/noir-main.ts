import { DeadlineRuntime, nameOf, paginate, type Option } from './deadline/runtime'
import {
  CLUES,
  LOCK_THOUGHT,
  SUSPECTS,
  type Dir,
  type Line,
  type Mood,
  type Stance,
  type SuspectId,
} from './deadline/story'
import { audio } from './game/audio'
import { setFigure, setMood, updateFigure } from './noir/figure'
import { ROOMS, torchDust } from './noir/rooms'
import { canvas, clock, ctx, darkness, finish, H, INK, lightning, pointer, W, type Rect } from './noir/stage'

/**
 * DEADLINE - first person, one step at a time, in silhouette noir.
 *
 * You are never on screen. W/A/S/D steps between fixed viewpoints, the mouse
 * aims a torch, and whatever the torch finds can be examined or spoken to.
 * Speaking to someone gives the same four moves every time: press them,
 * sympathise, show them something from the case file, or say nothing.
 *
 * All the rules live in DeadlineRuntime and all the words in story.ts. The
 * picture is drawn by the modules in ./noir. This file is what is left: input,
 * time, and the interface, which is ordinary HTML laid over the canvas so the
 * type is set by the browser rather than drawn by hand.
 */

type Mode =
  | 'title'
  | 'controls'
  | 'world'
  | 'lines'
  | 'choice'
  | 'present'
  | 'file'
  | 'pause'
  | 'accuse'
  | 'ending'

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

const frameEl = $<HTMLDivElement>('frame')
const captionEl = $<HTMLDivElement>('caption')
const hudLeftEl = $<HTMLDivElement>('hud-left')
const hudRightEl = $<HTMLDivElement>('hud-right')
const labelEl = $<HTMLDivElement>('label')
const noticesEl = $<HTMLDivElement>('notices')
const meterEl = $<HTMLDivElement>('meter')
const speakerEl = $<HTMLDivElement>('speaker')
const textEl = $<HTMLDivElement>('text')
const choicesEl = $<HTMLDivElement>('choices')
const overlayEl = $<HTMLDivElement>('overlay')
const hintEl = $<HTMLDivElement>('hint')

const DIRS: Dir[] = ['forward', 'left', 'right', 'back']
const ARROW: Record<Dir, string> = { forward: '↑', left: '←', right: '→', back: '↓' }
const STANCE_NAME: Record<Stance, string> = {
  press: 'Press',
  sympathise: 'Sympathise',
  present: 'Present',
  silence: 'Silence',
}

const CONTROLS: [string, string][] = [
  ['W / ↑', 'Step forward'],
  ['A D / ← →', 'Turn'],
  ['S / ↓', 'Step back'],
  ['Mouse', 'Aim the torch'],
  ['Click / E', 'Examine or talk'],
  ['1 - 4', 'Press, sympathise, present, silence'],
  ['N', 'Notebook'],
  ['R', 'Make the arrest'],
  ['M', 'Mute'],
  ['Esc', 'Step away, or pause'],
]

let rt = new DeadlineRuntime()
let mode: Mode = 'title'
/** Where the controls page goes back to. */
let controlsFrom: Mode = 'title'
let menuAt = 0
let time = 0

let current: Line | null = null
let queue: Line[] = []
let afterLines: () => void = () => {}
let shown = 0

/** Who the detective is questioning, while he is questioning anyone. */
let talkingTo: SuspectId | null = null
let options: Option[] = []

/** 0 is clear, 1 is black. A step is taken at the black midpoint. */
let fade = 0
let pendingStep: (() => void) | null = null

let hovered: { id: string; rect: Rect } | null = null

/** How each suspect was left, so they are still that way when you come back. */
const feeling: Record<SuspectId, Mood> = { crane: 'composed', sam: 'caught', helen: 'composed' }
let lastSuspicion = rt.suspicion

let pages: string[] = []
let pageAt = 0

/** What a first-time player has already worked out, so each prompt shows only until it is not needed. */
const taught = { look: false, moves: false }

/** Seconds since the case locked, while the detective's thought about it is on screen. Negative otherwise. */
let lockBeat = -1

const esc = (text: string): string =>
  text.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!)

// ---- the interface ------------------------------------------------------------------

function setMode(next: Mode): void {
  mode = next
  frameEl.dataset.mode = mode
  const overlay = ['title', 'controls', 'present', 'file', 'pause', 'accuse', 'ending'].includes(mode)
  if (overlay) frameEl.dataset.overlay = mode
  else delete frameEl.dataset.overlay
  hovered = null
  labelEl.classList.remove('on')
  if (overlay) renderOverlay()
  if (mode === 'world') renderWorld()
}

function menuItems(): string[] {
  if (mode === 'title') return ['Begin', 'Controls']
  if (mode === 'pause') return ['Resume', 'Controls', 'Restart']
  if (mode === 'accuse') return [...SUSPECTS.map((s) => s.name), 'Not yet']
  return []
}

function menuHtml(): string {
  return `<div class="menu">${menuItems()
    .map((item, i) => `<button class="caps${i === menuAt ? ' on' : ''}" data-menu="${i}">${esc(item)}</button>`)
    .join('')}</div>`
}

function barsHtml(): string {
  const now = rt.suspicion
  return SUSPECTS.map(
    (s) =>
      `<div class="bar"><span>${esc(s.name)}</span><i><b style="width:${now[s.id]}%"></b></i><em>${now[s.id]}%</em></div>`,
  ).join('')
}

function renderOverlay(): void {
  if (mode === 'title') {
    overlayEl.innerHTML = `<div><h1>DEADLINE</h1><div class="sub caps">A reporter is dead. Nobody has decided who did it yet.</div>${menuHtml()}</div>`
  } else if (mode === 'pause') {
    overlayEl.innerHTML = `<div><h2>Paused</h2>${menuHtml()}</div>`
  } else if (mode === 'accuse') {
    overlayEl.innerHTML = `<div><h2>Who killed Nora Hale?</h2><div class="sub caps">There is no taking this back.</div>${menuHtml()}</div>`
  } else if (mode === 'controls') {
    overlayEl.innerHTML = `<div><h2>Controls</h2><table>${CONTROLS.map(
      ([key, what]) => `<tr><td>${esc(key)}</td><td>${esc(what)}</td></tr>`,
    ).join('')}</table><div class="hint caps">Any key to go back</div></div>`
  } else if (mode === 'file') {
    renderNotebook()
  } else if (mode === 'present') {
    renderPresent()
  } else if (mode === 'ending') {
    renderEnding()
  }
}

/** The notebook: every statement with its stamp and the reasoning, then the evidence. */
function renderNotebook(): void {
  const entries = rt.notebook
  const statements =
    entries.length === 0
      ? `<div class="empty">Nobody has told you anything yet.</div>`
      : SUSPECTS.map((s) => {
          const mine = entries.filter((e) => e.statement.suspect === s.id)
          if (mine.length === 0) return ''
          return `<h4 class="caps">${esc(s.name)}</h4>${mine
            .map((e) => {
              const reason = e.verdict === 'unverified' ? '' : `<p><u>Why</u> ${esc(e.why)}</p><p><u>So</u> ${esc(e.deduction)}</p>`
              return `<div class="entry ${e.verdict}"><span class="stamp">${e.verdict}</span><q>${esc(e.statement.text)}</q>${reason}</div>`
            })
            .join('')}`
        }).join('')
  const found = rt.cluesFound
  const evidence =
    found.length === 0
      ? `<div class="empty">Nothing yet. Look around.</div>`
      : `<dl>${found.map((c) => `<div><dt>${esc(c.name)}</dt><dd>${esc(c.text)}</dd></div>`).join('')}</dl>`
  const lies = entries.filter((e) => e.verdict === 'lie').length
  const truths = entries.filter((e) => e.verdict === 'truth').length
  overlayEl.innerHTML = `<div id="file"><div class="col"><h3 class="caps">Statements &middot; ${lies} lies &middot; ${truths} truths</h3>${statements}</div><div class="col"><h3 class="caps">Suspicion</h3><div class="bars">${barsHtml()}</div><h3 class="caps">Evidence ${found.length}/${CLUES.length + SUSPECTS.length}</h3>${evidence}<div class="hint caps">N or Esc to close</div></div></div>`
}

/** Choosing what to put in front of a suspect: any evidence, or anything anyone has said. */
function renderPresent(): void {
  if (!talkingTo) return
  const items = rt.items()
  const group = (kind: 'clue' | 'statement'): string =>
    items
      .filter((i) => i.kind === kind)
      .map(
        (i) =>
          `<button class="item" data-item="${esc(i.id)}"><b>${esc(i.title)}</b><span>${esc(i.text)}</span></button>`,
      )
      .join('') || `<div class="empty">Nothing yet.</div>`
  overlayEl.innerHTML = `<div id="present"><h2>Show ${esc(nameOf(talkingTo))} what?</h2><div class="cols"><div><h3 class="caps">Evidence</h3>${group('clue')}</div><div><h3 class="caps">What people have said</h3>${group('statement')}</div></div><div class="hint caps">Esc to go back</div></div>`
}

function renderEnding(): void {
  const id = rt.ending
  if (!id) return
  const recap = pageAt >= pages.length
  if (!recap) {
    overlayEl.innerHTML = `<div id="ending"><h2 class="${id === 'ending.true' ? 'good' : 'bad'}">${esc(rt.endingTitle())}</h2><p id="end-text"></p><div class="hint caps">Click to go on</div></div>`
    return
  }
  // The last screen says the quiet part aloud: any of the three could have done it.
  const killer = rt.killer
  const cards = SUSPECTS.map((s) => {
    const was = killer === s.id
    const tag = was ? 'Tonight it was' : killer ? 'It could have been' : 'It might have been'
    return `<div class="card${was ? ' was' : ''}"><span class="caps">${tag}</span><b>${esc(s.name)}</b><em>${esc(s.role)}</em></div>`
  }).join('')
  const list = rt
    .recap()
    .map((l) => `<li>${esc(l)}</li>`)
    .join('')
  overlayEl.innerHTML = `<div id="ending" class="recap"><h2 class="${id === 'ending.true' ? 'good' : 'bad'}">${esc(rt.endingTitle())}</h2><div class="cards">${cards}</div><ul>${list}</ul><button class="again caps" data-act="again">Question them differently</button></div>`
}

/** Caption, exits and the bottom line: everything that depends on where you stand. */
function renderWorld(): void {
  const view = rt.view
  captionEl.innerHTML = `${esc(ROOMS[view.id].caption)} <b>&middot;</b> ${view.id === 'lobby' ? '11:20 pm' : 'after eleven'}`
  for (const dir of DIRS) {
    const button = $<HTMLButtonElement>(`exit-${dir}`)
    const exit = view.exits[dir]
    button.hidden = !exit
    if (!exit) continue
    const label = esc(exit.label)
    button.innerHTML = dir === 'right' ? `${label} &nbsp;${ARROW[dir]}` : `${ARROW[dir]}&nbsp; ${label}`
    button.classList.toggle('shut', !rt.exitOpen(exit))
  }
  hintEl.textContent = taught.look ? '' : 'Move the light over the desk. Click what it finds.'
  hudLeftEl.textContent = `Evidence ${rt.cluesFound.length}/${CLUES.length + SUSPECTS.length}`
  hudRightEl.innerHTML =
    (rt.canAccuse ? `<button class="hot" data-act="accuse"><kbd>R</kbd>&nbsp; Make the arrest</button>` : '') +
    `<button data-act="file"><kbd>N</kbd>&nbsp; Notebook</button><button data-act="pause"><kbd>Esc</kbd>&nbsp; Menu</button>`
}

/** The suspicion meter. A bar that moved is marked for a moment, so the eye catches it. */
function renderMeter(): void {
  const now = rt.suspicion
  meterEl.innerHTML = SUSPECTS.map((s) => {
    const delta = now[s.id] - lastSuspicion[s.id]
    const moved = delta > 0 ? ' up' : delta < 0 ? ' down' : ''
    const sign = delta > 0 ? `+${delta}` : `${delta}`
    return `<div class="bar${moved}"><span>${esc(s.name)}</span><i><b style="width:${now[s.id]}%"></b></i><em>${now[s.id]}%</em>${delta === 0 ? '' : `<s>${sign}</s>`}</div>`
  }).join('')
  lastSuspicion = now
}

function notify(text: string): void {
  const el = document.createElement('div')
  el.className = 'notice'
  el.textContent = text
  noticesEl.append(el)
  window.setTimeout(() => el.remove(), 4300)
}

/** Whatever the rules have to tell the player since last time. */
function flush(): void {
  // Once the case has locked onto someone, the music picks up a heartbeat.
  if (rt.locked) audio.setMusic('tense')
  const notices = rt.takeNotices()
  for (const text of notices) notify(text)
  if (notices.length > 0) audio.sting('deduction')
  renderMeter()
}

// ---- conversation ---------------------------------------------------------------------

function play(lines: Line[], then: () => void): void {
  queue = [...lines]
  afterLines = then
  nextLine()
}

function nextLine(): void {
  current = queue.shift() ?? null
  shown = 0
  if (!current) {
    const then = afterLines
    afterLines = () => {}
    then()
    return
  }
  const figure = ROOMS[rt.view.id].figure
  if (current.mood && figure) {
    feeling[figure.who] = current.mood
    setMood(current.mood)
  }
  // The case locking is the turn of the whole game, so its thought gets the room to itself.
  const lock = current.text === LOCK_THOUGHT
  if (lock) audio.thunder(true)
  lockBeat = lock ? 0 : -1
  textEl.classList.toggle('lock', lock)
  frameEl.toggleAttribute('data-lock', lock)

  const who = current.who
  speakerEl.textContent =
    who === 'you' ? 'Detective' : who === 'think' ? 'Detective · thinking' : who === 'note' ? '' : nameOf(who)
  speakerEl.classList.toggle('think', who === 'think')
  textEl.classList.toggle('note', who === 'note')
  textEl.classList.toggle('think', who === 'think')
  textEl.textContent = ''
  setMode('lines')
}

/** Start or resume questioning: the same four moves, every time. */
function showMoves(): void {
  // Once someone has confessed there is nothing left to ask them.
  if (!talkingTo || (rt.confessed && rt.killer === talkingTo)) return leave()
  options = rt.options(talkingTo)
  menuAt = 0
  renderMoves()
  setMode('choice')
}

function renderMoves(): void {
  const teach = taught.moves
    ? ''
    : `<div class="teach caps">The same four moves, every time. Press 1 to 4.</div>`
  choicesEl.innerHTML = `${teach}<ol>${options
    .map((option, i) => {
      const classes = [i === menuAt ? 'on' : '', option.fresh ? '' : 'spent', option.stance].join(' ').trim()
      return `<li><button class="${classes}" data-choice="${i}"><b>${i + 1}</b><u>${STANCE_NAME[option.stance]}</u>${esc(option.label)}</button></li>`
    })
    .join('')}</ol><button class="leave caps" data-act="leave">Esc &nbsp; Step away</button>`
}

function pick(index: number): void {
  const option = options[index]
  if (!option || !talkingTo) return
  taught.moves = true
  audio.sting('confirm')
  if (option.stance === 'present') {
    setMode('present')
    return
  }
  const lines = rt.take(talkingTo, option.stance)
  flush()
  play(lines, showMoves)
}

function presentItem(id: string): void {
  if (!talkingTo) return
  audio.sting('confirm')
  const lines = rt.present(talkingTo, id)
  flush()
  play(lines, showMoves)
}

function leave(): void {
  talkingTo = null
  setMode('world')
}

// ---- the world ------------------------------------------------------------------------

function spotUnder(x: number, y: number): { id: string; rect: Rect } | null {
  for (const [id, rect] of Object.entries(ROOMS[rt.view.id].spots)) {
    if (!rt.spotActive(id)) continue
    if (x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h) return { id, rect }
  }
  return null
}

/** What E acts on: the thing under the torch, or failing that the nearest thing to it. */
function litSpot(): { id: string; rect: Rect } | null {
  if (hovered) return hovered
  let best: { id: string; rect: Rect } | null = null
  let bestDist = 170
  for (const [id, rect] of Object.entries(ROOMS[rt.view.id].spots)) {
    if (!rt.spotActive(id)) continue
    const d = Math.hypot(rect.x + rect.w / 2 - pointer.x, rect.y + rect.h / 2 - pointer.y)
    if (d < bestDist) {
      best = { id, rect }
      bestDist = d
    }
  }
  return best
}

function useSpot(id: string): void {
  taught.look = true
  const event = rt.use(id)
  if (event.talk) {
    if (rt.confessed && rt.killer === event.talk) {
      play([{ who: 'think', text: 'I have what I came for. All that is left is to make the arrest.' }], () => setMode('world'))
      return
    }
    talkingTo = event.talk
    const lines = rt.talk(event.talk)
    flush()
    play(lines, showMoves)
    return
  }
  if (event.clue) {
    audio.sting('clue')
    notify(`Evidence: ${event.clue.name}`)
  }
  play(event.lines, () => setMode('world'))
}

function sayYou(text: string): void {
  if (!text) return
  play([{ who: 'you', text }], () => setMode('world'))
}

/** Put whoever is in this room on stage, as they were left. */
function enterView(): void {
  const figure = ROOMS[rt.view.id].figure
  if (figure) {
    setFigure(figure.who, figure.place)
    setMood(feeling[figure.who], true)
  }
  audio.setAmbience(rt.view.ambience)
}

function step(dir: Dir): void {
  if (pendingStep) return
  const exit = rt.view.exits[dir]
  if (!exit) return
  if (!rt.exitOpen(exit)) {
    audio.sting('locked')
    sayYou(exit.locked ?? '')
    return
  }
  audio.tick()
  frameEl.dataset.moving = ''
  pendingStep = () => {
    const result = rt.move(dir)
    enterView()
    delete frameEl.dataset.moving
    renderWorld()
    if (result.moved && result.narration) sayYou(result.narration)
  }
}

function begin(): void {
  rt = new DeadlineRuntime()
  talkingTo = null
  lockBeat = -1
  feeling.crane = 'composed'
  feeling.sam = 'caught'
  feeling.helen = 'composed'
  lastSuspicion = rt.suspicion
  renderMeter()
  audio.setMusic('theme')
  enterView()
  fade = 1
  sayYou(rt.view.enter)
}

function accuse(suspect: SuspectId): void {
  const ending = rt.accuse(suspect)
  audio.setAmbience('none')
  audio.setMusic(ending === 'ending.true' ? 'theme' : 'off')
  audio.sting(ending === 'ending.true' ? 'win' : 'lose')
  pages = paginate(rt.endingText(), 240)
  pageAt = 0
  shown = 0
  setMode('ending')
}

function activateMenu(index: number): void {
  audio.sting('confirm')
  if (mode === 'title') {
    if (index === 0) begin()
    else openControls()
  } else if (mode === 'pause') {
    if (index === 0) setMode('world')
    else if (index === 1) openControls()
    else window.location.reload()
  } else if (mode === 'accuse') {
    const suspect = SUSPECTS[index]
    if (suspect) accuse(suspect.id)
    else setMode('world')
  }
}

function openControls(): void {
  controlsFrom = mode
  setMode('controls')
}

function openAccuse(): void {
  if (!rt.canAccuse) return
  menuAt = SUSPECTS.length
  setMode('accuse')
}

/** Click, space, enter: whatever "go on" means right now. */
function advance(): void {
  if (mode === 'lines' && current) {
    if (shown < current.text.length) shown = current.text.length
    else nextLine()
  } else if (mode === 'ending') {
    const page = pages[pageAt]
    if (page !== undefined && shown < page.length) {
      shown = page.length
    } else if (pageAt < pages.length) {
      pageAt += 1
      shown = 0
      renderEnding()
    }
  } else if (mode === 'controls') {
    menuAt = 0
    setMode(controlsFrom)
  } else if (mode === 'file') {
    setMode('world')
  }
}

// ---- input ----------------------------------------------------------------------------

function toScene(ev: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()
  return {
    x: ((ev.clientX - rect.left) / rect.width) * W,
    y: ((ev.clientY - rect.top) / rect.height) * H,
  }
}

frameEl.addEventListener('pointermove', (ev) => {
  const p = toScene(ev)
  pointer.x = p.x
  pointer.y = p.y
  if (mode !== 'world' || pendingStep) return
  hovered = spotUnder(p.x, p.y)
  labelEl.classList.toggle('on', hovered !== null)
  if (!hovered) return
  const id = hovered.id
  const spot = rt.view.spots.find((s) => s.id === id)
  labelEl.textContent = spot?.talk ? `Talk to ${nameOf(spot.talk)}` : (spot?.label ?? '')
  labelEl.style.left = `${((hovered.rect.x + hovered.rect.w / 2) / W) * 100}%`
  labelEl.style.top = `${((hovered.rect.y - 10) / H) * 100}%`
})

frameEl.addEventListener('pointerdown', (ev) => {
  audio.unlock()
  const button = (ev.target as HTMLElement).closest('button')

  if (button?.dataset.menu !== undefined) {
    activateMenu(Number(button.dataset.menu))
  } else if (button?.dataset.choice !== undefined) {
    pick(Number(button.dataset.choice))
  } else if (button?.dataset.item !== undefined) {
    presentItem(button.dataset.item)
  } else if (button?.dataset.dir) {
    if (mode === 'world' && fade < 0.3) step(button.dataset.dir as Dir)
  } else if (button?.dataset.act === 'again') {
    begin()
  } else if (button?.dataset.act === 'leave') {
    leave()
  } else if (button?.dataset.act === 'file') {
    setMode('file')
  } else if (button?.dataset.act === 'pause') {
    menuAt = 0
    setMode('pause')
  } else if (button?.dataset.act === 'accuse') {
    openAccuse()
  } else if (mode === 'world') {
    if (pendingStep || fade > 0.3) return
    const p = toScene(ev)
    const spot = spotUnder(p.x, p.y)
    if (spot) useSpot(spot.id)
  } else if (mode === 'lines' || mode === 'ending' || mode === 'controls') {
    advance()
  }
})

overlayEl.addEventListener('pointerover', (ev) => {
  const button = (ev.target as HTMLElement).closest('button')
  if (button?.dataset.menu === undefined) return
  menuAt = Number(button.dataset.menu)
  for (const b of overlayEl.querySelectorAll('.menu button')) {
    b.classList.toggle('on', (b as HTMLElement).dataset.menu === String(menuAt))
  }
})

choicesEl.addEventListener('pointerover', (ev) => {
  const button = (ev.target as HTMLElement).closest('button')
  if (button?.dataset.choice === undefined || Number(button.dataset.choice) === menuAt) return
  menuAt = Number(button.dataset.choice)
  renderMoves()
})

const STEP_KEYS: Record<string, Dir> = {
  w: 'forward',
  arrowup: 'forward',
  a: 'left',
  arrowleft: 'left',
  d: 'right',
  arrowright: 'right',
  s: 'back',
  arrowdown: 'back',
}

window.addEventListener('keydown', (ev) => {
  audio.unlock()
  const key = ev.key.toLowerCase()
  if (key.startsWith('arrow') || key === ' ') ev.preventDefault()

  if (key === 'm') {
    audio.toggleMute()
    return
  }

  if (mode === 'title' || mode === 'pause' || mode === 'accuse') {
    const count = menuItems().length
    if (key === 'arrowup' || key === 'w') menuAt = (menuAt + count - 1) % count
    else if (key === 'arrowdown' || key === 's') menuAt = (menuAt + 1) % count
    else if (key === 'enter' || key === ' ' || key === 'e') return activateMenu(menuAt)
    else if (key === 'escape' && mode !== 'title') return setMode('world')
    renderOverlay()
    return
  }

  if (mode === 'choice') {
    const count = options.length
    if (key === 'arrowup' || key === 'w') menuAt = (menuAt + count - 1) % count
    else if (key === 'arrowdown' || key === 's') menuAt = (menuAt + 1) % count
    else if (key === 'enter' || key === 'e') return pick(menuAt)
    else if (/^[1-4]$/.test(key)) return pick(Number(key) - 1)
    else if (key === 'escape') return leave()
    renderMoves()
    return
  }

  if (mode === 'present') {
    if (key === 'escape') showMoves()
    return
  }

  if (mode === 'ending' && pageAt >= pages.length) {
    if (key === 'enter') begin()
    return
  }

  if (mode !== 'world') {
    if (key === 'enter' || key === ' ' || key === 'e' || key === 'escape' || key === 'n') advance()
    return
  }
  if (pendingStep || fade > 0.3) return

  const dir = STEP_KEYS[key]
  if (dir) {
    step(dir)
  } else if (key === 'e' || key === 'enter') {
    const spot = litSpot()
    if (spot) useSpot(spot.id)
  } else if (key === 'n') {
    setMode('file')
  } else if (key === 'escape') {
    menuAt = 0
    setMode('pause')
  } else if (key === 'r') {
    openAccuse()
  }
})

// ---- the loop -------------------------------------------------------------------------

let last = performance.now()

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  time += dt
  clock.time = time

  // The typewriter, for speech and for the closing narration.
  let typing = false
  if (mode === 'lines' && current && shown < current.text.length) {
    shown = Math.min(current.text.length, shown + dt * 46)
    typing = true
  }
  if (mode === 'lines' && current) textEl.textContent = current.text.slice(0, Math.floor(shown))
  if (mode === 'ending') {
    const page = pages[pageAt]
    const el = document.getElementById('end-text')
    if (page !== undefined && el) {
      if (shown < page.length) {
        shown = Math.min(page.length, shown + dt * 52)
        typing = true
      }
      el.textContent = page.slice(0, Math.floor(shown))
    }
  }
  if (typing) audio.tick()

  const who = current?.who
  const suspectSpeaking = mode === 'lines' && typing && who !== 'you' && who !== 'note' && who !== 'think'
  updateFigure(dt, time, suspectSpeaking)

  if (pendingStep) {
    fade = Math.min(1, fade + dt * 4)
    if (fade >= 1) {
      const take = pendingStep
      pendingStep = null
      take()
    }
  } else {
    fade = Math.max(0, fade - dt * 2.6)
  }

  // While the lock thought is up: one hard flash, then the room closes in around the words.
  if (lockBeat >= 0 && mode === 'lines') lockBeat += dt
  else if (mode !== 'lines') {
    lockBeat = -1
    frameEl.removeAttribute('data-lock')
  }
  const closing = lockBeat >= 0 ? Math.min(0.3, lockBeat * 0.5) : 0
  const flash = Math.max(lightning(), lockBeat >= 0 && lockBeat < 0.14 ? 1 : 0)
  // Thunder follows the flash. The audio module spaces the rolls out.
  if (flash > 0 && mode !== 'ending') audio.thunder()
  ctx.fillStyle = INK
  ctx.fillRect(0, 0, W, H)

  if (mode === 'ending') {
    finish(null, false, false, 0)
  } else if (mode === 'title' || (mode === 'controls' && controlsFrom === 'title')) {
    // The menu sits over the newsroom, darker than it will be in play.
    const room = ROOMS.newsroom
    room.draw(flash)
    darkness(0.74, room.lights, flash, false)
    finish(null, false, false, 0)
  } else {
    const room = ROOMS[rt.view.id]
    const playing = mode === 'world' && !pendingStep
    room.draw(flash)
    if (playing) torchDust()
    darkness(Math.min(0.95, room.darkness + closing), room.lights, flash, true)
    finish(playing ? (hovered?.rect ?? null) : null, mode === 'lines' || mode === 'choice', playing, fade)
  }

  requestAnimationFrame(frame)
}

renderMeter()
audio.setMusic('theme')
setMode('title')
requestAnimationFrame(frame)
