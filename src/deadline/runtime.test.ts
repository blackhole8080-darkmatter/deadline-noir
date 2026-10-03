import { describe, expect, it } from 'vitest'
import { DeadlineRuntime } from './runtime'
import {
  ALIBI,
  CLUES,
  INTERROGATIONS,
  STANCES,
  STATEMENTS,
  SUSPECTS,
  VIEWS,
  type Dir,
  type Exchange,
  type SuspectId,
  type ViewId,
} from './story'

const IDS = SUSPECTS.map((s) => s.id)

function walk(rt: DeadlineRuntime, ...dirs: Dir[]): void {
  for (const dir of dirs) expect(rt.move(dir).moved, `step ${dir} from ${rt.view.id}`).toBe(true)
}

/** Where each suspect is, as a path from the newsroom and back. */
const ROUTE: Record<SuspectId, { there: Dir[]; back: Dir[] }> = {
  crane: { there: ['back'], back: ['forward'] },
  sam: { there: ['left'], back: ['back'] },
  helen: { there: ['right'], back: ['back'] },
}

/**
 * Play the whole case so that `target` ends up the killer: meet everyone,
 * catch Crane and Sam lying, and lean on the target until the case locks.
 * Leaves the player in the newsroom.
 */
function steerTo(rt: DeadlineRuntime, target: SuspectId): void {
  // Lobby: the log, and Crane's first answers.
  rt.use('lobby.log')
  rt.talk('crane')
  if (target === 'crane') {
    rt.take('crane', 'press')
    rt.take('crane', 'press')
  }
  rt.present('crane', 'clue.log')
  expect(rt.locked).toBe(false)

  // Sam: his coat, then his lie. This is the second liar, so the case locks here
  // unless the target still needs leaning on first.
  walk(rt, 'forward', 'left')
  rt.use('sam.jacket')
  rt.talk('sam')
  if (target === 'sam') {
    rt.take('sam', 'press')
    rt.take('sam', 'press')
    rt.take('sam', 'press')
  }
  if (target === 'helen') {
    // Helen has to be pressed before the second lie breaks, and her door only
    // opens once somebody has been caught, which Crane already has.
    walk(rt, 'back', 'right')
    rt.talk('helen')
    for (let i = 0; i < 4; i++) rt.take('helen', 'press')
    walk(rt, 'back', 'left')
  }
  rt.present('sam', 'clue.usb')
  expect(rt.locked).toBe(true)
  walk(rt, 'back')

  if (!rt.has('said:h.alibi')) {
    walk(rt, 'right')
    rt.talk('helen')
    walk(rt, 'back')
  }
}

/** From the newsroom: fetch a suspect's alibi object and put it in front of them. */
function checkAlibi(rt: DeadlineRuntime, suspect: SuspectId): void {
  walk(rt, ...ROUTE[suspect].there)
  rt.use({ crane: 'lobby.phone', sam: 'sam.jacket', helen: 'office.phone' }[suspect])
  rt.present(suspect, ALIBI[suspect].id)
  walk(rt, ...ROUTE[suspect].back)
}

describe('the detective makes the murderer', () => {
  for (const target of IDS) {
    it(`can end with ${target} as the killer, confessing`, () => {
      const rt = new DeadlineRuntime()
      steerTo(rt, target)
      expect(rt.killer).toBe(target)

      checkAlibi(rt, target)
      expect(rt.confessed).toBe(true)
      expect(rt.status(target)).toBe('Confessed')
      expect(rt.accuse(target)).toBe('ending.true')
      expect(rt.endingText().length).toBeGreaterThan(40)
    })

    it(`clears the other two when ${target} is the killer`, () => {
      const rt = new DeadlineRuntime()
      steerTo(rt, target)
      for (const other of IDS.filter((s) => s !== target)) {
        checkAlibi(rt, other)
        expect(rt.status(other), other).toBe('Alibi holds')
      }
      expect(rt.confessed).toBe(false)
    })
  }

  it('does not decide anything until two different people have been caught lying', () => {
    const rt = new DeadlineRuntime()
    rt.use('lobby.log')
    rt.talk('crane')
    for (let i = 0; i < 5; i++) rt.take('crane', 'press')
    rt.present('crane', 'clue.log')
    expect(rt.caughtLying('crane')).toBe(true)
    expect(rt.killer).toBeNull()
  })

  it('hides every alibi object until the case has locked', () => {
    const rt = new DeadlineRuntime()
    expect(rt.spotActive('lobby.phone')).toBe(false)
    expect(() => rt.use('lobby.phone')).toThrow()
    steerTo(rt, 'sam')
    walk(rt, 'back')
    expect(rt.spotActive('lobby.phone')).toBe(true)
  })

  it('gives the coat a second look once the detective knows what to look for', () => {
    const rt = new DeadlineRuntime()
    steerTo(rt, 'crane')
    walk(rt, 'left')
    expect(rt.use('sam.jacket').clue?.id).toBe('alibi.sam')
    expect(rt.use('sam.jacket').clue).toBeUndefined()
  })
})

describe('suspicion', () => {
  const total = (rt: DeadlineRuntime): number => IDS.reduce((sum, s) => sum + rt.suspicion[s], 0)

  it('starts even and always adds up to 100', () => {
    const rt = new DeadlineRuntime()
    expect(total(rt)).toBe(100)
    expect(Math.max(...IDS.map((s) => rt.suspicion[s])) - Math.min(...IDS.map((s) => rt.suspicion[s]))).toBeLessThanOrEqual(1)
    steerTo(rt, 'helen')
    expect(total(rt)).toBe(100)
    checkAlibi(rt, 'helen')
    expect(total(rt)).toBe(100)
  })

  it('rises when a suspect is caught lying', () => {
    const rt = new DeadlineRuntime()
    rt.use('lobby.log')
    rt.talk('crane')
    const before = rt.suspicion.crane
    rt.present('crane', 'clue.log')
    expect(rt.suspicion.crane).toBeGreaterThan(before)
  })

  it('falls when a statement is proved true', () => {
    const rt = new DeadlineRuntime()
    steerTo(rt, 'helen')
    const before = rt.suspicion.crane
    checkAlibi(rt, 'crane')
    expect(rt.suspicion.crane).toBeLessThan(before)
  })

  it('rises with pressure and eases with sympathy', () => {
    const rt = new DeadlineRuntime()
    rt.talk('crane')
    const start = rt.suspicion.crane
    rt.take('crane', 'press')
    const pressed = rt.suspicion.crane
    expect(pressed).toBeGreaterThan(start)
    rt.take('crane', 'sympathise')
    expect(rt.suspicion.crane).toBeLessThan(pressed)
  })

  it('puts the killer far ahead once their alibi fails', () => {
    const rt = new DeadlineRuntime()
    steerTo(rt, 'sam')
    checkAlibi(rt, 'sam')
    expect(rt.suspicion.sam).toBeGreaterThan(60)
  })
})

describe('the notebook', () => {
  it('logs a statement as unverified, then rules it with a reason and a deduction', () => {
    const rt = new DeadlineRuntime()
    rt.talk('crane')
    const before = rt.notebook.find((e) => e.statement.id === 'c.upstairs')!
    expect(before.verdict).toBe('unverified')

    rt.use('lobby.log')
    const lines = rt.present('crane', 'clue.log')
    const after = rt.notebook.find((e) => e.statement.id === 'c.upstairs')!
    expect(after.verdict).toBe('lie')
    expect(after.why.length).toBeGreaterThan(10)
    expect(after.deduction.length).toBeGreaterThan(10)
    expect(lines.some((l) => l.who === 'think')).toBe(true)
  })

  it("lets one suspect's statement be put to another", () => {
    const rt = new DeadlineRuntime()
    rt.use('lobby.log')
    rt.talk('crane')
    rt.present('crane', 'clue.log')
    walk(rt, 'forward', 'left')
    rt.talk('sam')
    rt.take('sam', 'sympathise')
    expect(rt.items().some((i) => i.id === 's.mine')).toBe(true)

    walk(rt, 'back', 'right')
    rt.talk('helen')
    rt.present('helen', 's.mine')
    expect(rt.notebook.find((e) => e.statement.id === 's.mine')!.verdict).toBe('truth')
  })

  it('shrugs at something that means nothing to the suspect, without ruling on anything', () => {
    const rt = new DeadlineRuntime()
    rt.use('lobby.log')
    walk(rt, 'forward', 'left')
    rt.talk('sam')
    rt.present('sam', 'clue.log')
    expect(rt.notebook.every((e) => e.verdict === 'unverified')).toBe(true)
  })

  it('refuses to present something that is not in the case file', () => {
    const rt = new DeadlineRuntime()
    rt.talk('crane')
    expect(() => rt.present('crane', 'clue.usb')).toThrow()
  })

  it('thinks out loud when evidence is first examined, and only then', () => {
    const rt = new DeadlineRuntime()
    expect(rt.use('lobby.log').lines.some((l) => l.who === 'think')).toBe(true)
    expect(rt.use('lobby.log').lines.some((l) => l.who === 'think')).toBe(false)
  })
})

describe('questioning', () => {
  it('always offers the same four moves in the same order', () => {
    const rt = new DeadlineRuntime()
    for (const s of IDS) {
      expect(rt.options(s).map((o) => o.stance)).toEqual(STANCES)
      for (const option of rt.options(s)) expect(option.label.length, `${s} ${option.stance}`).toBeGreaterThan(0)
    }
  })

  it('still answers when a stance has nothing new to give', () => {
    const rt = new DeadlineRuntime()
    rt.talk('crane')
    for (let i = 0; i < 6; i++) expect(rt.take('crane', 'silence').length).toBeGreaterThan(0)
    expect(rt.options('crane').find((o) => o.stance === 'silence')!.fresh).toBe(false)
  })

  it('keeps a move back until what it depends on has happened', () => {
    const rt = new DeadlineRuntime()
    rt.use('lobby.log')
    rt.talk('crane')
    rt.present('crane', 'clue.log')
    walk(rt, 'forward', 'left')
    rt.talk('sam')
    rt.take('sam', 'sympathise')
    expect(rt.options('sam').find((o) => o.stance === 'sympathise')!.fresh).toBe(false)
    rt.use('sam.jacket')
    rt.present('sam', 'clue.usb')
    expect(rt.options('sam').find((o) => o.stance === 'sympathise')!.fresh).toBe(true)
  })
})

describe('the arrest', () => {
  it('refuses an arrest until all three have been questioned', () => {
    const rt = new DeadlineRuntime()
    rt.talk('crane')
    expect(rt.canAccuse).toBe(false)
    expect(() => rt.accuse('crane')).toThrow()
  })

  it('fails without proof, even against the right person', () => {
    const rt = new DeadlineRuntime()
    steerTo(rt, 'crane')
    expect(rt.accuse('crane')).toBe('ending.no_proof')
  })

  it('names the one who walked free when the wrong person is arrested', () => {
    const rt = new DeadlineRuntime()
    steerTo(rt, 'crane')
    expect(rt.accuse('sam')).toBe('ending.wrong')
    expect(rt.endingText()).toContain('Victor Crane')
  })

  it('writes a recap that says who it was this time', () => {
    const rt = new DeadlineRuntime()
    steerTo(rt, 'helen')
    checkAlibi(rt, 'helen')
    rt.accuse('helen')
    expect(rt.recap().join(' ')).toContain('Helen Marsh')
  })
})

describe('the building', () => {
  it("keeps the editor's door shut until somebody has been caught lying", () => {
    const rt = new DeadlineRuntime()
    walk(rt, 'forward')
    const shut = rt.move('right')
    expect(shut.moved).toBe(false)
    expect(shut.moved === false && shut.text.length).toBeGreaterThan(0)
  })

  it('narrates a room the first time only', () => {
    const rt = new DeadlineRuntime()
    const first = rt.move('forward')
    expect(first.moved && first.narration.length).toBeGreaterThan(0)
    rt.move('back')
    const again = rt.move('forward')
    expect(again.moved && again.narration).toBe('')
  })

  it('can reach every view and always get back out', () => {
    const reachable = new Set<ViewId>(['lobby'])
    const frontier: ViewId[] = ['lobby']
    while (frontier.length > 0) {
      const at = frontier.pop()
      const view = VIEWS.find((v) => v.id === at)!
      for (const exit of Object.values(view.exits)) {
        if (reachable.has(exit.to)) continue
        reachable.add(exit.to)
        frontier.push(exit.to)
      }
    }
    expect([...reachable].sort()).toEqual(VIEWS.map((v) => v.id).sort())
  })
})

describe('the script is well formed', () => {
  const statementIds = new Set(STATEMENTS.map((s) => s.id))
  const clueIds = new Set<string>([...CLUES.map((c) => c.id), ...IDS.map((s) => ALIBI[s].id)])

  const exchangesOf = (s: SuspectId): Exchange[] => {
    const ig = INTERROGATIONS[s]
    return [
      ig.intro,
      ...ig.press,
      ...ig.sympathise,
      ...ig.silence,
      ...Object.values(ig.spent),
      ...Object.values(ig.present).flat(),
      ig.shrug,
      ig.alibi.holds,
      ig.alibi.fails,
    ]
  }
  const all = IDS.flatMap(exchangesOf)

  it('only ever says, rules on, or waits for statements that exist', () => {
    for (const exchange of all) {
      for (const id of exchange.says ?? []) expect(statementIds.has(id), id).toBe(true)
      for (const ruling of exchange.rulings ?? []) expect(statementIds.has(ruling.statement), ruling.statement).toBe(true)
      for (const need of exchange.needs ?? []) {
        const id = need.split(':')[1] ?? need
        expect(statementIds.has(id) || clueIds.has(id), need).toBe(true)
      }
    }
  })

  it('only reacts to things that can actually be in the case file', () => {
    for (const s of IDS) {
      for (const item of Object.keys(INTERROGATIONS[s].present)) {
        expect(statementIds.has(item) || clueIds.has(item), `${s} reacts to ${item}`).toBe(true)
      }
    }
  })

  it('gives every statement somebody who says it and something that settles it', () => {
    for (const statement of STATEMENTS) {
      expect(all.some((e) => e.says?.includes(statement.id)), `${statement.id} is never said`).toBe(true)
      expect(
        all.some((e) => e.rulings?.some((r) => r.statement === statement.id)),
        `${statement.id} can never be ruled on`,
      ).toBe(true)
    }
  })

  it('gives every suspect one alibi, and a confession when it fails', () => {
    for (const s of IDS) {
      expect(STATEMENTS.filter((st) => st.suspect === s && st.kind === 'alibi')).toHaveLength(1)
      expect(STATEMENTS.some((st) => st.suspect === s && st.kind === 'secret')).toBe(true)
      expect(INTERROGATIONS[s].alibi.fails.confesses).toBe(true)
      expect(INTERROGATIONS[s].alibi.holds.confesses).toBeFalsy()
    }
  })

  it('puts a label on every move the player can choose', () => {
    for (const s of IDS) {
      const ig = INTERROGATIONS[s]
      for (const exchange of [...ig.press, ...ig.sympathise, ...ig.silence, ...Object.values(ig.spent)]) {
        expect(exchange.ask?.length ?? 0, `${s}: ${exchange.lines[0]?.text}`).toBeGreaterThan(0)
      }
    }
  })

  it('places every clue and every alibi object somewhere in the building', () => {
    const spots = VIEWS.flatMap((v) => v.spots)
    for (const clue of CLUES) expect(spots.some((s) => s.clue === clue.id), clue.id).toBe(true)
    for (const s of IDS) expect(spots.some((spot) => spot.alibi === s), `alibi for ${s}`).toBe(true)
  })
})
