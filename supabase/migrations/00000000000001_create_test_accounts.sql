-- ─────────────────────────────────────────────────────────────────────────────
-- CREATE 3 TEST ACCOUNTS: Management, Teacher, Student
-- Run this in Supabase SQL Editor after all migrations are applied
-- ─────────────────────────────────────────────────────────────────────────────

-- This script uses Supabase's admin API to create auth users,
-- then inserts corresponding records in public tables.
-- 
-- NOTE: You need to run this as a PostgreSQL function or via Supabase Dashboard > Authentication > Users > "Add user"
-- For SQL Editor, we'll use the auth.admin functions available via pg_net or use the simpler approach:
-- 
-- EASIEST METHOD: Use Supabase Dashboard > Authentication > Users > "Add user" (3 times)
-- Then run the INSERT statements below for the public tables.
--
-- ALTERNATIVE: If you have service_role key, use the Management API.
-- 
-- Below is the SQL to insert the public records AFTER auth users are created.
-- You'll need to replace the UUIDs with the actual auth.user IDs from the dashboard.

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Create Auth Users via Supabase Dashboard
-- Go to: Supabase Dashboard > Authentication > Users > "Add user"
-- Create these 3 users:
-- 
-- 1. Management:  admin@academy.test     / password: admin123
-- 2. Teacher:     teacher@academy.test   / password: teacher123  
-- 3. Student:     student@academy.test   / password: student123
-- 
-- After creating them, copy their UUIDs from the "Users" table and replace below.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Replace these UUIDs with actual auth.users IDs from Dashboard
-- ─────────────────────────────────────────────────────────────────────────────
-- Run this query first to see the IDs:
-- SELECT id, email FROM auth.users WHERE email IN ('admin@academy.test', 'teacher@academy.test', 'student@academy.test');

-- Replace these placeholders with actual UUIDs from the query above:
\set admin_id     'REPLACE_WITH_ADMIN_UUID'
\set teacher_id   'REPLACE_WITH_TEACHER_UUID'
\set student_id   'REPLACE_WITH_STUDENT_UUID'

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Insert public records (run after replacing UUIDs above)
-- ────────────────IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = :'admin_id')
INSERT INTO public.users (id, email, role)
VALUES 
  (:'admin_id', 'admin@academy.test', 'management'),
  (:'teacher_id', 'teacher@academy.test', 'teacher'),
  (:'student_id', 'student@academy.test', 'student')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  role = EXCLUDED.role;

-- Profiles
INSERT INTO public.profiles (id, full_name, phone)
VALUES 
  (:'admin_id', 'Academy Admin', '+1-555-0100'),
  (:'teacher_id', 'Ahmed Hassan', '+1-555-0101'),
  (:'student_id', 'Omar Ali', '+1-555-0102')
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone;

-- Teacher record
INSERT INTO public.teachers (id, teacher_id, specialization, qualification, years_of_experience, is_active, timezone)
VALUES (:'teacher_id', 'TCH-2025-0001', 'Quran & Tajweed', 'Al-Azhar Graduate', 8, true, 'Africa/Cairo')
ON CONFLICT (id) DO UPDATE SET
  teacher_id = EXCLUDED.teacher_id,
  specialization = EXCLUDED.specialization,
  qualification = EXCLUDED.qualification,
  years_of_experience = EXCLUDED.years_of_experience,
  is_active = EXCLUDED.is_active,
  timezone = EXCLUDED.timezone;

-- Student record
INSERT INTO public.students (id, student_id, enrollment_date, course, grade_level, parent_name, parent_email, parent_phone, is_active)
VALUES (:'student_id', 'STU-2025-0001', CURRENT_DATE, 'Quran Memorization', 'Beginner', 'Ali Omar', 'parent@academy.test', '+1-555-0103', true)
ON CONFLICT (id) DO UPDATE SET
  student_id = EXCLUDED.student_id,
  enrollment_date = EXCLUDED.enrollment_date,
  course = EXCLUDED.course,
  grade_level = EXCLUDED.grade_level,
  parent_name = EXCLUDED.parent_name,
  parent_email = EXCLUDED.parent_email,
  parent_phone = EXCLUDED.parent_phone,
  is_active = EXCLUDED.is_active;

-- Course (optional - links teacher + student)
INSERT INTO public.courses (id, name, student_id, teacher_id, total_lessons, lessons_per_week, lesson_duration_minutes, preferred_days, preferred_time, start_date, payment_type, monthly_price, currency, status, payment_status, timezone)
VALUES (
  gen_random_uuid(),
  'Quran Memorization - Beginner',
  :'student_id',
  :'teacher_id',
  20,
  2,
  60,
  ARRAY['sunday', 'tuesday'],
  '19:00',
  CURRENT_DATE,
  'monthly',
  200.00,
  'USD',
  'active',
  'unpaid',
  'Africa/Cairo'
)
ON CONFLICT DO NOTHING;

-- Enrollment
INSERT INTO public.course_enrollments (course_id, student_id, start_date, lessons_generated, student_price, teacher_rate, is_active)
SELECT c.id, :'student_id', CURRENT_DATE, 20, 50.00, 30.00, true
FROM public.courses c
WHERE c.student_id = :'student_id' AND c.teacher_id = :'teacher_id'
ON CONFLICT (course_id, student_id) DO UPDATE SET
  lessons_generated = EXCLUDED.lessons_generated,
  student_price = EXCLUDED.student_price,
  teacher_rate = EXCLUDED.teacher_rate,
  is_active = EXCLUDED.is_active;

-- Teacher-Student Assignment
INSERT INTO public.student_teacher_assignments (student_id, teacher_id, assigned_by, is_active)
VALUES (:'student_id', :'teacher_id', :'admin_id', true)
ON CONFLICT (student_id, teacher_id) DO UPDATE SET
  is_active = EXCLUDED.is_active;

-- Verify
SELECT 'users' as table_name, count(*) FROM public.users
UNION ALL SELECT 'profiles', count(*) FROM public.profiles
UNION ALL SELECT 'teachers', count(*) FROM public.teachers
UNION ALL SELECT 'students', count(*) FROM public.students
UNION ALL SELECT 'courses', count(*) FROM public.courses
UNION ALL SELECT 'course_enrollments', count(*) FROM public.course_enrollments
UNION ALL SELECT 'student_teacher_assignments', count(*) FROM public.student_teacher_assignments;