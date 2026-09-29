// ---------------------------------------------------------------------------
// Optional creative features shared by the Simple and Advanced workspaces.
// Both features are opt-in: when disabled they contribute nothing to the
// generated Master Prompt, so the existing behaviour stays untouched.
// Simple shows the core controls; Advanced adds extra detail inside the same
// shared markup, so both modes render from one logic path.
// ---------------------------------------------------------------------------

export const REFERENCE_ACTIONS = ['Copy Music Style', 'Adapt / Transform Style', 'Copy Lyrical Mood / Emotional Tone'];
export const TRANSFORM_ACTION = 'Adapt / Transform Style';
export const PERFORMANCE_DIRECTIONS = ['Emotional', 'Intimate', 'Build Up', 'Powerful', 'Soft / Intimate', 'Gentle', 'Restrained', 'Cathartic', 'Driving', 'Cinematic', 'Spoken', 'Playful'];
export const SECTION_TYPES = ['Intro', 'Verse 1', 'Verse 2', 'Pre-Chorus', 'Chorus', 'Bridge', 'Instrumental', 'Final Chorus', 'Outro', 'Custom'];

/** Simple keeps the mapping short and preset-based; Advanced is uncapped. */
export const SIMPLE_SECTION_LIMIT = 4;

/** One-click performance maps shown in both modes (primary value in Simple). */
export const PERFORMANCE_PRESETS = [
  { id: 'emotional-build', name: 'Emotional build', rows: [['Verse 1', 'Emotional'], ['Chorus', 'Powerful'], ['Bridge', 'Soft / Intimate']] },
  { id: 'anthemic-rise', name: 'Anthemic rise', rows: [['Verse 1', 'Intimate'], ['Pre-Chorus', 'Build Up'], ['Chorus', 'Powerful'], ['Final Chorus', 'Cathartic']] },
  { id: 'soft-story', name: 'Soft story', rows: [['Intro', 'Gentle'], ['Verse 1', 'Soft / Intimate'], ['Chorus', 'Emotional'], ['Outro', 'Gentle']] }
];

let rowCounter = 0;

/** A performance-section row. `custom` holds the free-text name for Custom type. */
export function createSectionRow(type = 'Verse 1', direction = 'Emotional', custom = '') {
  rowCounter += 1;
  return {
    id: `sec-${Date.now().toString(36)}-${rowCounter}`,
    type: SECTION_TYPES.includes(type) ? type : 'Custom',
    custom: typeof custom === 'string' ? custom : '',
    direction: PERFORMANCE_DIRECTIONS.includes(direction) ? direction : 'Emotional',
    note: ''
  };
}

/** Reference Music Analysis feature state (per mode workspace). */
export function createReferenceFeature() {
  return {
    enabled: false,
    sourceDescription: '',
    actions: [],
    transformAmount: 50,
    detail: { elementsToCopy: '', elementsToAvoid: '', lyricalThemesToKeep: '', lyricalThemesToAvoid: '' }
  };
}

/** Performance Direction feature state (per mode workspace). Rows start empty;
 *  the UI seeds a starter row the moment the user enables the feature. */
export function createPerformanceFeature() {
  return { enabled: false, sections: [] };
}

/** Fill a performance feature from a preset and turn it on. */
export function applyPerformancePreset(feature, presetId) {
  const preset = PERFORMANCE_PRESETS.find(item => item.id === presetId);
  if (!feature || !preset) return false;
  feature.sections = preset.rows.map(([type, direction]) => createSectionRow(type, direction));
  feature.enabled = true;
  return true;
}

// ---- State normalizers (used when loading persisted workspaces) -----------

export function normalizeReferenceFeature(raw, defaults = createReferenceFeature()) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const detail = source.detail && typeof source.detail === 'object' ? source.detail : {};
  const actions = Array.isArray(source.actions) ? [...new Set(source.actions.filter(action => REFERENCE_ACTIONS.includes(action)))] : [];
  const amount = Number(source.transformAmount);
  const string = value => typeof value === 'string' ? value : '';
  return {
    enabled: source.enabled === true,
    sourceDescription: string(source.sourceDescription),
    actions,
    transformAmount: Number.isFinite(amount) ? Math.min(100, Math.max(0, Math.round(amount))) : defaults.transformAmount,
    detail: {
      elementsToCopy: string(detail.elementsToCopy),
      elementsToAvoid: string(detail.elementsToAvoid),
      lyricalThemesToKeep: string(detail.lyricalThemesToKeep),
      lyricalThemesToAvoid: string(detail.lyricalThemesToAvoid)
    }
  };
}

export function normalizePerformanceFeature(raw, mode = 'simple') {
  const source = raw && typeof raw === 'object' ? raw : {};
  const sections = Array.isArray(source.sections) ? source.sections : [];
  const limit = mode === 'simple' ? SIMPLE_SECTION_LIMIT : 99;
  return {
    enabled: source.enabled === true,
    sections: sections.slice(0, limit).map(row => {
      const item = row && typeof row === 'object' ? row : {};
      const base = createSectionRow(item.type, item.direction, item.custom);
      return {
        ...base,
        id: typeof item.id === 'string' && item.id ? item.id : base.id,
        note: typeof item.note === 'string' ? item.note : ''
      };
    })
  };
}

// ---- Prompt section builders ----------------------------------------------

function sectionLabel(row, emptyLabel) {
  if (row.type !== 'Custom') return row.type;
  const custom = typeof row.custom === 'string' ? row.custom.trim() : '';
  return custom || emptyLabel;
}

function transformPhrase(amount) {
  if (amount <= 25) return 'stay very close to the reference; only refresh details';
  if (amount <= 50) return 'balance between the reference identity and a new one';
  if (amount <= 75) return 'clearly move toward a new identity while keeping the reference DNA recognizable';
  return 'use the reference only as a starting point; the result should feel like a new song';
}

/** Structured reference-analysis block, or '' when the feature is off/empty. */
export function buildReferenceBrief(reference) {
  const ref = reference && typeof reference === 'object' ? reference : {};
  if (!ref.enabled) return '';
  const actions = Array.isArray(ref.actions) ? ref.actions.filter(action => REFERENCE_ACTIONS.includes(action)) : [];
  const source = typeof ref.sourceDescription === 'string' ? ref.sourceDescription.trim() : '';
  if (!actions.length && !source) return '';
  const lines = ['REFERENCE MUSIC ANALYSIS (reference-informed direction):'];
  if (source) lines.push(`Reference track description: ${source}`);
  lines.push('Analyze the reference track (audio, or the description above) first, then shape the song according to the selected options:');
  for (const action of actions) {
    if (action === 'Copy Music Style') lines.push('- Copy Music Style: recreate the overall musical style of the reference (groove, instrumentation, and production feel) as closely as possible.');
    if (action === TRANSFORM_ACTION) lines.push(`- Adapt / Transform Style: use the reference style as a starting point and transform it (transformation level ${Number(ref.transformAmount) || 0}% — ${transformPhrase(Number(ref.transformAmount) || 0)}).`);
    if (action === 'Copy Lyrical Mood / Emotional Tone') lines.push('- Copy Lyrical Mood / Emotional Tone: mirror the emotional tone and lyrical atmosphere of the reference without copying its actual lyrics.');
  }
  const detail = ref.detail && typeof ref.detail === 'object' ? ref.detail : {};
  const extras = [['Elements to copy', detail.elementsToCopy], ['Elements to avoid', detail.elementsToAvoid], ['Lyrical themes to keep', detail.lyricalThemesToKeep], ['Lyrical themes to avoid', detail.lyricalThemesToAvoid]]
    .map(([label, value]) => [label, typeof value === 'string' ? value.trim() : ''])
    .filter(([, value]) => value)
    .map(([label, value]) => `- ${label}: ${value}`);
  if (extras.length) lines.push('Additional reference constraints:', ...extras);
  return lines.join('\n');
}

/** Structured section-by-section performance block, or '' when off/empty. */
export function buildPerformanceBrief(performance) {
  const perf = performance && typeof performance === 'object' ? performance : {};
  if (!perf.enabled) return '';
  const rows = Array.isArray(perf.sections) ? perf.sections.filter(row => row && typeof row === 'object') : [];
  const directions = rows.map(row => {
    const label = sectionLabel(row, 'Section');
    const direction = PERFORMANCE_DIRECTIONS.includes(row.direction) ? row.direction : '';
    const note = typeof row.note === 'string' ? row.note.trim() : '';
    if (!direction && !note) return '';
    return `- ${label} → ${direction || 'as written'}${note ? ` (${note})` : ''}`;
  }).filter(Boolean);
  if (!directions.length) return '';
  return ['PERFORMANCE DIRECTION (section-by-section):', ...directions, 'Follow these performance directions when shaping energy, dynamics, and vocal delivery for each section; keep the transitions between sections natural.'].join('\n');
}
