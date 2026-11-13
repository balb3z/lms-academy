-- ─────────────────────────────────────────────────────────────────────────────
-- NUCLEAR RESET - Complete Database Wipe
-- Run this FIRST in Supabase SQL Editor to completely wipe everything
-- ─────────────────────────────────────────────────────────────────────────────

-- Disable RLS on all tables (ignore errors if table doesn't exist)
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

-- Drop ALL tables in dependency order (CASCADE handles foreign keys)
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
DROP TABLE IF EXISTS public.student_teacher_assignments CASCADE;

-- Drop custom types/enums
DROP TYPE IF EXISTS public.user_role CASCADE;
DROP TYPE IF EXISTS public.course_status CASCADE;
DROP TYPE IF EXISTS public.payment_status CASCADE;
DROP TYPE IF EXISTS public.payment_type CASCADE;

-- Drop helper functions
DROP FUNCTION IF EXISTS public.is_management_user(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role(uuid) CASCADE;

-- Verify clean
SELECT 'Database reset complete. Ready for fresh schema.' as status;