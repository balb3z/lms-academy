export type BadgeVariant = 'success' | 'info' | 'warning' | 'destructive' | 'secondary' | 'default';

export const RATING_LABEL: Record<string, string> = {
  excellent: 'Excellent',
  very_good: 'Very Good',
  good: 'Good',
  needs_improvement: 'Needs Improvement',
};

export const RATING_VARIANT: Record<string, BadgeVariant> = {
  excellent: 'success',
  very_good: 'success',
  good: 'info',
  needs_improvement: 'warning',
};
