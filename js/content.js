// Every word the app shows lives here, so a therapist can review it in one place.
// House rules for this file:
//   - No "I don't know" option anywhere.
//   - No reassurance ("it'll be fine", "don't worry") and no praise.
//   - The teen-facing voice is first person ("I", "my") or plain "you".

export const APP_NAME = 'What-If Map';

export const DISCLAIMER =
  'A self-help practice tool to use alongside your therapist. It is not therapy.';

export const PRIVACY =
  'Everything stays on this phone. Nothing leaves it unless you choose to email, share, or export it.';

export const STEPS = ['worry', 'body', 'sort', 'core', 'reality', 'cope', 'act', 'sketch', 'next'];

export const STEP_NAMES = {
  worry: 'The worry',
  body: 'Body check',
  sort: 'Sort it',
  core: 'Dig to the core',
  reality: 'Reality check',
  cope: 'If it happened',
  act: 'Right now',
  sketch: 'Sketch it',
  next: 'My next step',
};

// ---- Step 1 ----
export const WHEN = [
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'week', label: 'This week' },
  { id: 'later', label: 'Later' },
];

// ---- Step 2 ----
export const BODY_SPOTS = [
  { id: 'stomach', label: 'Stomach' },
  { id: 'chest', label: 'Chest or heart' },
  { id: 'head', label: 'Head' },
  { id: 'throat', label: 'Throat' },
  { id: 'hands', label: 'Hands or shaky' },
  { id: 'nowhere', label: 'Nowhere right now', exclusive: true },
];

// ---- Step 3 ----
export const CATEGORIES = [
  { id: 'A', name: 'People', desc: 'Being judged, embarrassed, left out, someone upset with me' },
  { id: 'B', name: 'Performance', desc: 'Not knowing an answer, failing, falling behind' },
  { id: 'C', name: 'Body', desc: 'Feeling sick, panicking, needing the bathroom, not being able to leave' },
  { id: 'D', name: 'The unknown', desc: 'Not knowing what will happen, plans changing, getting lost' },
  { id: 'E', name: 'Something real happened', desc: 'Something someone said or did, online or in person' },
];

// ---- Step 4 ----
// `ifThat` is how the answer reads inside the next question:
// "And if <ifThat>, the worst part would be..."
export const CORE_FEARS = [
  { id: 'judged', label: 'People would think less of me', ifThat: 'people thought less of me' },
  { id: 'fallapart', label: "I couldn't handle it; I'd fall apart", ifThat: 'I fell apart' },
  { id: 'stuck', label: "I'd be stuck with no way out", ifThat: 'I was stuck with no way out' },
  { id: 'alone', label: "I'd be alone", ifThat: 'I was alone' },
  { id: 'forever', label: 'It would go on forever', ifThat: 'it went on forever' },
  { id: 'letdown', label: "I'd let someone down", ifThat: 'I let someone down' },
];
export const CORE_MAX_ROUNDS = 4;
// From round 2 on, the answer just picked is left out (the question already
// names it: "And if people thought less of me, the worst part would be…").
// This takes its place and ends the dig with that answer as the core fear.
export const CORE_BOTTOM = { id: 'bottom', label: 'Nothing worse. That’s the worst part.' };

// ---- Step 5 ----
export const ODDS = [0, 10, 25, 50, 75, 90, 100];
export const HISTORY = [
  { id: 'never', label: 'Never' },
  { id: 'once', label: 'Once' },
  { id: 'few', label: 'A few times' },
  { id: 'often', label: 'Often' },
];
export const FRIEND = [
  { id: 'unlikely', label: '"That\'s really unlikely."' },
  { id: 'okay', label: '"Even if it happens, you\'d be okay."' },
  { id: 'awkward', label: '"It\'d be awkward for a minute, then it\'d pass."' },
  { id: 'own', label: 'Their words', text: true, placeholder: 'What they would say' },
];

// ---- Step 6 ----
export const COPE = [
  { id: 'teacher', label: 'Ask a teacher or the counselor' },
  { id: 'text', label: 'Text mom or dad' },
  { id: 'breathe', label: 'Breathe slowly and wait 10 minutes; the wave passes' },
  { id: 'nurse', label: 'Go to the nurse, then go back to class' },
  { id: 'ride', label: 'Ride it out: awkward, then over' },
  { id: 'own', label: 'My own plan', text: true, placeholder: 'My plan' },
];

// ---- Step 7 ----
export const PARK_IT = {
  title: 'Park it.',
  lines: [
    'There is nothing to do about this one right now, so it waits here.',
    'Bring your attention back to what is in front of you. Name three things you can see.',
  ],
};

// ---- Step 8 ----
export const SKETCH = {
  before: 'Draw the worry as a creature, an object, or the weather. How big is it next to you?',
  after: 'How big is it really, after the reality check?',
};

// ---- Short labels for signs in the game world (full text stays in the dock) ----
export const SIGN_LABELS = {
  when: { today: 'Today', tomorrow: 'Tomorrow', week: 'This week', later: 'Later' },
  body: { stomach: 'Stomach', chest: 'Chest', head: 'Head', throat: 'Throat', hands: 'Hands', nowhere: 'Nowhere' },
  sort: { A: 'People', B: 'Performance', C: 'Body', D: 'Unknown', E: 'Something real' },
  core: { judged: 'Judged', fallapart: 'Fall apart', stuck: 'Stuck', alone: 'Alone', forever: 'Forever', letdown: 'Let down', bottom: 'Nothing worse' },
  history: { never: 'Never', once: 'Once', few: 'A few', often: 'Often' },
  friend: { unlikely: 'Unlikely', okay: "You'd be okay", awkward: 'Awkward, then over', own: 'Their words' },
  cope: { teacher: 'Teacher', text: 'Text parent', breathe: 'Breathe', nurse: 'Nurse', ride: 'Ride it out', own: 'My plan' },
  act: { yes: 'Yes', no: 'No' },
};

// ---- Signs on the hub islands (Home and the islands around it) ----
// Numbers on signs use the same words as the dock. No praise, no judgement.
export const HUB_SIGNS = {
  newMap: 'New map',
  withParent: 'With a parent',
  continueMap: 'Continue my map',
  bench: 'Worry to check',
  help: 'Need to talk to someone?',
  islands: { maps: 'My maps', score: 'Scoreboard', patterns: 'Patterns', settings: 'Settings' },
  wolf: (n) => `My brain cried wolf: ${n}`,
  oddsPredicted: (n) => `Predicted: ${n}%`,
  oddsCameTrue: (a, b) => `Came true: ${a} of ${b}`,
  outcomes: { no: 'Didn’t happen', partly: 'Partly', yes: 'Came true', unchecked: 'Not checked' },
  week: (d) => `Week of ${d}`,
  byWeek: 'By week',
  checkQs: { happened: 'Did it happen?', howBad: 'How bad really?', coped: 'Did I cope?', step: 'Did I do my next step?' },
  notYet: 'Not yet',
  resultPredicted: (n) => `I predicted ${n}%`,
  resultHappened: (x) => `What happened: ${x}`,
  more: (n) => `+${n}`,
};

// ---- Tomorrow check ----
export const CHECK_HAPPENED = [
  { id: 'yes', label: 'Yes' },
  { id: 'partly', label: 'Partly' },
  { id: 'no', label: 'No' },
];
// Not an outcome: the feared thing hasn't had its chance yet (a test next
// week, a trip later). The check comes back later and nothing is counted.
export const CHECK_NOT_YET = { id: 'notyet', label: 'Hasn’t come up yet' };
export const CHECK_COPED = [
  { id: 'yes', label: 'Yes' },
  { id: 'partly', label: 'Partly' },
  { id: 'notreally', label: 'Not really' },
  { id: 'notneeded', label: "Didn't need to" },
];
// "Today I will…": did he do it? The behavior side of the map.
export const CHECK_STEP = [
  { id: 'yes', label: 'Yes' },
  { id: 'partly', label: 'Partly' },
  { id: 'no', label: 'Not yet' },
];
export const HAPPENED_LABEL = { yes: 'Came true', partly: 'Partly', no: "Didn't happen" };
export const COPED_LABEL = { yes: 'Coped', partly: 'Partly coped', notreally: 'Didn’t really cope', notneeded: "Didn't need to cope" };
export const STEP_LABEL = { yes: 'Did the next step', partly: 'Partly did the next step', no: 'Next step not done yet' };
export const STEP_RESULT = { yes: 'done', partly: 'partly done', no: 'not done yet' };

// ---- Ladder (the therapist's plan, one step at a time) ----
// The steps come from the therapist. The app holds only the step he's on
// and a short log of tries. Only tries are logged, never "didn't do it".
export const LADDER = {
  title: 'My ladder step',
  intro: 'Working on a ladder with your therapist? Type the step you’re on now, the way it’s written in your plan.',
  placeholder: 'Like: parking lot for 10 minutes',
  changeHint: 'Change it when you and your therapist decide on the next step. Your tries on this step stay in the list.',
  did: [{ id: 'all', label: 'All of it' }, { id: 'part', label: 'Part of it' }],
  didLabel: { all: 'All of it', part: 'Part of it' },
  thought: 'Before I started, how hard did I think it would be?',
  was: 'How hard was it really?',
  low: 'easy',
  high: 'the hardest',
};

// ---- Right now (for the moment the worry is loud) ----
// No map, nothing saved. No promises about how it will turn out.
export const RIGHT_NOW = {
  title: 'Right now',
  lead: 'This is hard. Slow your breathing first: one minute.',
  breatheIn: 'Breathe in',
  breatheOut: 'Breathe out',
  again: 'Again',
  lookTitle: 'Look around',
  look: ['Name 3 things you can see.', 'Name 2 things you can hear.', 'Name 1 thing you can feel, like your feet on the floor.'],
  reachTitle: 'Reach out',
  noContacts: 'A parent can add a phone number in Settings for a “Text” button here.',
  parkTitle: 'Write it down for later',
  parkHint: 'Map it when things are calmer.',
};

// ---- Safety ----
export const SAFETY = {
  title: 'This sounds important.',
  body: 'Talk to mom, dad, or another adult you trust today.',
  lifeline: '988 Suicide & Crisis Lifeline (US). Free, any time, day or night.',
  emergency: 'In an emergency, call 911.',
  smsBody: 'Can we talk today?',
};

// ---- Parent mode ----
// Shown on each step when a map is done together. Written to the parent,
// but the teen sees them too, so they stay short and respectful.
export const PARENT_TIPS = {
  worry: 'Read the question out loud, then wait. Let your teen use their own words, even if you would say it differently. Don’t fix the wording.',
  body: 'Ask, don’t guess. If they point to a spot, that counts. The number is theirs; don’t comment on it.',
  sort: 'If you hear “I don’t know,” say: “Pick the closest one.” Then wait quietly. Ten seconds of silence is fine.',
  core: 'This is the hard part. Keep your voice calm and curious. Don’t argue with the fear or say it won’t happen. Just ask: “And if that happened?”',
  reality: 'Let them pick the odds, even if the number seems high to you. Don’t correct it. The tomorrow check will test it.',
  cope: 'If they’re stuck, offer one idea, not a list. Let them choose.',
  act: 'Don’t solve it for them. If the answer is No, help them move on to what’s in front of you both.',
  sketch: 'If they draw, say what you see (“That one’s huge”), not how good it is. Drawing is optional.',
  next: 'Keep the next step small enough to do today. Don’t add a second one. Later, ask about it once, not over and over.',
  safety: 'Listen first. You don’t need to fix it right now. If you’re worried about their safety, call or text 988, or call 911 in an emergency.',
  check: 'Ask what happened and listen. Skip “I told you so.” The scoreboard keeps count.',
};

export const PARENT_GUIDE = {
  title: 'Doing a map together',
  intro: 'The map gives you both a script. Your job is to read the questions, wait, and let your teen answer. Say less than you think you need to, and don’t go quiet either: read every question out loud.',
  sections: [
    {
      title: 'Before you start',
      items: [
        'Pick a calm moment, not the middle of a panic or an argument about school.',
        'Sit side by side. Let your teen hold the phone.',
        'Tap “Map it with a parent” so a tip shows on each step. The people button at the top of a map turns tips on or off.',
        'Agree that either of you can pause. The map saves where you stop.',
      ],
    },
    {
      title: 'During the map',
      items: [
        'Read each question out loud, then wait for the answer.',
        'If you hear “I don’t know,” say “Pick the closest one.” There is no skip button on purpose.',
        'Skip reassurance about how things will turn out. It helps for a minute, but an anxious brain learns to need it again and again. Let the reality check do that job.',
        'Don’t argue with the odds or correct answers. They belong to your teen.',
        'Keep your face and voice calm, even if the worry surprises you.',
      ],
    },
    {
      title: 'If it gets heated',
      items: [
        'Stop and say, “Let’s pause and finish this later.” Tap the X; nothing is lost.',
        'Don’t finish the map for them.',
        'Come back after a short break instead of negotiating.',
      ],
    },
    {
      title: 'After the map',
      items: [
        'Ask about the next step once, later that day. Don’t quiz.',
        'The next day, do “Check yesterday’s worry” together if your teen wants to.',
        'Your teen decides what to share with their therapist.',
        'The app allows a few maps a day on purpose. If your teen wants many in a row, mention it to the therapist.',
      ],
    },
    {
      title: 'Ladder days',
      items: [
        'The steps come from the therapist. On the day, don’t add to a step or bargain it down.',
        'Before the step, say the supportive line once (“This is hard. I think you can handle it.”), then let your teen go.',
        'Part of a step is still a try. It goes in the log as “Part of it.”',
        'Notice the effort out loud, once, then drop it. No lecture about next time.',
        'Moving up a step is decided with the therapist, not in the moment.',
      ],
    },
  ],
  phrasesTitle: 'Say this / Instead of this',
  phrases: [
    ['“Pick the closest one.”', '“Just answer the question.”'],
    ['“And if that happened?”', '“That’s never going to happen.”'],
    ['“What number would you give it?”', '“You’re overreacting.”'],
    ['“This is hard. I think you can handle it.”', '“There’s nothing to be scared of.”'],
    ['“Okay.” (Then wait.)', 'A lecture about why school matters.'],
    ['“What’s the smallest step you could do today?”', '“You have to go tomorrow, no matter what.”'],
  ],
  urgentTitle: 'When to get help now',
  urgent: 'If your teen talks about hurting themselves, wanting to die, or someone hurting them, stop the map. Call or text 988 (Suicide & Crisis Lifeline), or call 911 in an emergency.',
  footnote: 'These are general suggestions for using a self-help tool. Ask your teen’s therapist which words they want you to use; they may suggest different ones.',
};
