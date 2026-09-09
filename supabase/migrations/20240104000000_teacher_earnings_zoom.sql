-- ─────────────────────────────────────────────────────────────────────────────
-- TEACHER ZOOM LINK + EARNINGS / RATES
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Teacher's personal Zoom meeting link
ALTER TABLE public.teachers
    ADD COLUMN IF NOT EXISTS zoom_link TEXT;

-- 2. Per-student pricing set at assignment time
ALTER TABLE public.course_enrollments
    ADD COLUMN IF NOT EXISTS student_price NUMERIC(10, 2);
ALTER TABLE public.course_enrollments
    ADD COLUMN IF NOT EXISTS teacher_rate NUMERIC(10, 2);

-- 3. Teacher rate stamped onto each generated lesson.
--    Earnings = SUM(teacher_rate) over the teacher's COMPLETED lessons.
--    Stamping on the lesson "locks in" the rate at assignment time, so later
--    rate changes never rewrite historical earnings.
ALTER TABLE public.lessons
    ADD COLUMN IF NOT EXISTS teacher_rate NUMERIC(10, 2);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: allow the Zoom link (and other teacher fields) to be read by the people
-- who need it. The teachers table previously only had a management policy, so
-- neither the teacher nor their students could read zoom_link.
-- ─────────────────────────────────────────────────────────────────────────────

-- A teacher can read their own teacher record; a student can read the record of
-- a teacher they are assigned to or share a lesson with. (Management already has
-- full access through the existing "Management full access teachers" policy.)
CREATE POLICY "Related users view teacher record"
    ON public.teachers FOR SELECT
    USING (
        auth.uid() = id
        OR id IN (
            SELECT teacher_id FROM public.student_teacher_assignments
            WHERE student_id = auth.uid()
        )
        OR id IN (
            SELECT teacher_id FROM public.lessons
            WHERE student_id = auth.uid()
        )
    );
