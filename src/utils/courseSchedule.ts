// Shared course-scheduling utilities with timezone support.
// Used by AddCourseModal (initial student) and AssignStudentModal (additional
// students) so the lesson-generation logic lives in exactly one place.

import { localToUtc } from './timezone';

export const DAY_LABELS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

export const DAY_KEYS = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
];

/** Add minutes to an "HH:MM" time string, returning "HH:MM". */
export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export interface GeneratedLesson {
  date: string;           // YYYY-MM-DD in the course timezone
  start_time: string;     // HH:MM in the course timezone
  end_time: string;       // HH:MM in the course timezone
  start_time_utc: string; // ISO string in UTC
  end_time_utc: string;   // ISO string in UTC
  timezone: string;       // IANA timezone identifier
}

/**
 * Generate lesson dates by walking forward in the course timezone.
 * Returns lessons with local times (in course timezone) and UTC times.
 */
export function generateLessonDates(
  startDate: string,          // YYYY-MM-DD in course timezone
  totalLessons: number,
  preferredDays: string[],
  preferredTime: string,      // HH:MM in course timezone
  durationMinutes: number,
  courseTimezone: string
): GeneratedLesson[] {
  const results: GeneratedLesson[] = [];
  const dayNums = new Set(
    preferredDays
      .map(d => DAY_KEYS.indexOf(d.toLowerCase()))
      .filter(n => n >= 0),
  );

  if (dayNums.size === 0 || totalLessons < 1) return results;

  const endTimeLocal = addMinutesToTime(preferredTime, durationMinutes);
  
  // Parse start date components
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  
  // Create a starting point: midnight in the course timezone on startDate
  // We create a date at the target time in the target timezone, then convert to UTC
  let currentLocal = new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0));
  
  let guard = 0;
  const maxIterations = 2000;

  while (results.length < totalLessons && guard < maxIterations) {
    // Get the day of week in the course timezone for currentLocal
    const dayOfWeek = getDayOfWeekInTimezone(currentLocal, courseTimezone);
    
    if (dayNums.has(dayOfWeek)) {
      // Format the date in the course timezone
      const dateStr = formatDateInTimezone(currentLocal, courseTimezone);
      
      // Convert local times to UTC
      const startUtc = localToUtc(dateStr, preferredTime, courseTimezone);
      const endTimeLocal = addMinutesToTime(preferredTime, durationMinutes);
      const endUtc = localToUtc(dateStr, endTimeLocal, courseTimezone);
      
      results.push({ 
        date: dateStr, 
        start_time: preferredTime, 
        end_time: addMinutesToTime(preferredTime, durationMinutes),
        start_time_utc: startUtc,
        end_time_utc: endUtc,
        timezone: courseTimezone,
      });
    }
    
    // Increment by one day in the course timezone
    // Add 24 hours in the target timezone (handles DST transitions correctly)
    currentLocal = addDaysInTimezone(currentLocal, 1, courseTimezone);
    guard++;
  }

  return results;
}

/**
 * Get the day of week (0=Sunday, 6=Saturday) for a UTC date in a specific timezone.
 */
function getDayOfWeekInTimezone(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'numeric',
  });
  // Intl returns 1=Monday...7=Sunday, convert to 0=Sunday...6=Saturday
  return (parseInt(formatter.format(new Date(date.getTime()))) % 7);
}

/**
 * Add days to a date in a specific timezone (handles DST correctly).
 */
function addDaysInTimezone(date: Date, days: number, timezone: string): Date {
  // Get the current time in the target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(new Date(date.getTime()));
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  const year = parseInt(get('year'));
  const month = parseInt(get('month')) - 1; // 0-indexed
  const day = parseInt(get('day'));
  const hour = parseInt(get('hour'));
  const minute = parseInt(get('minute'));
  const second = parseInt(get('second'));
  
  // Create a new date in the target timezone at the same local time + days
  const newLocal = new Date(year, month, day + days, hour, minute, second);
  
  // Convert back to UTC using the timezone
  const newDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day + days).padStart(2, '0')}`;
  const newTimeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  
  // Convert the new local date/time back to UTC
  const utcIso = localToUtc(newDateStr, newTimeStr, timezone);
  return new Date(utcIso);
}

/**
 * Format a UTC Date as YYYY-MM-DD in a specific timezone.
 */
function formatDateInTimezone(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export interface BuildLessonRowsParams {
  courseId: string;
  courseName: string;
  studentId: string;
  teacherId: string;
  totalLessons: number;
  preferredDays: string[];
  preferredTime: string;
  durationMinutes: number;
  startDate: string;
  createdBy?: string | null;
  startNumber?: number;
  /** Teacher's Zoom link, stamped onto every generated lesson's meeting_url. */
  meetingUrl?: string | null;
  /** Amount the teacher earns per lesson, stamped onto each lesson. */
  teacherRate?: number | null;
  /** Course timezone (student's timezone for this course). */
  courseTimezone: string;
}

/**
 * Build ready-to-insert `lessons` rows for one student in a course.
 * Each row carries course_id + student_id + teacher_id so it appears on the
 * management course page and on the student's and teacher's dashboards.
 * 
 * Lessons are stored with both local times (in course timezone) and UTC times.
 */
export function buildCourseLessonRows(params: BuildLessonRowsParams): Record<string, any>[] {
  const dates = generateLessonDates(
    params.startDate,
    params.totalLessons,
    params.preferredDays,
    params.preferredTime,
    params.durationMinutes,
    params.courseTimezone,
  );

  const startNumber = params.startNumber ?? 1;

  return dates.map((d, i) => ({
    course_id: params.courseId,
    lesson_number: startNumber + i,
    student_id: params.studentId,
    teacher_id: params.teacherId,
    title: `${params.courseName} — Lesson ${startNumber + i}`,
    scheduled_date: d.date,
    start_time: d.start_time,
    end_time: d.end_time,
    start_time_utc: d.start_time_utc,
    end_time_utc: d.end_time_utc,
    timezone: d.timezone,
    duration_minutes: params.durationMinutes,
    meeting_platform: 'zoom',
    meeting_url: params.meetingUrl ?? null,
    teacher_rate: params.teacherRate ?? null,
    status: 'scheduled',
    is_recurring: false,
    created_by: params.createdBy ?? null,
  }));
}