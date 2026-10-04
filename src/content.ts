/**
 * All copy and placeholders for the site live here.
 * Replace the [BRACKETED] values before publishing.
 */
export const links = {
  makingOf: '[MAKING-OF URL]',
  linkedin: '[LINKEDIN URL]',
  portfolio: '[PORTFOLIO URL]',
}

export const credits = {
  author: '[YOUR NAME]',
  model: 'Lumhax (Sketchfab) · CC BY 4.0',
  modelUrl:
    'https://sketchfab.com/3d-models/great-deku-tree-hyrule-warriors-e786604ea35644fe99e5a57f69922689',
}

/** 3D models used on the site (both CC BY 4.0; attribution required). */
export const modelCredits = [
  {
    work: 'Great Deku Tree | Hyrule Warriors',
    author: 'Lumhax',
    source: 'Sketchfab',
    url: 'https://sketchfab.com/3d-models/great-deku-tree-hyrule-warriors-e786604ea35644fe99e5a57f69922689',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    modified: false,
  },
  {
    work: 'a forest (3) with a road at night for game',
    author: 'dasy444',
    source: 'Sketchfab',
    url: '[FOREST MODEL URL]',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    modified: true,
  },
] as const

/** Hero (beat 1) copy. Nothing else is shown in the hero. */
export const hero = {
  wordmark: 'DEKU',
  title: 'The Great Deku Tree',
  spoilers: 'Spoilers',
  sound: 'Sound',
  soundOn: 'On',
  soundOff: 'Off',
  hintWake: 'Move to wake it',
  hintEnter: 'Scroll to enter',
}

/** The section right after the hero, once the camera is inside the tree (dark tone). */
export const inside = {
  eyebrow: 'Chapter I',
  title: 'Inside the Deku Tree',
  body: 'Roots older than the forest. Something has been feeding on them.',
}

export const hud = {
  wordmark: 'DEKU',
  soundOn: 'Sound on',
  soundOff: 'Sound off',
  spoilers: 'Spoilers',
}

export const home = {
  hero: {
    eyebrow: 'Kokiri Forest',
    title: 'The Great Deku Tree',
    body: 'The guardian of the forest has slept for centuries. Something has begun to stir beneath its roots.',
    scrollHint: 'Scroll to begin',
  },
  face: {
    hint: 'Move to wake it. Stay still and it sleeps.',
    title: "It's watching.",
    body: 'A curse creeps through its roots. Only one who enters can break it.',
  },
  curse: {
    eyebrow: 'The Curse',
    title: 'Something lives inside.',
    body: 'For the first time in a thousand years, the forest has gone quiet.',
  },
  entrance: {
    eyebrow: 'Chapter I',
    title: 'Inside the Deku Tree',
    cta: 'Enter the tree',
  },
  rooms: [
    { n: '01', kind: 'Weapon', title: 'Kokiri Sword', body: "Small, sharp and forged for a hero who doesn't know it yet." },
    { n: '02', kind: 'Shield', title: 'Deku Shield', body: 'Made of wood. Burns easily. Saves lives anyway.' },
    { n: '03', kind: 'Item', title: 'Fairy Slingshot', body: 'Hidden high in the webs. Aim for the eye.' },
    { n: '04', kind: 'Boss', title: 'Queen Gohma', body: 'The parasite at the heart of the curse.' },
  ],
  emerald: {
    eyebrow: 'The curse is broken',
    title: "Kokiri's Emerald",
    body: 'The first Spiritual Stone. The forest is safe — for now.',
    ctaMakingOf: 'Watch the making-of',
    ctaSpoilers: "See what the tree didn't tell you",
  },
  exit: {
    title: 'The forest breathes again.',
    credits: `A fan concept by ${credits.author}. 3D model by ${credits.model}. Built with React Three Fiber, GSAP and a lot of nostalgia.`,
    legal: 'Not affiliated with Nintendo. The Legend of Zelda is a trademark of Nintendo.',
    linkedin: 'LinkedIn',
    portfolio: 'Portfolio',
  },
}

export const spoilers = {
  eyebrow: 'Lens of Truth',
  title: "What the tree didn't tell you",
  body: 'Some things are only visible to those who look closely. Spoilers ahead for Ocarina of Time.',
  revealAll: 'Reveal all',
  hideAll: 'Hide again',
  back: 'Back to the forest',
  cards: [
    { title: "The guardian's fate", body: "The Great Deku Tree doesn't survive. The curse had already taken root before you arrived." },
    { title: 'Who cast the curse', body: 'Ganondorf. He cursed the tree after it refused to give him the Spiritual Stone.' },
    { title: 'Why you have no fairy', body: "You were never Kokiri. You're a Hylian child, left in the forest as a baby." },
    { title: "Saria's song", body: 'Your oldest friend is the Sage of the Forest.' },
    { title: 'The sprout', body: 'Years later, a new Deku Tree grows from the same ground.' },
  ],
}
