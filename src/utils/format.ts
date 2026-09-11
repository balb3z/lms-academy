import { format } from 'date-fns';

export function formatDate(date: string | Date) {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return format(d, 'MMM dd, yyyy');
  } catch {
    return '';
  }
}

export function formatTime(time: string) {
  try {
    if (!time) return '';
    const d = new Date(`2000-01-01T${time}`);
    if (isNaN(d.getTime())) return '';
    return format(d, 'h:mm a');
  } catch {
    return '';
  }
}

export function formatDateTime(date: string, time: string) {
  return `${formatDate(date)} at ${formatTime(time)}`;
}