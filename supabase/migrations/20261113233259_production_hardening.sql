-- Production hardening: addresses Supabase security/performance advisors.
-- Non-destructive: no tables or rows are dropped. Idempotent (safe to re-run).
--   1. SECURITY DEFINER helpers: search_path = '', EXECUTE only for authenticated/service_role
--   2. Revoke anon privileges on public tables/sequences (RLS is the only gate; nothing for anon)
--   3. Rewrite all RLS policies: TO authenticated, (select auth.uid()) initplans,
--      one permissive policy per table/action (no overlaps)
--   4. activity_logs policies
--   5. Covering indexes for unindexed foreign keys

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Helper functions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.users WHERE id = user_id;
$$;

CREATE OR REPLACE FUNCTION public.is_management_user(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role = 'management' FROM public.users WHERE id = user_id;
$$;

CREATE OR REPLACE FUNCTION public.is_management()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'management'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'teacher'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_student()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'student'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_management_user(uuid)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_management()            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_teacher()               FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_student()               FROM PUBLIC, anon;
-- Arbitrary role lookups must not be callable by end users via RPC.
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid)        FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_management_user(uuid)   FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.get_user_role(uuid)        TO service_role;
GRANT  EXECUTE ON FUNCTION public.is_management_user(uuid)   TO service_role;
GRANT  EXECUTE ON FUNCTION public.is_management()            TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.is_teacher()               TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.is_student()               TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. anon gets nothing in public; authenticated loses TRUNCATE/TRIGGER/REFERENCES
-- ---------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;

-- ---------------------------------------------------------------------------
-- 3. RLS policies: drop every existing policy on the 15 tables, recreate.
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN (
      'users','profiles','students','teachers','subjects','courses',
      'course_enrollments','lessons','attendance','lesson_reports','payments',
      'notifications','activity_logs','academy_settings','student_teacher_assignments')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Pattern: M = (select public.is_management()), U = (select auth.uid())

-- academy_settings: management only
CREATE POLICY academy_settings_management_all ON public.academy_settings
  FOR ALL TO authenticated
  USING ((select public.is_management()))
  WITH CHECK ((select public.is_management()));

-- users
CREATE POLICY users_select ON public.users FOR SELECT TO authenticated
  USING ((select public.is_management()) OR id = (select auth.uid()));
CREATE POLICY users_insert ON public.users FOR INSERT TO authenticated
  WITH CHECK ((select public.is_management()));
CREATE POLICY users_update ON public.users FOR UPDATE TO authenticated
  USING ((select public.is_management())) WITH CHECK ((select public.is_management()));
CREATE POLICY users_delete ON public.users FOR DELETE TO authenticated
  USING ((select public.is_management()));

-- profiles
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (
    (select public.is_management())
    OR id = (select auth.uid())
    OR id IN (
      SELECT l.teacher_id FROM public.lessons l WHERE l.student_id = (select auth.uid())
      UNION
      SELECT a.teacher_id FROM public.student_teacher_assignments a WHERE a.student_id = (select auth.uid())
    )
    OR id IN (
      SELECT l.student_id FROM public.lessons l WHERE l.teacher_id = (select auth.uid())
      UNION
      SELECT a.student_id FROM public.student_teacher_assignments a WHERE a.teacher_id = (select auth.uid())
    )
  );
CREATE POLICY profiles_insert ON public.profiles FOR INSERT TO authenticated
  WITH CHECK ((select public.is_management()));
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
  USING ((select public.is_management()) OR id = (select auth.uid()))
  WITH CHECK ((select public.is_management()) OR id = (select auth.uid()));

CREATE OR REPLACE FUNCTION public.profiles_guard_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_management()
     AND coalesce(current_setting('request.jwt.claim.role', true), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')) = 'authenticated' THEN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Only management can change profile ids' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.profiles_guard_id() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_guard_id ON public.profiles;
CREATE TRIGGER profiles_guard_id
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_id();
CREATE POLICY profiles_delete ON public.profiles FOR DELETE TO authenticated
  USING ((select public.is_management()));

-- students
-- NOTE: the old "Teacher view assigned students" policy compared
-- student_teacher_assignments.student_id = student_teacher_assignments.id (always
-- false in practice), so its teacher branch never matched. Dropped, not widened.
-- Teachers can read the students actively assigned to them (used by the
-- teacher Students page), fixing the broken branch described above.
CREATE POLICY students_select ON public.students FOR SELECT TO authenticated
  USING (
    (select public.is_management())
    OR id = (select auth.uid())
    OR id IN (
      SELECT sta.student_id FROM public.student_teacher_assignments sta
      WHERE sta.teacher_id = (select auth.uid()) AND sta.is_active
    )
  );
CREATE POLICY students_insert ON public.students FOR INSERT TO authenticated
  WITH CHECK ((select public.is_management()));
-- Students may edit their own row (parent contact details on the Profile page);
-- the trigger below stops them changing administrative columns.
CREATE POLICY students_update ON public.students FOR UPDATE TO authenticated
  USING ((select public.is_management()) OR id = (select auth.uid()))
  WITH CHECK ((select public.is_management()) OR id = (select auth.uid()));

CREATE OR REPLACE FUNCTION public.students_guard_admin_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_management()
     AND coalesce(current_setting('request.jwt.claim.role', true), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')) = 'authenticated' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.student_id IS DISTINCT FROM OLD.student_id
       OR NEW.enrollment_date IS DISTINCT FROM OLD.enrollment_date
       OR NEW.is_active IS DISTINCT FROM OLD.is_active
       OR NEW.course IS DISTINCT FROM OLD.course
       OR NEW.grade_level IS DISTINCT FROM OLD.grade_level THEN
      RAISE EXCEPTION 'Only management can change administrative student fields'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.students_guard_admin_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS students_guard_admin_columns ON public.students;
CREATE TRIGGER students_guard_admin_columns
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.students_guard_admin_columns();
CREATE POLICY students_delete ON public.students FOR DELETE TO authenticated
  USING ((select public.is_management()));

-- teachers
CREATE POLICY teachers_select ON public.teachers FOR SELECT TO authenticated
  USING (
    (select public.is_management())
    OR id = (select auth.uid())
    OR id IN (SELECT a.teacher_id FROM public.student_teacher_assignments a WHERE a.student_id = (select auth.uid()))
    OR id IN (SELECT l.teacher_id FROM public.lessons l WHERE l.student_id = (select auth.uid()))
  );
CREATE POLICY teachers_insert ON public.teachers FOR INSERT TO authenticated
  WITH CHECK ((select public.is_management()));
CREATE POLICY teachers_update ON public.teachers FOR UPDATE TO authenticated
  USING ((select public.is_management())) WITH CHECK ((select public.is_management()));
CREATE POLICY teachers_delete ON public.teachers FOR DELETE TO authenticated
  USING ((select public.is_management()));

-- subjects
CREATE POLICY subjects_select ON public.subjects FOR SELECT TO authenticated
  USING (true);
CREATE POLICY subjects_insert ON public.subjects FOR INSERT TO authenticated
  WITH CHECK ((select public.is_management()));
CREATE POLICY subjects_update ON public.subjects FOR UPDATE TO authenticated
  USING ((select public.is_management())) WITH CHECK ((select public.is_management()));
CREATE POLICY subjects_delete ON public.subjects FOR DELETE TO authenticated
  USING ((select public.is_management()));

-- courses
CREATE POLICY courses_select ON public.courses FOR SELECT TO authenticated
  USING ((select public.is_management())
         OR student_id = (select auth.uid())
         OR teacher_id = (select auth.uid()));
CREATE POLICY courses_insert ON public.courses FOR INSERT TO authenticated
  WITH CHECK ((select public.is_management()));
CREATE POLICY courses_update ON public.courses FOR UPDATE TO authenticated
  USING ((select public.is_management())) WITH CHECK ((select public.is_management()));
CREATE POLICY courses_delete ON public.courses FOR DELETE TO authenticated
  USING ((select public.is_management()));

-- course_enrollments
CREATE POLICY course_enrollments_select ON public.course_enrollments FOR SELECT TO authenticated
  USING ((select public.is_management())
         OR student_id = (select auth.uid())
         OR course_id IN (SELECT c.id FROM public.courses c WHERE c.teacher_id = (select auth.uid())));
CREATE POLICY course_enrollments_insert ON public.course_enrollments FOR INSERT TO authenticated
  WITH CHECK ((select public.is_management()));
CREATE POLICY course_enrollments_update ON public.course_enrollments FOR UPDATE TO authenticated
  USING ((select public.is_management())) WITH CHECK ((select public.is_management()));
CREATE POLICY course_enrollments_delete ON public.course_enrollments FOR DELETE TO authenticated
  USING ((select public.is_management()));

-- lessons
CREATE POLICY lessons_select ON public.lessons FOR SELECT TO authenticated
  USING ((select public.is_management())
         OR student_id = (select auth.uid())
         OR teacher_id = (select auth.uid()));
CREATE POLICY lessons_insert ON public.lessons FOR INSERT TO authenticated
  WITH CHECK ((select public.is_management()));
CREATE POLICY lessons_update ON public.lessons FOR UPDATE TO authenticated
  USING ((select public.is_management()) OR teacher_id = (select auth.uid()))
  WITH CHECK ((select public.is_management()) OR teacher_id = (select auth.uid()));
-- Teachers may only progress a lesson (status, actual times, attendance); they
-- cannot reassign or reschedule it, and teacher_rate is stamped server-side
-- from course_enrollments.teacher_rate when a lesson is completed.
CREATE OR REPLACE FUNCTION public.lessons_guard_teacher_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_management()
     AND coalesce(current_setting('request.jwt.claim.role', true), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')) = 'authenticated' THEN
    IF NEW.student_id IS DISTINCT FROM OLD.student_id
       OR NEW.teacher_id IS DISTINCT FROM OLD.teacher_id
       OR NEW.course_id IS DISTINCT FROM OLD.course_id
       OR NEW.subject_id IS DISTINCT FROM OLD.subject_id
       OR NEW.scheduled_date IS DISTINCT FROM OLD.scheduled_date
       OR NEW.start_time IS DISTINCT FROM OLD.start_time
       OR NEW.end_time IS DISTINCT FROM OLD.end_time
       OR NEW.start_time_utc IS DISTINCT FROM OLD.start_time_utc
       OR NEW.end_time_utc IS DISTINCT FROM OLD.end_time_utc
       OR NEW.timezone IS DISTINCT FROM OLD.timezone
       OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes
       OR NEW.meeting_url IS DISTINCT FROM OLD.meeting_url THEN
      RAISE EXCEPTION 'Only management can change lesson assignment, schedule or meeting link'
        USING ERRCODE = '42501';
    END IF;

    -- Ignore any client-supplied rate; stamp it from the enrollment on completion.
    NEW.teacher_rate := OLD.teacher_rate;
    IF NEW.status = 'completed' AND OLD.teacher_rate IS NULL THEN
      SELECT ce.teacher_rate INTO NEW.teacher_rate
      FROM public.course_enrollments ce
      WHERE ce.course_id = NEW.course_id AND ce.student_id = NEW.student_id
      ORDER BY ce.created_at DESC
      LIMIT 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.lessons_guard_teacher_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS lessons_guard_teacher_columns ON public.lessons;
CREATE TRIGGER lessons_guard_teacher_columns
  BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.lessons_guard_teacher_columns();

CREATE POLICY lessons_delete ON public.lessons FOR DELETE TO authenticated
  USING ((select public.is_management()));

-- attendance
CREATE POLICY attendance_select ON public.attendance FOR SELECT TO authenticated
  USING ((select public.is_management())
         OR student_id = (select auth.uid())
         OR teacher_id = (select auth.uid()));
CREATE POLICY attendance_insert ON public.attendance FOR INSERT TO authenticated
  WITH CHECK ((select public.is_management())
              OR (teacher_id = (select auth.uid())
                  AND EXISTS (SELECT 1 FROM public.lessons l
                     WHERE l.id = attendance.lesson_id
                       AND l.teacher_id = (select auth.uid())
                       AND l.student_id = attendance.student_id)));
CREATE POLICY attendance_update ON public.attendance FOR UPDATE TO authenticated
  USING ((select public.is_management()) OR teacher_id = (select auth.uid()))
  WITH CHECK ((select public.is_management())
              OR (teacher_id = (select auth.uid())
                  AND EXISTS (SELECT 1 FROM public.lessons l
                     WHERE l.id = attendance.lesson_id
                       AND l.teacher_id = (select auth.uid())
                       AND l.student_id = attendance.student_id)));
CREATE POLICY attendance_delete ON public.attendance FOR DELETE TO authenticated
  USING ((select public.is_management()));

-- lesson_reports
CREATE POLICY lesson_reports_select ON public.lesson_reports FOR SELECT TO authenticated
  USING ((select public.is_management())
         OR (student_id = (select auth.uid()) AND is_visible_to_student = true)
         OR teacher_id = (select auth.uid()));
CREATE POLICY lesson_reports_insert ON public.lesson_reports FOR INSERT TO authenticated
  WITH CHECK ((select public.is_management())
              OR (teacher_id = (select auth.uid())
                  AND EXISTS (SELECT 1 FROM public.lessons l
                     WHERE l.id = lesson_reports.lesson_id
                       AND l.teacher_id = (select auth.uid())
                       AND l.student_id = lesson_reports.student_id)));
CREATE POLICY lesson_reports_update ON public.lesson_reports FOR UPDATE TO authenticated
  USING ((select public.is_management()) OR teacher_id = (select auth.uid()))
  WITH CHECK ((select public.is_management())
              OR (teacher_id = (select auth.uid())
                  AND EXISTS (SELECT 1 FROM public.lessons l
                     WHERE l.id = lesson_reports.lesson_id
                       AND l.teacher_id = (select auth.uid())
                       AND l.student_id = lesson_reports.student_id)));
CREATE POLICY lesson_reports_delete ON public.lesson_reports FOR DELETE TO authenticated
  USING ((select public.is_management()));

-- payments
CREATE POLICY payments_select ON public.payments FOR SELECT TO authenticated
  USING ((select public.is_management()) OR student_id = (select auth.uid()));
CREATE POLICY payments_insert ON public.payments FOR INSERT TO authenticated
  WITH CHECK ((select public.is_management()));
CREATE POLICY payments_update ON public.payments FOR UPDATE TO authenticated
  USING ((select public.is_management())) WITH CHECK ((select public.is_management()));
CREATE POLICY payments_delete ON public.payments FOR DELETE TO authenticated
  USING ((select public.is_management()));

-- notifications
CREATE POLICY notifications_select ON public.notifications FOR SELECT TO authenticated
  USING ((select public.is_management()) OR user_id = (select auth.uid()));
CREATE POLICY notifications_insert ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    (select public.is_management())
    OR (
      (select public.is_teacher())
      AND (
        EXISTS (SELECT 1 FROM public.student_teacher_assignments sta
                WHERE sta.teacher_id = (select auth.uid())
                  AND sta.student_id = notifications.user_id
                  AND sta.is_active)
        OR EXISTS (SELECT 1 FROM public.lessons l
                   WHERE l.teacher_id = (select auth.uid())
                     AND l.student_id = notifications.user_id)
      )
    )
  );
CREATE POLICY notifications_update ON public.notifications FOR UPDATE TO authenticated
  USING ((select public.is_management())) WITH CHECK ((select public.is_management()));
CREATE POLICY notifications_delete ON public.notifications FOR DELETE TO authenticated
  USING ((select public.is_management()));

-- student_teacher_assignments
CREATE POLICY student_teacher_assignments_select ON public.student_teacher_assignments FOR SELECT TO authenticated
  USING ((select public.is_management())
         OR student_id = (select auth.uid())
         OR teacher_id = (select auth.uid()));
CREATE POLICY student_teacher_assignments_insert ON public.student_teacher_assignments FOR INSERT TO authenticated
  WITH CHECK ((select public.is_management()));
CREATE POLICY student_teacher_assignments_update ON public.student_teacher_assignments FOR UPDATE TO authenticated
  USING ((select public.is_management())) WITH CHECK ((select public.is_management()));
CREATE POLICY student_teacher_assignments_delete ON public.student_teacher_assignments FOR DELETE TO authenticated
  USING ((select public.is_management()));

-- ---------------------------------------------------------------------------
-- 4. activity_logs (RLS enabled, previously had no policy)
-- ---------------------------------------------------------------------------
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY activity_logs_select ON public.activity_logs FOR SELECT TO authenticated
  USING ((select public.is_management()));
CREATE POLICY activity_logs_insert ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 4b. https-only meeting links (existing rows verified compliant: 0 violations)
-- ---------------------------------------------------------------------------
ALTER TABLE public.lessons DROP CONSTRAINT IF EXISTS lessons_meeting_url_https;
ALTER TABLE public.lessons ADD CONSTRAINT lessons_meeting_url_https
  CHECK (meeting_url IS NULL OR meeting_url ~* '^https://') NOT VALID;
ALTER TABLE public.lessons VALIDATE CONSTRAINT lessons_meeting_url_https;

ALTER TABLE public.teachers DROP CONSTRAINT IF EXISTS teachers_zoom_link_https;
ALTER TABLE public.teachers ADD CONSTRAINT teachers_zoom_link_https
  CHECK (zoom_link IS NULL OR zoom_link ~* '^https://') NOT VALID;
ALTER TABLE public.teachers VALIDATE CONSTRAINT teachers_zoom_link_https;

-- ---------------------------------------------------------------------------
-- 5. Covering indexes for unindexed foreign keys
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_academy_settings_updated_by ON public.academy_settings (updated_by);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_marked_by ON public.attendance (marked_by);
CREATE INDEX IF NOT EXISTS idx_attendance_teacher_id ON public.attendance (teacher_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_enrolled_by ON public.course_enrollments (enrolled_by);
CREATE INDEX IF NOT EXISTS idx_courses_created_by ON public.courses (created_by);
CREATE INDEX IF NOT EXISTS idx_lesson_reports_student_id ON public.lesson_reports (student_id);
CREATE INDEX IF NOT EXISTS idx_lesson_reports_submitted_by ON public.lesson_reports (submitted_by);
CREATE INDEX IF NOT EXISTS idx_lesson_reports_teacher_id ON public.lesson_reports (teacher_id);
CREATE INDEX IF NOT EXISTS idx_lessons_created_by ON public.lessons (created_by);
CREATE INDEX IF NOT EXISTS idx_lessons_subject_id ON public.lessons (subject_id);
CREATE INDEX IF NOT EXISTS idx_payments_recorded_by ON public.payments (recorded_by);
CREATE INDEX IF NOT EXISTS idx_student_teacher_assignments_assigned_by ON public.student_teacher_assignments (assigned_by);

COMMIT;
