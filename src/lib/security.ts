const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizePlainText(value: string, maxLength = 4000): string {
  return value
    .normalize('NFKC')
    .replace(CONTROL_CHARACTERS, '')
    .slice(0, maxLength);
}

export function sanitizeOptionalText(
  value: string | null | undefined,
  maxLength = 4000,
): string | null {
  if (value == null) return null;
  return sanitizePlainText(value, maxLength);
}

function isHostOrSubdomain(hostname: string, allowedHost: string): boolean {
  return hostname === allowedHost || hostname.endsWith(`.${allowedHost}`);
}

export function safeMeetingUrl(value?: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value.trim());
    const allowedHosts = ['zoom.us', 'meet.google.com', 'teams.microsoft.com'];
    if (
      url.protocol !== 'https:'
      || !allowedHosts.some((host) => isHostOrSubdomain(url.hostname, host))
    ) {
      return null;
    }
    url.username = '';
    url.password = '';
    return url.toString();
  } catch {
    return null;
  }
}

export function safeWhatsAppUrl(value?: string | null): string | null {
  let digits = (value || '').replace(/\D/g, '');
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  if (digits.length < 10 || digits.length > 11) return null;
  return `https://wa.me/55${digits}`;
}
