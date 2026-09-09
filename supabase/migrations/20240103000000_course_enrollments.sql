-- ─────────────────────────────────────────────────────────────────────────────
-- COURSE ENROLLMENTS
-- Allows multiple students to be assigned to a single course without creating
-- a new course. Each enrollment gets its own generated lessons (a lesson is
-- always one student + one teacher).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.course_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    start_date DATE,
    lessons_generated INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    enrolled_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(course_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_course_enrollments_course_id  ON public.course_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_student_id ON public.course_enrollments(student_id);

ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;

-- Management: full access
CREATE POLICY "Management full access course_enrollments"
    ON public.course_enrollments FOR ALL
    USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'management'));

-- Teachers: read enrollments for courses they teach
CREATE POLICY "Teacher view course_enrollments"
    ON public.course_enrollments FOR SELECT
    USING (
        course_id IN (SELECT id FROM public.courses WHERE teacher_id = auth.uid())
    );

-- Students: read their own enrollments
CREATE POLICY "Student view own course_enrollments"
    ON public.course_enrollments FOR SELECT
    USING (auth.uid() = student_id);
