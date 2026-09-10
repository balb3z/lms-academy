-- ─────────────────────────────────────────────────────────────────────────────
-- TIMEZONE SUPPORT
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Teacher's default timezone (stored on teacher profile)
ALTER TABLE public.teachers
    ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';

-- 2. Course timezone (student's timezone for this course)
ALTER TABLE public.courses
    ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';

-- 3. Lessons: store times in UTC with timezone reference
--    - scheduled_date: DATE (the date in the course's timezone)
--    - start_time_utc / end_time_utc: TIMESTAMPTZ (the actual moment in UTC)
--    - timezone: the IANA timezone this lesson belongs to (course timezone)
--    - Keep start_time/end_time for backward compatibility (local time strings in course tz)
ALTER TABLE public.lessons
    ADD COLUMN IF NOT EXISTS start_time_utc TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS end_time_utc TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_lessons_start_time_utc ON public.lessons(start_time_utc);
CREATE INDEX IF NOT EXISTS idx_lessons_timezone ON public.lessons(timezone);

-- 5. Update existing lessons to populate UTC columns from existing data
-- This assumes existing data is stored as local time in UTC (which is wrong but common)
-- We'll populate from scheduled_date + start_time assuming they were in UTC
-- This is a best-effort migration; manual review may be needed
UPDATE public.lessons
SET start_time_utc = (scheduled_date || ' ' || start_time)::timestamptz AT TIME ZONE 'UTC',
    end_time_utc = (scheduled_date || ' ' || end_time)::timestamptz AT TIME ZONE 'UTC',
    timezone = COALESCE(
        (SELECT c.timezone FROM public.courses c WHERE c.id = lessons.course_id),
        'UTC'
    )
WHERE start_time_utc IS NULL AND scheduled_date IS NOT NULL AND start_time IS NOT NULL;

-- 6. Set default timezone for existing teachers/courses
UPDATE public.teachers SET timezone = 'UTC' WHERE timezone IS NULL;
UPDATE public.courses SET timezone = 'UTC' WHERE timezone IS NULL;

-- 7. RLS: teachers can read their own timezone, students can read course timezone
-- Teachers already have read access via existing policies
-- Students can read their own course's timezone via the cross-role read policy