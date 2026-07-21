import type { ObjectCondition, ObjectType } from '@/lib/types/objects'
import type { MinifigSource } from '@/lib/types/parts'

/**
 * Every user-facing string in the app, in one place.
 *
 * The app ships in American English only. This is deliberately a plain
 * frozen object — no provider, no context, no dependency — so strings can
 * be imported anywhere, including server components. If a second language
 * is ever added, this is the seam to build it on.
 *
 * Not covered here: user-entered names and notes, and the AI vision prompt
 * in the identify route (that is model input, not display copy).
 */

/** Freezes an object and everything nested inside it. */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze((value as Record<string, unknown>)[key])
    }
    Object.freeze(value)
  }
  return value
}

const objectTypes: Record<ObjectType, string> = {
  SET: 'Set',
  MINIFIG: 'Minifigure',
  PART: 'Part',
  BULK: 'Bulk',
  MOC: 'MOC',
  MOD: 'MOD',
}

const conditions: Record<ObjectCondition, string> = {
  NEW: 'New',
  SEALED: 'Sealed',
  BUILT: 'Built',
  OPENED: 'Opened',
  USED: 'Used',
  INCOMPLETE: 'Incomplete',
  DAMAGED: 'Damaged',
}

const minifigSources: Record<MinifigSource, string> = {
  SET: 'From set',
  BAM: 'Build a Minifigure',
  CMF: 'Collectible figure',
  STANDALONE: 'Standalone figure',
}

export const strings = deepFreeze({
  common: {
    appName: 'Studsly',
    unnamed: '(unnamed)',
    none: '–',
    saving: 'Saving…',
    saveFailed: 'Could not save. Check your connection.',

    auth: {
      pageTitle: 'Sign in — Studsly',
      pageDescription: 'AI-powered LEGO collection overview',
      tagline: 'Your LEGO collection, intelligently organized',
      cardTitle: 'Sign in',
      cardDescription: 'Use your Google account to continue',
      continueWithGoogle: 'Continue with Google',
      signingIn: 'Signing in…',
      legalPrefix: 'By signing in you agree to our',
      terms: 'terms',
      legalConjunction: 'and',
      privacy: 'privacy policy',
    },

    dashboard: {
      pageTitle: 'Collection — Studsly',
      title: 'Your collection',
      subtitle: 'Overview of every registered object',
      totalCard: 'Total',
      totalUnit: 'objects',
      setsCard: 'Sets',
      setsUnit: 'registered sets',
      statusCard: 'Status',
      statusValue: 'Phase 1 — Reboot',
      statusNote: 'Next.js frontend active',
      objectsCard: 'Objects',
      objectsPlaceholder:
        'The collection list is coming in the next step. Supabase connection is active.',
    },
  },

  nav: {
    collection: 'Collection',
    quickScan: 'Quick Scan',
    signOut: 'Sign out',
  },

  collection: {
    pageTitle: 'Collection — Studsly',
    title: 'Collection',
    /** e.g. "586 objects · BL value $12,000" */
    summary: (count: number, value: string) =>
      `${count} objects · BL value ${value}`,
    allTab: 'All',
    searchPlaceholder: 'Search name, number, theme…',
    loadFailed: 'Could not load the collection. Please try again.',
    empty: 'No objects match your search.',
    partsCheck: 'Parts check',
    minifigCountTitle: 'Number of minifigures',
    columns: {
      name: 'Name',
      theme: 'Theme',
      year: 'Year',
      condition: 'Condition',
      parts: 'Parts',
      minifigs: 'Minifigs',
      blValue: 'BL value',
    },
    footer: {
      showing: (shown: number, total: number) =>
        shown === total
          ? `Showing ${shown} objects`
          : `Showing ${shown} of ${total} objects`,
      total: (value: string) => `Total ${value}`,
    },
    objectTypes,
    conditions,
  },

  partsCheck: {
    pageTitle: 'Parts check — Studsly',
    eyebrow: 'Parts check',
    back: 'Back to collection',
    haveAll: 'Have all',
    reset: 'Reset',

    notASetTitle: 'Parts check is for sets only',
    notASetMessage: (name: string) =>
      `“${name}” is not registered as a set, so it has no official parts list.`,
    noListTitle: 'No official parts list available',
    noListMessage: (setNumber: string) =>
      `We could not find ${setNumber} in the Rebrickable catalog. It may be newer than the catalog, or have no registered inventory (collectible minifigure bags, for example).`,
    generateFailedTitle: 'Could not build the parts list',
    generateFailedMessage:
      'Something went wrong fetching the parts list from the catalog. Please try again.',

    /** e.g. "2,903 parts · 5 minifigures" */
    partsCount: (parts: string) => `${parts} parts`,
    minifigCount: (figs: string) => `${figs} minifigures`,
    catalogRef: (setNum: string) => `Catalog: ${setNum}`,
    piecesOf: (present: string, expected: string) =>
      `${present} of ${expected} pieces`,
    figuresOf: (present: string, expected: string) =>
      `${present}/${expected} figures`,
    missingSummary: (pieces: string, lots: string) =>
      `Missing ${pieces} pieces across ${lots} part types`,

    tabs: {
      all: 'Parts list',
      missing: 'Missing',
      spares: 'Spare parts',
    },
    sortBy: {
      name: 'Name',
      color: 'Color',
    },
    searchPlaceholder: 'Search part, number, color…',

    wantListLabel: (lots: string) => `Shopping list (${lots} part types):`,
    copyAsText: 'Copy as text',
    copyBrickLinkXml: 'Copy BrickLink XML',
    copied: 'Copied',
    noBlColor: 'no BL color',
    noBlColorParen: 'no BL color',

    minifigsHeading: 'Minifigures',
    minifigComplete: 'Complete',
    minifigPartsCount: (n: number) => `${n} parts`,
    minifigShowParts: 'Show parts',
    minifigHideParts: 'Hide parts',
    minifigHaveAll: 'Have the whole figure',
    minifigNoParts: 'No parts list for this figure in the catalog.',

    columns: {
      part: 'Part',
      color: 'Color',
      expected: 'Need',
      have: 'Have',
      missing: 'Missing',
      quantity: 'Quantity',
    },
    haveAllOfThis: 'Have all of these',
    nothingMissing: 'Nothing is missing. 🎉',
    noPartsMatch: 'No parts match your search.',
    noSpares: 'This set has no registered spare parts.',

    detail: {
      close: 'Close',
      enlarge: 'Show larger',
      noImage: 'No image available',
      color: 'Color',
      blColor: 'BrickLink color',
      expected: 'Need',
      have: 'Have',
    },

    footer: {
      spares: (n: string) => `${n} spare parts (not counted toward completeness)`,
      parts: (n: string) => `Showing ${n} part types`,
      partsAndFigs: (parts: string, figs: string) =>
        `Showing ${parts} part types and ${figs} minifigures`,
    },

    minifigSources,
  },

  hurtigscan: {
    pageTitle: 'Quick Scan — Studsly',
    title: 'Quick Scan',
    intro: 'The location you choose applies to every object in this session.',

    modeLabel: 'What are you registering?',
    modeSet: '🧱 Set',
    modeMinifig: '👾 Minifig',
    modeSetWord: 'set',
    modeMinifigWord: 'minifig',
    modeSetObject: 'the set',
    modeMinifigObject: 'the minifigure',

    locationLabel: 'Choose location',
    locationFields: {
      place: 'Place',
      placeHint: 'Storage, Living room, Office…',
      unit: 'Unit',
      unitHint: 'Shelf A, Display cabinet…',
      position: 'Position',
      positionHint: '1, 2, Row 2…',
      container: 'Container',
      containerHint: 'Box A, Bag 3…',
    },
    start: 'Start registering',
    placeRequired: 'Place is required to start',

    change: 'Change',
    end: 'End',
    scanPrompt: (mode: string) => `📷 Scan ${mode}`,
    analyzing: 'Analyzing image…',
    takePhoto: 'Take a photo or choose from library',
    imageFormats: 'JPG · PNG · WebP',
    orSearchManually: 'or search manually',
    searchSetPlaceholder: 'Set number or name…',
    searchMinifigPlaceholder: "Figure code or name (e.g. 'sw0001' or 'Darth Vader')…",
    search: 'Search',

    imageQuality: {
      high: 'Image quality: Good',
      medium: 'Image quality: Medium',
      low: 'Image quality: Low',
    },
    yourImage: 'Your image',
    referenceImage: 'Reference image',
    noImage: 'No image',
    partsSuffix: (n: number) => `${n} parts`,
    conditionLabel: 'Condition',
    wearLabel: 'Wear',
    wearNotSet: '– Not set –',
    correct: 'Correct',
    saving: 'Saving…',
    confirm: 'OK →',

    registeredAs: (id: string) => `Registered as ${id}`,
    registerNext: 'Register next',

    notRecognized: (object: string) =>
      `We did not recognize ${object} from the image. Search manually below.`,
    searchFor: (object: string) => `Search for ${object}`,
    notFound: 'Not found.',
    notFoundHint: 'This was not saved. Try a different search term.',
    resultCount: (n: number, object: string) =>
      `${n} ${n === 1 ? 'match' : 'matches'} — choose the right ${object}:`,
    choose: 'Choose',
    backToScanning: 'Back to scanning',

    analyzeFailed: 'Could not analyze the image. Please try again.',
    searchFailed: 'Search failed. Please try again.',
    saveFailed: (msg: string) => `Save failed: ${msg}`,
    unknownError: 'Unknown error',

    conditions: {
      SEALED: 'Sealed',
      OPENED: 'Unbuilt (opened)',
      BUILT: 'Built',
      USED: 'Used',
      INCOMPLETE: 'Incomplete',
    } as Record<string, string>,

    wearLevels: {
      MINT: 'Mint',
      NEAR_MINT: 'Near mint',
      VERY_GOOD: 'Very good',
      GOOD: 'Good',
      FAIR: 'Fair',
    } as Record<string, string>,
  },
})
