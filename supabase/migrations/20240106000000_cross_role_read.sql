-- ─────────────────────────────────────────────────────────────────────────────
-- CROSS-ROLE READ CONSISTENCY  (idempotent — safe to re-run)
--
-- Names live in `profiles` and emails in `users`. Those tables only granted
-- read access to management, so teacher/student dashboards and reports showed
-- blank names for the other party. These additive SELECT policies let a user
-- read their own record plus the records of the people they are directly
-- connected to through lessons or teacher/student assignments.
--
-- They are written to avoid recursion: neither policy references its own table
-- in a way that re-triggers itself (the profiles policy reads `users`, and the
-- users policy reads only `lessons`/`student_teacher_assignments`).
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Read related profiles" ON public.profiles;
CREATE POLICY "Read related profiles"
    ON public.profiles FOR SELECT
    USING (
        auth.uid() = id
        OR auth.uid() IN (SELECT id FROM public.users WHERE role = 'management')
        OR id IN (SELECT teacher_id FROM public.lessons WHERE student_id = auth.uid())
        OR id IN (SELECT student_id FROM public.lessons WHERE teacher_id = auth.uid())
        OR id IN (SELECT teacher_id FROM public.student_teacher_assignments WHERE student_id = auth.uid())
        OR id IN (SELECT student_id FROM public.student_teacher_assignments WHERE teacher_id = auth.uid())
    );

DROP POLICY IF EXISTS "Read related users" ON public.users;
CREATE POLICY "Read related users"
    ON public.users FOR SELECT
    USING (
        auth.uid() = id
        OR id IN (SELECT teacher_id FROM public.lessons WHERE student_id = auth.uid())
        OR id IN (SELECT student_id FROM public.lessons WHERE teacher_id = auth.uid())
        OR id IN (SELECT teacher_id FROM public.student_teacher_assignments WHERE student_id = auth.uid())
        OR id IN (SELECT student_id FROM public.student_teacher_assignments WHERE teacher_id = auth.uid())
    );
