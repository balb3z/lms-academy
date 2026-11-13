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

  // Walk plain calendar dates (course-local); timezone only matters when stamping UTC.
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  if (isNaN(startYear) || isNaN(startMonth) || isNaN(startDay)) return results;

  let y = startYear;
  let m = startMonth - 1;
  let d = startDay;

  let guard = 0;
  const maxIterations = 2000;

  while (results.length < totalLessons && guard < maxIterations) {
    const cal = new Date(Date.UTC(y, m, d));
    const dayOfWeek = cal.getUTCDay();

    if (dayNums.has(dayOfWeek)) {
      const dateStr = cal.toISOString().slice(0, 10);

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
    
    const next = new Date(Date.UTC(y, m, d + 1));
    y = next.getUTCFullYear();
    m = next.getUTCMonth();
    d = next.getUTCDate();
    guard++;
  }

  return results;
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
export function buildCourseLessonRows(params: BuildLessonRowsParams): Record<string, unknown>[] {
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