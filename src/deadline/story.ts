/**
 * DEADLINE - the whole case as data.
 *
 * A journalist is dead at her desk and three people are still in the building.
 * Nothing here knows how it is drawn: src/noir/rooms.ts holds a hit area for
 * every spot id listed below.
 *
 * THERE IS NO DEFAULT MURDERER.
 *
 * Every suspect has a motive, a secret they lie about, and an alibi for half
 * past ten that nobody can check at first. All three secrets are always true,
 * so all three can always be caught lying. What is not fixed is whose alibi
 * fails. Once the detective has broken two people's lies, the case locks onto
 * whoever the detective has leaned on hardest, and from then on the evidence
 * of where each of them was at half past ten is real and consistent: two
 * alibis hold, one does not. The detective's questioning makes the murderer.
 *
 * That is why every alibi object and every confession exists in two versions.
 */

export type SuspectId = 'crane' | 'sam' | 'helen'

/** `think` is the detective reasoning to himself. It is shown, never spoken. */
export type Who = 'you' | 'note' | 'think' | SuspectId

/** How a suspect holds themselves. The renderer turns this into a pose. */
export type Mood = 'composed' | 'defensive' | 'caught' | 'broken'

export type Line = { who: Who; text: string; mood?: Mood }

export const SUSPECTS: { id: SuspectId; name: string; role: string }[] = [
  { id: 'crane', name: 'Victor Crane', role: 'The builder she was exposing' },
  { id: 'sam', name: 'Sam Ortiz', role: 'Junior reporter' },
  { id: 'helen', name: 'Helen Marsh', role: 'Her editor' },
]

// ---- evidence ------------------------------------------------------------------------

export type ClueId =
  | 'clue.log'
  | 'clue.printer'
  | 'clue.award'
  | 'clue.usb'
  | 'clue.payments'
  | 'clue.page'
  | 'alibi.crane'
  | 'alibi.sam'
  | 'alibi.helen'

export type Clue = { id: ClueId; name: string; text: string }

export const CLUES: Clue[] = [
  { id: 'clue.log', name: 'Visitor log', text: 'Crane signed in at 9:40 PM to see N. Hale. He never signed out.' },
  { id: 'clue.printer', name: 'Print queue', text: "Her draft went to the editor's printer at 10:20 PM. The file was deleted at 10:50." },
  { id: 'clue.award', name: 'Press Guild award', text: 'The weapon. From the shelf by the newsroom door. Its base has been wiped.' },
  { id: 'clue.usb', name: "Sam's USB stick", text: "Nora's finished story, saved at 10:50 PM." },
  { id: 'clue.payments', name: 'Envelope of payments', text: "Six years of monthly payments from Crane's company, kept in the editor's office." },
  { id: 'clue.page', name: 'Red-pen page', text: "The last page of the story, from Helen's bin. Her name is circled twice." },
]

/**
 * Where each of them was at half past ten. Each object says one thing if its
 * owner is innocent and another if they are the killer, and none of them can
 * be found until the case has locked.
 */
export const ALIBI: Record<
  SuspectId,
  { id: ClueId; name: string; holds: { text: string; examine: string }; fails: { text: string; examine: string } }
> = {
  crane: {
    id: 'alibi.crane',
    name: "Crane's phone",
    holds: {
      text: 'A call to a law firm, 10:22 to 10:41 PM.',
      examine: 'His phone, charging on the reception desk. Recent calls. One outgoing at 10:22 PM, nineteen minutes, to a law firm.',
    },
    fails: {
      text: 'No call at all between 10:19 and 10:44 PM.',
      examine: 'His phone, charging on the reception desk. Recent calls. One ends at 10:19. The next begins at 10:44. Between them, nothing.',
    },
  },
  sam: {
    id: 'alibi.sam',
    name: 'Taxi receipt',
    holds: {
      text: 'Dropped at the City Ledger at 10:44 PM.',
      examine: 'The other pocket. A taxi receipt, still damp. Dropped at the City Ledger, 10:44 PM.',
    },
    fails: {
      text: 'Dropped at the City Ledger at 10:12 PM.',
      examine: 'The other pocket. A taxi receipt, still damp. Dropped at the City Ledger, 10:12 PM. Half an hour earlier than he told me.',
    },
  },
  helen: {
    id: 'alibi.helen',
    name: 'Her desk phone',
    holds: {
      text: 'Line one was in use from 10:08 to 10:52 PM.',
      examine: 'The display on her desk phone keeps the last call. Line one, 10:08 to 10:52 PM. Forty-four minutes.',
    },
    fails: {
      text: 'Her last call ended at 10:16 PM.',
      examine: 'The display on her desk phone keeps the last call. Line one, ended 10:16 PM. Nothing after it.',
    },
  },
}

// ---- statements ------------------------------------------------------------------------

/**
 * Something a suspect has claimed. It goes in the notebook UNVERIFIED and
 * stays that way until something proves it a TRUTH or a LIE.
 *
 * `secret` is the thing each of them is hiding that is not the murder.
 * `alibi` is where they say they were at half past ten.
 */
export type StatementKind = 'secret' | 'alibi' | 'detail'

export type Statement = { id: string; suspect: SuspectId; kind: StatementKind; text: string }

export const STATEMENTS: Statement[] = [
  { id: 'c.upstairs', suspect: 'crane', kind: 'secret', text: "I've never set foot in that newsroom." },
  { id: 'c.advert', suspect: 'crane', kind: 'secret', text: 'I came to see the editor about advertising.' },
  { id: 'c.paid', suspect: 'crane', kind: 'detail', text: "I've paid Helen Marsh for six years to hold stories about me." },
  { id: 'c.alibi', suspect: 'crane', kind: 'alibi', text: 'At half past ten I was on the phone to my lawyer, by the lobby window.' },

  { id: 's.home', suspect: 'sam', kind: 'secret', text: 'I went home at nine. I only came back when I saw the police cars.' },
  { id: 's.mine', suspect: 'sam', kind: 'detail', text: 'The building story was mine first. Helen gave it to Nora.' },
  { id: 's.shredder', suspect: 'sam', kind: 'detail', text: "When I came in, Helen's door was shut and her shredder was running." },
  { id: 's.alibi', suspect: 'sam', kind: 'alibi', text: 'I got back at quarter to eleven. She was already dead.' },

  { id: 'h.unread', suspect: 'helen', kind: 'secret', text: 'I never read a word of her story.' },
  { id: 'h.advertiser', suspect: 'helen', kind: 'secret', text: 'Victor Crane is an advertiser. Nothing more.' },
  { id: 'h.alibi', suspect: 'helen', kind: 'alibi', text: 'I was in my office with the door shut, on calls, from nine until I found her at eleven.' },
]

/** The detective settling a statement: what it is, why, and what follows from it. */
export type Ruling = { statement: string; verdict: 'truth' | 'lie'; why: string; deduction: string }

// ---- interrogation ------------------------------------------------------------------------

/**
 * The four things a detective can do with a suspect, always in this order.
 * Pressing is what makes someone the detective's suspect.
 */
export type Stance = 'press' | 'sympathise' | 'present' | 'silence'

export const STANCES: Stance[] = ['press', 'sympathise', 'present', 'silence']

/**
 * One move and its answer.
 *
 * `ask` is the line on the button. `needs` are statement or verdict keys that
 * must hold first: "said:s.alibi", "lie:s.home", "truth:c.paid".
 */
export type Exchange = {
  ask?: string
  needs?: string[]
  lines: Line[]
  /** Statements made in this exchange. They go into the notebook. */
  says?: string[]
  rulings?: Ruling[]
  /** What the detective makes of it, shown after the lines. */
  thought?: string
  /** The suspect admits to the murder. */
  confesses?: boolean
}

export type Interrogation = {
  /** Played the first time you speak to them. */
  intro: Exchange
  /** Played when you come back. */
  again: Line[]
  press: Exchange[]
  sympathise: Exchange[]
  silence: Exchange[]
  /** What each stance gets once it has nothing new to give. */
  spent: Record<Exclude<Stance, 'present'>, Exchange>
  /** Showing them a piece of evidence or someone's statement, by its id. First match wins. */
  present: Record<string, Exchange[]>
  /** Showing them something that means nothing to them. */
  shrug: Exchange
  /** Showing them their own alibi object: it either holds or it does not. */
  alibi: { holds: Exchange; fails: Exchange }
}

export const INTERROGATIONS: Record<SuspectId, Interrogation> = {
  // -- Victor Crane, in the lobby --------------------------------------------------
  crane: {
    intro: {
      lines: [
        { who: 'note', text: 'He stands by the window with his coat on, checking his watch. He does not sit.', mood: 'composed' },
        { who: 'crane', text: 'Detective. I hope this is quick. I have a site inspection at six.' },
        { who: 'you', text: 'Were you upstairs tonight?' },
        { who: 'crane', text: "I've never set foot in that newsroom. I came to see the editor about advertising. I've been in this lobby the whole time." },
      ],
      says: ['c.upstairs', 'c.advert'],
      thought: 'A man with a six o\'clock inspection, waiting in a newspaper lobby at eleven at night. To talk about advertising.',
    },
    again: [{ who: 'crane', text: 'Still here, Detective. As are you.' }],
    press: [
      {
        ask: 'Sit down. Nobody is going anywhere.',
        lines: [
          { who: 'you', text: 'Sit down. Nobody is going anywhere.', mood: 'defensive' },
          { who: 'crane', text: "I'd be careful with that tone. I know your commissioner." },
        ],
        thought: 'He reached for the commissioner before he reached for an answer.',
      },
      {
        ask: 'Her story ends your company. That is a reason to want her gone.',
        lines: [
          { who: 'you', text: 'Her story ends your company. That is a reason to want her gone.', mood: 'defensive' },
          { who: 'crane', text: "It's a reason to call a lawyer. Which I did. Men like me don't need people dead, Detective. We need them quiet." },
        ],
      },
    ],
    sympathise: [
      {
        ask: "A woman is dead upstairs. I'd like your help.",
        lines: [
          { who: 'you', text: "A woman is dead upstairs, Mr Crane. I'd like your help.", mood: 'composed' },
          { who: 'crane', text: "Of course. Terrible thing. I didn't know her. I knew her byline. She wrote about my company the way some people write about the weather." },
        ],
      },
      {
        ask: 'Forty buildings, and they will remember the one.',
        lines: [
          { who: 'you', text: 'Forty buildings, and they will remember the one.', mood: 'composed' },
          { who: 'crane', text: 'Thirty-nine of them are still standing. Nobody writes that.' },
          { who: 'crane', text: 'Eleven people were in the fortieth. I know their names. She was going to print that I did not.' },
        ],
        thought: 'That was the first thing he has said tonight that cost him something.',
      },
    ],
    silence: [
      {
        ask: '(Say nothing. Let the rain do the talking.)',
        lines: [
          { who: 'note', text: 'You let the rain do the talking.', mood: 'defensive' },
          { who: 'crane', text: "I don't have to fill the quiet for you, Detective." },
          { who: 'crane', text: 'Look, she was alive when... she was alive the last I heard.', mood: 'caught' },
        ],
        thought: 'Alive the last he heard. Heard from whom? He started to say something else.',
      },
    ],
    spent: {
      press: {
        ask: 'Tell me again where you were.',
        lines: [
          { who: 'you', text: 'Tell me again where you were.', mood: 'defensive' },
          { who: 'crane', text: 'The same place I was the last time you asked.' },
        ],
      },
      sympathise: {
        ask: 'This must be a long night for you.',
        lines: [
          { who: 'you', text: 'This must be a long night for you.' },
          { who: 'crane', text: 'I have had longer. Ask your questions.' },
        ],
      },
      silence: {
        ask: '(Say nothing.)',
        lines: [{ who: 'note', text: 'He checks his watch. This time the quiet does not move him.' }],
      },
    },
    present: {
      'clue.log': [
        {
          lines: [
            { who: 'you', text: 'Visitor log. V. Crane, 9:40 PM, to see N. Hale. Your handwriting.', mood: 'caught' },
            { who: 'crane', text: '...Fine. I went up. Ten minutes.' },
            { who: 'you', text: 'To do what?' },
            { who: 'crane', text: 'To make her an offer. A generous one. She laughed at me. She said the story was already written and my money was the best quote in it.', mood: 'defensive' },
            { who: 'crane', text: "So I came down here and called someone who could actually stop it. I've paid Helen Marsh for six years. Stories about me get held for legal review and are never seen again." },
            { who: 'you', text: 'And at half past ten?' },
            { who: 'crane', text: 'On the phone to my lawyer, by that window. Twenty minutes.', mood: 'composed' },
          ],
          says: ['c.paid', 'c.alibi'],
          rulings: [
            {
              statement: 'c.upstairs',
              verdict: 'lie',
              why: 'The visitor log has him signing in to see Nora at 9:40.',
              deduction: 'He saw her less than an hour before she died, and hid it.',
            },
            {
              statement: 'c.advert',
              verdict: 'lie',
              why: 'By his own admission he came to have the story stopped, not to buy a page.',
              deduction: 'He had a second way to stop the story. A man with a second way has less need of a third.',
            },
          ],
          thought: 'He bribes. Whether a man who can buy the editor also needs to kill the reporter is a different question.',
        },
      ],
      'clue.payments': [
        {
          needs: ['said:c.paid'],
          lines: [
            { who: 'you', text: "The envelope from the editor's office. Six years, monthly, from your company.", mood: 'composed' },
            { who: 'crane', text: 'Then you know I was telling you the truth. I usually am, when it is cheaper.' },
          ],
          rulings: [
            {
              statement: 'c.paid',
              verdict: 'truth',
              why: "The envelope in Helen's office matches what he told me.",
              deduction: 'Crane tells the truth when it costs him nothing. The payments are real.',
            },
          ],
        },
        {
          lines: [
            { who: 'you', text: "An envelope from the editor's office. Six years of monthly payments from Crane Construction.", mood: 'caught' },
            { who: 'crane', text: '...Retainers. Consultancy.' },
            { who: 'you', text: 'For what?' },
            { who: 'crane', text: 'For peace and quiet.', mood: 'defensive' },
          ],
          rulings: [
            {
              statement: 'c.advert',
              verdict: 'lie',
              why: "Helen's office holds six years of payments from his company. This was never about advertising.",
              deduction: 'He owns the editor. He came tonight to use her.',
            },
          ],
        },
      ],
      'h.advertiser': [
        {
          lines: [
            { who: 'you', text: 'Helen Marsh says you are an advertiser. Nothing more.', mood: 'defensive' },
            { who: 'crane', text: 'Then she is a liar as well as expensive.' },
          ],
          thought: 'No loyalty between them. Whoever breaks first will bring the other down.',
        },
      ],
    },
    shrug: {
      lines: [
        { who: 'crane', text: 'I have no idea what that is, and I doubt it has my name on it.', mood: 'composed' },
      ],
    },
    alibi: {
      holds: {
        lines: [
          { who: 'you', text: 'Your phone. A call to a law firm, 10:22 to 10:41.', mood: 'composed' },
          { who: 'crane', text: 'As I said. I pay a great deal for my calls to be remembered.' },
        ],
        rulings: [
          {
            statement: 'c.alibi',
            verdict: 'truth',
            why: 'His phone shows the call: nineteen minutes, straight across half past ten.',
            deduction: 'Crane was on the phone in the lobby when she died. It was not him.',
          },
        ],
      },
      fails: {
        lines: [
          { who: 'you', text: 'Your phone. One call ends at 10:19. The next begins at 10:44. There is no lawyer in between.', mood: 'caught' },
          { who: 'crane', text: '...Calls drop.' },
          { who: 'you', text: 'For twenty-five minutes. Across the one half hour that matters.' },
          { who: 'note', text: 'He looks up the stairs. For the first time tonight he does not check his watch.', mood: 'broken' },
          { who: 'crane', text: 'I went back up. I thought, one more number. Everyone has a number.' },
          { who: 'crane', text: "She didn't even turn round. She said, you are in the last paragraph too, Victor. The award was on the shelf by the door." },
          { who: 'crane', text: 'I have put up forty buildings. I had never once hit anybody.' },
        ],
        rulings: [
          {
            statement: 'c.alibi',
            verdict: 'lie',
            why: 'His phone shows no call at all between 10:19 and 10:44.',
            deduction: 'He went back upstairs. Victor Crane killed Nora Hale.',
          },
        ],
        confesses: true,
      },
    },
  },

  // -- Sam Ortiz, at his desk -----------------------------------------------------
  sam: {
    intro: {
      lines: [
        { who: 'note', text: 'He is young, pale, and cannot keep his hands still. His coat hangs on the chair beside him.', mood: 'caught' },
        { who: 'sam', text: 'I already told the officer. I went home at nine. I only came back because I saw the police cars.' },
      ],
      says: ['s.home'],
      thought: 'He answered a question I had not asked yet.',
    },
    again: [{ who: 'sam', text: 'I... yes. What else do you need?' }],
    press: [
      {
        ask: "You don't look like a man who has been home.",
        lines: [
          { who: 'you', text: "You don't look like a man who has been home.", mood: 'caught' },
          { who: 'sam', text: "I... it's raining. I ran. What do you want me to say?" },
        ],
        thought: 'His coat is wet at the shoulders. Rain you get from running, or rain you get from standing outside a building deciding whether to go in.',
      },
      {
        ask: 'You wanted that story back. Badly enough?',
        lines: [
          { who: 'you', text: 'You wanted that story back. Badly enough?', mood: 'defensive' },
          { who: 'sam', text: "Wanting isn't doing. Everyone in this building wanted something from her." },
        ],
      },
    ],
    sympathise: [
      {
        ask: 'Take your time. Tell me about Nora.',
        lines: [
          { who: 'you', text: 'Take your time, Sam. Tell me about Nora.', mood: 'composed' },
          { who: 'sam', text: 'She was the best reporter in the building. Everyone knew it. She knew it most of all.' },
          { who: 'sam', text: 'The building story was mine first. I found the first document, eight months ago. Then Helen said it needed a senior name and gave it to Nora.', mood: 'defensive' },
        ],
        says: ['s.mine'],
        thought: 'He handed me his own motive without being asked. Either he is honest, or he wants me to think so.',
      },
      {
        ask: 'You did a stupid thing, not a murder. Help me now.',
        needs: ['lie:s.home'],
        lines: [
          { who: 'you', text: 'You did a stupid thing, Sam. That is not the same as a murder. Help me now.', mood: 'broken' },
          { who: 'sam', text: "Read the last paragraph. That's why I couldn't file it. It names Helen. It says she has been burying Crane stories for years." },
          { who: 'sam', text: 'And when I came in, her office door was shut and the shredder was running. At eleven at night.' },
        ],
        says: ['s.shredder'],
        thought: 'The last paragraph names the editor. And the editor was shredding paper.',
      },
    ],
    silence: [
      {
        ask: '(Say nothing. Watch his hands.)',
        lines: [
          { who: 'note', text: 'He looks at her desk across the room, then away.', mood: 'caught' },
          { who: 'sam', text: 'She was good to me. Mostly. I keep thinking I should have told her that.' },
        ],
        thought: 'He speaks about her in the past tense very easily, for someone who heard the news an hour ago.',
      },
    ],
    spent: {
      press: {
        ask: 'Go through your evening again. Slowly.',
        lines: [
          { who: 'you', text: 'Go through your evening again. Slowly.', mood: 'caught' },
          { who: 'sam', text: 'It does not change. I keep telling you. It does not change.' },
        ],
      },
      sympathise: {
        ask: 'Nobody is blaming you for being frightened.',
        lines: [
          { who: 'you', text: 'Nobody is blaming you for being frightened.' },
          { who: 'sam', text: 'Somebody will. Somebody always does.' },
        ],
      },
      silence: {
        ask: '(Say nothing.)',
        lines: [{ who: 'note', text: 'He stares at the desk. There is nothing more in the silence.' }],
      },
    },
    present: {
      'clue.usb': [
        {
          lines: [
            { who: 'you', text: "USB stick, from your coat. One file. Nora's story, saved at 10:50 tonight. An hour and fifty minutes after you went home.", mood: 'caught' },
            { who: 'sam', text: "She was already dead. I swear to you. I came back at quarter to eleven to... I don't know. To argue with her again.", mood: 'broken' },
            { who: 'sam', text: 'She was on the floor by her desk. I should have called someone.' },
            { who: 'you', text: 'Instead you copied her work.' },
            { who: 'sam', text: 'Her screen was still on. The whole story, finished. I thought, nobody else has this. I copied it and I deleted hers. Then I sat in the stairwell and could not move.' },
          ],
          says: ['s.alibi'],
          rulings: [
            {
              statement: 's.home',
              verdict: 'lie',
              why: 'The USB stick in his coat holds her story, saved at 10:50 PM.',
              deduction: 'He was at her desk tonight, and he took her work. He says she was dead when he got there.',
            },
          ],
          thought: 'A thief, by his own account. The question is whether he arrived before half past ten or after.',
        },
      ],
      'clue.printer': [
        {
          needs: ['lie:s.home'],
          lines: [
            { who: 'you', text: 'The file was deleted from her machine at 10:50.', mood: 'broken' },
            { who: 'sam', text: 'I told you. That was me. I wanted to be the only one who had it.' },
          ],
        },
        {
          lines: [
            { who: 'you', text: "Her story was deleted from her machine at 10:50 tonight.", mood: 'caught' },
            { who: 'sam', text: 'I would not know anything about that.' },
          ],
          thought: 'He did not ask what was deleted. He already knew.',
        },
      ],
      'h.unread': [
        {
          lines: [
            { who: 'you', text: 'Helen says she never read the story.', mood: 'defensive' },
            { who: 'sam', text: 'Everything goes through Helen. Everything. She reads the weather before it prints.' },
          ],
          thought: 'If nothing reaches print without her, then she read it.',
        },
      ],
    },
    shrug: {
      lines: [{ who: 'sam', text: "I don't know what that is. I really don't.", mood: 'caught' }],
    },
    alibi: {
      holds: {
        lines: [
          { who: 'you', text: 'A taxi receipt from your coat. Dropped here at 10:44.', mood: 'broken' },
          { who: 'sam', text: 'I told you. I told you she was already...' },
          { who: 'sam', text: 'I took her story. I did not take anything else from her.' },
        ],
        rulings: [
          {
            statement: 's.alibi',
            verdict: 'truth',
            why: 'The taxi receipt puts him outside the building until 10:44 PM.',
            deduction: 'Sam arrived after she was dead. He is a thief, not a killer.',
          },
        ],
      },
      fails: {
        lines: [
          { who: 'you', text: 'A taxi receipt from your coat. Dropped here at 10:12. Not quarter to eleven.', mood: 'caught' },
          { who: 'note', text: 'His hands stop moving. It is the first time tonight they have been still.', mood: 'broken' },
          { who: 'sam', text: 'I came back to ask her for one thing. My name on it. Second, underneath hers. That was all.' },
          { who: 'sam', text: "She said, you found a document, Sam. I found the story. She didn't even turn her chair round." },
          { who: 'sam', text: 'I do not remember picking it up. I remember how heavy it was.' },
          { who: 'sam', text: 'Then I sat with her for half an hour. Then I took the story, because it was all that was left of either of us.' },
        ],
        rulings: [
          {
            statement: 's.alibi',
            verdict: 'lie',
            why: 'The taxi receipt puts him at the building at 10:12 PM, not quarter to eleven.',
            deduction: 'He was upstairs with her at half past ten. Sam Ortiz killed Nora Hale.',
          },
        ],
        confesses: true,
      },
    },
  },

  // -- Helen Marsh, in her office --------------------------------------------------
  helen: {
    intro: {
      lines: [
        { who: 'note', text: 'She sits behind her desk with her hands folded. Behind her, a shelf of framed front pages.', mood: 'composed' },
        { who: 'helen', text: "Detective. I've asked the staff to give you whatever you need. Nora was the finest journalist I ever edited." },
        { who: 'you', text: 'You found her.' },
        { who: 'helen', text: 'At eleven. I had been in here with the door shut since nine, on calls. I came out for coffee and she was on the floor.' },
        { who: 'you', text: 'What was she working on?' },
        { who: 'helen', text: "The Crane building piece. It wasn't ready. She hadn't filed it. I never read a word of it." },
        { who: 'you', text: 'And Victor Crane? He is in your lobby.' },
        { who: 'helen', text: 'An advertiser. A difficult one. Nothing more.' },
      ],
      says: ['h.alibi', 'h.unread', 'h.advertiser'],
      thought: 'Three answers, each one complete, none of them a word too long. She has been an editor for thirty years.',
    },
    again: [{ who: 'helen', text: 'Detective. Back again.' }],
    press: [
      {
        ask: 'You found her. That is convenient.',
        lines: [
          { who: 'you', text: 'You found her. That is convenient.', mood: 'defensive' },
          { who: 'helen', text: 'I found her because I was the only person on this floor who came out of a room to look.' },
        ],
      },
      {
        ask: 'What did her story say about you?',
        lines: [
          { who: 'you', text: 'What did her story say about you?', mood: 'defensive' },
          { who: 'helen', text: 'That is an extraordinary question to ask an editor about a piece she has not read.' },
        ],
        thought: 'She did not say it said nothing.',
      },
    ],
    sympathise: [
      {
        ask: 'Thirty years on this paper. Tonight must be hard.',
        lines: [
          { who: 'you', text: 'Thirty years on this paper. Tonight must be hard.', mood: 'composed' },
          { who: 'helen', text: 'I hired her. Did they tell you that? Nine years ago. She corrected my grammar in the interview.' },
        ],
      },
      {
        ask: 'She wrote it knowing what it would do to you.',
        needs: ['lie:h.unread'],
        lines: [
          { who: 'you', text: 'She wrote it knowing what it would do to you.', mood: 'defensive' },
          { who: 'helen', text: 'She was the one person in this building I never had to rewrite. I told her so once. She said it was because I was afraid to.' },
          { who: 'helen', text: 'She was right about that as well.', mood: 'caught' },
        ],
        thought: 'She admired her. That is not the same thing as forgiving her.',
      },
    ],
    silence: [
      {
        ask: '(Say nothing. Let her fill it.)',
        lines: [
          { who: 'note', text: 'You wait. She waits better.', mood: 'composed' },
          { who: 'helen', text: 'You are waiting for me to fill the silence. I taught that trick to half the reporters out there.' },
        ],
        thought: 'She will not be rushed. Whatever moves her, it will have to be on paper.',
      },
    ],
    spent: {
      press: {
        ask: 'I think you are leaving something out.',
        lines: [
          { who: 'you', text: 'I think you are leaving something out.', mood: 'defensive' },
          { who: 'helen', text: 'Everyone leaves something out, Detective. That is what editing is.' },
        ],
      },
      sympathise: {
        ask: 'I am sorry for your loss.',
        lines: [
          { who: 'you', text: 'I am sorry for your loss.' },
          { who: 'helen', text: 'Thank you. I expect to hear that a great deal tomorrow.' },
        ],
      },
      silence: {
        ask: '(Say nothing.)',
        lines: [{ who: 'note', text: 'She straightens a page on her desk and waits for you to finish not speaking.' }],
      },
    },
    present: {
      'clue.page': [
        {
          lines: [
            { who: 'you', text: 'This was in your bin. The last page of her story. Your red pen, all over it. And one name circled twice. Yours.', mood: 'caught' },
            { who: 'helen', text: '...The shredder jammed.' },
            { who: 'you', text: 'So you did read it.' },
            { who: 'helen', text: "I read it. Of course I read it, I am her editor. And yes, it was ugly, and yes, I was going to hold it. That is my job.", mood: 'defensive' },
            { who: 'helen', text: 'Holding a story is not killing a reporter, Detective.' },
          ],
          rulings: [
            {
              statement: 'h.unread',
              verdict: 'lie',
              why: 'The last page was in her bin, marked in her red pen, with her own name circled.',
              deduction: 'She read the paragraph that names her, tonight, minutes before Nora died.',
            },
            {
              statement: 's.shredder',
              verdict: 'truth',
              why: 'Helen admits the shredder was running, and that it jammed.',
              deduction: 'Sam told the truth about what he heard. He was outside her door, not inside it.',
            },
          ],
        },
      ],
      'clue.printer': [
        {
          lines: [
            { who: 'you', text: 'A full draft was sent to the printer in this office at 10:20.', mood: 'defensive' },
            { who: 'helen', text: "Then she printed it and I didn't notice. I was on the phone. Paper comes out of that machine all night." },
          ],
          thought: 'The printer is an arm\'s length from her chair. She would have had to not look at her own desk.',
        },
      ],
      'clue.payments': [
        {
          lines: [
            { who: 'you', text: 'An envelope from behind your front pages. Crane Construction. Monthly, for six years.', mood: 'caught' },
            { who: 'helen', text: '...That is a consultancy arrangement.' },
            { who: 'you', text: 'For holding stories.' },
            { who: 'helen', text: 'For judgement. About which stories are ready, and which are not.', mood: 'defensive' },
          ],
          rulings: [
            {
              statement: 'h.advertiser',
              verdict: 'lie',
              why: "The envelope on her own shelf holds six years of payments from Crane's company.",
              deduction: "She has been selling the paper's silence. Nora's story would have ended that.",
            },
            {
              statement: 'c.paid',
              verdict: 'truth',
              why: "Helen's envelope matches what Crane told me.",
              deduction: 'Crane tells the truth when it costs him nothing. The payments are real.',
            },
          ],
        },
      ],
      'c.paid': [
        {
          lines: [
            { who: 'you', text: 'Victor Crane says he has paid you for six years to make stories disappear.', mood: 'defensive' },
            { who: 'helen', text: 'A man facing ruin will say anything about anyone. Is that all you have? His word?' },
          ],
          thought: 'She asked what else I have. She did not say no.',
        },
      ],
      's.mine': [
        {
          lines: [
            { who: 'you', text: 'Sam says the building story was his, and you gave it to Nora.', mood: 'composed' },
            { who: 'helen', text: 'It needed a senior name. He was not ready. He will tell you he was.' },
          ],
          rulings: [
            {
              statement: 's.mine',
              verdict: 'truth',
              why: 'Helen confirms it: the story was his, and she took it from him.',
              deduction: "Sam's grudge is real, and he volunteered it. Liars rarely hand you their motive.",
            },
          ],
        },
      ],
      's.shredder': [
        {
          needs: ['lie:h.unread'],
          lines: [
            { who: 'you', text: 'Sam heard your shredder running. At eleven at night.', mood: 'defensive' },
            { who: 'helen', text: 'You have the page it jammed on. You know perfectly well what I was shredding.' },
          ],
          rulings: [
            {
              statement: 's.shredder',
              verdict: 'truth',
              why: 'Helen admits the shredder was running, and that it jammed.',
              deduction: 'Sam told the truth about what he heard. He was outside her door, not inside it.',
            },
          ],
        },
        {
          lines: [
            { who: 'you', text: 'Sam heard your shredder running. At eleven at night.', mood: 'defensive' },
            { who: 'helen', text: 'I shred things every night. Sources. Legal notes. Try again.' },
          ],
        },
      ],
    },
    shrug: {
      lines: [{ who: 'helen', text: 'I am not sure what you expect me to say about that.', mood: 'composed' }],
    },
    alibi: {
      holds: {
        lines: [
          { who: 'you', text: 'Your desk phone. Line one, 10:08 to 10:52.', mood: 'composed' },
          { who: 'helen', text: 'A source in the planning office. He will confirm it, reluctantly.' },
          { who: 'helen', text: 'I am guilty of several things, Detective. You will find them all in that envelope. Not this.' },
        ],
        rulings: [
          {
            statement: 'h.alibi',
            verdict: 'truth',
            why: 'Her desk phone shows one call running from 10:08 to 10:52 PM.',
            deduction: 'Helen was on the phone when Nora died. Corrupt, but not a killer.',
          },
        ],
      },
      fails: {
        lines: [
          { who: 'you', text: 'Your desk phone. Your last call ended at 10:16. You were not on the phone at half past ten.', mood: 'caught' },
          { who: 'note', text: 'Silence. The rain is the only sound. Then she unfolds her hands.', mood: 'broken' },
          { who: 'helen', text: 'She came in at twenty past ten and put the pages on my desk. She said, I wanted you to read it before the city does.' },
          { who: 'helen', text: 'Thirty years I gave this paper. She was going to end it in one paragraph and feel sad about it.' },
          { who: 'helen', text: 'I followed her back to her desk. The award was on the shelf by the door, with the name of this paper on it.' },
          { who: 'helen', text: 'I only wanted her to stop walking away from me.' },
        ],
        rulings: [
          {
            statement: 'h.alibi',
            verdict: 'lie',
            why: 'Her desk phone shows her last call ended at 10:16 PM.',
            deduction: 'She followed Nora back to her desk. Helen Marsh killed Nora Hale.',
          },
        ],
        confesses: true,
      },
    },
  },
}

/** What the detective thinks at the moment the case locks. */
export const LOCK_THOUGHT =
  'Two of them have lied to me now. But lying is not killing. What matters is where each of them was at half past ten, and now I know what to look for.'

// ---- the building -----------------------------------------------------------------

export type ViewId = 'lobby' | 'newsroom' | 'desk' | 'samdesk' | 'office'
export type Dir = 'forward' | 'left' | 'right' | 'back'

export type Exit = {
  to: ViewId
  label: string
  /** Open once any one of these suspects has been caught in a lie. */
  needsLieFrom?: SuspectId[]
  /** What the detective thinks when the way is still shut. */
  locked?: string
}

/** Something in view that can be examined or spoken to. */
export type Spot = {
  id: string
  label: string
  examine?: string
  /** What the detective makes of it. */
  thought?: string
  clue?: ClueId
  talk?: SuspectId
  /** Holds this suspect's alibi object, once the case has locked. */
  alibi?: SuspectId
}

/**
 * A place to stand and a direction to face. Movement is one step per key
 * press between these, which is the whole of first-person navigation.
 */
export type View = {
  id: ViewId
  ambience: 'rain' | 'room' | 'night'
  /** Narration the first time the player stands here. */
  enter: string
  exits: Partial<Record<Dir, Exit>>
  spots: Spot[]
}

export const VIEWS: View[] = [
  {
    id: 'lobby',
    ambience: 'rain',
    enter:
      'The City Ledger. A reporter is dead upstairs and three people have not been allowed to leave. The lobby lights are on. Nothing above them is.',
    exits: { forward: { to: 'newsroom', label: 'Upstairs' } },
    spots: [
      {
        id: 'lobby.log',
        label: 'Visitor log',
        examine:
          'The night book. One entry after nine. V. Crane, 9:40 PM, to see N. Hale. The sign-out column beside it is empty.',
        thought: 'He signed in to see her. Nobody signs in to see a woman and then waits in the lobby.',
        clue: 'clue.log',
      },
      { id: 'lobby.phone', label: "Crane's phone", alibi: 'crane' },
      { id: 'lobby.crane', label: 'Victor Crane', talk: 'crane' },
    ],
  },
  {
    id: 'newsroom',
    ambience: 'room',
    enter:
      'Night lights only. Rows of dark desks, one lamp still on, and under it the shape nobody has covered yet.',
    exits: {
      forward: { to: 'desk', label: "Nora's desk" },
      left: { to: 'samdesk', label: "Sam's desk" },
      right: {
        to: 'office',
        label: "Editor's office",
        needsLieFrom: ['crane', 'sam'],
        locked:
          "The editor's door is shut. Her voice behind it, low, on the phone. She can wait. The other two might not.",
      },
      back: { to: 'lobby', label: 'Lobby' },
    },
    spots: [],
  },
  {
    id: 'desk',
    ambience: 'room',
    enter: 'Her chair is on its side. Her screen is still awake.',
    exits: { back: { to: 'newsroom', label: 'Newsroom' } },
    spots: [
      {
        id: 'desk.screen',
        label: 'Her screen',
        examine:
          "The story folder is empty. Deleted at 10:50 PM. But the print queue remembers. One job, 10:20 PM, sent to the editor's office printer.",
        thought: 'Printed at 10:20, deleted at 10:50. Two different people touched this story tonight, half an hour apart.',
        clue: 'clue.printer',
      },
      {
        id: 'desk.award',
        label: 'On the floor',
        examine:
          'A Press Guild award, brass on a marble base. It stands on the shelf by the newsroom door, where everyone who comes in passes it. The base has been wiped.',
        thought: 'Not brought here. Picked up on the way in. Nobody planned this.',
        clue: 'clue.award',
      },
      {
        id: 'desk.body',
        label: 'Nora Hale',
        examine:
          'One blow, from behind, as she sat at her desk. The medic put it at half past ten. She never turned round.',
        thought: 'She did not turn round. She knew who was behind her, and she was not afraid of them.',
      },
    ],
  },
  {
    id: 'samdesk',
    ambience: 'room',
    enter: 'The junior reporter is sitting very upright at a desk with nothing on it.',
    exits: {
      right: { to: 'newsroom', label: 'Newsroom' },
      back: { to: 'newsroom', label: 'Newsroom' },
    },
    spots: [
      {
        id: 'sam.jacket',
        label: 'His coat',
        examine:
          'Damp at the shoulders. He has been outside tonight, and not at nine. In the inside pocket, a USB stick. One file on it, saved at 10:50 PM.',
        thought: 'Saved at 10:50. The same minute her copy was deleted.',
        clue: 'clue.usb',
        alibi: 'sam',
      },
      { id: 'sam.sam', label: 'Sam Ortiz', talk: 'sam' },
    ],
  },
  {
    id: 'office',
    ambience: 'room',
    enter: 'One desk lamp. Thirty years of front pages on the wall. She does not get up.',
    exits: {
      left: { to: 'newsroom', label: 'Newsroom' },
      back: { to: 'newsroom', label: 'Newsroom' },
    },
    spots: [
      {
        id: 'office.shelf',
        label: 'The shelf',
        examine:
          'Framed front pages. Behind one of them, an envelope gone soft with handling. Statements from Crane Construction. Monthly, for six years.',
        thought: 'Six years. The building came down four years ago. She was being paid before it fell and after.',
        clue: 'clue.payments',
      },
      {
        id: 'office.bin',
        label: 'The bin',
        examine:
          "Shredded paper, and one page that jammed and was pulled out whole. The last page of Nora's story, marked in red pen. One name is circled twice. Helen Marsh.",
        thought: 'You do not circle your own name twice in a story you have not read.',
        clue: 'clue.page',
      },
      { id: 'office.phone', label: 'Her desk phone', alibi: 'helen' },
      { id: 'office.helen', label: 'Helen Marsh', talk: 'helen' },
    ],
  },
]

// ---- endings -------------------------------------------------------------------

export type EndingId = 'ending.true' | 'ending.no_proof' | 'ending.wrong'

export const ENDING_TITLE: Record<EndingId, string> = {
  'ending.true': 'Deadline',
  'ending.no_proof': 'No case',
  'ending.wrong': 'Wrong name',
}

/** The three ways the case can be closed properly, one per killer. */
export const TRUE_ENDING: Record<SuspectId, string> = {
  crane:
    "Victor Crane is walked out through the lobby he waited in all night, past the visitor log with his name in it. Upstairs, Sam's copy of the story goes to the night printer under one name. Nora Hale. By dawn the presses are running, and the last paragraph has a new line in it: how the man it was about tried to stop it.",
  sam:
    'Sam Ortiz hands over the USB stick himself. He asks whether the story will still run. It runs, under one name. Nora Hale. Helen Marsh does not edit it. She has her own interview to give in the morning, about an envelope. By dawn the presses are running.',
  helen:
    "Helen Marsh walks out of her own newsroom between two officers, past the desk, without looking at the floor. Sam's copy of the story goes to the night printer under one name. Nora Hale. By dawn the presses are running, and every copy ends with the paragraph she died for.",
}
