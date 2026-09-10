-- ─────────────────────────────────────────────────────────────────────────────
-- NUCLEAR OPTION: Complete Database Reset
-- Use this if clean slate failed. Drops everything including auth users.
-- ─────────────────────────────────────────────────────────────────────────────

-- Disable RLS on all tables first
DO $$ 
DECLARE 
  r RECORD;
BEGIN 
  FOR r IN (
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename NOT IN ('spatial_ref_sys')
  ) LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' DISABLE ROW LEVEL SECURITY';
  END LOOP;
END $$;

-- Drop all tables in dependency order (CASCADE handles foreign keys)
DROP TABLE IF EXISTS public.lesson_reports CASCADE;
DROP TABLE IF EXISTS public.attendance CASCADE;
DROP TABLE IF EXISTS public.lessons CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.course_enrollments CASCADE;
DROP TABLE IF EXISTS public.courses CASCADE;
DROP TABLE IF EXISTS public.student_teacher_assignments CASCADE;
DROP TABLE IF EXISTS public.teachers CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.academy_settings CASCADE;
DROP TABLE IF EXISTS public.subjects CASCADE;

-- Drop enums if they exist
DROP TYPE IF EXISTS public.user_role CASCADE;
DROP TYPE IF EXISTS public.course_status CASCADE;
DROP TYPE IF EXISTS public.payment_status CASCADE;
DROP TYPE IF EXISTS public.payment_type CASCADE;

-- Verify clean
SELECT 'Database reset complete. Ready for fresh schema.' as status;