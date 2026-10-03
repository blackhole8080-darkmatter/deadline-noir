import {
  ALIBI,
  CLUES,
  ENDING_TITLE,
  INTERROGATIONS,
  LOCK_THOUGHT,
  STANCES,
  STATEMENTS,
  SUSPECTS,
  TRUE_ENDING,
  VIEWS,
  type Clue,
  type Dir,
  type EndingId,
  type Exchange,
  type Exit,
  type Line,
  type Ruling,
  type Stance,
  type Statement,
  type SuspectId,
  type View,
  type ViewId,
} from './story'

export type MoveResult = { moved: true; narration: string } | { moved: false; text: string }

/** What looking at something gives back: lines to show, and perhaps a clue or a person. */
export type UseResult = { lines: Line[]; clue?: Clue; talk?: SuspectId }

export type Verdict = 'unverified' | 'truth' | 'lie'

/** A statement as the notebook holds it. */
export type Entry = { statement: Statement; verdict: Verdict; why: string; deduction: string }

export type Option = { stance: Stance; label: string; fresh: boolean }

/** Anything that can be put in front of a suspect: evidence, or what somebody said. */
export type Item = { id: string; kind: 'clue' | 'statement'; title: string; text: string }

export type SuspectStatus = 'Not questioned' | 'Questioned' | 'Caught lying' | 'Alibi holds' | 'Confessed'

/**
 * How far a ruling moves the detective's suspicion of the person who said it,
 * against a starting weight of SUSPICION_START each. An ordinary lie is a
 * nudge, about eight points. Only a broken alibi is decisive.
 */
const SUSPICION_START = 2
const WEIGHT = { lie: 0.8, alibiLie: 7, truth: -0.4, alibiTruth: -1.5 }
const PRESSURE = { press: 1.5, present: 1, sympathise: -1, silence: 0 }
const SUSPICION_PER_PRESSURE = 0.1
const SUSPICION_FLOOR = 0.3

/**
 * DEADLINE as a testable object. All rules, no rendering, no DOM.
 *
 * Three numbers per suspect drive everything. `pressure` is how hard the
 * detective has leaned on them. `raw` suspicion is what the evidence says,
 * moved by every statement proved a truth or a lie. And once two different
 * people have been caught lying, `killer` is fixed as whoever has taken the
 * most pressure, which is the sense in which the detective makes the murderer.
 */
export class DeadlineRuntime {
  private viewId: ViewId = 'lobby'
  private readonly visited = new Set<ViewId>(['lobby'])
  private readonly held = new Set<string>()
  private readonly met = new Set<SuspectId>()
  private readonly used = new Set<Exchange>()
  private readonly said: string[] = []
  private readonly rulings = new Map<string, Ruling>()
  private readonly pressure: Record<SuspectId, number> = { crane: 0, sam: 0, helen: 0 }
  private readonly raw: Record<SuspectId, number> = {
    crane: SUSPICION_START,
    sam: SUSPICION_START,
    helen: SUSPICION_START,
  }
  private lastConfronted: SuspectId | null = null
  private killerValue: SuspectId | null = null
  private confessedValue = false
  private notices: string[] = []
  private endingValue: EndingId | null = null
  private accusedValue: SuspectId | null = null

  // ---- walking around -------------------------------------------------------

  get view(): View {
    return viewOf(this.viewId)
  }

  exitOpen(exit: Exit): boolean {
    return !exit.needsLieFrom || exit.needsLieFrom.some((s) => this.caughtLying(s))
  }

  /** One step. A shut door answers with a reason instead of doing nothing. */
  move(dir: Dir): MoveResult {
    const exit = this.view.exits[dir]
    if (!exit) return { moved: false, text: '' }
    if (!this.exitOpen(exit)) return { moved: false, text: exit.locked ?? '' }

    this.viewId = exit.to
    const first = !this.visited.has(exit.to)
    this.visited.add(exit.to)
    return { moved: true, narration: first ? this.view.enter : '' }
  }

  /** Whether a spot can be used yet. Alibi objects mean nothing until the case has locked. */
  spotActive(spotId: string): boolean {
    const spot = this.view.spots.find((s) => s.id === spotId)
    if (!spot) return false
    if (spot.alibi && !spot.clue && !spot.talk) return this.locked
    return true
  }

  /** Look at a thing, or turn to a person. */
  use(spotId: string): UseResult {
    const spot = this.view.spots.find((s) => s.id === spotId)
    if (!spot) throw new Error(`spot "${spotId}" is not in view "${this.viewId}"`)
    if (!this.spotActive(spotId)) throw new Error(`spot "${spotId}" is not available yet`)
    if (spot.talk) return { lines: [], talk: spot.talk }

    // Something already examined is worth a second look once the case has
    // locked, because the detective now knows what he is looking for.
    const alibi = spot.alibi ? ALIBI[spot.alibi] : null
    const firstLook = spot.clue !== undefined && !this.held.has(spot.clue)
    if (alibi && this.locked && !firstLook && !this.held.has(alibi.id)) {
      this.held.add(alibi.id)
      const version = this.killerValue === spot.alibi ? alibi.fails : alibi.holds
      return {
        lines: [{ who: 'you', text: version.examine }],
        clue: { id: alibi.id, name: alibi.name, text: version.text },
      }
    }

    const lines: Line[] = []
    if (spot.examine) lines.push({ who: 'you', text: spot.examine })
    if (firstLook && spot.thought) lines.push({ who: 'think', text: spot.thought })
    if (firstLook) this.held.add(spot.clue!)
    if (lines.length === 0) lines.push({ who: 'you', text: 'Nothing more to see there.' })
    return { lines, clue: firstLook ? this.clue(spot.clue!) : undefined }
  }

  /** Evidence in the order it was authored, with alibi objects in whichever version is true. */
  get cluesFound(): Clue[] {
    const fixed = CLUES.filter((c) => this.held.has(c.id))
    const alibis = SUSPECTS.filter((s) => this.held.has(ALIBI[s.id].id)).map((s) => this.clue(ALIBI[s.id].id))
    return [...fixed, ...alibis]
  }

  private clue(id: string): Clue {
    const fixed = CLUES.find((c) => c.id === id)
    if (fixed) return fixed
    const owner = SUSPECTS.find((s) => ALIBI[s.id].id === id)
    if (!owner) throw new Error(`unknown clue "${id}"`)
    const alibi = ALIBI[owner.id]
    return { id: alibi.id, name: alibi.name, text: (this.killerValue === owner.id ? alibi.fails : alibi.holds).text }
  }

  // ---- the notebook -----------------------------------------------------------

  /** Every statement made so far, with how it has been ruled. */
  get notebook(): Entry[] {
    return this.said.map((id) => {
      const ruling = this.rulings.get(id)
      return {
        statement: statementOf(id),
        verdict: ruling?.verdict ?? 'unverified',
        why: ruling?.why ?? '',
        deduction: ruling?.deduction ?? '',
      }
    })
  }

  /** "said:x", "lie:x", "truth:x", or a clue id. */
  has = (key: string): boolean => {
    const [kind, id] = key.split(':') as [string, string | undefined]
    if (id === undefined) return this.held.has(key)
    if (kind === 'said') return this.said.includes(id)
    return this.rulings.get(id)?.verdict === kind
  }

  caughtLying(suspect: SuspectId): boolean {
    return [...this.rulings.values()].some(
      (r) => r.verdict === 'lie' && statementOf(r.statement).suspect === suspect,
    )
  }

  // ---- suspicion --------------------------------------------------------------

  /**
   * Suspicion as a probability: three whole percentages that add up to 100.
   * It is what the evidence says, plus the detective's own lean toward
   * whoever he has been pressing.
   */
  get suspicion(): Record<SuspectId, number> {
    const score = (s: SuspectId): number =>
      Math.max(SUSPICION_FLOOR, this.raw[s]) + this.pressure[s] * SUSPICION_PER_PRESSURE
    const ids = SUSPECTS.map((s) => s.id)
    const total = ids.reduce((sum, s) => sum + score(s), 0)
    const exact = ids.map((s) => (score(s) / total) * 100)
    const floored = exact.map(Math.floor)
    // Hand the leftover points to the largest remainders, so it always sums to 100.
    let left = 100 - floored.reduce((a, b) => a + b, 0)
    const order = exact.map((v, i) => [v - floored[i]!, i] as const).sort((a, b) => b[0] - a[0])
    for (const [, i] of order) {
      if (left <= 0) break
      floored[i] = floored[i]! + 1
      left -= 1
    }
    return { crane: floored[0]!, sam: floored[1]!, helen: floored[2]! }
  }

  get locked(): boolean {
    return this.killerValue !== null
  }

  /** Who did it. Null until the detective's questioning has decided. */
  get killer(): SuspectId | null {
    return this.killerValue
  }

  get confessed(): boolean {
    return this.confessedValue
  }

  /** Who the detective has leaned on hardest. Evidence breaks a tie, then recency. */
  private mostPressed(): SuspectId {
    const ids = SUSPECTS.map((s) => s.id)
    return [...ids].sort((a, b) => {
      if (this.pressure[b] !== this.pressure[a]) return this.pressure[b] - this.pressure[a]
      if (this.raw[b] !== this.raw[a]) return this.raw[b] - this.raw[a]
      return Number(b === this.lastConfronted) - Number(a === this.lastConfronted)
    })[0]!
  }

  // ---- questioning --------------------------------------------------------------

  /** Open a conversation. Returns what is said before the detective's first move. */
  talk(suspect: SuspectId): Line[] {
    const ig = INTERROGATIONS[suspect]
    if (this.met.has(suspect)) return ig.again
    this.met.add(suspect)
    return this.play(suspect, ig.intro)
  }

  /** The four moves, always in the same order. */
  options(suspect: SuspectId): Option[] {
    return STANCES.map((stance) => {
      if (stance === 'present') {
        return { stance, label: 'Show them something from the case file.', fresh: this.items().length > 0 }
      }
      const next = this.nextExchange(suspect, stance)
      return { stance, label: (next ?? INTERROGATIONS[suspect].spent[stance]).ask ?? '', fresh: next !== null }
    })
  }

  private nextExchange(suspect: SuspectId, stance: Exclude<Stance, 'present'>): Exchange | null {
    return (
      INTERROGATIONS[suspect][stance].find(
        (e) => !this.used.has(e) && (e.needs ?? []).every(this.has),
      ) ?? null
    )
  }

  /** Press, sympathise, or say nothing. */
  take(suspect: SuspectId, stance: Exclude<Stance, 'present'>): Line[] {
    this.pressure[suspect] = Math.max(0, this.pressure[suspect] + PRESSURE[stance])
    if (stance === 'press') this.lastConfronted = suspect
    const next = this.nextExchange(suspect, stance)
    if (next) this.used.add(next)
    return this.play(suspect, next ?? INTERROGATIONS[suspect].spent[stance])
  }

  /** Everything in the case file that can be shown to someone. */
  items(): Item[] {
    const clues: Item[] = this.cluesFound.map((c) => ({ id: c.id, kind: 'clue', title: c.name, text: c.text }))
    const statements: Item[] = this.notebook.map((e) => ({
      id: e.statement.id,
      kind: 'statement',
      title: `${nameOf(e.statement.suspect)} said`,
      text: e.statement.text,
    }))
    return [...clues, ...statements]
  }

  /** Put something in front of a suspect and see what it does to them. */
  present(suspect: SuspectId, itemId: string): Line[] {
    if (!this.items().some((i) => i.id === itemId)) throw new Error(`"${itemId}" is not in the case file`)
    const ig = INTERROGATIONS[suspect]
    this.pressure[suspect] += PRESSURE.present
    this.lastConfronted = suspect

    if (itemId === ALIBI[suspect].id) {
      return this.play(suspect, this.killerValue === suspect ? ig.alibi.fails : ig.alibi.holds)
    }
    const match = (ig.present[itemId] ?? []).find((e) => (e.needs ?? []).every(this.has))
    return this.play(suspect, match ?? ig.shrug)
  }

  /** Apply an exchange: record what was said and ruled, and return it with the detective's thoughts. */
  private play(suspect: SuspectId, exchange: Exchange): Line[] {
    const lines: Line[] = [...exchange.lines]
    for (const id of exchange.says ?? []) if (!this.said.includes(id)) this.said.push(id)

    for (const ruling of exchange.rulings ?? []) {
      if (!this.said.includes(ruling.statement) || this.rulings.has(ruling.statement)) continue
      this.rulings.set(ruling.statement, ruling)
      const statement = statementOf(ruling.statement)
      const alibi = statement.kind === 'alibi'
      const lie = ruling.verdict === 'lie'
      this.raw[statement.suspect] += lie
        ? alibi
          ? WEIGHT.alibiLie
          : WEIGHT.lie
        : alibi
          ? WEIGHT.alibiTruth
          : WEIGHT.truth
      this.notices.push(`${lie ? 'Lie' : 'Truth'}: ${nameOf(statement.suspect)}`)
      lines.push({ who: 'think', text: `${lie ? 'A lie.' : 'True.'} ${ruling.why} ${ruling.deduction}` })
    }

    if (exchange.thought) lines.push({ who: 'think', text: exchange.thought })
    if (exchange.confesses) {
      this.confessedValue = true
      this.notices.push(`${nameOf(suspect)} has confessed.`)
    }

    // Two different people caught lying: the case locks onto whoever has been pressed hardest.
    if (!this.locked && SUSPECTS.filter((s) => this.caughtLying(s.id)).length >= 2) {
      this.killerValue = this.mostPressed()
      this.notices.push('New lead: check where each of them was at half past ten.')
      lines.push({ who: 'think', text: LOCK_THOUGHT })
    }
    return lines
  }

  /** Pop-ups earned since the last call. */
  takeNotices(): string[] {
    const out = this.notices
    this.notices = []
    return out
  }

  status(suspect: SuspectId): SuspectStatus {
    if (this.confessedValue && this.killerValue === suspect) return 'Confessed'
    const alibi = this.rulings.get(STATEMENTS.find((s) => s.suspect === suspect && s.kind === 'alibi')!.id)
    if (alibi?.verdict === 'truth') return 'Alibi holds'
    if (this.caughtLying(suspect)) return 'Caught lying'
    return this.met.has(suspect) ? 'Questioned' : 'Not questioned'
  }

  // ---- the arrest --------------------------------------------------------------

  /** Nobody is arrested by a detective who has not spoken to everyone. */
  get canAccuse(): boolean {
    return SUSPECTS.every((s) => this.met.has(s.id))
  }

  get ending(): EndingId | null {
    return this.endingValue
  }

  accuse(suspect: SuspectId): EndingId {
    if (!this.canAccuse) throw new Error('cannot accuse before questioning all three')
    this.accusedValue = suspect
    if (suspect !== this.killerValue) this.endingValue = 'ending.wrong'
    else this.endingValue = this.confessedValue ? 'ending.true' : 'ending.no_proof'
    return this.endingValue
  }

  endingTitle(): string {
    return this.endingValue ? ENDING_TITLE[this.endingValue] : ''
  }

  endingText(): string {
    const accused = this.accusedValue
    if (!this.endingValue || !accused) return ''
    const name = nameOf(accused)
    if (this.endingValue === 'ending.true') return TRUE_ENDING[accused]
    if (this.endingValue === 'ending.no_proof') {
      return `You name ${name}, and you may even be right. But you never showed where they were at half past ten, and a lawyer finds that gap in a morning. They are home by lunch. The story never runs.`
    }
    if (this.killerValue && this.confessedValue) {
      return `${name} is arrested. ${nameOf(this.killerValue)} told you what happened, to your face, in a room with nobody else in it, and will never say it again. You had the answer and you wrote down a different name.`
    }
    if (this.killerValue) {
      return `${name} is arrested on the strength of a lie that was never about the murder. ${nameOf(this.killerValue)} watches the cars pull out, and goes home. The answer was in the building. You asked the wrong person for it.`
    }
    return `${name} is arrested for lying, which is not what Nora Hale died of. Two other people walk out of the building tonight. You never found out where any of them were at half past ten.`
  }

  /** The closing "this is what you did" list. */
  recap(): string[] {
    const lines: string[] = []
    const pressed = this.mostPressed()
    if (this.pressure[pressed] > 0) lines.push(`You leaned hardest on ${nameOf(pressed)}.`)
    if (this.killerValue) lines.push(`In this telling, it was ${nameOf(this.killerValue)}.`)
    else lines.push('You never found out who it was.')
    const entries = this.notebook
    lines.push(
      `Lies caught: ${entries.filter((e) => e.verdict === 'lie').length}. Truths confirmed: ${entries.filter((e) => e.verdict === 'truth').length}.`,
    )
    lines.push(`Evidence found: ${this.cluesFound.length} of ${CLUES.length + SUSPECTS.length}.`)
    if (this.killerValue) lines.push('Lean on someone else, and it will be someone else.')
    return lines
  }
}

function viewOf(id: ViewId): View {
  const found = VIEWS.find((v) => v.id === id)
  if (!found) throw new Error(`unknown view "${id}"`)
  return found
}

function statementOf(id: string): Statement {
  const found = STATEMENTS.find((s) => s.id === id)
  if (!found) throw new Error(`unknown statement "${id}"`)
  return found
}

export function nameOf(id: SuspectId): string {
  return SUSPECTS.find((s) => s.id === id)!.name
}

/** Split closing narration into screens, breaking only between sentences. */
export function paginate(text: string, maxChars: number): string[] {
  const pages: string[] = []
  let current = ''
  for (const sentence of text.split(/(?<=\.)\s+/)) {
    const next = current ? `${current} ${sentence}` : sentence
    if (current && next.length > maxChars) {
      pages.push(current)
      current = sentence
    } else {
      current = next
    }
  }
  if (current) pages.push(current)
  return pages
}
