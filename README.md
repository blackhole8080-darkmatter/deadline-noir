# DEADLINE

A first-person noir detective game for the browser. One newsroom, three
suspects, one night.

**Play it: https://blackhole8080-darkmatter.github.io/deadline-noir/**

A reporter is dead at her desk and her story is missing. Three people are
still in the building. You walk the rooms with a torch, examine what it finds,
and question each of them until somebody's account stops holding together.

Best with sound on. Works in any current desktop browser.

## Controls

| Key | What it does |
| --- | --- |
| `W` / `↑` | Step forward |
| `A` `D` / `←` `→` | Turn |
| `S` / `↓` | Step back |
| Mouse | Aim the torch |
| Click / `E` | Examine something, or talk to someone |
| `1` to `4` | Press, sympathise, present evidence, say nothing |
| `N` | Notebook |
| `R` | Make the arrest, once you have spoken to all three |
| `M` | Mute |
| `Esc` | Step away from a conversation, or pause |

## How questioning works

Every conversation offers the same four moves:

1. **Press** them.
2. **Sympathise** with them.
3. **Present** something from the case file: a piece of evidence, or something
   another suspect has said.
4. **Say nothing**, and see who fills the silence.

Everything a suspect claims goes into the notebook as *unverified*. When
evidence settles it, the notebook stamps it **truth** or **lie** and records why,
and what follows from it. The suspicion meter in the corner moves with every
ruling.

<details>
<summary>Spoiler: what makes this game different</summary>

There is no fixed murderer. All three suspects have a motive, a secret they lie
about, and an alibi nobody can check at first. Once you have caught two of them
lying, the case locks onto whoever you have leaned on hardest, and from then on
the evidence of where each of them was at half past ten is real and consistent:
two alibis hold and one does not.

Play it again, lean on someone else, and it will be someone else.

</details>

## Run it yourself

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # the rules and the script, with no browser needed
npm run build    # typecheck, then a static build in dist/
```

## How it is put together

There are no image or audio files. Every room and every person is drawn in code
on a canvas, and every sound, including the music and the thunder, is
synthesised.

| Path | What it is |
| --- | --- |
| `src/deadline/story.ts` | The whole case as data: rooms, evidence, statements, every line of dialogue |
| `src/deadline/runtime.ts` | The rules: movement, the notebook, suspicion, and how the killer is decided. No rendering |
| `src/deadline/runtime.test.ts` | Proves each suspect can end up the killer, and that the script has no dead ends |
| `src/noir/rooms.ts` | The five rooms |
| `src/noir/figure.ts` | The suspects: a posable figure with four moods |
| `src/noir/stage.ts` | The canvas, the lighting pass, grain and letterbox |
| `src/game/audio.ts` | Rain, thunder, music and interface sounds |
| `src/noir-main.ts` | Input, the game loop, and the HTML interface over the canvas |

The split matters: the story and the rules know nothing about how the game
looks, so the script can be rewritten without touching the drawing, and the
rules can be tested without a browser.
