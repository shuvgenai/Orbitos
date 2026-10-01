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
  // Look for text/plain part with non-empty, non-whitespace text (Finding 1, Fix Round 2: handle undefined and empty)
  const plain = parts.find((p) => {
    const mimeType = normalizeMimeType(p.mimeType);
    return (
      mimeType === 'text/plain' &&
      typeof p.text === 'string' &&
      p.text.trim().length > 0
    );
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

  // Remove script, style, head blocks first (Finding 3, Fix Round 2: prevent injection, make terminators optional to prevent superlinear behavior)
  let cleaned = htmlText
    .replace(/<(script|style|head)\b[\s\S]*?(?:<\/\1>|$)/gi, '')
    .replace(/<!--[\s\S]*?(?:-->|$)/g, ''); // Remove HTML comments, terminal optional

  // Convert line breaks and block-level tags to newlines (Finding 2: safe regex)
  cleaned = cleaned
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^<>]*>/g, ''); // Safe: doesn't hang on unmatched < or >

  // Decode all entities in one pass (Finding 4, Fix Round 2: single-pass decode prevents double-decoding)
  cleaned = cleaned.replace(/&(#\d+|#x[0-9a-f]+|quot|nbsp|lt|gt|amp);/gi, (match, entity) => {
    if (entity === 'quot') return '"';
    if (entity === 'nbsp') return ' ';
    if (entity === 'lt') return '<';
    if (entity === 'gt') return '>';
    if (entity === 'amp') return '&';
    if (entity.startsWith('#x')) {
      const codePoint = parseInt(entity.slice(2), 16);
      if (codePoint >= 0 && codePoint <= 0x10ffff) {
        return String.fromCodePoint(codePoint);
      }
      return match; // Out of range, leave as-is
    }
    if (entity.startsWith('#')) {
      const codePoint = parseInt(entity.slice(1), 10);
      if (codePoint >= 0 && codePoint <= 0x10ffff) {
        return String.fromCodePoint(codePoint);
      }
      return match; // Out of range, leave as-is
    }
    return match; // Unknown entity, leave as-is
  });

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

  // Strip only trailing contiguous > lines (Finding 5, Fix Round 2: not interior ones, skip blank lines)
  const lines = out.split('\n');
  while (lines.length > 0) {
    const lastLine = lines[lines.length - 1];
    if (lastLine === undefined || lastLine.startsWith('>') || lastLine.trim() === '') {
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
