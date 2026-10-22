// Client-side crisis keyword check. Runs on every text the teen types,
// before it is saved as part of a map step.
//
// Scope (from the spec): self-harm, suicide, abuse, someone hurting him.
// Phrases are chosen to catch these with few false alarms. A false alarm
// stops the map and points to an adult; a miss is worse, so when in doubt
// a phrase stays in. Single words like "die" or "hurt" are left out because
// worries such as "What if I throw up and die" are common health anxiety.

const PATTERNS = [
  // suicide and wanting to die
  /\bsuicid/,
  /\bsewer ?slide\b/,
  /\bunalive\b/,
  /\bkms\b/,
  /\bkys\b/,
  /\bkill(ing|ed)? ?my ?self\b/,
  /\bkill(ing)? ?your ?self\b/,
  /\b(end|ending|take|taking) my (own )?life\b/,
  /\bend(ing)? it all\b/,
  /\b(want|wanted|wanting|wanna|going|gonna) to die\b/,
  /\bwanna die\b/,
  /\bwish (i|id|i had|i'd) (was|were|been|never been) (dead|born)\b/,
  /\bwish i was never born\b/,
  /\bbetter off dead\b/,
  /\bbetter off without me\b/,
  /\b(dont|do not|don't) want to (live|be alive|be here anymore|exist)\b/,
  /\bno (reason|point) (to|in) (live|living|being alive)\b/,
  /\bnot (want|wanting) to be alive\b/,
  /\boverdos/,
  // self-harm
  /\bself ?harm/,
  /\b(cut|cuts|cutting|hurt|hurts|hurting|harm|harming|burn|burning|starve|starving) ?my ?self\b/,
  // abuse and someone hurting me
  /\babus(e|ed|es|ing|ive|er)\b/,
  /\bmolest/,
  /\brap(e|ed|es|ing|ist)\b/,
  /\bsexual(ly)? (assault|abuse)/,
  /\b(touch|touched|touches|touching) me\b/,
  /\b(hit|hits|hitting|punch|punches|punched|punching|slap|slaps|slapped|choke|chokes|choked|choking|strangle|strangled) me\b/,
  /\b(beat|beats|beating) me up\b/,
  /\b(hurt|hurts|hurting) me\b/,
  /\b(kill|shoot|stab) me\b/,
  /\bthreat(en|ened|ens|ening)? (to )?(kill|hurt|beat|shoot|stab)/,
];

export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isCrisis(text) {
  const t = normalize(text);
  if (!t) return false;
  // Check both "don't" and "dont" spellings.
  const variants = [t, t.replace(/'/g, '')];
  return variants.some((v) => PATTERNS.some((re) => re.test(v)));
}

export const anyCrisis = (texts) => texts.some(isCrisis);
