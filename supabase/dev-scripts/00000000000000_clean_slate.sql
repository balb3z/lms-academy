-- ─────────────────────────────────────────────────────────────────────────────
-- CLEAN SLATE / FIRST RUN RESET
-- Run this FIRST in Supabase SQL Editor to wipe all academy data
-- ─────────────────────────────────────────────────────────────────────────────

-- Disable RLS temporarily so we can delete everything
ALTER TABLE public.lesson_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_teacher_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.students DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_settings DISABLE ROW LEVEL SECURITY;

-- Delete in correct order (respecting foreign keys)
TRUNCATE TABLE public.lesson_reports CASCADE;
TRUNCATE TABLE public.attendance CASCADE;
TRUNCATE TABLE public.lessons CASCADE;
TRUNCATE TABLE public.payments CASCADE;
TRUNCATE TABLE public.course_enrollments CASCADE;
TRUNCATE TABLE public.courses CASCADE;
TRUNCATE TABLE public.student_teacher_assignments CASCADE;
TRUNCATE TABLE public.teachers CASCADE;
TRUNCATE TABLE public.students CASCADE;
TRUNCATE TABLE public.profiles CASCADE;
TRUNCATE TABLE public.users CASCADE;
TRUNCATE TABLE public.notifications CASCADE;
TRUNCATE TABLE public.activity_logs CASCADE;
TRUNCATE TABLE public.academy_settings CASCADE;

-- Reset subjects to default (keep the 5 default subjects)
DELETE FROM public.subjects WHERE id NOT IN (
  SELECT id FROM public.subjects 
  WHERE name IN ('Quran', 'Arabic', 'Islamic Studies', 'Tafsir', 'Hadith')
);

-- Re-enable RLS
ALTER TABLE public.lesson_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_settings ENABLE ROW LEVEL SECURITY;

-- Verify clean state
SELECT 
  'users' as table_name, count(*) FROM public.users
UNION ALL SELECT 'profiles', count(*) FROM public.profiles
UNION ALL SELECT 'students', count(*) FROM public.students
UNION ALL SELECT 'teachers', count(*) FROM public.teachers
UNION ALL SELECT 'courses', count(*) FROM public.courses
UNION ALL SELECT 'lessons', count(*) FROM public.lessons
UNION ALL SELECT 'payments', count(*) FROM public.payments
UNION ALL SELECT 'course_enrollments', count(*) FROM public.course_enrollments
UNION ALL SELECT 'student_teacher_assignments', count(*) FROM public.student_teacher_assignments
UNION ALL SELECT 'lesson_reports', count(*) FROM public.lesson_reports
UNION ALL SELECT 'attendance', count(*) FROM public.attendance
UNION ALL SELECT 'subjects', count(*) FROM public.subjects;