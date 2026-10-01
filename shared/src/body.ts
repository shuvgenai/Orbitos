export type BodyPart = { mimeType: string; text: string };

// §22 N-15 is unanswered: the old 32K limit was Jev's context size and Jev is deferred.
// This is the only place the limit exists, so answering N-15 is a one-line change.
export const MAX_MODEL_BODY_CHARS = 16_000;

const QUOTE_MARKERS = [/^On .+ wrote:$/m, /^-{2,}\s*Original Message\s*-{2,}$/im, /^_{10,}$/m];

export function pickTextPart(parts: readonly BodyPart[]): string {
  const plain = parts.find((p) => p.mimeType === 'text/plain');
  if (plain) return plain.text;
  const html = parts.find((p) => p.mimeType === 'text/html');
  if (!html) return '';
  return html.text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

export function stripQuotedAndSignature(text: string): string {
  let out = text;
  for (const marker of QUOTE_MARKERS) {
    const hit = out.match(marker);
    if (hit?.index !== undefined) out = out.slice(0, hit.index);
  }
  out = out.replace(/\n-- \n[\s\S]*$/, '');
  out = out
    .split('\n')
    .filter((line) => !line.startsWith('>'))
    .join('\n');
  return out.trim();
}

export function cleanBody(parts: readonly BodyPart[]): string {
  return stripQuotedAndSignature(pickTextPart(parts)).slice(0, MAX_MODEL_BODY_CHARS);
}
