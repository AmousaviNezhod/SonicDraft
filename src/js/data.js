export const GENRES = [
  'Indie Folk', 'Bedroom Pop', 'Dark Pop', 'R&B', 'Hip-Hop', 'Cinematic', 'Rock', 'Acoustic', 'Electronic', 'Ambient', 'Persian Pop', 'Persian Folk', 'Dream Pop', 'Modern R&B', 'Synthwave', 'Lo-fi Rap', 'Singer-Songwriter'
];
export const MOODS = ['Melancholic', 'Hopeful', 'Romantic', 'Nostalgic', 'Dark', 'Dreamy', 'Energetic', 'Peaceful', 'Lonely', 'Euphoric', 'Intimate', 'Emotional'];
export const LANGUAGES = ['English', 'Persian', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Turkish', 'Arabic', 'Russian', 'Japanese', 'Korean', 'Chinese', 'Hindi', 'Urdu', 'Dutch', 'Swedish', 'Polish', 'Greek', 'Indonesian'];
export const VOCAL_DELIVERY = ['Soft', 'Intimate', 'Emotional', 'Dry', 'Airy', 'Powerful', 'Breathy', 'Warm', 'Raw', 'Gentle'];
export const VOCAL_ROLES = ['Lead', 'Co-lead', 'Harmony', 'Backing'];
export const INSTRUMENT_GROUPS = {
  Strings: ['Acoustic Guitar', 'Electric Guitar', 'Bass', 'Violin', 'Viola', 'Cello', 'Double Bass'],
  Keys: ['Piano', 'Electric Piano', 'Rhodes', 'Organ', 'Synth', 'Mellotron'],
  Drums: ['Acoustic Drums', 'Electronic Drums', 'Percussion', 'Claps', 'Shakers', 'Toms'],
  Orchestral: ['Strings', 'Brass', 'Woodwinds', 'Choir', 'Cinematic Percussion'],
  Texture: ['Pads', 'Drones', 'Ambient Texture', 'Field Recordings', 'Noise', 'Sound Design']
};
export const INSTRUMENT_ROLES = ['Primary', 'Secondary', 'Accent', 'Texture'];

export const SIMPLE_STEPS = [
  { id: 'style', label: 'Style', short: '01' }, { id: 'mood', label: 'Mood', short: '02' },
  { id: 'lyrics', label: 'Lyrics', short: '03' }, { id: 'vocals', label: 'Vocals', short: '04' },
  { id: 'review', label: 'Review', short: '05' }
];
export const ADVANCED_STEPS = [
  { id: 'style', label: 'Style', short: '01' }, { id: 'mood', label: 'Mood', short: '02' },
  { id: 'music', label: 'Music', short: '03' }, { id: 'instruments', label: 'Instruments', short: '04' },
  { id: 'vocals', label: 'Vocals', short: '05' }, { id: 'lyrics', label: 'Lyrics', short: '06' },
  { id: 'structure', label: 'Structure', short: '07' }, { id: 'production', label: 'Production', short: '08' },
  { id: 'review', label: 'Review', short: '09' }
];
export const UI_STEP_LABELS = {
  simple: [...SIMPLE_STEPS], advanced: [...ADVANCED_STEPS]
};

const cinematicProduction = { character: ['Cinematic', 'Organic'], recording: 'Studio', humanFeel: 'Natural', imperfection: 'Subtle', era: 'Contemporary', saturation: 'Gentle analog warmth', texture: 'Expansive and intimate' };
export const PRESETS = [
  { name: 'Sad Indie', icon: '✳', mode: 'simple', genre: 'Indie Folk', moods: ['Melancholic', 'Intimate'], styleDescription: 'Warm acoustic guitar, honest storytelling, a gentle cinematic lift.' },
  { name: 'Bedroom Pop', icon: '◌', mode: 'simple', genre: 'Bedroom Pop', moods: ['Dreamy', 'Nostalgic'], styleDescription: 'Hazy, close-mic vocals and soft, nostalgic textures.' },
  { name: 'Persian Ballad', icon: '♪', mode: 'simple', genre: 'Persian Pop', moods: ['Emotional', 'Romantic'], songLanguage: 'Persian', styleDescription: 'A heartfelt modern Persian ballad with graceful melodic phrasing.' },
  { name: 'Indie Folk', icon: '⌂', mode: 'simple', genre: 'Indie Folk', moods: ['Hopeful', 'Nostalgic'], styleDescription: 'Fingerpicked acoustic guitar, intimate vocal, organic room warmth.' },
  { name: 'Cinematic Love Song', icon: '⌁', mode: 'simple', genre: 'Cinematic', moods: ['Romantic', 'Emotional'], styleDescription: 'An intimate love story that gradually opens into a heartfelt, cinematic refrain.' },
  { name: 'Cinematic Ballad', icon: '⌁', mode: 'advanced', genre: 'Cinematic', moods: ['Emotional', 'Hopeful'], bpm: 76, key: 'D Minor', timeSignature: '6/8', modeName: 'Minor', instruments: [{ name: 'Piano', role: 'Primary' }, { name: 'Strings', role: 'Secondary' }, { name: 'Cinematic Percussion', role: 'Accent' }], production: cloneData(cinematicProduction), arrangement: { density: 'Gradual build', complexity: 'Moderate', intro: 'Piano-led, intimate', verse: 'Sparse and close', chorus: 'Strings open into a wide emotional lift', bridge: 'Pull back, then rebuild', breakdown: 'Brief piano-led breath', build: 'Patient crescendo', release: 'Warm, sustained release', ending: 'Resolve softly' } },
  { name: 'Dark Pop', icon: '◐', mode: 'advanced', genre: 'Dark Pop', moods: ['Dark', 'Dreamy'], bpm: 104, key: 'F Minor', timeSignature: '4/4', modeName: 'Minor', instruments: [{ name: 'Synth', role: 'Primary' }, { name: 'Electronic Drums', role: 'Secondary' }, { name: 'Pads', role: 'Texture' }], production: { character: ['Modern', 'Polished'], recording: 'Studio', era: 'Contemporary', humanFeel: 'Balanced', imperfection: 'Subtle', saturation: 'Soft tape color', texture: 'Smoky and nocturnal' } },
  { name: 'Emotional Acoustic', icon: '⌂', mode: 'advanced', genre: 'Acoustic', moods: ['Intimate', 'Melancholic'], bpm: 82, key: 'G Major', timeSignature: '4/4', modeName: 'Major', instruments: [{ name: 'Acoustic Guitar', role: 'Primary' }, { name: 'Cello', role: 'Accent' }], production: { character: ['Organic', 'Live'], recording: 'Roomy studio', era: 'Contemporary', humanFeel: 'Loose and human', imperfection: 'Audible', saturation: 'Natural', texture: 'Close and tactile' } },
  { name: 'Dream Pop', icon: '☼', mode: 'advanced', genre: 'Dream Pop', moods: ['Dreamy', 'Hopeful'], bpm: 96, key: 'A Major', timeSignature: '4/4', modeName: 'Lydian', instruments: [{ name: 'Electric Guitar', role: 'Primary' }, { name: 'Pads', role: 'Texture' }, { name: 'Electronic Drums', role: 'Secondary' }], production: { character: ['Modern', 'Cinematic'], recording: 'Studio', era: 'Contemporary', humanFeel: 'Balanced', imperfection: 'Subtle', saturation: 'Soft', texture: 'Airy and shimmering' } },
  { name: 'Lo-fi Rap', icon: '▧', mode: 'advanced', genre: 'Lo-fi Rap', moods: ['Nostalgic', 'Intimate'], bpm: 84, key: 'C Minor', timeSignature: '4/4', modeName: 'Minor', instruments: [{ name: 'Piano', role: 'Primary' }, { name: 'Electronic Drums', role: 'Secondary' }, { name: 'Noise', role: 'Texture' }], production: { character: ['Lo-fi', 'Bedroom'], recording: 'Bedroom', era: 'Contemporary', humanFeel: 'Loose and human', imperfection: 'Audible', saturation: 'Tape warmth', texture: 'Dusty and close' } },
  { name: 'Modern R&B', icon: '◒', mode: 'advanced', genre: 'Modern R&B', moods: ['Intimate', 'Romantic'], bpm: 92, key: 'A Minor', timeSignature: '4/4', modeName: 'Minor', instruments: [{ name: 'Rhodes', role: 'Primary' }, { name: 'Bass', role: 'Secondary' }, { name: 'Electronic Drums', role: 'Accent' }], production: { character: ['Modern', 'Polished'], recording: 'Studio', era: 'Contemporary', humanFeel: 'Natural', imperfection: 'Subtle', saturation: 'Warm', texture: 'Silky and close' } },
  { name: 'Melancholic Piano', icon: '♩', mode: 'advanced', genre: 'Cinematic', moods: ['Melancholic', 'Lonely'], bpm: 68, key: 'C Minor', timeSignature: '3/4', modeName: 'Minor', instruments: [{ name: 'Piano', role: 'Primary' }, { name: 'Cello', role: 'Accent' }, { name: 'Ambient Texture', role: 'Texture' }], production: cloneData(cinematicProduction) },
  { name: 'Ambient Pop', icon: '☼', mode: 'advanced', genre: 'Ambient', moods: ['Dreamy', 'Peaceful'], bpm: 88, key: 'F Major', timeSignature: '4/4', modeName: 'Lydian', instruments: [{ name: 'Pads', role: 'Primary' }, { name: 'Piano', role: 'Accent' }, { name: 'Ambient Texture', role: 'Texture' }], production: { character: ['Ambient', 'Modern'], recording: 'Studio', humanFeel: 'Balanced', imperfection: 'Subtle', era: 'Contemporary', saturation: 'Soft', texture: 'Airy and immersive' } }
];
function cloneData(value) { return JSON.parse(JSON.stringify(value)); }
