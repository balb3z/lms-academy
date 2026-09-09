export const LESSON_STATUSES = {
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  ABSENT: 'absent'
} as const;

export const ATTENDANCE_STATUSES = {
  PRESENT: 'present',
  LATE: 'late',
  ABSENT: 'absent',
  EXCUSED: 'excused',
  NOT_MARKED: 'not_marked'
} as const;

export const PERFORMANCE_RATINGS = {
  EXCELLENT: 'excellent',
  VERY_GOOD: 'very_good',
  GOOD: 'good',
  NEEDS_IMPROVEMENT: 'needs_improvement'
} as const;