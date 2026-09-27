const clean = value => typeof value === 'string' ? value.trim() : '';
const list = value => Array.isArray(value) ? value.filter(Boolean) : [];
const add = (lines, label, value) => {
  if (Array.isArray(value)) value = value.filter(Boolean).join(', ');
  if (value !== undefined && value !== null && value !== '') lines.push(`${label}: ${value}`);
};
function vocalDescription(vocalists, advanced = false) {
  return list(vocalists).map((voice, index) => {
    const parts = [];
    if (voice.gender) parts.push(voice.gender.toLowerCase());
    if (voice.role) parts.push(voice.role.toLowerCase());
    if (advanced) {
      for (const key of ['voiceType', 'register', 'texture', 'delivery', 'intensity', 'distance', 'breathiness', 'roughness', 'clarity', 'presence', 'harmony', 'interaction', 'adlibs']) {
        if (voice[key]) parts.push(`${key === 'voiceType' ? 'voice type' : key}: ${voice[key]}`);
      }
    } else if (voice.delivery) parts.push(`${voice.delivery.toLowerCase()} delivery`);
    return `Vocalist ${index + 1}: ${parts.join(', ')}`;
  });
}

export function generateSimplePrompt(state) {
  const brief = [];
  add(brief, 'Genre', state.genre);
  add(brief, 'Subgenre / style', state.subgenre);
  add(brief, 'Mood', state.moods);
  add(brief, 'Emotional direction', state.emotionalDirection);
  add(brief, 'Song language', state.songLanguage);
  add(brief, 'Song concept and lyrical direction', clean(state.lyricsDescription));
  add(brief, 'Style description', clean(state.styleDescription));
  for (const voice of vocalDescription(state.vocalists)) brief.push(voice);
  const context = brief.length ? brief.join('\n') : 'No specific creative constraints were provided; make thoughtful, coherent professional choices.';
  return `${ROLE}\n\nCREATIVE BRIEF (user-selected direction):\n${context}\n\nCreate natural, singable, emotionally coherent lyrics with an appropriate structure. Respect the chosen genre, mood, language, and vocal direction. Avoid generic AI clichés, filler, unnatural repetition, and unrequested genre fusion. Where musical details are unspecified, make sensible professional choices; do not imply the user explicitly requested those choices. Keep lyrics concise, memorable, and believable.\n\n${OUTPUT_CONTRACT}`;
}

export function generateAdvancedPrompt(state) {
  const brief = [];
  add(brief, 'Genre', state.genre);
  add(brief, 'Subgenre / style', state.subgenre);
  add(brief, 'Mood', state.moods);
  add(brief, 'Emotional arc', state.emotionalArc);
  add(brief, 'Energy', state.energy);
  add(brief, 'Song language', state.songLanguage);
  add(brief, 'Tempo', state.bpm ? `${state.bpm} BPM` : '');
  add(brief, 'Time signature', state.timeSignature === 'Custom' ? state.customTimeSignature : state.timeSignature);
  add(brief, 'Key', state.key);
  add(brief, 'Mode', state.modeName === 'Custom' ? state.customMode : state.modeName);
  const h = state.harmony || {};
  add(brief, 'Harmonic character', h.character); add(brief, 'Chord complexity', h.complexity);
  add(brief, 'Harmonic tension', h.tension); add(brief, 'Resolution behavior', h.resolution);
  const r = state.rhythm || {};
  add(brief, 'Groove', r.groove); add(brief, 'Swing', r.swing); add(brief, 'Syncopation', r.syncopation);
  add(brief, 'Rhythmic density', r.density); add(brief, 'Percussion density', r.percussionDensity);
  if (list(state.instruments).length) add(brief, 'Instrument roles', list(state.instruments).map(i => `${i.name} (${i.role})`));
  const a = state.arrangement || {};
  for (const [key, label] of Object.entries({ density: 'Arrangement density', complexity: 'Arrangement complexity', intro: 'Intro', verse: 'Verse development', chorus: 'Chorus expansion', bridge: 'Bridge', breakdown: 'Breakdown', build: 'Dynamic build', release: 'Dynamic release', ending: 'Final section' })) add(brief, label, a[key]);
  add(brief, 'Vocal interaction', state.vocalInteraction);
  for (const voice of vocalDescription(state.vocalists, true)) brief.push(voice);
  add(brief, 'Lyric density', state.lyricDensity); add(brief, 'Lyric complexity', state.lyricComplexity);
  add(brief, 'Song structure', state.songStructure === 'Custom' ? state.customStructure : state.songStructure);
  const p = state.production || {};
  add(brief, 'Production character', p.character); add(brief, 'Recording character', p.recording);
  add(brief, 'Production era', p.era || state.era); add(brief, 'Human feel', p.humanFeel); add(brief, 'Imperfection level', p.imperfection);
  add(brief, 'Saturation', p.saturation); add(brief, 'Production texture', p.texture);
  const m = state.mix || {};
  for (const [key, label] of Object.entries({ stereoWidth: 'Stereo width', bass: 'Bass level', mids: 'Midrange character', highs: 'High-frequency character', compression: 'Compression', dynamics: 'Dynamic range', reverb: 'Reverb', delay: 'Delay', vocalPosition: 'Vocal position', instrumentPosition: 'Instrument positioning', ambience: 'Ambient level', spatialDepth: 'Spatial depth' })) add(brief, label, m[key]);
  const c = state.creative || {};
  for (const [key, label] of Object.entries({ vocalTexture: 'Vocal texture', vocalDistance: 'Vocal distance', instrumentDensity: 'Instrument density', arrangementComplexity: 'Arrangement complexity', dynamicRange: 'Dynamic range', ambientLevel: 'Ambient level', percussionDensity: 'Percussion density', harmonicComplexity: 'Harmonic complexity', melodicComplexity: 'Melodic complexity', productionEra: 'Production era', recordingCharacter: 'Recording character', humanFeel: 'Human feel', imperfection: 'Imperfection level' })) add(brief, label, c[key]);
  add(brief, 'Song concept and lyrical direction', clean(state.lyricsDescription));
  add(brief, 'Style description', clean(state.styleDescription));
  add(brief, 'Production era', state.creative?.productionEra);
  add(brief, 'Recording character', state.creative?.recordingCharacter);
  add(brief, 'Human feel', state.creative?.humanFeel);
  add(brief, 'Imperfection level', state.creative?.imperfection);
  const negatives = clean(state.negativeConstraints);
  const constraints = negatives ? `\n\nADDITIONAL AVOIDANCE CONSTRAINTS (user-selected):\n${negatives}` : '';
  return `${ROLE}\n\nCREATIVE BRIEF AND EXPLICIT SPECIFICATIONS:\n${brief.length ? brief.join('\n') : 'No specifications were provided; make coherent professional choices.'}\n\nTreat every value above as an explicit constraint. Preserve numeric and musical values exactly; do not replace them with generic alternatives. For unspecified fields, make tasteful choices that support a coherent song. Write natural, singable lyrics and avoid generic AI clichés, filler, unnatural repetition, and contradictory production choices.${constraints}\n\n${OUTPUT_CONTRACT}`;
}

export function generateMasterPrompt(mode, state) {
  return mode === 'advanced' ? generateAdvancedPrompt(state.advanced || state) : generateSimplePrompt(state.simple || state);
}
export function buildStyleDescriptors(mode, state) {
  const s = mode === 'advanced' ? state.advanced || state : state.simple || state;
  return [s.genre, s.subgenre, ...(s.moods || []), mode === 'advanced' ? s.era : '', mode === 'advanced' && s.bpm ? `${s.bpm} BPM` : '', ...(s.instruments || []).map(item => item.name), ...(s.vocalists || []).map(v => [v.gender, v.delivery, 'vocal'].filter(Boolean).join(' ')), mode === 'advanced' ? (s.production?.character || []).join(' ') : '', s.styleDescription].filter(Boolean).join(', ');
}
const ROLE = 'You are an expert songwriter, lyricist, composer, arranger, vocal director, and music producer. Create a professional song based on the creative brief and musical specifications below. Your output will be consumed directly by the user, so follow the output contract exactly.';
const OUTPUT_CONTRACT = `OUTPUT CONTRACT:\n\nReturn exactly two separate Markdown code blocks and nothing else.\n\nThe first code block must contain lyrics only.\nThe second code block must contain style descriptors only.\n\nDo not write any explanation before the first code block.\nDo not write any explanation between the two code blocks.\nDo not write any explanation after the second code block.\n\nWrite the lyrics in the selected song language.\nAll structural section tags must be written in English (for example [Intro], [Verse 1], [Pre-Chorus], [Chorus], [Bridge], [Final Chorus], [Outro]).\nWrite all style descriptors in English.\nThe style descriptor block must be one single line using comma-separated descriptors only.\nDo not use bullets, quotations, headings, explanations, or additional prose in the style block.`;
