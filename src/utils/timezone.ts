// Timezone utilities for the LMS
// Uses IANA timezone identifiers (e.g., 'Africa/Cairo', 'Europe/London', 'America/New_York')

// Common timezone list for selectors
export const COMMON_TIMEZONES = [
  'UTC',
  'Africa/Cairo',
  'Africa/Casablanca',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/New_York',
  'America/Phoenix',
  'America/Toronto',
  'America/Vancouver',
  'Asia/Bangkok',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Riyadh',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Melbourne',
  'Australia/Sydney',
  'Europe/Berlin',
  'Europe/Istanbul',
  'Europe/London',
  'Europe/Moscow',
  'Europe/Paris',
  'Pacific/Auckland',
  'Pacific/Honolulu',
];

export interface TimezoneOption {
  value: string;
  label: string;
}

export function getTimezoneOptions(): TimezoneOption[] {
  return COMMON_TIMEZONES.map(tz => ({
    value: tz,
    label: formatTimezoneLabel(tz),
  }));
}

function formatTimezoneLabel(tz: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    const parts = formatter.formatToParts(now);
    const tzName = parts.find(p => p.type === 'timeZoneName')?.value || tz;
    const offset = parts.find(p => p.type === 'hour')?.value || '';
    const minute = parts.find(p => p.type === 'minute')?.value || '';
    return `${tz} (UTC${offset}:${minute} ${tzName})`;
  } catch {
    return tz;
  }
}

/**
 * Convert a local time in a specific timezone to UTC ISO string.
 * @param dateStr - YYYY-MM-DD (in the target timezone)
 * @param timeStr - HH:MM (in the target timezone)
 * @param timezone - IANA timezone identifier
 * @returns ISO string in UTC
 */
export function localToUtc(dateStr: string, timeStr: string, timezone: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  
  // Create date in the target timezone
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  
  // Get the UTC equivalent by formatting in UTC and comparing
  const utcDate = new Date(date.getTime());
  const tzDate = new Date(utcDate.toLocaleString('en-US', { timeZone: timezone }));
  const offsetMs = tzDate.getTime() - utcDate.getTime();
  
  // The actual UTC time is the local time minus the offset
  const actualUtc = new Date(date.getTime() - offsetMs);
  return actualUtc.toISOString();
}

/**
 * Convert UTC ISO string to local time in a specific timezone.
 * @param utcIso - ISO string in UTC
 * @param timezone - IANA timezone identifier
 * @returns Object with date, time, and formatted strings in the target timezone
 */
export function utcToLocal(utcIso: string, timezone: string): {
  date: string;
  time: string;
  dateTime: string;
  formattedDate: string;
  formattedTime: string;
} {
  const date = new Date(utcIso);
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');
  
  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${hour}:${minute}`;
  
  return {
    date: dateStr,
    time: timeStr,
    dateTime: `${dateStr}T${timeStr}`,
    formattedDate: new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date),
    formattedTime: new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date),
  };
}

/**
 * Convert UTC ISO string to local time in a specific timezone for display.
 * Simplified version for components.
 */
export function formatUtcInTimezone(utcIso: string | null | undefined, timezone: string, options?: {
  dateStyle?: 'short' | 'medium' | 'long';
  timeStyle?: 'short' | 'medium';
}): string {
  if (!utcIso) return '';
  const date = new Date(utcIso);
  if (isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    dateStyle: options?.dateStyle || 'medium',
    timeStyle: options?.timeStyle || 'short',
  }).format(date);
}

/**
 * Format just the time portion in a specific timezone.
 */
export function formatTimeInTimezone(utcIso: string | null | undefined, timezone: string): string {
  if (!utcIso) return '';
  const date = new Date(utcIso);
  if (isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/**
 * Format just the date portion in a specific timezone.
 */
export function formatDateInTimezone(utcIso: string | null | undefined, timezone: string): string {
  if (!utcIso) return '';
  const date = new Date(utcIso);
  if (isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/**
 * Get the current user's timezone from their profile or default to UTC.
 */
export function getUserTimezone(userTimezone?: string): string {
  return userTimezone || 'UTC';
}

/**
 * Check if a timezone is valid IANA identifier.
 */
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get timezone offset string for display (e.g., "UTC+2:00").
 */
export function getTimezoneOffsetLabel(timezone: string, date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
      hour: '2-digit',
      minute: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const tzName = parts.find(p => p.type === 'timeZoneName')?.value || '';
    return tzName.replace('GMT', 'UTC');
  } catch {
    return timezone;
  }
}