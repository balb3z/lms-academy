-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('management', 'teacher', 'student')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PROFILES TABLE
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    phone TEXT,
    date_of_birth DATE,
    address TEXT,
    bio TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. STUDENTS TABLE
CREATE TABLE public.students (
    id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    student_id TEXT UNIQUE NOT NULL,
    enrollment_date DATE DEFAULT CURRENT_DATE,
    course TEXT,
    grade_level TEXT,
    parent_name TEXT,
    parent_email TEXT,
    parent_phone TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TEACHERS TABLE
CREATE TABLE public.teachers (
    id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    teacher_id TEXT UNIQUE NOT NULL,
    specialization TEXT,
    qualification TEXT,
    years_of_experience INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. SUBJECTS TABLE
CREATE TABLE public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT DEFAULT '#3B82F6',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. STUDENT_TEACHER_ASSIGNMENTS TABLE
CREATE TABLE public.student_teacher_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES public.users(id),
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    UNIQUE(student_id, teacher_id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. LESSONS TABLE
CREATE TABLE public.lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id),
    title TEXT NOT NULL,
    description TEXT,
    scheduled_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL,
    meeting_platform TEXT DEFAULT 'zoom',
    meeting_url TEXT,
    meeting_id TEXT,
    meeting_password TEXT,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled', 'absent')),
    attendance_status TEXT CHECK (attendance_status IN ('present', 'late', 'absent', 'excused', 'not_marked')),
    actual_start_time TIMESTAMPTZ,
    actual_end_time TIMESTAMPTZ,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_rule TEXT,
    notes TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. LESSON_REPORTS TABLE
CREATE TABLE public.lesson_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    attendance_status TEXT NOT NULL CHECK (attendance_status IN ('present', 'late', 'absent', 'excused')),
    performance_rating TEXT CHECK (performance_rating IN ('excellent', 'very_good', 'good', 'needs_improvement')),
    topics_covered TEXT,
    what_was_taught TEXT,
    student_performance TEXT,
    strengths TEXT,
    weaknesses TEXT,
    homework TEXT,
    teacher_notes TEXT,
    additional_comments TEXT,
    next_lesson_plan TEXT,
    is_visible_to_student BOOLEAN DEFAULT TRUE,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. ATTENDANCE TABLE
CREATE TABLE public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('present', 'late', 'absent', 'excused')),
    marked_by UUID REFERENCES public.users(id),
    marked_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(lesson_id, student_id)
);

-- 10. NOTIFICATIONS TABLE
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('lesson_reminder', 'lesson_starting', 'lesson_rescheduled', 'lesson_cancelled', 'new_report', 'new_homework', 'missed_lesson', 'attendance_marked', 'system')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. ACTIVITY_LOGS TABLE
CREATE TABLE public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. ACADEMY_SETTINGS TABLE
CREATE TABLE public.academy_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES public.users(id)
);

-- CREATE INDEXES
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_lessons_student_id ON public.lessons(student_id);
CREATE INDEX idx_lessons_teacher_id ON public.lessons(teacher_id);
CREATE INDEX idx_lessons_scheduled_date ON public.lessons(scheduled_date);
CREATE INDEX idx_lessons_status ON public.lessons(status);
CREATE INDEX idx_assignments_student_id ON public.student_teacher_assignments(student_id);
CREATE INDEX idx_assignments_teacher_id ON public.student_teacher_assignments(teacher_id);
CREATE INDEX idx_attendance_student_id ON public.attendance(student_id);
CREATE INDEX idx_attendance_lesson_id ON public.attendance(lesson_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX idx_lesson_reports_lesson_id ON public.lesson_reports(lesson_id);

-- ROW LEVEL SECURITY POLICIES
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_settings ENABLE ROW LEVEL SECURITY;

-- MANAGEMENT POLICIES
CREATE POLICY "Management full access" ON public.users FOR ALL USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'management'));
CREATE POLICY "Management full access profiles" ON public.profiles FOR ALL USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'management'));
CREATE POLICY "Management full access students" ON public.students FOR ALL USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'management'));
CREATE POLICY "Management full access teachers" ON public.teachers FOR ALL USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'management'));
CREATE POLICY "Management full access assignments" ON public.student_teacher_assignments FOR ALL USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'management'));
CREATE POLICY "Management full access lessons" ON public.lessons FOR ALL USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'management'));
CREATE POLICY "Management full access reports" ON public.lesson_reports FOR ALL USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'management'));
CREATE POLICY "Management full access attendance" ON public.attendance FOR ALL USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'management'));
CREATE POLICY "Management full access notifications" ON public.notifications FOR ALL USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'management'));
CREATE POLICY "Management full access settings" ON public.academy_settings FOR ALL USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'management'));

-- TEACHER POLICIES
CREATE POLICY "Teacher view assigned students" ON public.students FOR SELECT USING (
    auth.uid() IN (SELECT teacher_id FROM public.student_teacher_assignments WHERE student_id = id) OR
    auth.uid() IN (SELECT id FROM public.users WHERE role = 'management')
);
CREATE POLICY "Teacher view own lessons" ON public.lessons FOR SELECT USING (
    auth.uid() = teacher_id OR auth.uid() IN (SELECT id FROM public.users WHERE role = 'management')
);
CREATE POLICY "Teacher view own reports" ON public.lesson_reports FOR SELECT USING (
    auth.uid() = teacher_id OR auth.uid() IN (SELECT id FROM public.users WHERE role = 'management')
);
CREATE POLICY "Teacher view own attendance" ON public.attendance FOR SELECT USING (
    auth.uid() = teacher_id OR auth.uid() IN (SELECT id FROM public.users WHERE role = 'management')
);
CREATE POLICY "Teacher view own notifications" ON public.notifications FOR SELECT USING (
    auth.uid() = user_id OR auth.uid() IN (SELECT id FROM public.users WHERE role = 'management')
);

-- STUDENT POLICIES
CREATE POLICY "Student view own data" ON public.students FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Student view own lessons" ON public.lessons FOR SELECT USING (
    auth.uid() = student_id OR auth.uid() IN (SELECT id FROM public.users WHERE role = 'management')
);
CREATE POLICY "Student view own reports" ON public.lesson_reports FOR SELECT USING (
    auth.uid() = student_id OR auth.uid() IN (SELECT id FROM public.users WHERE role = 'management')
);
CREATE POLICY "Student view own attendance" ON public.attendance FOR SELECT USING (
    auth.uid() = student_id OR auth.uid() IN (SELECT id FROM public.users WHERE role = 'management')
);
CREATE POLICY "Student view own notifications" ON public.notifications FOR SELECT USING (
    auth.uid() = user_id
);

-- INSERT DEFAULT SUBJECTS
INSERT INTO public.subjects (name, description, color) VALUES
('Quran', 'Holy Quran recitation and memorization', '#22C55E'),
('Arabic', 'Arabic language and grammar', '#3B82F6'),
('Islamic Studies', 'Islamic studies and teachings', '#8B5CF6'),
('Tafsir', 'Quran interpretation and explanation', '#EC4899'),
('Hadith', 'Prophetic traditions and sayings', '#F59E0B')
ON CONFLICT (name) DO NOTHING;