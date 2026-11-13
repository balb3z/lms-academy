-- 3 Test Accounts with actual UUIDs (fixed ambiguous column issue)
-- Admin: 74160eaf-89dd-4734-8df3-d17e1377352b
-- Teacher: 296b2738-a95f-4c6f-b833-832f8a2abeb2
-- Student: 4c396899-b472-412f-8bd4-b674e50e600b

DO $$
DECLARE
  v_admin_id uuid := '74160eaf-89dd-4734-8df3-d17e1377352b';
  v_teacher_id uuid := '296b2738-a95f-4c6f-b833-832f8a2abeb2';
  v_student_id uuid := '4c396899-b472-412f-8bd4-b674e50e600b';
  v_course_id uuid;
BEGIN
  -- 1. Users
  INSERT INTO public.users (id, email, role)
  VALUES 
    (v_admin_id, 'admin@academy.test', 'management'),
    (v_teacher_id, 'teacher@academy.test', 'teacher'),
    (v_student_id, 'student@academy.test', 'student')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role;

  -- Profiles
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES 
    (v_admin_id, 'Academy Admin', '+1-555-0100'),
    (v_teacher_id, 'Ahmed Hassan', '+1-555-0101'),
    (v_student_id, 'Omar Ali', '+1-555-0102')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone;

  -- Teacher
  INSERT INTO public.teachers (id, teacher_id, specialization, qualification, years_of_experience, is_active, timezone)
  VALUES (v_teacher_id, 'TCH-2025-0001', 'Quran & Tajweed', 'Al-Azhar Graduate', 8, true, 'Africa/Cairo')
  ON CONFLICT (id) DO UPDATE SET teacher_id = EXCLUDED.teacher_id, specialization = EXCLUDED.specialization, qualification = EXCLUDED.qualification, years_of_experience = EXCLUDED.years_of_experience, is_active = EXCLUDED.is_active, timezone = EXCLUDED.timezone;

  -- Student
  INSERT INTO public.students (id, student_id, enrollment_date, course, grade_level, parent_name, parent_email, parent_phone, is_active)
  VALUES (v_student_id, 'STU-2025-0001', CURRENT_DATE, 'Quran Memorization', 'Beginner', 'Ali Omar', 'parent@academy.test', '+1-555-0103', true)
  ON CONFLICT (id) DO UPDATE SET student_id = EXCLUDED.student_id, enrollment_date = EXCLUDED.enrollment_date, course = EXCLUDED.course, grade_level = EXCLUDED.grade_level, parent_name = EXCLUDED.parent_name, parent_email = EXCLUDED.parent_email, parent_phone = EXCLUDED.parent_phone, is_active = EXCLUDED.is_active;

  -- Course
  INSERT INTO public.courses (name, student_id, teacher_id, total_lessons, lessons_per_week, lesson_duration_minutes, preferred_days, preferred_time, start_date, payment_type, monthly_price, currency, status, payment_status, timezone)
  VALUES ('Quran Memorization - Beginner', v_student_id, v_teacher_id, 20, 2, 60, ARRAY['sunday', 'tuesday'], '19:00', CURRENT_DATE, 'monthly', 200.00, 'USD', 'active', 'unpaid', 'Africa/Cairo')
  ON CONFLICT DO NOTHING;

  -- Get course ID for enrollment
  SELECT id INTO v_course_id FROM public.courses WHERE student_id = v_student_id AND teacher_id = v_teacher_id;

  -- Enrollment
  INSERT INTO public.course_enrollments (course_id, student_id, start_date, lessons_generated, student_price, teacher_rate, is_active)
  VALUES (v_course_id, v_student_id, CURRENT_DATE, 20, 50.00, 30.00, true)
  ON CONFLICT (course_id, student_id) DO UPDATE SET lessons_generated = EXCLUDED.lessons_generated, student_price = EXCLUDED.student_price, teacher_rate = EXCLUDED.teacher_rate, is_active = EXCLUDED.is_active;

  -- Assignment
  INSERT INTO public.student_teacher_assignments (student_id, teacher_id, assigned_by, is_active)
  VALUES (v_student_id, v_teacher_id, v_admin_id, true)
  ON CONFLICT (student_id, teacher_id) DO UPDATE SET is_active = EXCLUDED.is_active;
END $$;

-- Verify
SELECT 'users', count(*) FROM public.users
UNION ALL SELECT 'profiles', count(*) FROM public.profiles
UNION ALL SELECT 'teachers', count(*) FROM public.teachers
UNION ALL SELECT 'students', count(*) FROM public.students
UNION ALL SELECT 'courses', count(*) FROM public.courses
UNION ALL SELECT 'course_enrollments', count(*) FROM public.course_enrollments
UNION ALL SELECT 'student_teacher_assignments', count(*) FROM public.student_teacher_assignments;