# SonicDraft

**Craft the sound. Shape the story.** A bilingual, static music-prompt composer that helps users create a professional Master Prompt for an external AI. SonicDraft does not generate audio, call an AI API, or require an API key.

## Development and production

Node/npm are used only to run Tailwind CSS CLI.

```sh
npm install
npm run dev       # Compile/watch Tailwind CSS
npm run build     # Minify production CSS into dist/css/app.css
```

Serve `index.html` with a local static file server during development (native ES modules require HTTP in some browsers). Deploy the static site/repository to GitHub Pages, Cloudflare Pages, Netlify, Vercel static hosting, or any standard static host. There is no backend. The page references the compiled production stylesheet and never uses the Tailwind CDN.

## Architecture

- `index.html` — static semantic entry point.
- `src/input.css` — Tailwind input and custom responsive SonicDraft design system.
- `src/js/data.js` — option vocabularies, independent step definitions, and mode-scoped presets.
- `src/js/state.js` — independent mode defaults, schema migration, validation, and cloning.
- `src/js/modeManager.js` — explicit workspace transition transaction.
- `src/js/syncManager.js` — shared creative field schema, cloned reconciliation.
- `src/js/storage.js` — guarded versioned localStorage persistence under `sonicdraft:v1`.
- `src/js/promptGenerator.js` — one shared entry point with separate Simple and Advanced prompt paths.
- `src/js/providers.js` — provider destinations and copy/open handoff.
- `src/js/translations.js` — centralized English/Persian labels and select vocabulary.
- `src/js/animations.js` — reduced-motion-aware enter/exit helpers.
- `src/js/app.js` — DOM rendering, UI interactions, navigation, and accessible modal lifecycle.

Simple and Advanced have distinct state objects, step definitions, renderers, vocal limits, presets, and prompt paths. Shared fields are explicitly declared and reconciled before switching. A meaningful value in the active workspace wins a conflict; an empty active value never erases a meaningful counterpart. Values are cloned. Advanced-only music, vocal engineering, instrument, arrangement, production, and mix values remain isolated. Reconciliation is one transaction rather than a pair of watchers and is idempotent.

Both ecosystems, active mode, onboarding choice, and UI language persist independently. Corrupt/unavailable storage safely falls back to defaults. User-entered text is escaped before it is rendered.

## Provider limitations

ChatGPT, Gemini, and Claude open at their public compose pages. Arbitrary prompt prefill/submission is not a dependable, officially supported URL behavior across providers. SonicDraft copies the prompt first and then opens the selected provider so users can paste it themselves.
