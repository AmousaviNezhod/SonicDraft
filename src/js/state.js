import { LANGUAGES } from './data.js';

export const SHARED_FIELDS = Object.freeze([
  'genre', 'subgenre', 'moods', 'songLanguage', 'lyricsDescription', 'styleDescription', 'vocalists'
]);
export const clone = value => value == null ? value : structuredClone(value);

export function createSimpleState() {
  return {
    genre: '', subgenre: '', moods: [], songLanguage: 'English', lyricsDescription: '',
    styleDescription: '', vocalists: [], emotionalDirection: ''
  };
}

export function createAdvancedState() {
  return {
    genre: '', subgenre: '', moods: [], songLanguage: 'English', lyricsDescription: '',
    styleDescription: '', vocalists: [], emotionalArc: '', energy: '', era: '', bpm: null,
    timeSignature: '', customTimeSignature: '', key: '', modeName: '', customMode: '',
    harmony: { character: '', complexity: '', tension: '', resolution: '' },
    rhythm: { groove: '', swing: '', syncopation: '', density: '', percussionDensity: '' },
    instruments: [], instrumentSearch: '',
    arrangement: { density: '', complexity: '', intro: '', verse: '', chorus: '', bridge: '', breakdown: '', build: '', release: '', ending: '' },
    vocalInteraction: [], lyricDensity: '', lyricComplexity: '', songStructure: 'Standard Pop',
    customStructure: '', production: { character: [], recording: '', humanFeel: '', imperfection: '', era: '', saturation: '', texture: '' },
    mix: { stereoWidth: '', bass: '', mids: '', highs: '', compression: '', dynamics: '', reverb: '', delay: '', vocalPosition: '', instrumentPosition: '', ambience: '', spatialDepth: '' },
    creative: { vocalTexture: '', vocalDistance: '', instrumentDensity: '', arrangementComplexity: '', dynamicRange: '', ambientLevel: '', percussionDensity: '', harmonicComplexity: '', melodicComplexity: '', productionEra: '', recordingCharacter: '', humanFeel: '', imperfection: '' },
    negativeConstraints: ''
  };
}

export function createDefaultState() {
  return { version: 1, activeMode: 'simple', simple: createSimpleState(), advanced: createAdvancedState(), shared: { uiLanguage: 'en', onboarded: false } };
}

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function mergeShape(defaultValue, savedValue) {
  if (Array.isArray(defaultValue)) return Array.isArray(savedValue) ? clone(savedValue) : clone(defaultValue);
  if (isObject(defaultValue)) {
    const result = {};
    for (const key of Object.keys(defaultValue)) result[key] = mergeShape(defaultValue[key], savedValue?.[key]);
    return result;
  }
  return savedValue === undefined || savedValue === null && defaultValue !== null ? defaultValue : savedValue;
}
function normalizeModeState(state, defaults, mode) {
  const target = mergeShape(defaults, isObject(state) ? state : {});
  target.moods = Array.isArray(target.moods) ? [...new Set(target.moods.filter(item => typeof item === 'string'))].slice(0, 4) : [];
  target.vocalists = Array.isArray(target.vocalists) ? target.vocalists.slice(0, mode === 'simple' ? 2 : 4).filter(isObject).map((vocalist, i) => ({
    id: typeof vocalist.id === 'string' ? vocalist.id : `voice-${i + 1}`,
    gender: typeof vocalist.gender === 'string' ? vocalist.gender : '', role: typeof vocalist.role === 'string' ? vocalist.role : 'Lead', delivery: typeof vocalist.delivery === 'string' ? vocalist.delivery : '',
    voiceType: typeof vocalist.voiceType === 'string' ? vocalist.voiceType : '', register: typeof vocalist.register === 'string' ? vocalist.register : '', texture: typeof vocalist.texture === 'string' ? vocalist.texture : '',
    intensity: typeof vocalist.intensity === 'string' ? vocalist.intensity : '', distance: typeof vocalist.distance === 'string' ? vocalist.distance : '', breathiness: typeof vocalist.breathiness === 'string' ? vocalist.breathiness : '',
    roughness: typeof vocalist.roughness === 'string' ? vocalist.roughness : '', clarity: typeof vocalist.clarity === 'string' ? vocalist.clarity : '', presence: typeof vocalist.presence === 'string' ? vocalist.presence : '',
    harmony: typeof vocalist.harmony === 'string' ? vocalist.harmony : '', interaction: typeof vocalist.interaction === 'string' ? vocalist.interaction : '', adlibs: typeof vocalist.adlibs === 'string' ? vocalist.adlibs : ''
  })) : [];
  if (!LANGUAGES.includes(target.songLanguage)) target.songLanguage = 'English';
  for (const key of ['genre', 'subgenre', 'lyricsDescription', 'styleDescription']) if (typeof target[key] !== 'string') target[key] = '';
  if (mode === 'advanced') {
    if (Array.isArray(target.instruments)) target.instruments = target.instruments.map(item => typeof item === 'string' ? { name: item, role: 'Secondary' } : item).filter(item => isObject(item) && typeof item.name === 'string');
    else target.instruments = [];
    if (!Array.isArray(target.vocalInteraction)) target.vocalInteraction = [];
    if (!isObject(target.harmony)) target.harmony = defaults.harmony;
    if (!isObject(target.rhythm)) target.rhythm = defaults.rhythm;
    if (!isObject(target.arrangement)) target.arrangement = defaults.arrangement;
    if (!isObject(target.production)) target.production = defaults.production;
    if (!Array.isArray(target.production.character)) target.production.character = [];
    if (!isObject(target.mix)) target.mix = defaults.mix;
    if (!isObject(target.creative)) target.creative = defaults.creative;
  }
  return target;
}

export function migrateState(raw) {
  const defaults = createDefaultState();
  if (!isObject(raw)) return defaults;
  const migrated = {
    version: 1,
    activeMode: raw.activeMode === 'advanced' ? 'advanced' : 'simple',
    simple: normalizeModeState(raw.simple, defaults.simple, 'simple'),
    advanced: normalizeModeState(raw.advanced, defaults.advanced, 'advanced'),
    shared: mergeShape(defaults.shared, isObject(raw.shared) ? raw.shared : {})
  };
  migrated.shared.uiLanguage = migrated.shared.uiLanguage === 'fa' ? 'fa' : 'en';
  migrated.shared.onboarded = typeof raw.shared?.onboarded === 'boolean' ? raw.shared.onboarded : Boolean(raw.activeMode);
  return migrated;
}

export const isMeaningful = value => {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (isObject(value)) return Object.values(value).some(isMeaningful);
  return true;
};
