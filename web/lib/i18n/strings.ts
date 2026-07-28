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
    home: 'Home',
    collection: 'Collection',
    quickScan: 'Quick Scan',
    insights: 'Insights',
    register: 'Register',
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

  home: {
    pageTitle: 'Home — Studsly',
    greeting: (name: string) => `Good to see you, ${name}`,
    ask: {
      title: 'Ask Studsly about your collection',
      placeholder: 'What am I missing to build the Millennium Falcon?',
      button: 'Ask',
      hint: 'Ask questions about your own collection. Coming with the value engine (Phase 2).',
    },
    kpi: {
      value: 'Value',
      valueUnit: '(NOK)',
      valueSub: 'BrickLink estimate',
      parts: 'Parts',
      setsUnit: (n: string) => `${n} sets`,
      figsUnit: (n: string) => `${n} minifigs`,
      buildStatus: 'Build status',
      newSuffix: ' new',
      new: 'New',
      unbuilt: 'Unbuilt',
      built: 'Built',
      uniqueSets: 'Unique sets',
      uniqueSub: (pct: string) => `= ${pct} of all LEGO sets`,
    },
    attention: {
      title: 'Needs your attention',
      notCounted: (n: string) => `${n} sets not yet parts-counted`,
      notCountedSub: "Build a checklist to see what's missing",
      start: 'Start',
      empty: 'Nothing needs your attention right now.',
    },
    closest: {
      title: 'Closest to completing',
      seeAll: 'See all series in Insights →',
      empty: 'Series completion appears once you register collectible series.',
    },
    recent: {
      title: 'Recently added',
      openFull: 'Open full collection →',
      empty: 'Nothing added yet.',
    },
  },

  insights: {
    pageTitle: 'Insights — Studsly',
    title: 'Insights',
    subtitle: (sets: string, parts: string, value: string) =>
      `${sets} sets · ${parts} parts · ${value} estimated value`,
    exportReport: '⬇ Export insurance report',
    sections: {
      portfolioValue: 'Portfolio value',
      makeUp: 'Collection make-up',
      completion: 'Completion & what’s next',
      leaders: 'Value leaders & movers',
      insurance: 'Insurance readiness',
    },
    valueByTheme: 'Value by theme',
    setsByTheme: 'Sets by theme',
    buildStatus: 'Build status',
    buildStatusNote:
      'Most of your collection is still sealed — a big unbuilt backlog, and a strong insurance position.',
    whatsInIt: 'What’s in it',
    whatsInItNote:
      'Two independent counts: parts (bricks) and entities (figures & animals). No double-counting.',
    tiles: { sets: 'Sets', figures: 'Figures', animals: 'Animals', parts: 'Parts' },
    valueChartNote:
      'Shows the BrickLink estimate we have today. A your-value-over-time line builds as Studsly snapshots your collection each month.',
    showTable: 'Show as table',
    showChart: 'Show as chart',
    tableTheme: 'Theme',
    tableValue: 'Value',
    tableCount: 'Sets',
    mostValuable: 'Most valuable',
    openFull: 'Open full collection →',
    movers: 'Biggest movers · 6 mo',
    moversEmpty:
      'Value history builds up as Studsly snapshots your collection each month — nothing to compare yet.',
    closestSeries: 'Closest to completing a series',
    closestSeriesEmpty:
      'Register a collectible series (like a CMF series) to track completion here.',
    finishThese: 'Finish these sets',
    finishTheseSub: 'missing parts you already own',
    finishTheseEmpty:
      'Once you count a set’s parts and register loose parts, Studsly matches what you’re missing against what you own.',
    documentation: 'Documentation across your sets',
    docBasic: 'Basic — catalogue reference',
    docDocumented: 'Documented — your own photo',
    docVerified: 'Verified — receipt / serial',
    coveredValue: (n: string, total: string) =>
      `covered value · ${n} of ${total} sets in the export`,
    emptyValue: 'Portfolio value appears once your sets carry a BrickLink estimate.',
  },

  register: {
    pageTitle: 'Register — Studsly',
    back: '← Collection',
    title: 'Add to your collection',
    subtitle: 'Choose what you’re adding — or scan to let Studsly identify it',
    scan: {
      title: 'Scan to add',
      desc: 'Point your camera at a part or figure and Studsly identifies it — or snap a set to look it up and confirm.',
    },
    orByType: 'or add by type',
    methods: {
      set: { title: 'A set', desc: 'By set number or name. We pull the full part & figure list.' },
      parts: {
        title: 'Individual parts',
        desc: 'Parts or bricks not tied to a set. Add many identical at once, or individual items.',
      },
      comp: {
        title: 'Instructions or a box',
        desc: 'A spare manual or original box. Register it now, link it to a set later.',
      },
      figure: {
        title: 'A figure or animal',
        desc: 'A figure, an animal or an assembled creature on its own.',
      },
      moc: {
        title: 'A MOC (your build)',
        desc: 'A custom build with no official set. Import its parts list.',
      },
    },
    comingSoon: 'Coming soon',
    note: 'Everything you add starts with a catalogue reference — enough for a basic insurance record. Strengthen any item with your own photos later.',
  },

  setDetail: {
    pageTitle: (name: string) => `${name} — Studsly`,
    back: '← Collection',
    notFound: 'That set could not be found in your collection.',
    tabs: {
      overview: 'Overview',
      parts: 'Parts',
      figures: 'Figures',
      value: 'Value & Insurance',
    },
    facts: { value: 'Value (NOK)', pieces: 'Pieces', figures: 'Figures', parts: 'Parts' },
    edit: 'Edit',
    buildStatus: 'Build status',
    status: { new: 'New / Sealed', sealed: 'New / Sealed', unbuilt: 'Unbuilt', built: 'Built' },
    statusReadonly:
      'Editing build status, allocations and modifications arrives with the next release. This view reflects your registered data.',
    modified: '✦ Modified',
    partsMeter: (present: string, total: string) => `Parts: ${present} of ${total} present`,
    partsMissing: (n: string) => `${n} missing`,
    goToParts: 'Go to parts check →',
    contents: 'Contents & condition',
    contentsEmpty:
      'No contents recorded yet. Instructions and box status appear here once registered.',
    component: {
      instructions: 'Instructions',
      box: 'Original box',
      stickers: 'Sticker sheet',
      innerBags: 'Inner bags',
      extras: 'Extras',
      other: 'Other',
      present: 'Present',
      notPresent: 'Not with this copy',
    },
    overallCondition: 'Overall condition',
    grades: { MINT: 'Mint', EXCELLENT: 'Excellent', GOOD: 'Good', FAIR: 'Fair', POOR: 'Poor' },
    notGraded: 'Not graded',
    provenance: 'Provenance & meta',
    prov: { entryId: 'Entry ID', added: 'Added', condition: 'Condition', theme: 'Theme' },
    valueSection: 'How this value is built',
    ledger: {
      base: (tier: string) => `Base — ${tier}`,
      tierSealed: 'Sealed',
      tierCib: 'Used · complete in box',
      tierIncomplete: 'Used · incomplete',
      noBox: '− Original box (not with this copy)',
      noManual: '− Instructions (not with this copy)',
      grade: (g: string) => `Condition grade (${g})`,
      restoration: 'Restoration (parts to replace)',
      restorationPhase2: '— Phase 2',
      restorationFlagged: (n: string) => `${n} parts flagged`,
      thisCopy: 'This copy',
    },
    valueNote:
      'Base is a BrickLink estimate you can override — not a live price. Box, instructions and condition each move the number. The restoration line shows what’s flagged to replace; its price arrives with the value engine (Phase 2).',
    partsTabEmpty:
      'No parts checklist yet for this set. Open the parts check to build one from the catalog.',
    openPartsCheck: 'Open parts check →',
    figuresTabEmpty: 'No figure list registered for this set yet.',

    // Editable build status (Flow 2, FF_MOD). statusLabels are the four states;
    // the segmented control persists ONLY objects.build_status.
    statusLabels: { NEW: 'New', SEALED: 'Sealed', UNBUILT: 'Unbuilt', BUILT: 'Built' } as Record<
      string,
      string
    >,
    statusEdit: {
      hint: 'Set the build state. Marking a set factory-sealed again asks for confirmation — nothing else about the set changes.',
      saved: 'Build status saved',
      confirmTitle: 'Mark as factory-sealed?',
      confirmBody: (from: string) =>
        `This set is currently ${from}. Marking it Sealed says it is unopened in its factory packaging — use this only to fix a mistake. Parts, figures, contents and value are left untouched.`,
      cancel: 'Cancel',
      confirm: 'Mark as sealed',
    },

    // MOD (Flow 2, FF_MOD).
    mod: {
      toggleLabel: 'Modified build (MOD)',
      toggleDesc:
        'Turn on if this build differs from the official set — parts added or removed. Independent of Sealed / Unbuilt / Built.',
      summaryTitle: 'Modifications',
      summaryLine: (added: number) =>
        added === 0
          ? 'No parts added to this build yet. Add parts below from your available inventory, or register new ones.'
          : `This build differs from the official set: ${added} part${added === 1 ? '' : 's'} added. Added parts are pulled from your available inventory (or registered new) and count toward the set.`,
      manage: 'Manage in Parts →',
      editorTitle: 'Modifications to this build',
      addTitle: 'Add parts to this mod',
      srcInv: 'From my inventory',
      srcNew: 'Register new parts',
      searchPlaceholder: 'Search your available parts — e.g. 3001 or “Brick 2×4”',
      hintInv:
        'Pick parts you already own that aren’t allocated to a set — they move from your available pool into this build.',
      hintNew:
        'Register brand-new parts. They’re added to your inventory and allocated straight into this build.',
      addedTitle: 'Added to this build',
      officialTitle: 'Official set inventory',
      fromInventory: 'from inventory',
      registeredNew: 'registered new',
      colAddedPart: 'Added part',
      colInMod: 'In mod',
      allocate: 'Add',
      poolFree: (n: number, loc: string | null) =>
        loc ? `${n} free · ${loc}` : `${n} free`,
      removeHint:
        'Removing parts to your pool arrives in the next update. For now you can add parts and restore any you’ve added.',
    },

    // Register-new-part mini form (Flow 2 MOD).
    registerNew: {
      partNum: 'Part number',
      name: 'Name (optional)',
      colour: 'Colour',
      quantity: 'Quantity',
      add: 'Add to build',
      cancel: 'Cancel',
      pickColour: 'Pick a colour',
    },

    // Inline Parts tab (Flow 2, FF_MOD).
    partsUI: {
      bar: (present: string, total: string) => `Parts present: ${present} of ${total}`,
      missing: (n: string) => `${n} missing`,
      markAll: 'Mark all present',
      reset: 'Reset',
      intro:
        'Enter what you have with the − / + steppers (or type). Anything short of the set quantity counts as missing.',
      colPart: 'Part',
      colColour: 'Colour',
      colInSet: 'In set',
      colHave: 'Have',
      colStatus: 'Status',
      complete: 'Complete',
      missingStatus: (n: string) => `${n} missing`,
      incDecInc: 'Increase parts you have',
      incDecDec: 'Decrease parts you have',
      noChecklistTitle: 'No parts list yet for this set',
      noChecklistSub: 'Build the checklist in the parts check, then count here.',
    },

    // Inline Figures tab (Flow 2, FF_MOD).
    figuresUI: {
      bar: (present: string, total: string) => `Figures & animals present: ${present} of ${total}`,
      colFigure: 'Figure',
      colType: 'Type',
      empty: 'No figures registered for this set yet.',
      incFig: 'Increase figures you have',
      decFig: 'Decrease figures you have',
    },

    // Contents & condition / CIB (Flow 3, FF_COMPONENTS).
    contentsUI: {
      copyBadge: (n: number, total: number) => `Copy ${n} of ${total}`,
      valueImpact: 'Value impact →',
      present: 'Present · with this copy',
      notPresent: 'Not with this copy',
      markPresent: 'Mark present',
      markNotPresent: 'Mark not present',
      togglePresent: 'Present with this copy',
      looseAvailable: (n: number, word: string) =>
        `${n} loose ${word}${n === 1 ? '' : 'es'} in your inventory`,
      allocate: (word: string) => `Allocate ${word}`,
      allocated: 'Allocated from inventory',
      condition: 'Condition & damage',
      overall: 'Overall condition',
      kinds: {
        INSTRUCTIONS: 'Instructions',
        ORIGINAL_BOX: 'Original box',
        STICKER_SHEET: 'Sticker sheet',
        EXTRAS: 'Extras',
      } as Record<string, string>,
      word: { INSTRUCTIONS: 'manual', ORIGINAL_BOX: 'box' } as Record<string, string>,
      cibPrefix: 'This copy:',
      cibParts: (pct: string) => `parts ${pct}`,
      cibInstr: 'instructions ✓',
      cibNoInstr: 'no instructions',
      cibBox: 'box ✓',
      cibNoBox: 'no box',
      cibHint:
        'Register instructions & boxes on their own, then link them to any copy here.',
    },

    // Damage tags (canonical list, §7.3) — shared by components (Flow 3) and
    // "to replace" (Flow 6).
    damage: {
      title: 'Condition & damage',
      noteLabel: 'Note (optional)',
      notePlaceholder: 'Anything worth recording…',
      done: 'Done',
      clear: 'Clear',
      summary: (n: number) => (n === 0 ? 'Add detail' : `${n} tag${n === 1 ? '' : 's'}`),
      tags: {
        UV_YELLOWING: 'UV yellowing',
        SCRATCHED: 'Scratched',
        BITE_MARKS: 'Bite marks',
        STRESS_CRACKS: 'Stress cracks',
        PRINT_WORN: 'Print worn',
        PRINT_MISSING: 'Print missing',
        DISCOLOURED: 'Discoloured',
        WARPED: 'Warped',
        OTHER: 'Other',
      } as Record<string, string>,
    },
  },

  collectionExtra: {
    summary: (sets: string, figures: string, animals: string, value: string) =>
      `${sets} sets · ${figures} figures · ${animals} animals · ${value} estimated value`,
    register: 'Register',
    searchPlaceholder:
      'Search or ask across everything — e.g. “Millennium Falcon”, or a theme',
    aiPill: '✦ AI',
    tabs: { sets: 'Sets', figures: 'Figures', animals: 'Animals', parts: 'Parts', mocs: 'MOCs' },
    view: 'View',
    grid: 'Grid',
    table: 'Table',
    sort: 'Sort',
    sortOptions: {
      valueDesc: 'Value: high → low',
      valueAsc: 'Value: low → high',
      recent: 'Recently added',
      nameAsc: 'Name: A → Z',
      yearDesc: 'Year: newest first',
      partsDesc: 'Piece count: most first',
    },
    shown: (n: number, total: number) => `${n} of ${total} shown`,
    showing: (n: number, total: number) =>
      n === total ? `Showing ${n} sets` : `Showing ${n} of ${total} sets`,
    tabPlaceholder: (tab: string) => `${tab} view`,
    tabPlaceholderSub:
      'Cross-type views arrive with the registration flows in the next release. Sets are live now.',
    noMatch: 'No sets match your search.',
    columns: {
      name: 'Name',
      theme: 'Theme',
      year: 'Year',
      status: 'Status',
      parts: 'Parts',
      value: 'Value',
    },
  },

  // Shared Allocate / Restore (Phase 1b §7.6) — used by lib/allocate.ts.
  allocate: {
    allocate: 'Allocate',
    restore: 'Restore',
    failed: 'Could not allocate. Please try again.',
    restoreFailed: 'Could not restore. Please try again.',
    overAllocated:
      'You have already allocated all of these loose parts. Restore one first.',
  },

  // Free parts pool — Collection ▸ Individual parts (Phase 1b §7.6, FF_POOL).
  pool: {
    heading: 'Individual parts',
    intro:
      'Loose parts you own that aren’t locked inside a set. “Free” is what’s left after any allocations — allocate them to a set from its parts list or your buy list.',
    empty: 'No loose parts registered yet.',
    emptySub:
      'Register individual parts to build up a pool you can allocate to sets that are missing pieces.',
    colourUnconfirmed: 'Colour unconfirmed',
    setColour: 'Set colour',
    unknownColour: '(unknown)',
    noLocation: 'No location',
    allocatedTo: 'Allocated to',
    columns: {
      part: 'Part',
      colour: 'Colour',
      owned: 'Owned',
      free: 'Free',
      allocated: 'Allocated',
      location: 'Location',
    },
    showAllocations: 'Show allocations',
    hideAllocations: 'Hide allocations',
    allNumbersFree: 'All free',
  },
})
