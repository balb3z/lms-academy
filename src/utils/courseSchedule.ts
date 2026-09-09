// Shared course-scheduling utilities.
// Used by AddCourseModal (initial student) and AssignStudentModal (additional
// students) so the lesson-generation logic lives in exactly one place.

export const DAY_LABELS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

export const DAY_KEYS = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
];

/** Parse a YYYY-MM-DD string as a LOCAL date (avoids UTC off-by-one shifts). */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Format a Date as a local YYYY-MM-DD string. */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Add minutes to an "HH:MM" time string, returning "HH:MM". */
export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export interface GeneratedLesson {
  date: string;
  start_time: string;
  end_time: string;
}

/**
 * Walk forward from startDate, collecting dates that fall on any of the
 * preferred weekday keys, until `totalLessons` dates are produced.
 */
export function generateLessonDates(
  startDate: string,
  totalLessons: number,
  preferredDays: string[],
  preferredTime: string,
  durationMinutes: number,
): GeneratedLesson[] {
  const results: GeneratedLesson[] = [];
  const dayNums = new Set(
    preferredDays
      .map(d => DAY_KEYS.indexOf(d.toLowerCase()))
      .filter(n => n >= 0),
  );

  if (dayNums.size === 0 || totalLessons < 1) return results;

  const endTime = addMinutesToTime(preferredTime, durationMinutes);
  const current = parseLocalDate(startDate);
  let guard = 0;

  while (results.length < totalLessons && guard < 2000) {
    if (dayNums.has(current.getDay())) {
      results.push({ date: toDateString(current), start_time: preferredTime, end_time: endTime });
    }
    current.setDate(current.getDate() + 1);
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
}

/**
 * Build ready-to-insert `lessons` rows for one student in a course.
 * Each row carries course_id + student_id + teacher_id so it appears on the
 * management course page and on the student's and teacher's dashboards.
 */
export function buildCourseLessonRows(params: BuildLessonRowsParams): Record<string, any>[] {
  const dates = generateLessonDates(
    params.startDate,
    params.totalLessons,
    params.preferredDays,
    params.preferredTime,
    params.durationMinutes,
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
    duration_minutes: params.durationMinutes,
    meeting_platform: 'zoom',
    meeting_url: params.meetingUrl ?? null,
    teacher_rate: params.teacherRate ?? null,
    status: 'scheduled',
    is_recurring: false,
    created_by: params.createdBy ?? null,
  }));
}
