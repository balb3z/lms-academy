-- ─────────────────────────────────────────────────────────────────────────────
-- 1. COURSES TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    total_lessons INTEGER NOT NULL DEFAULT 20,
    lessons_per_week INTEGER NOT NULL DEFAULT 2,
    lesson_duration_minutes INTEGER NOT NULL DEFAULT 60,
    preferred_days TEXT[] NOT NULL DEFAULT '{}',
    preferred_time TIME NOT NULL,
    start_date DATE NOT NULL,
    price_per_hour NUMERIC(10, 2),
    monthly_price NUMERIC(10, 2),
    currency TEXT NOT NULL DEFAULT 'USD',
    payment_type TEXT NOT NULL DEFAULT 'monthly'
        CHECK (payment_type IN ('per_hour', 'monthly', 'per_lesson')),
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
    payment_status TEXT NOT NULL DEFAULT 'unpaid'
        CHECK (payment_status IN ('paid', 'unpaid', 'partial', 'overdue')),
    notes TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PAYMENTS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT CHECK (payment_method IN ('cash', 'bank_transfer', 'card', 'online', 'other')),
    period_start DATE,
    period_end DATE,
    status TEXT NOT NULL DEFAULT 'completed'
        CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    notes TEXT,
    recorded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ALTER LESSONS
--    • course_id links a generated lesson back to its course
--    • lesson_number tracks position within the course (1-of-20, etc.)
--    • subject_id made nullable so course lessons don't require a subject
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.lessons
    ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL;

ALTER TABLE public.lessons
    ADD COLUMN IF NOT EXISTS lesson_number INTEGER;

ALTER TABLE public.lessons
    ALTER COLUMN subject_id DROP NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. INDEXES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_courses_student_id    ON public.courses(student_id);
CREATE INDEX IF NOT EXISTS idx_courses_teacher_id    ON public.courses(teacher_id);
CREATE INDEX IF NOT EXISTS idx_courses_status        ON public.courses(status);
CREATE INDEX IF NOT EXISTS idx_courses_payment_status ON public.courses(payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_course_id    ON public.payments(course_id);
CREATE INDEX IF NOT EXISTS idx_payments_student_id   ON public.payments(student_id);
CREATE INDEX IF NOT EXISTS idx_lessons_course_id     ON public.lessons(course_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.courses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Management: full access
CREATE POLICY "Management full access courses"
    ON public.courses FOR ALL
    USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'management'));

CREATE POLICY "Management full access payments"
    ON public.payments FOR ALL
    USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'management'));

-- Teachers: read their own courses
CREATE POLICY "Teacher view own courses"
    ON public.courses FOR SELECT
    USING (auth.uid() = teacher_id);

-- Students: read their own courses
CREATE POLICY "Student view own courses"
    ON public.courses FOR SELECT
    USING (auth.uid() = student_id);

-- Students: read their own payments
CREATE POLICY "Student view own payments"
    ON public.payments FOR SELECT
    USING (auth.uid() = student_id);
