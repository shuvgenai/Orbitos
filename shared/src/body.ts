export type BodyPart = { mimeType: string; text?: string };

// §22 N-15 is unanswered: the old 32K limit was Jev's context size and Jev is deferred.
// This is the only place the limit exists, so answering N-15 is a one-line change.
export const MAX_MODEL_BODY_CHARS = 16_000;

// Pre-cap before any regex touches the string to avoid hangs on attacker input
const INPUT_CAP = MAX_MODEL_BODY_CHARS * 4;

const QUOTE_MARKERS = [/^On .+ wrote:$/m, /^-{2,}\s*Original Message\s*-{2,}$/im, /^_{10,}$/m];

function normalizeMimeType(mimeType: string | undefined): string {
  // Handle Finding 6: normalize MIME type, handle charset and case
  const normalized = (mimeType ?? '').split(';')[0];
  return (normalized ?? '').trim().toLowerCase();
}

function capText(text: string | undefined): string {
  // Ensure text is a string and cap it early (Finding 1, Finding 2)
  if (typeof text !== 'string') return '';
  return text.length > INPUT_CAP ? text.slice(0, INPUT_CAP) : text;
}

export function pickTextPart(parts: readonly BodyPart[]): string {
  // Look for text/plain part with non-empty text (Finding 1: handle undefined and empty)
  const plain = parts.find((p) => {
    const mimeType = normalizeMimeType(p.mimeType);
    return mimeType === 'text/plain' && typeof p.text === 'string' && p.text.length > 0;
  });
  if (plain) return capText(plain.text);

  // Fall back to HTML part (Finding 1: ensure text is a string)
  const html = parts.find((p) => {
    const mimeType = normalizeMimeType(p.mimeType);
    return mimeType === 'text/html' && typeof p.text === 'string';
  });
  if (!html) return '';

  const htmlText = capText(html.text);
  if (!htmlText) return '';

  // Remove script, style, head blocks first (Finding 3: prevent injection)
  let cleaned = htmlText
    .replace(/<(script|style|head)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, ''); // Remove HTML comments

  // Convert line breaks and block-level tags to newlines (Finding 2: safe regex)
  cleaned = cleaned
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^<>]*>/g, ''); // Safe: doesn't hang on unmatched < or >

  // Decode entities - &amp; must be last (Finding 4: decode order matters)
  cleaned = cleaned
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&'); // Last!

  return cleaned.trim();
}

export function stripQuotedAndSignature(text: string): string {
  // Normalize line endings first (Finding 5: handle CRLF)
  let out = text.replace(/\r\n/g, '\n');

  // Try to detect and cut at quote markers, but only if corroborated by > lines (Finding 5)
  for (const marker of QUOTE_MARKERS) {
    const hit = out.match(marker);
    if (hit?.index !== undefined) {
      const afterMarker = out.slice(hit.index);
      // Corroborate: check if there are > lines after this marker
      const hasQuotedLines = afterMarker
        .split('\n')
        .slice(1)
        .some((line) => line.startsWith('>'));
      if (hasQuotedLines) {
        // Corroborated: cut here
        out = out.slice(0, hit.index);
        break;
      }
      // Not corroborated: don't cut, this is the lead's own prose
    }
  }

  // Strip signature: \n-- (space?) followed by \n or end of string (Finding 5)
  out = out.replace(/\n-- ?(\n|$)[\s\S]*$/, '');

  // Strip only trailing contiguous > lines (Finding 5: not interior ones)
  const lines = out.split('\n');
  while (lines.length > 0) {
    const lastLine = lines[lines.length - 1];
    if (lastLine && lastLine.startsWith('>')) {
      lines.pop();
    } else {
      break;
    }
  }
  out = lines.join('\n');

  return out.trim();
}

export function cleanBody(parts: readonly BodyPart[]): string {
  return stripQuotedAndSignature(pickTextPart(parts)).slice(0, MAX_MODEL_BODY_CHARS).trim(); // Minor: trim after slice
}
