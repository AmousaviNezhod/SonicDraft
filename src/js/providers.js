export const AI_PROVIDERS = [
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/' },
  { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/app' },
  { id: 'claude', name: 'Claude', url: 'https://claude.ai/new' }
];

// Public compose pages do not provide a dependable official URL contract for
// pre-filling arbitrary prompts. Open a blank tab synchronously, copy, then
// navigate it so popup blocking is avoided and the prompt is safely retained.
export async function openProvider(providerId, prompt) {
  const provider = AI_PROVIDERS.find(item => item.id === providerId);
  if (!provider) throw new Error('Unknown AI provider');
  const tab = window.open('about:blank', '_blank');
  if (tab) tab.opener = null;
  let copied = false;
  try {
    await navigator.clipboard.writeText(prompt);
    copied = true;
  } catch {
    const helper = document.createElement('textarea');
    helper.value = prompt;
    helper.setAttribute('readonly', '');
    helper.style.position = 'fixed'; helper.style.opacity = '0';
    document.body.append(helper); helper.select();
    copied = document.execCommand('copy'); helper.remove();
  }
  if (tab) tab.location.href = provider.url;
  else window.open(provider.url, '_blank', 'noopener,noreferrer');
  return copied;
}
