import { format } from 'date-fns';

export function formatDate(date: string | Date) {
  return format(new Date(date), 'MMM dd, yyyy');
}

export function formatTime(time: string) {
  return format(new Date(`2000-01-01T${time}`), 'h:mm a');
}

export function formatDateTime(date: string, time: string) {
  return `${formatDate(date)} at ${formatTime(time)}`;
}