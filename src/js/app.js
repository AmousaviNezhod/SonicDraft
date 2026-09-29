import { ADVANCED_STEPS, GENRES, INSTRUMENT_GROUPS, INSTRUMENT_ROLES, LANGUAGES, MOODS, PRESETS, SIMPLE_STEPS, VOCAL_DELIVERY, VOCAL_ROLES } from './data.js';
import { clone, createAdvancedState, createSimpleState } from './state.js';
import { transitionMode } from './modeManager.js';
import { loadState, saveState } from './storage.js';
import { generateMasterPrompt } from './promptGenerator.js';
import { AI_PROVIDERS, openProvider } from './providers.js';
import { translate, translateOption } from './translations.js';
import { animateExit } from './animations.js';
import { PERFORMANCE_DIRECTIONS, PERFORMANCE_PRESETS, SECTION_TYPES, SIMPLE_SECTION_LIMIT, TRANSFORM_ACTION, applyPerformancePreset, createPerformanceFeature, createReferenceFeature, createSectionRow } from './features.js';

const app = document.querySelector('#app');
const overlayRoot = document.querySelector('#overlay-root');
const toastRoot = document.querySelector('#toast-root');
const appState = loadState();
let currentStepId = 'style';
let modalTrigger = null;
let activeModal = null;
let promptToShow = '';
let modalTimer = 0;
let toastTimer = 0;
let pickerClosing = false;
let explicitlyEdited = new Set();
let transitionDirection = 'forward';
let modeChoosing = false;
let locale = appState.shared.uiLanguage;
const pickerOptions = new Map();

const tx = key => translate(locale, key);
const fieldLabel = (key, fallback = key) => tx(key) === key ? fallback : tx(key);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const current = () => appState[appState.activeMode];
const steps = () => appState.activeMode === 'simple' ? SIMPLE_STEPS : ADVANCED_STEPS;
const activeStepIndex = () => Math.max(0, steps().findIndex(step => step.id === currentStepId));
const modeLabel = mode => tx(mode === 'simple' ? 'simple' : 'advanced');
const pathGet = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
function pathSet(object, path, value) {
  const keys = path.split('.');
  const leaf = keys.pop();
  const parent = keys.reduce((cursor, key) => cursor[key] ||= {}, object);
  parent[leaf] = value;
}
function save() { saveState(appState); }
function toast(message) {
  clearTimeout(toastTimer);
  toastRoot.replaceChildren();
  const element = document.createElement('div');
  element.className = 'toast'; element.setAttribute('role', 'status'); element.textContent = message;
  toastRoot.append(element);
  toastTimer = setTimeout(() => {
    element.classList.add('leaving');
    setTimeout(() => { if (element.parentNode) element.remove(); }, 200);
  }, 1900);
}
function inputField(label, path, value, { placeholder = '', type = 'text', hint = '', min = '', max = '', full = false, large = false } = {}) {
  const labelText = typeof label === 'string' && label.startsWith('@') ? fieldLabel(label.slice(1), label.slice(1)) : label;
  const id = `f-${path.replaceAll('.', '-')}`;
  const common = `id="${escapeHtml(id)}" data-bind="${escapeHtml(path)}"`;
  const control = large
    ? `<textarea class="text-area large" ${common} placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea>`
    : `<input class="text-input" ${common} type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${min !== '' ? `min="${min}"` : ''} ${max !== '' ? `max="${max}"` : ''}>`;
  return `<div class="field ${full ? 'full' : ''}"><label class="field-label" for="${escapeHtml(id)}">${escapeHtml(labelText)}${hint ? `<span class="field-hint">${escapeHtml(hint)}</span>` : ''}</label>${control}</div>`;
}
function pickerTrigger(path, value, options, { label = '', placeholder = '', extraAttrs = '' } = {}) {
  const normalized = [...new Set(options)];
  pickerOptions.set(path, normalized);
  const selected = normalized.includes(value) && value !== '' && value != null;
  const visible = selected ? translateOption(locale, value) : (placeholder || tx('empty'));
  return `<button type="button" class="select-input picker-trigger ${selected ? 'has-value' : 'is-empty'}" data-picker="${escapeHtml(path)}" aria-haspopup="dialog" aria-expanded="false" aria-label="${escapeHtml(label || visible)}" ${extraAttrs}><span class="picker-value">${escapeHtml(visible)}</span><span class="picker-chevron" aria-hidden="true">⌄</span></button>`;
}
function selectField(labelKey, path, value, options, { full = false, allowEmpty = true } = {}) {
  const id = `f-${path.replaceAll('.', '-')}`;
  const opts = [...(allowEmpty ? [''] : []), ...options];
  return `<div class="field ${full ? 'full' : ''}"><span class="field-label" id="${escapeHtml(id)}-label">${escapeHtml(fieldLabel(labelKey, labelKey))}</span>${pickerTrigger(path, value, opts, { label: fieldLabel(labelKey, labelKey), placeholder: allowEmpty ? tx('empty') : tx('select'), extraAttrs: `id="${escapeHtml(id)}" aria-labelledby="${escapeHtml(id)}-label"` })}</div>`;
}
function chipGroup(labelKey, path, options, selected, { multi = false, max = 99 } = {}) {
  const active = Array.isArray(selected) ? selected : [];
  const title = fieldLabel(labelKey, labelKey);
  return `<div class="field"><div class="field-label">${escapeHtml(title)}${multi ? `<span class="field-hint">${active.length}/${max}</span>` : ''}</div><div class="chip-list" role="group" aria-label="${escapeHtml(title)}">${options.map(option => {
    const value = typeof option === 'string' ? option : option.value;
    const label = typeof option === 'string' ? option : option.label;
    const isSelected = multi ? active.includes(value) : selected === value;
    return `<button type="button" class="chip ${isSelected ? 'selected' : ''}" aria-pressed="${isSelected}" data-choice="${escapeHtml(path)}" data-value="${escapeHtml(value)}" data-multi="${multi}" data-max="${max}">${escapeHtml(translateOption(locale, label))}</button>`;
  }).join('')}</div></div>`;
}
function sectionTitle(key) { return `<div class="section-label">${escapeHtml(fieldLabel(key, key))}</div>`; }
function stageHeader(title, description, index) {
  return `<div class="stage-head"><div><div class="stage-kicker">${escapeHtml(modeLabel(appState.activeMode))} · ${escapeHtml(tx('stepOf'))} ${String(index + 1).padStart(2, '0')}</div><h2 class="stage-title">${escapeHtml(tx(title))}</h2><p class="stage-desc">${escapeHtml(tx(description))}</p></div><span class="stage-count">${String(index + 1).padStart(2, '0')} / ${String(steps().length).padStart(2, '0')}</span></div>`;
}
function vocalEditor(advanced = false) {
  const max = advanced ? 4 : 2;
  const voices = current().vocalists || [];
  const voiceFields = voices.map((voice, index) => {
    const prefix = `vocalists.${index}`;
    let body = `<div class="field-grid">${selectField('gender', `${prefix}.gender`, voice.gender, ['Male', 'Female'])}${selectField('role', `${prefix}.role`, voice.role, VOCAL_ROLES)}${selectField('delivery', `${prefix}.delivery`, voice.delivery, VOCAL_DELIVERY)}</div>`;
    if (advanced) body += `<div class="field-grid" style="margin-top:16px">${selectField('voiceType', `${prefix}.voiceType`, voice.voiceType, ['Breathy alto', 'Clear soprano', 'Warm tenor', 'Rich baritone', 'Falsetto', 'Spoken', 'Custom'])}${selectField('register', `${prefix}.register`, voice.register, ['Low', 'Mid', 'High', 'Wide'])}${selectField('vocalTexture', `${prefix}.texture`, voice.texture, ['Airy', 'Warm', 'Raspy', 'Pure', 'Smoky', 'Raw', 'Smooth'])}${selectField('intensity', `${prefix}.intensity`, voice.intensity, ['Restrained', 'Gentle', 'Moderate', 'Powerful'])}${selectField('distance', `${prefix}.distance`, voice.distance, ['Close', 'Intimate', 'Mid-distance', 'Distant'])}${selectField('breathiness', `${prefix}.breathiness`, voice.breathiness, ['Subtle', 'Audible', 'Very breathy'])}${selectField('roughness', `${prefix}.roughness`, voice.roughness, ['Clean', 'Slightly rough', 'Grainy'])}${selectField('clarity', `${prefix}.clarity`, voice.clarity, ['Soft focus', 'Clear', 'Crisp'])}${selectField('presence', `${prefix}.presence`, voice.presence, ['Recessed', 'Natural', 'Forward'])}${inputField('@harmony', `${prefix}.harmony`, voice.harmony, { placeholder: 'Close thirds, airy octave…' })}${inputField('@adlibs', `${prefix}.adlibs`, voice.adlibs, { placeholder: 'Sparse at the final chorus…' })}</div>`;
    return `<div class="voice-block"><div class="voice-head"><span class="voice-title">${escapeHtml(tx('vocalists'))} ${index + 1}</span><button class="text-action" type="button" data-remove-voice="${index}">${escapeHtml(tx('remove'))}</button></div>${body}</div>`;
  }).join('');
  const noVoice = voices.length ? '' : `<p class="field-hint">${escapeHtml(tx('voiceCount'))}</p>`;
  return `${voiceFields}${noVoice}${voices.length < max ? `<button type="button" class="add-button" data-add-voice>${escapeHtml(tx('addVoice'))} <span aria-hidden="true">＋</span></button>` : ''}`;
}
// ---- Optional features: Reference Music Analysis + Performance Direction ---
const REFERENCE_ACTION_META = [
  { value: 'Copy Music Style', label: 'copyMusicStyle' },
  { value: 'Adapt / Transform Style', label: 'adaptTransformStyle' },
  { value: 'Copy Lyrical Mood / Emotional Tone', label: 'copyLyricalMood' }
];
function renderFeatureSections(advanced) {
  return `${renderReferenceFeature(advanced)}${renderPerformanceFeature(advanced)}`;
}
function featureToggle(labelKey, description, checked, action) {
  const id = `toggle-${action}`;
  return `<div class="feature-toggle-row"><div class="feature-toggle-copy"><span class="feature-toggle-label">${escapeHtml(fieldLabel(labelKey, labelKey))}</span><span class="feature-toggle-hint">${escapeHtml(description)}</span></div><button type="button" class="feature-toggle ${checked ? 'on' : ''}" role="switch" aria-checked="${checked}" id="${id}" ${action === 'reference' ? 'data-toggle-reference' : 'data-toggle-performance'} aria-label="${escapeHtml(fieldLabel(labelKey, labelKey))}"><span class="feature-toggle-knob" aria-hidden="true"></span></button></div>`;
}
function renderReferenceFeature(advanced) {
  const ref = current().reference;
  const checked = action => ref.actions.includes(action);
  const core = `<div class="feature-body">${inputField('@referenceSource', 'reference.sourceDescription', ref.sourceDescription, { placeholder: tx('referenceSourcePlaceholder'), full: true, large: true })}<div class="feature-action-grid">${REFERENCE_ACTION_META.map(meta => `<button type="button" class="chip ${checked(meta.value) ? 'selected' : ''}" aria-pressed="${checked(meta.value)}" data-reference-action="${escapeHtml(meta.value)}">${escapeHtml(tx(meta.label))}</button>`).join('')}</div>${checked(TRANSFORM_ACTION) ? `<div class="transform-slider ${advanced ? '' : 'compact'}"><div class="field-label"><span>${escapeHtml(tx('transformAmount'))}</span><span class="field-hint">${ref.transformAmount}%</span></div><input type="range" min="0" max="100" step="5" value="${Number(ref.transformAmount) || 0}" data-bind="reference.transformAmount" aria-label="${escapeHtml(tx('transformAmount'))}"><div class="transform-scale" aria-hidden="true"><span>${escapeHtml(tx('transformMin'))}</span><span>${escapeHtml(tx('transformMax'))}</span></div></div>` : ''}</div>`;
  const extra = advanced && ref.enabled ? `<div class="feature-extra"><div class="section-label">${escapeHtml(tx('referenceAdvancedTitle'))}</div><div class="field-grid">${inputField('@elementsToCopy', 'reference.detail.elementsToCopy', ref.detail.elementsToCopy, { placeholder: 'e.g. drum tone, reverb style, tempo feel…', full: true })}${inputField('@elementsToAvoid', 'reference.detail.elementsToAvoid', ref.detail.elementsToAvoid, { placeholder: 'e.g. heavy autotune, EDM drops…', full: true })}${inputField('@themesToKeep', 'reference.detail.lyricalThemesToKeep', ref.detail.lyricalThemesToKeep, { placeholder: 'e.g. longing, night imagery…', full: true })}${inputField('@themesToAvoid', 'reference.detail.lyricalThemesToAvoid', ref.detail.lyricalThemesToAvoid, { placeholder: 'e.g. party clichés…', full: true })}</div></div>` : '';
  return `<section class="feature-section ${ref.enabled ? 'enabled' : ''}" aria-labelledby="reference-feature-title"><div class="feature-head"><div><h3 id="reference-feature-title" class="feature-title">${escapeHtml(tx('referenceFeatureTitle'))}</h3><p class="feature-desc">${escapeHtml(tx('referenceFeatureDesc'))}</p></div></div>${featureToggle('enableReferenceLabel', tx('referenceToggleHint'), ref.enabled, 'reference')}${ref.enabled ? core + extra : ''}</section>`;
}
function renderPerformanceFeature(advanced) {
  const perf = current().performance;
  const isSimple = appState.activeMode === 'simple';
  const max = isSimple ? SIMPLE_SECTION_LIMIT : 99;
  const rows = perf.sections;
  const rowMarkup = rows.map((row, index) => {
    const prefix = `performance.sections.${index}`;
    const typeField = row.type === 'Custom' ? `<div class="section-row-fields">${selectField('sectionType', `${prefix}.type`, row.type, SECTION_TYPES, { allowEmpty: false })}${inputField('@customSection', `${prefix}.custom`, row.custom, { placeholder: 'e.g. Drop 2', full: true })}</div>` : `<div class="section-row-fields">${selectField('sectionType', `${prefix}.type`, row.type, SECTION_TYPES, { allowEmpty: false })}</div>`;
    const noteField = advanced ? inputField('@sectionNote', `${prefix}.note`, row.note, { placeholder: tx('sectionNotePlaceholder'), full: true }) : '';
    return `<div class="section-row"><div class="section-row-main">${typeField}<div class="section-row-fields">${selectField('performanceDirection', `${prefix}.direction`, row.direction, PERFORMANCE_DIRECTIONS, { allowEmpty: false })}</div>${noteField}</div><button type="button" class="text-action section-remove" data-remove-section="${index}" aria-label="${escapeHtml(tx('remove'))}">${escapeHtml(tx('remove'))}</button></div>`;
  }).join('');
  const core = `<div class="feature-body">${isSimple ? `<div class="preset-row">${PERFORMANCE_PRESETS.map(preset => `<button type="button" class="chip preset-chip" data-apply-preset-performance="${escapeHtml(preset.id)}">${escapeHtml(preset.name)}</button>`).join('')}</div>` : ''}<div class="section-rows">${rowMarkup || `<p class="field-hint">${escapeHtml(tx('noSectionsHint'))}</p>`}</div>${rows.length < max ? `<button type="button" class="add-button" data-add-section>${escapeHtml(tx('addSection'))} <span aria-hidden="true">＋</span></button>` : `<p class="field-hint">${escapeHtml(tx('sectionLimitHint'))}</p>`}</div>`;
  const extra = advanced && perf.enabled ? `<div class="feature-extra"><p class="field-hint">${escapeHtml(tx('performanceAdvancedHint'))}</p></div>` : '';
  return `<section class="feature-section ${perf.enabled ? 'enabled' : ''}" aria-labelledby="performance-feature-title"><div class="feature-head"><div><h3 id="performance-feature-title" class="feature-title">${escapeHtml(tx('performanceFeatureTitle'))}</h3><p class="feature-desc">${escapeHtml(tx('performanceFeatureDesc'))}</p></div></div>${featureToggle('enablePerformanceLabel', tx('performanceToggleHint'), perf.enabled, 'performance')}${perf.enabled ? core + extra : ''}</section>`;
}
function renderSimpleStep(step) {
  switch (step.id) {
    case 'style': return `${stageHeader('styleTitle', 'styleDesc', activeStepIndex())}<div class="field-grid">${selectField('genre', 'genre', current().genre, GENRES)}${inputField('@subgenre', 'subgenre', current().subgenre, { placeholder: 'e.g. Persian folk, dream pop…' })}${inputField('@styleDescription', 'styleDescription', current().styleDescription, { placeholder: tx('stylePlaceholder'), full: true, large: true })}</div>`;
    case 'mood': return `${stageHeader('moodTitle', 'moodDesc', activeStepIndex())}<div class="field-grid one">${chipGroup('mood', 'moods', MOODS, current().moods, { multi: true, max: 4 })}${chipGroup('emotionalDirection', 'emotionalDirection', ['Beginning', 'Development', 'Climax', 'Ending'], current().emotionalDirection)}</div>`;
    case 'lyrics': return `${stageHeader('lyricsTitle', 'lyricsDesc', activeStepIndex())}<div class="field-grid">${selectField('songLanguage', 'songLanguage', current().songLanguage, LANGUAGES, { allowEmpty: false })}${inputField('@concept', 'lyricsDescription', current().lyricsDescription, { placeholder: tx('lyricsPlaceholder'), full: true, large: true })}</div>${renderFeatureSections(false)}`;
    case 'vocals': return `${stageHeader('vocalsTitle', 'vocalsDesc', activeStepIndex())}<div class="field-grid one">${vocalEditor(false)}</div>`;
    case 'review': return `${stageHeader('reviewTitle', 'reviewDesc', activeStepIndex())}<div class="review-list">${reviewRows(false)}</div>`;
    case 'generate': return `${stageHeader('resultTitle', 'promptReady', activeStepIndex())}<div class="review-list">${reviewRows(false)}</div>`;
  }
}
function renderAdvancedStep(step) {
  const s = current();
  switch (step.id) {
    case 'style': return `${stageHeader('styleTitle', 'styleDesc', activeStepIndex())}<div class="field-grid">${selectField('genre', 'genre', s.genre, GENRES)}${inputField('@subgenre', 'subgenre', s.subgenre, { placeholder: 'e.g. Persian folk, dream pop…' })}${selectField('productionEra', 'era', s.era, ['1960s', '1970s', '1980s', '1990s', '2000s', '2010s', 'Contemporary', 'Timeless'])}${inputField('@styleDescription', 'styleDescription', s.styleDescription, { placeholder: tx('stylePlaceholder'), full: true, large: true })}</div>`;
    case 'mood': return `${stageHeader('moodTitle', 'moodDesc', activeStepIndex())}<div class="field-grid">${chipGroup('mood', 'moods', MOODS, s.moods, { multi: true, max: 4 })}${selectField('emotionalArc', 'emotionalArc', s.emotionalArc, ['Gradual lift', 'Rise and fall', 'Quiet to cathartic', 'Dark to hopeful', 'Steady and intimate', 'Cyclical'])}${selectField('energy', 'energy', s.energy, ['Very low', 'Low', 'Moderate', 'Driving', 'High', 'Dynamic'])}</div>`;
    case 'music': return `${stageHeader('musicTitle', 'musicDesc', activeStepIndex())}<div class="advanced-group">${sectionTitle('musicTitle')}<div class="field-grid">${inputField('@tempo', 'bpm', s.bpm ?? '', { type: 'number', min: 50, max: 200, hint: tx('bpmHelp') })}${selectField('timeSignature', 'timeSignature', s.timeSignature, ['4/4', '3/4', '6/8', '2/4', '5/4', '7/8', 'Custom'])}${s.timeSignature === 'Custom' ? inputField('@custom', 'customTimeSignature', s.customTimeSignature, { placeholder: 'e.g. 9/8' }) : '<div></div>'}${selectField('key', 'key', s.key, ['C Major', 'C Minor', 'C♯ / D♭ Major', 'C♯ / D♭ Minor', 'D Major', 'D Minor', 'D♯ / E♭ Major', 'D♯ / E♭ Minor', 'E Major', 'E Minor', 'F Major', 'F Minor', 'F♯ / G♭ Major', 'F♯ / G♭ Minor', 'G Major', 'G Minor', 'G♯ / A♭ Major', 'G♯ / A♭ Minor', 'A Major', 'A Minor', 'A♯ / B♭ Major', 'A♯ / B♭ Minor', 'B Major', 'B Minor'])}${selectField('musicalMode', 'modeName', s.modeName, ['Major', 'Minor', 'Dorian', 'Mixolydian', 'Phrygian', 'Lydian', 'Harmonic Minor', 'Melodic Minor', 'Custom'])}${s.modeName === 'Custom' ? inputField('@custom', 'customMode', s.customMode, { placeholder: 'Custom mode' }) : '<div></div>'}</div></div><div class="advanced-group">${sectionTitle('harmony')}<div class="field-grid">${selectField('harmonicCharacter', 'harmony.character', s.harmony.character, ['Consonant', 'Warm', 'Bittersweet', 'Moody', 'Unresolved', 'Tense'])}${selectField('chordComplexity', 'harmony.complexity', s.harmony.complexity, ['Simple', 'Moderate', 'Rich extensions', 'Jazz-influenced', 'Experimental'])}${selectField('tension', 'harmony.tension', s.harmony.tension, ['Low', 'Gentle tension', 'Moderate', 'High'])}${selectField('resolution', 'harmony.resolution', s.harmony.resolution, ['Clear resolution', 'Delayed resolution', 'Open-ended', 'Avoid resolution'])}</div></div><div>${sectionTitle('rhythm')}<div class="field-grid">${selectField('groove', 'rhythm.groove', s.rhythm.groove, ['Straight', 'Swung', 'Half-time', 'Shuffle', 'Laid-back', 'Driving', 'Swaying', 'Syncopated'])}${selectField('swing', 'rhythm.swing', s.rhythm.swing, ['None', 'Subtle', 'Moderate', 'Heavy'])}${selectField('syncopation', 'rhythm.syncopation', s.rhythm.syncopation, ['Minimal', 'Subtle', 'Moderate', 'Strong'])}${selectField('rhythmicDensity', 'rhythm.density', s.rhythm.density, ['Sparse', 'Open', 'Moderate', 'Busy'])}${selectField('percussionDensity', 'rhythm.percussionDensity', s.rhythm.percussionDensity, ['None', 'Sparse', 'Moderate', 'Dense'])}</div></div>`;
    case 'instruments': return renderInstrumentStep();
    case 'vocals': return `${stageHeader('vocalAdvancedTitle', 'vocalAdvancedDesc', activeStepIndex())}<div class="field-grid one">${vocalEditor(true)}${chipGroup('vocalInteraction', 'vocalInteraction', ['Unison', 'Harmony', 'Call and response', 'Alternating verses', 'Layered chorus', 'Background support', 'Countermelody', 'Ad-libs'], s.vocalInteraction, { multi: true, max: 8 })}</div>`;
    case 'lyrics': return `${stageHeader('lyricsAdvancedTitle', 'lyricsAdvancedDesc', activeStepIndex())}<div class="field-grid">${selectField('songLanguage', 'songLanguage', s.songLanguage, LANGUAGES, { allowEmpty: false })}${selectField('emotionalArc', 'emotionalArc', s.emotionalArc, ['Gradual lift', 'Rise and fall', 'Quiet to cathartic', 'Dark to hopeful', 'Steady and intimate', 'Cyclical'])}${selectField('lyricDensity', 'lyricDensity', s.lyricDensity, ['Sparse', 'Moderate', 'Dense', 'Conversational'])}${selectField('lyricComplexity', 'lyricComplexity', s.lyricComplexity, ['Direct', 'Poetic but natural', 'Layered imagery', 'Narrative'])}${inputField('@concept', 'lyricsDescription', s.lyricsDescription, { placeholder: tx('lyricsPlaceholder'), full: true, large: true })}</div>${renderFeatureSections(true)}`;
    case 'structure': return `${stageHeader('structureTitle', 'structureDesc', activeStepIndex())}<div class="field-grid">${selectField('songStructure', 'songStructure', s.songStructure, ['Standard Pop', 'Short Form', 'Cinematic', 'Ballad', 'Custom'])}${s.songStructure === 'Custom' ? inputField('@customStructure', 'customStructure', s.customStructure, { placeholder: tx('structurePlaceholder') }) : '<div></div>'}<div class="field full">${sectionTitle('arrangement')}<div class="field-grid">${selectField('arrangementDensity', 'arrangement.density', s.arrangement.density, ['Sparse', 'Gradual build', 'Full and layered', 'Dynamic'])}${selectField('complexity', 'arrangement.complexity', s.arrangement.complexity, ['Minimal', 'Moderate', 'Detailed', 'Ornate'])}${inputField('@introBehavior', 'arrangement.intro', s.arrangement.intro, { placeholder: 'Piano-led, intimate…' })}${inputField('@verseDevelopment', 'arrangement.verse', s.arrangement.verse, { placeholder: 'Add subtle pulse…' })}${inputField('@chorusExpansion', 'arrangement.chorus', s.arrangement.chorus, { placeholder: 'Widen with harmonies…' })}${inputField('@bridgeBehavior', 'arrangement.bridge', s.arrangement.bridge, { placeholder: 'Pull back, then lift…' })}${inputField('@breakdown', 'arrangement.breakdown', s.arrangement.breakdown, {})}${inputField('@dynamicBuild', 'arrangement.build', s.arrangement.build, {})}${inputField('@dynamicRelease', 'arrangement.release', s.arrangement.release, {})}${inputField('@finalSection', 'arrangement.ending', s.arrangement.ending, {})}</div></div></div>`;
    case 'production': return `${stageHeader('productionTitle', 'productionDesc', activeStepIndex())}<div class="advanced-group">${sectionTitle('production')}<div class="field-grid">${chipGroup('production', 'production.character', ['Raw', 'Organic', 'Polished', 'Lo-fi', 'Vintage', 'Modern', 'Cinematic', 'Analog', 'Digital', 'Live', 'Studio', 'Bedroom', 'Experimental'], s.production.character, { multi: true, max: 6 })}${selectField('recording', 'production.recording', s.production.recording, ['Studio', 'Live room', 'Bedroom', 'Field recording', 'Tape', 'Intimate close-mic'])}${selectField('productionEra', 'production.era', s.production.era, ['Vintage', '1970s', '1980s', '1990s', '2000s', 'Contemporary', 'Timeless'])}${selectField('humanFeel', 'production.humanFeel', s.production.humanFeel, ['Tight', 'Balanced', 'Loose and human', 'Live and spontaneous'])}${selectField('imperfection', 'production.imperfection', s.production.imperfection, ['Immaculate', 'Subtle', 'Audible', 'Rough-edged'])}${selectField('saturation', 'production.saturation', s.production.saturation, ['Clean', 'Gentle analog warmth', 'Tape saturation', 'Rich and saturated'])}${inputField('@productionTexture', 'production.texture', s.production.texture, { placeholder: 'Warm, tactile, spacious…' })}</div></div><div class="advanced-group">${sectionTitle('mixing')}<div class="field-grid">${selectField('stereoWidth', 'mix.stereoWidth', s.mix.stereoWidth, ['Narrow', 'Natural', 'Wide', 'Very wide'])}${selectField('bass', 'mix.bass', s.mix.bass, ['Lean', 'Balanced', 'Warm', 'Full'])}${selectField('mids', 'mix.mids', s.mix.mids, ['Soft', 'Natural', 'Forward', 'Sculpted'])}${selectField('highs', 'mix.highs', s.mix.highs, ['Dark', 'Smooth', 'Open', 'Airy'])}${selectField('compression', 'mix.compression', s.mix.compression, ['Minimal', 'Gentle', 'Moderate', 'Punchy'])}${selectField('dynamics', 'mix.dynamics', s.mix.dynamics, ['Wide', 'Natural', 'Controlled', 'Dense'])}${selectField('reverb', 'mix.reverb', s.mix.reverb, ['Dry', 'Room', 'Plate', 'Hall', 'Dreamy and long'])}${selectField('delay', 'mix.delay', s.mix.delay, ['None', 'Slapback', 'Subtle echoes', 'Rhythmic', 'Wide repeats'])}${selectField('vocalPosition', 'mix.vocalPosition', s.mix.vocalPosition, ['Intimate and upfront', 'Centered', 'Blended', 'Distant'])}${selectField('instrumentPosition', 'mix.instrumentPosition', s.mix.instrumentPosition, ['Centered', 'Natural spread', 'Wide and layered'])}${selectField('ambientLevel', 'mix.ambience', s.mix.ambience, ['Dry', 'Subtle', 'Present', 'Immersive'])}${selectField('spatialDepth', 'mix.spatialDepth', s.mix.spatialDepth, ['Close', 'Natural depth', 'Deep and cinematic'])}</div></div><div>${sectionTitle('creative')}<div class="field-grid">${selectField('vocalTexture', 'creative.vocalTexture', s.creative.vocalTexture, ['Clean', 'Airy', 'Warm', 'Raw', 'Smoky'])}${selectField('vocalDistance', 'creative.vocalDistance', s.creative.vocalDistance, ['Close', 'Mid-distance', 'Distant'])}${selectField('instrumentDensity', 'creative.instrumentDensity', s.creative.instrumentDensity, ['Sparse', 'Moderate', 'Dense'])}${selectField('arrangementComplexity', 'creative.arrangementComplexity', s.creative.arrangementComplexity, ['Minimal', 'Moderate', 'Detailed'])}${selectField('dynamicRange', 'creative.dynamicRange', s.creative.dynamicRange, ['Wide', 'Natural', 'Controlled'])}${selectField('ambientLevel', 'creative.ambientLevel', s.creative.ambientLevel, ['Subtle', 'Present', 'Immersive'])}${selectField('harmonicComplexity', 'creative.harmonicComplexity', s.creative.harmonicComplexity, ['Simple', 'Moderate', 'Rich'])}${selectField('melodicComplexity', 'creative.melodicComplexity', s.creative.melodicComplexity, ['Direct', 'Expressive', 'Ornate'])}${inputField('@negativeConstraints', 'negativeConstraints', s.negativeConstraints, { placeholder: tx('avoidPlaceholder'), full: true })}</div></div>`;
    case 'review': return `${stageHeader('reviewTitle', 'reviewDesc', activeStepIndex())}<div class="review-list">${reviewRows(true)}</div>`;
    case 'generate': return `${stageHeader('resultTitle', 'promptReady', activeStepIndex())}<div class="review-list">${reviewRows(true)}</div>`;
  }
}
function renderInstrumentStep() {
  const s = current();
  const groups = Object.entries(INSTRUMENT_GROUPS).map(([group, items]) => {
    const found = items.filter(name => name.toLowerCase().includes((s.instrumentSearch || '').toLowerCase()));
    if (!found.length) return '';
    return `${sectionTitle(group)}<div class="instrument-list">${found.map(name => {
      const selected = s.instruments.find(item => item.name === name);
      return `<div class="instrument-row"><label><input type="checkbox" ${selected ? 'checked' : ''} data-instrument="${escapeHtml(name)}"> ${escapeHtml(translateOption(locale, name))}</label>${selected ? pickerTrigger(`instrument-role:${name}`, selected.role, INSTRUMENT_ROLES, { label: `${translateOption(locale, name)} ${tx('instrumentRole')}` }) : `<span class="field-hint">${escapeHtml(translateOption(locale, group))}</span>`}</div>`;
    }).join('')}</div>`;
  }).join('');
  return `${stageHeader('instrumentsTitle', 'instrumentsDesc', activeStepIndex())}${inputField('@searchInstruments', 'instrumentSearch', s.instrumentSearch, { placeholder: tx('searchInstruments') })}<div style="margin-top:17px">${groups}</div>`;
}
function reviewRows(advanced) {
  const s = current();
  const rows = [
    [tx('genre'), [translateOption(locale, s.genre), s.subgenre].filter(Boolean).join(' · ')],
    [tx('mood'), (s.moods || []).map(item => translateOption(locale, item)).join(', ')],
    [tx('songLanguage'), translateOption(locale, s.songLanguage)],
    [tx('concept'), s.lyricsDescription],
    [tx('styleDescription'), s.styleDescription],
    [tx('vocalsTitle'), (s.vocalists || []).map(v => [translateOption(locale, v.gender), translateOption(locale, v.role), translateOption(locale, v.delivery)].filter(Boolean).join(' · ')).join(' / ') || tx('empty')]
  ];
  if (s.reference?.enabled) rows.push([tx('referenceFeatureTitle'), [s.reference.actions.map(action => tx(REFERENCE_ACTION_META.find(meta => meta.value === action)?.label || action)).join(' · '), s.reference.sourceDescription].filter(Boolean).join(' — ') || tx('referenceEnabledShort')]);
  if (s.performance?.enabled) rows.push([tx('performanceFeatureTitle'), s.performance.sections.map(row => `${row.type === 'Custom' && row.custom ? row.custom : row.type} → ${row.direction}`).join(' · ') || tx('performanceEnabledShort')]);
  if (advanced) {
    rows.push([tx('tempo'), s.bpm ? `${s.bpm} BPM` : '']);
    rows.push([tx('timeSignature'), s.timeSignature === 'Custom' ? s.customTimeSignature : s.timeSignature]);
    rows.push([tx('key'), [s.key, s.modeName === 'Custom' ? s.customMode : s.modeName].filter(Boolean).join(' · ')]);
    rows.push([tx('instrumentsTitle'), (s.instruments || []).map(i => `${translateOption(locale, i.name)} (${translateOption(locale, i.role)})`).join(', ')]);
    rows.push([tx('songStructure'), translateOption(locale, s.songStructure === 'Custom' ? s.customStructure : s.songStructure)]);
    rows.push([tx('production'), (s.production.character || []).map(item => translateOption(locale, item)).join(', ')]);
    rows.push([tx('mixing'), Object.entries(s.mix || {}).filter(([, value]) => value).map(([key, value]) => `${fieldLabel(key === 'stereoWidth' ? 'stereoWidth' : key === 'ambience' ? 'ambientLevel' : key, key)}: ${translateOption(locale, value)}`).join(' · ')]);
    rows.push([tx('arrangement'), Object.entries(s.arrangement || {}).filter(([, value]) => value).map(([key, value]) => `${fieldLabel(key === 'build' ? 'dynamicBuild' : key === 'release' ? 'dynamicRelease' : key === 'ending' ? 'finalSection' : key === 'density' ? 'arrangementDensity' : key, key)}: ${value}`).join(' · ')]);
  }
  return rows.filter(([, value]) => value).map(([key, value]) => `<div class="review-row ${key === tx('concept') || key === tx('styleDescription') ? 'full' : ''}"><span class="review-key">${escapeHtml(key)}</span><span class="review-value">${escapeHtml(value)}</span></div>`).join('');
}
function renderHeader() {
  const activeStep = steps()[activeStepIndex()];
  const done = new Set(steps().slice(0, activeStepIndex()).map(step => step.id));
  const labelForStep = id => ({ style:'styleTitle', mood:'moodTitle', lyrics:'lyricsTitle', vocals:appState.activeMode === 'advanced' ? 'vocalAdvancedTitle' : 'vocalsTitle', review:'review', generate:'generate', music:'musicTitle', instruments:'instrumentsTitle', structure:'structureTitle', production:'productionTitle' }[id] || id);
  const stepper = steps().map(step => `<button type="button" class="step-item ${step.id === currentStepId ? 'active' : ''} ${done.has(step.id) ? 'done' : ''}" data-step="${step.id}" aria-current="${step.id === currentStepId ? 'step' : 'false'}"><span class="step-num">${done.has(step.id) ? '✓' : step.short}</span><span class="step-name">${escapeHtml(tx(labelForStep(step.id)))}</span></button>`).join('');
  const percent = Math.round(((activeStepIndex() + 1) / steps().length) * 100);
  return `<header class="topbar"><a class="brand" href="#" aria-label="SonicDraft home"><span class="brand-mark" aria-hidden="true">∿</span><span><span class="brand-word">sonicdraft</span><span class="brand-sub">${escapeHtml(tx('tagline'))}</span></span></a><div class="header-actions"><button class="mode-switch" type="button" data-open-mode aria-haspopup="dialog"><span class="mode-dot"></span><span>${escapeHtml(modeLabel(appState.activeMode))}</span><span class="chevron">⌄</span></button><button class="icon-button" type="button" data-toggle-language aria-label="${escapeHtml(locale === 'en' ? 'Switch to Persian' : 'Switch to English')}">${locale === 'en' ? 'فا' : 'EN'}</button></div></header><section class="hero"><div><div class="eyebrow">${escapeHtml(tx('tagline'))}</div><h1>${escapeHtml(tx(appState.activeMode === 'simple' ? 'modeSimpleTitle' : 'modeAdvancedTitle'))}</h1><p class="hero-copy">${escapeHtml(tx(appState.activeMode === 'simple' ? 'simpleNote' : 'advancedNote'))}</p></div><div class="hero-side"><span class="save-dot"></span>${escapeHtml(tx('saved'))}</div></section><div class="composer-top"><div class="workspace-label">${escapeHtml(tx('mode'))}: <strong>${escapeHtml(modeLabel(appState.activeMode))}</strong> <span aria-hidden="true">·</span> ${escapeHtml(tx('savedApart'))}</div><button class="preset-button" type="button" data-open-presets>✳ &nbsp;${escapeHtml(tx('presets'))}</button></div><nav class="stepper-wrap" aria-label="${escapeHtml(tx('steps'))}"><div class="stepper">${stepper}</div><div class="step-progress-mobile"><div class="progress-info"><strong>${escapeHtml(tx(labelForStep(activeStep?.id)))}</strong><span>${escapeHtml(tx('stepOf'))} ${activeStepIndex() + 1}</span></div><span class="progress-count">${activeStepIndex() + 1} / ${steps().length}</span></div><div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div></nav>`;
}
function renderActions() {
  const index = activeStepIndex();
  const isFirst = index === 0;
  const isLast = index === steps().length - 1;
  const isReview = currentStepId === 'review';
  const previous = locale === 'fa' ? '→' : '←';
  const forward = locale === 'fa' ? '←' : '→';
  return `<div class="action-row desktop-actions"><div class="action-left"><button class="action-button quiet" type="button" data-reset>${escapeHtml(tx('reset'))}</button><button class="action-button" type="button" data-surprise>✳ &nbsp;${escapeHtml(tx('surprise'))}</button></div><div class="action-right"><span class="shortcut">${index + 1} / ${steps().length}</span><button class="action-button" type="button" data-back ${isFirst ? 'disabled' : ''}><span aria-hidden="true">${previous}</span> ${escapeHtml(tx('back'))}</button>${!isLast ? `<button class="action-button ${isReview ? '' : 'primary'}" type="button" data-next>${escapeHtml(tx('next'))} <span aria-hidden="true">${forward}</span></button>` : ''}${isLast || isReview ? `<button class="action-button primary" type="button" data-generate>${escapeHtml(tx('generate'))} <span aria-hidden="true">✦</span></button>` : ''}</div></div><nav class="mobile-dock" aria-label="${escapeHtml(tx('steps'))}" dir="${locale === 'fa' ? 'rtl' : 'ltr'}"><div class="dock-tools" role="group" aria-label="${escapeHtml(tx('creative'))}"><button class="dock-control dock-icon" type="button" data-surprise aria-label="${escapeHtml(tx('surprise'))}" title="${escapeHtml(tx('surprise'))}"><span aria-hidden="true">✳</span></button><button class="dock-control dock-icon" type="button" data-reset aria-label="${escapeHtml(tx('reset'))}" title="${escapeHtml(tx('reset'))}"><span aria-hidden="true">↺</span></button></div><div class="dock-navigation" role="group" aria-label="${escapeHtml(tx('steps'))}"><button class="dock-control dock-icon" type="button" data-back aria-label="${escapeHtml(tx('back'))}" title="${escapeHtml(tx('back'))}" ${isFirst ? 'disabled' : ''}><span aria-hidden="true">${previous}</span></button><button class="dock-control dock-next" type="button" data-next ${isLast ? 'disabled' : ''}>${escapeHtml(tx('next'))}<span aria-hidden="true">${forward}</span></button></div><button class="dock-control dock-generate" type="button" data-generate aria-label="${escapeHtml(tx('generate'))}"><span class="dock-generate-mark" aria-hidden="true">✦</span><span>${escapeHtml(tx('dockGenerate'))}</span></button></nav>`;
}
function render() {
  if (!steps().some(step => step.id === currentStepId)) currentStepId = 'style';
  pickerOptions.clear();
  const step = steps()[activeStepIndex()];
  const body = appState.activeMode === 'simple' ? renderSimpleStep(step) : renderAdvancedStep(step);
  app.innerHTML = `<main>${renderHeader()}<div class="stage" id="composer-stage"><section class="step-screen ${transitionDirection === 'back' ? 'enter-back' : 'enter-forward'}" id="step-screen" aria-live="polite" aria-atomic="false">${body}</section></div>${renderActions()}</main>`;
  document.documentElement.lang = locale === 'fa' ? 'fa' : 'en';
  document.documentElement.dir = locale === 'fa' ? 'rtl' : 'ltr';
  document.title = `SonicDraft — ${tx('tagline')}`;
  transitionDirection = 'forward';
}
let stepTransitioning = false;
function setStep(stepId, direction = 'forward') {
  if (activeModal || stepTransitioning || !steps().some(step => step.id === stepId) || stepId === currentStepId) return;
  const screen = document.querySelector('#step-screen');
  stepTransitioning = true;
  if (screen) {
    screen.classList.add(direction === 'back' ? 'leaving-back' : 'leaving-forward');
    setTimeout(() => { currentStepId = stepId; transitionDirection = direction; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); setTimeout(() => { stepTransitioning = false; }, 310); }, 240);
  }
}
function navigate(direction) {
  const index = activeStepIndex();
  const nextIndex = Math.min(steps().length - 1, Math.max(0, index + direction));
  if (nextIndex !== index) setStep(steps()[nextIndex].id, direction < 0 ? 'back' : 'forward');
}
function switchMode(nextMode) {
  if (!['simple', 'advanced'].includes(nextMode)) { closeModal(); return; }
  if (nextMode === appState.activeMode) {
    appState.shared.onboarded = true; modeChoosing = false; save(); closeModal(false); return;
  }
  const editedThisWorkspace = explicitlyEdited;
  const stage = document.querySelector('#composer-stage');
  if (stage) animateExit(stage, [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(5px)' }], { duration: 180 });
  transitionMode(appState, nextMode, editedThisWorkspace);
  explicitlyEdited = new Set(); currentStepId = 'style'; save(); closeModal(false);
  setTimeout(() => { render(); const nextStage = document.querySelector('#composer-stage'); if (nextStage && !matchMedia('(prefers-reduced-motion: reduce)').matches) nextStage.animate([{ opacity: 0, transform: 'translateY(9px) scale(.995)', filter: 'blur(2px)' }, { opacity: 1, transform: 'translateY(0) scale(1)', filter: 'blur(0)' }], { duration: 260, easing: 'cubic-bezier(.2,.75,.25,1)' }); }, 220);
}
function activeFocusables(container) {
  return [...container.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(item => item.offsetParent !== null);
}
function openModal(kind, content, { wide = false, closable = true, picker = false } = {}) {
  clearTimeout(modalTimer);
  pickerClosing = false;
  modalTrigger = document.activeElement; activeModal = kind; document.body.style.overflow = 'hidden';
  const titleKey = kind === 'mode' ? 'chooseMode' : kind === 'result' ? 'resultTitle' : kind === 'reset' ? 'resetTitle' : kind === 'picker' ? 'select' : 'presets';
  const markup = `<div class="modal-backdrop ${picker ? 'picker-backdrop' : ''}" data-backdrop><section class="modal-panel ${wide ? 'wide' : ''} ${picker ? 'picker-panel' : ''}" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabindex="-1">${closable ? `<button class="icon-button modal-close" type="button" data-close-modal aria-label="${escapeHtml(tx('closeDialog'))}">×</button>` : ''}${content}</section></div>`;
  overlayRoot.innerHTML = markup;
  const backdrop = overlayRoot.querySelector('[data-backdrop]');
  const dialog = overlayRoot.querySelector('.modal-panel');
  if (!dialog.querySelector('#dialog-title')) {
    dialog.removeAttribute('aria-labelledby');
    dialog.setAttribute('aria-label', tx(titleKey));
  }
  backdrop.addEventListener('click', event => { if (event.target === backdrop && closable) closeModal(); });
  const trigger = modalTrigger;
  if (trigger instanceof HTMLElement && trigger.matches('[data-picker]') && activeModal === 'picker') trigger.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => {
    if (activeModal === 'picker') return;
    (dialog.querySelector('button:not([disabled])') || dialog).focus();
  });
}
function closeModal(restoreFocus = true) {
  const backdrop = overlayRoot.querySelector('[data-backdrop]');
  const closingKind = activeModal;
  if (!backdrop) { activeModal = null; return; }
  if (modeChoosing && activeModal === 'mode' && !appState.shared.onboarded) return;
  if (closingKind === 'picker' && modalTrigger instanceof HTMLElement) modalTrigger.setAttribute('aria-expanded', 'false');
  if (closingKind === 'picker') pickerClosing = true;
  backdrop.classList.add('closing'); activeModal = null; document.body.style.overflow = '';
  modalTimer = setTimeout(() => {
    if (!backdrop.isConnected || activeModal !== null) return;
    overlayRoot.replaceChildren();
    if (closingKind === 'picker') pickerClosing = false;
    if (restoreFocus && modalTrigger instanceof HTMLElement && modalTrigger.isConnected) modalTrigger.focus({ preventScroll: true });
  }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 20 : matchMedia('(max-width: 760px)').matches ? 360 : 240);
}
function openModeChooser(initial = false) {
  modeChoosing = initial;
  openModal('mode', `<div class="modal-eyebrow">SonicDraft · ${escapeHtml(tx('mode'))}</div><h2 id="dialog-title" class="modal-title">${escapeHtml(tx('chooseMode'))}</h2><p class="modal-description">${escapeHtml(tx('chooseModeSub'))}</p><div class="mode-options"><button class="mode-option" type="button" data-select-mode="simple"><span class="mode-option-icon">◌</span><h3>${escapeHtml(tx('modeSimpleTitle'))}</h3><p>${escapeHtml(tx('modeSimpleDesc'))}</p></button><button class="mode-option" type="button" data-select-mode="advanced"><span class="mode-option-icon">✳</span><h3>${escapeHtml(tx('modeAdvancedTitle'))}</h3><p>${escapeHtml(tx('modeAdvancedDesc'))}</p></button></div><p class="field-hint" style="margin-top:17px">${escapeHtml(tx('savedApart'))}</p>`, { closable: !initial });
}
function openPicker(path, trigger) {
  const options = pickerOptions.get(path);
  if (!options) return;
  const isInstrumentRole = path.startsWith('instrument-role:');
  const selectedValue = isInstrumentRole
    ? current().instruments.find(item => item.name === path.slice('instrument-role:'.length))?.role || ''
    : pathGet(current(), path);
  const label = trigger.getAttribute('aria-labelledby') ? document.getElementById(trigger.getAttribute('aria-labelledby'))?.textContent?.trim() || tx('select') : trigger.getAttribute('aria-label') || tx('select');
  const currentValue = Array.isArray(selectedValue) ? selectedValue[0] : selectedValue;
  const hasCurrentValue = options.some(item => String(item) === String(currentValue ?? ''));
  const list = options.map((option, index) => {
    const isSelected = String(option) === String(currentValue ?? '');
    const title = option === '' ? tx('empty') : translateOption(locale, option);
    const firstFocusable = isSelected || (!hasCurrentValue && index === 0);
    return `<button type="button" class="picker-option ${isSelected ? 'selected' : ''} ${option === '' ? 'picker-option-empty' : ''}" role="option" aria-selected="${isSelected}" tabindex="${firstFocusable ? '0' : '-1'}" style="--option-index:${index}" data-picker-choice="${escapeHtml(path)}" data-value="${escapeHtml(option)}" data-option-index="${index}" data-search-value="${escapeHtml(title.toLocaleLowerCase())}"><span>${escapeHtml(title)}</span><span class="picker-check" aria-hidden="true">${isSelected ? '✓' : ''}</span></button>`;
  }).join('');
  const search = options.length > 12 ? `<input class="text-input picker-search" type="search" data-picker-search placeholder="${escapeHtml(tx('searchOptions'))}" aria-label="${escapeHtml(tx('searchOptions'))}">` : '';
  openModal('picker', `<div class="picker-top"><div class="picker-heading"><div><div class="modal-eyebrow">${escapeHtml(tx('select'))}</div><h2 id="dialog-title" class="modal-title">${escapeHtml(label)}</h2></div></div>${search}</div><div class="picker-list" role="listbox" aria-label="${escapeHtml(label)}">${list}</div><p class="picker-no-results hidden" data-picker-empty role="status">${escapeHtml(tx('noOptions'))}</p>`, { picker: true });
  const selected = overlayRoot.querySelector('.picker-option.selected');
  requestAnimationFrame(() => {
    const focusTarget = overlayRoot.querySelector('[data-picker-search]') || selected || overlayRoot.querySelector('.picker-option');
    if (focusTarget) { focusTarget.focus(); if (focusTarget.matches('.picker-option')) focusTarget.scrollIntoView({ block: 'nearest' }); }
  });
}
function choosePickerValue(path, value) {
  const priorPickerTrigger = modalTrigger;
  if (path.startsWith('instrument-role:')) {
    const name = path.slice('instrument-role:'.length);
    const instrument = current().instruments.find(item => item.name === name);
    if (instrument) instrument.role = value;
  } else {
    if (path === 'timeSignature' && value !== 'Custom') current().customTimeSignature = '';
    if (path === 'modeName' && value !== 'Custom') current().customMode = '';
    if (path === 'songStructure' && value !== 'Custom') current().customStructure = '';
    pathSet(current(), path, value);
    if (path.startsWith('vocalists.')) explicitlyEdited.add('vocalists');
    if (['genre', 'subgenre', 'moods', 'songLanguage', 'lyricsDescription', 'styleDescription'].includes(path)) explicitlyEdited.add(path);
  }
  save();
  closeModal(false);
  render();
  const trigger = [...document.querySelectorAll('[data-picker]')].find(item => item.dataset.picker === path);
  if (trigger) {
    const delay = matchMedia('(prefers-reduced-motion: reduce)').matches ? 30 : matchMedia('(max-width: 760px)').matches ? 360 : 240;
    setTimeout(() => { if (trigger.isConnected) { trigger.focus({ preventScroll: true }); return; } if (priorPickerTrigger?.isConnected) priorPickerTrigger.focus({ preventScroll: true }); }, delay);
  } else if (priorPickerTrigger?.isConnected) setTimeout(() => priorPickerTrigger.focus({ preventScroll: true }), 30);
}
function openPresets() {
  const available = PRESETS.filter(preset => preset.mode === appState.activeMode);
  openModal('presets', `<div class="modal-eyebrow">${escapeHtml(modeLabel(appState.activeMode))}</div><h2 id="dialog-title" class="modal-title">${escapeHtml(tx('choosePreset'))}</h2><p class="modal-description">${escapeHtml(tx('noPreset'))}</p><div class="preset-list">${available.map(preset => `<button type="button" class="preset-choice" data-preset="${escapeHtml(preset.name)}"><span class="preset-symbol">${escapeHtml(preset.icon)}</span><span>${escapeHtml(preset.name)}</span></button>`).join('')}</div>`);
}
function openReset() {
  openModal('reset', `<div class="modal-eyebrow">${escapeHtml(modeLabel(appState.activeMode))}</div><h2 id="dialog-title" class="modal-title">${escapeHtml(tx('resetTitle'))}</h2><p class="modal-description">${escapeHtml(tx('resetDescription'))}</p><div class="modal-footer"><button class="action-button" type="button" data-close-modal>${escapeHtml(tx('cancel'))}</button><button class="action-button primary" type="button" data-confirm-reset>${escapeHtml(tx('resetAll'))}</button></div>`);
}
function resetActiveMode() {
  appState[appState.activeMode] = appState.activeMode === 'simple' ? createSimpleState() : createAdvancedState();
  currentStepId = 'style'; explicitlyEdited = new Set(); save(); closeModal(false); render(); toast(tx('reset'));
}
function applyPreset(name) {
  const preset = PRESETS.find(item => item.name === name && item.mode === appState.activeMode);
  if (!preset) return;
  for (const [key, value] of Object.entries(preset)) {
    if (['name', 'icon', 'mode'].includes(key)) continue;
    current()[key] = clone(value);
    if (['genre', 'subgenre', 'moods', 'songLanguage', 'lyricsDescription', 'styleDescription', 'vocalists'].includes(key)) explicitlyEdited.add(key);
  }
  save(); closeModal(false); render(); toast(name);
}
function createVocalist(index) {
  return { id: `voice-${Date.now()}-${index}`, gender: '', role: index === 0 ? 'Lead' : 'Harmony', delivery: '', voiceType: '', register: '', texture: '', intensity: '', distance: '', breathiness: '', roughness: '', clarity: '', presence: '', harmony: '', interaction: '', adlibs: '' };
}
function surpriseMe() {
  const mode = appState.activeMode;
  const options = PRESETS.filter(preset => preset.mode === mode);
  const preset = options[Math.floor(Math.random() * options.length)];
  const target = current();
  for (const [key, value] of Object.entries(preset)) if (!['name', 'icon', 'mode'].includes(key)) {
    target[key] = clone(value);
    if (['genre', 'subgenre', 'moods', 'songLanguage', 'lyricsDescription', 'styleDescription', 'vocalists'].includes(key)) explicitlyEdited.add(key);
  }
  target.moods = clone(preset.moods || ['Melancholic', 'Intimate']);
  target.songLanguage ||= 'English';
  explicitlyEdited.add('genre');
  target.lyricsDescription = mode === 'simple' ? 'A quiet moment of missing someone, finding a little hope in the memories they left behind.' : 'A vivid, emotionally grounded story of distance and return; intimate verses rise toward a cathartic final refrain.';
  explicitlyEdited.add('lyricsDescription'); explicitlyEdited.add('moods');
  if (mode === 'simple') {
    target.vocalists = [{ ...createVocalist(0), gender: 'Male', role: 'Lead', delivery: 'Intimate' }];
    target.emotionalDirection = 'Development';
    currentStepId = 'review';
  } else {
    target.bpm ||= 92; target.timeSignature ||= '4/4'; target.modeName ||= 'Minor'; target.key ||= 'D Minor';
    target.vocalists = [{ ...createVocalist(0), gender: 'Male', role: 'Lead', delivery: 'Intimate', texture: 'Warm', distance: 'Close', intensity: 'Gentle' }];
    target.vocalInteraction = ['Layered chorus', 'Background support'];
    target.arrangement.build ||= 'Patient cinematic rise'; target.mix.stereoWidth ||= 'Wide'; target.mix.reverb ||= 'Room'; target.mix.dynamics ||= 'Wide';
  }
  explicitlyEdited.add('vocalists'); currentStepId = 'review'; save(); render(); toast(tx('surprise'));
}
function validateMode(mode, state) {
  if (mode === 'simple' && !state.genre && !state.subgenre && !state.lyricsDescription && !state.styleDescription) return tx('styleDesc');
  if (mode === 'advanced' && state.bpm !== null && state.bpm !== '' && (state.bpm < 50 || state.bpm > 200)) return tx('bpmHelp');
  return '';
}
async function generate() {
  const mode = appState.activeMode;
  const state = clone(current());
  const error = validateMode(mode, state);
  if (error || mode === 'advanced' && !state.genre && !state.lyricsDescription && !state.styleDescription && !state.bpm) { toast(error || tx('styleDesc')); return; }
  if (mode === 'advanced' && state.bpm !== null && state.bpm !== '' && state.bpm >= 50 && state.bpm <= 200) state.bpm = Math.round(state.bpm);
  const trigger = document.activeElement;
  promptToShow = generateMasterPrompt(mode, { [mode]: state });
  openModal('loading', `<div class="modal-eyebrow">SonicDraft</div><h2 id="dialog-title" class="modal-title">${escapeHtml(tx('preparing'))}</h2><p class="modal-description">${escapeHtml(tx('saved'))}</p><div class="progress-track"><div class="progress-fill" style="width:70%"></div></div>`, { closable: false });
  modalTrigger = trigger;
  setTimeout(() => {
    if (activeModal !== 'loading') return;
    openModal('result', `<div class="modal-eyebrow">${escapeHtml(modeLabel(mode))}</div><h2 id="dialog-title" class="modal-title">${escapeHtml(tx('resultTitle'))}</h2><p class="modal-description">${escapeHtml(tx('resultDesc'))}</p><pre class="result-text" tabindex="0">${escapeHtml(promptToShow)}</pre><div class="provider-row"><button class="action-button primary" type="button" data-copy>${escapeHtml(tx('copy'))}</button>${AI_PROVIDERS.map(provider => `<button class="action-button" type="button" data-provider="${provider.id}">${escapeHtml(tx(`open${provider.name}`))}</button>`).join('')}</div><div class="modal-footer"><button class="action-button quiet" type="button" data-close-modal>${escapeHtml(tx('close'))}</button></div>`, { wide: true });
    modalTrigger = trigger;
  }, 430);
}
async function copyPrompt() {
  try { await navigator.clipboard.writeText(promptToShow); toast(tx('copied')); }
  catch {
    const helper = document.createElement('textarea'); helper.value = promptToShow; helper.setAttribute('readonly', ''); helper.style.position = 'fixed'; helper.style.opacity = '0'; document.body.append(helper); helper.select();
    const copied = document.execCommand('copy'); helper.remove(); toast(copied ? tx('copied') : tx('resultDesc'));
  }
}
function updateBoundValue(element) {
  const path = element.dataset.bind;
  if (!path) return;
  let value = element.value;
  if (element instanceof HTMLInputElement && element.type === 'number') value = value === '' ? null : Number(value);
  pathSet(current(), path, value);
  if (path.startsWith('vocalists.') && !path.endsWith('.id')) explicitlyEdited.add('vocalists');
  if (['genre', 'subgenre', 'moods', 'songLanguage', 'lyricsDescription', 'styleDescription'].includes(path)) explicitlyEdited.add(path);
  save();
}
function rerenderPreservingFocus(selector, selectionStart) {
  render(); const next = document.querySelector(selector);
  if (next) { next.focus(); if (selectionStart != null && next.setSelectionRange) next.setSelectionRange(selectionStart, selectionStart); }
}

app.addEventListener('input', event => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.matches('[data-bind]')) return;
  updateBoundValue(target);
  if (target.dataset.bind === 'instrumentSearch') rerenderPreservingFocus('[data-bind="instrumentSearch"]', target.selectionStart);
});
app.addEventListener('change', event => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;      if (target.matches('[data-bind]')) { updateBoundValue(target); render(); return; }
  if (target.matches('[data-instrument]')) {
    const name = target.dataset.instrument;
    const list = current().instruments;
    const index = list.findIndex(item => item.name === name);
    if (target.checked && index === -1) list.push({ name, role: 'Secondary' });
    if (!target.checked && index !== -1) list.splice(index, 1);
    save(); render(); return;
  }
});
// Modal content is mounted in a sibling root, so delegate app-wide actions
// from the document rather than only from the composer shell.
document.addEventListener('click', async event => {
  const target = event.target instanceof Element ? event.target.closest('button') : null;
  if (!target) return;  if (target.hasAttribute('data-picker')) { openPicker(target.dataset.picker, target); return; }
  if (target.hasAttribute('data-picker-choice')) { choosePickerValue(target.dataset.pickerChoice, target.dataset.value); return; }
  if (target.hasAttribute('data-toggle-language')) { locale = locale === 'en' ? 'fa' : 'en'; appState.shared.uiLanguage = locale; save(); render(); return; }
  if (target.hasAttribute('data-open-mode')) { openModeChooser(false); return; }
  if (target.hasAttribute('data-select-mode')) { switchMode(target.dataset.selectMode); return; }
  if (target.hasAttribute('data-open-presets')) { openPresets(); return; }
  if (target.hasAttribute('data-close-modal')) { closeModal(); return; }
  if (target.hasAttribute('data-confirm-reset')) { resetActiveMode(); return; }
  if (target.hasAttribute('data-reset')) { openReset(); return; }
  if (target.hasAttribute('data-surprise')) { surpriseMe(); return; }
  if (target.hasAttribute('data-next')) { navigate(1); return; }
  if (target.hasAttribute('data-back')) { navigate(-1); return; }
  if (target.hasAttribute('data-step')) { setStep(target.dataset.step, steps().findIndex(step => step.id === target.dataset.step) < activeStepIndex() ? 'back' : 'forward'); return; }
  if (target.hasAttribute('data-generate')) { generate(); return; }
  if (target.hasAttribute('data-copy')) { await copyPrompt(); return; }
  if (target.hasAttribute('data-provider')) {
    try { const copied = await openProvider(target.dataset.provider, promptToShow); toast(copied ? tx('copiedOpen') : tx('resultDesc')); }
    catch { toast(tx('resultDesc')); }
    return;
  }
  if (target.hasAttribute('data-preset')) { applyPreset(target.dataset.preset); return; }
  if (target.hasAttribute('data-add-voice')) {
    const voices = current().vocalists; const max = appState.activeMode === 'simple' ? 2 : 4;
    if (voices.length < max) { voices.push(createVocalist(voices.length)); explicitlyEdited.add('vocalists'); save(); render(); document.querySelectorAll('.voice-block')[voices.length - 1]?.querySelector('[data-picker]')?.focus(); }
    return;
  }
  if (target.hasAttribute('data-remove-voice')) { current().vocalists.splice(Number(target.dataset.removeVoice), 1); explicitlyEdited.add('vocalists'); save(); render(); return; }
  if (target.hasAttribute('data-toggle-reference')) {
    const ref = current().reference;
    ref.enabled = !ref.enabled;
    if (ref.enabled && !ref.actions.length) ref.actions = ['Copy Music Style'];
    save(); render();
    requestAnimationFrame(() => document.querySelector('[data-toggle-reference]')?.focus());
    return;
  }
  if (target.hasAttribute('data-toggle-performance')) {
    const perf = current().performance;
    perf.enabled = !perf.enabled;
    if (perf.enabled && !perf.sections.length) {
      perf.sections = [createSectionRow('Verse 1', 'Emotional')];
    }
    save(); render();
    requestAnimationFrame(() => document.querySelector('[data-toggle-performance]')?.focus());
    return;
  }
  if (target.hasAttribute('data-reference-action')) {
    const action = target.dataset.referenceAction;
    const actions = current().reference.actions;
    const index = actions.indexOf(action);
    if (index >= 0) actions.splice(index, 1); else actions.push(action);
    save(); render();
    requestAnimationFrame(() => document.querySelector(`[data-reference-action="${CSS.escape(action)}"]`)?.focus());
    return;
  }
  if (target.hasAttribute('data-add-section')) {
    const perf = current().performance;
    const max = appState.activeMode === 'simple' ? SIMPLE_SECTION_LIMIT : 99;
    if (perf.sections.length < max) {
      perf.sections.push(createSectionRow('Verse 1', 'Emotional'));
      save(); render();
    }
    return;
  }
  if (target.hasAttribute('data-remove-section')) {
    current().performance.sections.splice(Number(target.dataset.removeSection), 1);
    save(); render();
    return;
  }
  if (target.hasAttribute('data-apply-preset-performance')) {
    applyPerformancePreset(current().performance, target.dataset.applyPresetPerformance);
    save(); render();
    return;
  }
  if (target.hasAttribute('data-choice')) {
    const path = target.dataset.choice; const value = target.dataset.value;
    if (target.dataset.multi === 'true') {
      const selection = pathGet(current(), path) || []; const index = selection.indexOf(value);
      if (index >= 0) selection.splice(index, 1); else if (selection.length < Number(target.dataset.max || 99)) selection.push(value);
      if (path === 'moods') explicitlyEdited.add('moods'); pathSet(current(), path, selection);
    } else {
      pathSet(current(), path, value === pathGet(current(), path) ? '' : value);
      if (path === 'emotionalDirection') explicitlyEdited.add(path);
    }
    save(); render();
  }
});

document.addEventListener('input', event => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !input.matches('[data-picker-search]')) return;
  const query = input.value.trim().toLocaleLowerCase();
  let visibleCount = 0;
  for (const option of overlayRoot.querySelectorAll('.picker-option')) {
    const visible = option.dataset.searchValue.includes(query);
    option.hidden = !visible;
    if (visible) visibleCount += 1;
  }
  overlayRoot.querySelector('[data-picker-empty]')?.classList.toggle('hidden', visibleCount > 0);
});

document.addEventListener('keydown', event => {
  if (!activeModal) return;
  if (event.key === 'Escape') { if (activeModal !== 'loading' && !(modeChoosing && !appState.shared.onboarded)) closeModal(); return; }
  if (activeModal === 'picker' && event.key === 'Enter' && document.activeElement?.matches('.picker-option')) {
    event.preventDefault(); document.activeElement.click(); return;
  }
  if (activeModal === 'picker' && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && !overlayRoot.querySelector('[data-picker-search]')) {
    const options = [...overlayRoot.querySelectorAll('.picker-option:not([hidden])')];
    const firstMatch = options.find(option => option.dataset.searchValue.startsWith(event.key.toLocaleLowerCase()));
    if (firstMatch) { event.preventDefault(); firstMatch.focus(); }
    return;
  }
  if (activeModal === 'picker' && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    const options = [...overlayRoot.querySelectorAll('.picker-option:not([hidden])')];
    if (!options.length) return;
    const currentIndex = options.indexOf(document.activeElement);
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : event.key === 'ArrowDown' ? Math.min(options.length - 1, currentIndex < 0 ? 0 : currentIndex + 1) : Math.max(0, currentIndex < 0 ? 0 : currentIndex - 1);
    event.preventDefault(); options[nextIndex].focus(); return;
  }
  if (event.key === 'Tab') {
    const panel = overlayRoot.querySelector('.modal-panel'); const items = panel && activeFocusables(panel);
    if (!items?.length) { event.preventDefault(); panel?.focus(); return; }
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});

render();
if (!appState.shared.onboarded) {
  modeChoosing = true;
  requestAnimationFrame(() => openModeChooser(true));
}
