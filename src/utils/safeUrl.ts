import { toast } from 'react-toastify';

/** Returns the normalized href only if the URL parses and uses https:. */
export function safeHttpsUrl(u?: string | null): string | null {
  if (!u) return null;
  try {
    const url = new URL(u.trim());
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function openExternal(u?: string | null): void {
  const href = safeHttpsUrl(u);
  if (!href) {
    toast.error('Invalid meeting link');
    return;
  }
  window.open(href, '_blank', 'noopener,noreferrer');
}
