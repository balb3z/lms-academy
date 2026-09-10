-- ─────────────────────────────────────────────────────────────────────────────
-- FIX: Infinite Recursion in RLS Policies (Idempotent)
-- The issue: policies on `users` table query `users` table, causing recursion.
-- Fix: Use SECURITY DEFINER functions instead of querying tables in policies.
-- This version is idempotent - safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Drop ALL existing policies on users table (comprehensive list)
DROP POLICY IF EXISTS "Management full access" ON public.users;
DROP POLICY IF EXISTS "Management full access users" ON public.users;
DROP POLICY IF EXISTS "Read related users" ON public.users;
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can read own data" ON public.users;

-- 2. Drop ALL existing policies on profiles
DROP POLICY IF EXISTS "Management full access profiles" ON public.profiles;
DROP POLICY IF EXISTS "Management full access" ON public.profiles;
DROP POLICY IF EXISTS "Read related profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Teacher read student profiles" ON public.profiles;
DROP POLICY IF EXISTS "Student read teacher profiles" ON public.profiles;

-- 3. Drop ALL existing policies on lessons
DROP POLICY IF EXISTS "Teacher update own lessons" ON public.lessons;

-- 4. Drop ALL existing policies on lesson_reports
DROP POLICY IF EXISTS "Teacher insert own reports" ON public.lesson_reports;
DROP POLICY IF EXISTS "Teacher update own reports" ON public.lesson_reports;

-- 5. Drop ALL existing policies on attendance
DROP POLICY IF EXISTS "Teacher insert own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Teacher update own attendance" ON public.attendance;

-- 6. Drop ALL existing policies on notifications
DROP POLICY IF EXISTS "Staff insert notifications" ON public.notifications;

-- 7. Create/Update SECURITY DEFINER helper functions (avoids recursion)
CREATE OR REPLACE FUNCTION public.is_management_user(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role = 'management' FROM public.users WHERE id = user_id;
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = user_id;
$$;

-- 8. Recreate policies using helper functions (no recursion)

-- Users table policies
CREATE POLICY "Management full access users" ON public.users
  FOR ALL
  USING (public.is_management_user(auth.uid()));

CREATE POLICY "Users can read own data" ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Profiles table policies
CREATE POLICY "Management full access profiles" ON public.profiles
  FOR ALL
  USING (public.is_management_user(auth.uid()));

CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Cross-role read: teacher/student can read related profiles
CREATE POLICY "Teacher read student profiles" ON public.profiles
  FOR SELECT
  USING (
    id IN (
      SELECT student_id FROM public.lessons WHERE teacher_id = auth.uid()
      UNION
      SELECT student_id FROM public.student_teacher_assignments WHERE teacher_id = auth.uid()
    )
  );

CREATE POLICY "Student read teacher profiles" ON public.profiles
  FOR SELECT
  USING (
    id IN (
      SELECT teacher_id FROM public.lessons WHERE student_id = auth.uid()
      UNION
      SELECT teacher_id FROM public.student_teacher_assignments WHERE student_id = auth.uid()
    )
  );

-- Lessons: teacher can update their own lessons
CREATE POLICY "Teacher update own lessons" ON public.lessons
  FOR UPDATE
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- Lessons: teacher can view their own lessons
CREATE POLICY "Teacher view own lessons" ON public.lessons
  FOR SELECT
  USING (teacher_id = auth.uid());

-- Lessons: teacher can create lessons
CREATE POLICY "Teacher create lessons" ON public.lessons
  FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

-- Lessons: student can view their own lessons
CREATE POLICY "Student view own lessons" ON public.lessons
  FOR SELECT
  USING (student_id = auth.uid());

-- Lessons: management can view all lessons
CREATE POLICY "Management full access lessons" ON public.lessons
  FOR ALL
  USING (public.is_management_user(auth.uid()));

-- Lesson reports: teacher can insert/update their own
CREATE POLICY "Teacher insert own reports" ON public.lesson_reports
  FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teacher update own reports" ON public.lesson_reports
  FOR UPDATE
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- Lesson reports: teacher can view their own reports
CREATE POLICY "Teacher view own reports" ON public.lesson_reports
  FOR SELECT
  USING (teacher_id = auth.uid());

-- Lesson reports: student can view their own reports (visible ones)
CREATE POLICY "Student view own reports" ON public.lesson_reports
  FOR SELECT
  USING (student_id = auth.uid() AND is_visible_to_student = true);

-- Lesson reports: management can view all
CREATE POLICY "Management full access lesson_reports" ON public.lesson_reports
  FOR ALL
  USING (public.is_management_user(auth.uid()));

-- Attendance: teacher can insert/update their own
CREATE POLICY "Teacher insert own attendance" ON public.attendance
  FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teacher update own attendance" ON public.attendance
  FOR UPDATE
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- Attendance: teacher can view their own
CREATE POLICY "Teacher view own attendance" ON public.attendance
  FOR SELECT
  USING (teacher_id = auth.uid());

-- Attendance: student can view their own
CREATE POLICY "Student view own attendance" ON public.attendance
  FOR SELECT
  USING (student_id = auth.uid());

-- Attendance: management can view all
CREATE POLICY "Management full access attendance" ON public.attendance
  FOR ALL
  USING (public.is_management_user(auth.uid()));

-- Notifications: staff can insert
CREATE POLICY "Staff insert notifications" ON public.notifications
  FOR INSERT
  WITH CHECK (
    public.get_user_role(auth.uid()) IN ('teacher', 'management')
  );

-- Courses: teacher can view their courses
CREATE POLICY "Teacher view own courses" ON public.courses
  FOR SELECT
  USING (teacher_id = auth.uid());

-- Courses: student can view their courses
CREATE POLICY "Student view own courses" ON public.courses
  FOR SELECT
  USING (student_id = auth.uid());

-- Courses: management full access
CREATE POLICY "Management full access courses" ON public.courses
  FOR ALL
  USING (public.is_management_user(auth.uid()));

-- Course enrollments: teacher can view enrollments for their courses
CREATE POLICY "Teacher view course enrollments" ON public.course_enrollments
  FOR SELECT
  USING (
    course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
  );

-- Course enrollments: teacher can create enrollments for their courses
CREATE POLICY "Teacher create course enrollments" ON public.course_enrollments
  FOR INSERT
  WITH CHECK (
    course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
  );

-- Course enrollments: student can view their enrollments
CREATE POLICY "Student view own enrollments" ON public.course_enrollments
  FOR SELECT
  USING (student_id = auth.uid());

-- Course enrollments: management full access
CREATE POLICY "Management full access course_enrollments" ON public.course_enrollments
  FOR ALL
  USING (public.is_management_user(auth.uid()));

-- Course enrollments: management full access
CREATE POLICY "Management full access course_enrollments" ON public.course_enrollments
  FOR ALL
  USING (public.is_management_user(auth.uid()));

-- Student-Teacher Assignments: teacher can view their assignments
CREATE POLICY "Teacher view student assignments" ON public.student_teacher_assignments
  FOR SELECT
  USING (teacher_id = auth.uid());

-- Student-Teacher Assignments: teacher can create assignments for their courses
CREATE POLICY "Teacher create student assignments" ON public.student_teacher_assignments
  FOR INSERT
  WITH CHECK (
    teacher_id = auth.uid()
  );

-- Student-Teacher Assignments: student can view their assignments
CREATE POLICY "Student view teacher assignments" ON public.student_teacher_assignments
  FOR SELECT
  USING (student_id = auth.uid());

-- Student-Teacher Assignments: management full access
CREATE POLICY "Management full access student_teacher_assignments" ON public.student_teacher_assignments
  FOR ALL
  USING (public.is_management_user(auth.uid()));

SELECT 'RLS policies fixed. No more infinite recursion.' as status;