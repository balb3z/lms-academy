-- ─────────────────────────────────────────────────────────────────────────────
-- TEACHER WORKFLOW RLS
-- The lessons / lesson_reports / attendance tables previously only granted
-- write access to management. Without these policies a teacher's "Start" and
-- "End Meeting" actions are silently blocked by row-level security, so the
-- lesson never completes and the report/attendance never save.
-- ─────────────────────────────────────────────────────────────────────────────

-- Teachers may update the status/times of their own lessons (start → live → completed)
CREATE POLICY "Teacher update own lessons"
    ON public.lessons FOR UPDATE
    USING (auth.uid() = teacher_id)
    WITH CHECK (auth.uid() = teacher_id);

-- Teachers may create + edit lesson reports for their own lessons
CREATE POLICY "Teacher insert own reports"
    ON public.lesson_reports FOR INSERT
    WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teacher update own reports"
    ON public.lesson_reports FOR UPDATE
    USING (auth.uid() = teacher_id)
    WITH CHECK (auth.uid() = teacher_id);

-- Teachers may mark/adjust attendance for their own lessons
CREATE POLICY "Teacher insert own attendance"
    ON public.attendance FOR INSERT
    WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teacher update own attendance"
    ON public.attendance FOR UPDATE
    USING (auth.uid() = teacher_id)
    WITH CHECK (auth.uid() = teacher_id);

-- Staff (teachers + management) may create notifications (e.g. "report ready")
CREATE POLICY "Staff insert notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role IN ('teacher', 'management')));
