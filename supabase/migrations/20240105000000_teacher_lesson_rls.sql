-- ─────────────────────────────────────────────────────────────────────────────
-- TEACHER WORKFLOW RLS  (idempotent — safe to re-run)
-- The lessons / lesson_reports / attendance tables previously only granted
-- write access to management. Without these policies a teacher's "Start" and
-- "End Meeting" actions are silently blocked by row-level security, so the
-- lesson never completes and the report/attendance never save.
-- ─────────────────────────────────────────────────────────────────────────────

-- Teachers may update the status/times of their own lessons (start → live → completed)
DROP POLICY IF EXISTS "Teacher update own lessons" ON public.lessons;
CREATE POLICY "Teacher update own lessons"
    ON public.lessons FOR UPDATE
    USING (auth.uid() = teacher_id)
    WITH CHECK (auth.uid() = teacher_id);

-- Teachers may create + edit lesson reports for their own lessons
DROP POLICY IF EXISTS "Teacher insert own reports" ON public.lesson_reports;
CREATE POLICY "Teacher insert own reports"
    ON public.lesson_reports FOR INSERT
    WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teacher update own reports" ON public.lesson_reports;
CREATE POLICY "Teacher update own reports"
    ON public.lesson_reports FOR UPDATE
    USING (auth.uid() = teacher_id)
    WITH CHECK (auth.uid() = teacher_id);

-- Teachers may mark/adjust attendance for their own lessons
DROP POLICY IF EXISTS "Teacher insert own attendance" ON public.attendance;
CREATE POLICY "Teacher insert own attendance"
    ON public.attendance FOR INSERT
    WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teacher update own attendance" ON public.attendance;
CREATE POLICY "Teacher update own attendance"
    ON public.attendance FOR UPDATE
    USING (auth.uid() = teacher_id)
    WITH CHECK (auth.uid() = teacher_id);

-- Staff (teachers + management) may create notifications (e.g. "report ready")
DROP POLICY IF EXISTS "Staff insert notifications" ON public.notifications;
CREATE POLICY "Staff insert notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role IN ('teacher', 'management')));
