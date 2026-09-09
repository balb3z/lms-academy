import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'react-toastify';
import { CheckCircle, BookOpen } from 'lucide-react';
import { DAY_LABELS, DAY_KEYS, buildCourseLessonRows } from '@/utils/courseSchedule';

// ── types ──────────────────────────────────────────────────────────────────────

interface StudentOption {
  id: string;
  student_id: string;
  full_name: string;
}

interface TeacherOption {
  id: string;
  teacher_id: string;
  full_name: string;
  zoom_link?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'form' | 'success';
type PaymentType = 'per_hour' | 'monthly' | 'per_lesson';

interface FormData {
  name: string;
  student_id: string;
  teacher_id: string;
  total_lessons: number;
  lessons_per_week: number;
  lesson_duration_minutes: number;
  preferred_days: string[];
  preferred_time: string;
  start_date: string;
  payment_type: PaymentType;
  price: string;
  currency: string;
  student_price: string;
  teacher_rate: string;
  notes: string;
}

type FormErrors = Partial<Record<string, string>>;

// ── component ──────────────────────────────────────────────────────────────────

export function AddCourseModal({ open, onClose, onSuccess }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [createdCourseName, setCreatedCourseName] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  const blankForm = (): FormData => ({
    name: '',
    student_id: '',
    teacher_id: '',
    total_lessons: 20,
    lessons_per_week: 2,
    lesson_duration_minutes: 60,
    preferred_days: [],
    preferred_time: '19:00',
    start_date: new Date().toISOString().split('T')[0],
    payment_type: 'monthly',
    price: '',
    currency: 'USD',
    student_price: '',
    teacher_rate: '',
    notes: '',
  });

  const [formData, setFormData] = useState<FormData>(blankForm());

  useEffect(() => {
    if (open) fetchData();
  }, [open]);

  const fetchData = async () => {
    setFetchingData(true);
    try {
      const [studentsRes, teachersRes] = await Promise.all([
        supabase.from('students').select('id, student_id').eq('is_active', true),
        supabase.from('teachers').select('id, teacher_id, zoom_link').eq('is_active', true),
      ]);

      const sIds = (studentsRes.data || []).map((s: any) => s.id);
      const tIds = (teachersRes.data || []).map((t: any) => t.id);

      const [spRes, tpRes] = await Promise.all([
        sIds.length > 0
          ? supabase.from('profiles').select('id, full_name').in('id', sIds)
          : Promise.resolve({ data: [] as any[] }),
        tIds.length > 0
          ? supabase.from('profiles').select('id, full_name').in('id', tIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      setStudents(
        (studentsRes.data || []).map((s: any) => {
          const p = (spRes.data || []).find((x: any) => x.id === s.id);
          return { id: s.id, student_id: s.student_id, full_name: p?.full_name || `Student (${s.student_id})` };
        }),
      );

      setTeachers(
        (teachersRes.data || []).map((t: any) => {
          const p = (tpRes.data || []).find((x: any) => x.id === t.id);
          return { id: t.id, teacher_id: t.teacher_id, full_name: p?.full_name || `Teacher (${t.teacher_id})`, zoom_link: t.zoom_link };
        }),
      );
    } catch (err) {
      console.error('Error fetching course form data:', err);
      toast.error('Failed to load students and teachers.');
    } finally {
      setFetchingData(false);
    }
  };

  const toggleDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      preferred_days: prev.preferred_days.includes(day)
        ? prev.preferred_days.filter(d => d !== day)
        : [...prev.preferred_days, day],
    }));
    setErrors(prev => ({ ...prev, preferred_days: undefined }));
  };

  const clearErr = (key: string) =>
    errors[key] && setErrors(prev => ({ ...prev, [key]: undefined }));

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!formData.name.trim()) e.name = 'Course name is required.';
    if (!formData.student_id) e.student_id = 'Please select a student.';
    if (!formData.teacher_id) e.teacher_id = 'Please select a teacher.';
    if (!formData.preferred_time) e.preferred_time = 'Please set a lesson time.';
    if (!formData.start_date) e.start_date = 'Please set a start date.';
    if (formData.preferred_days.length === 0) e.preferred_days = 'Select at least one day.';
    if (!formData.total_lessons || formData.total_lessons < 1) e.total_lessons = 'Must be at least 1.';
    if (!formData.lesson_duration_minutes || formData.lesson_duration_minutes < 15)
      e.lesson_duration_minutes = 'Minimum 15 minutes.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    try {
      const courseRow: Record<string, any> = {
        name: formData.name.trim(),
        student_id: formData.student_id,
        teacher_id: formData.teacher_id,
        total_lessons: formData.total_lessons,
        lessons_per_week: formData.lessons_per_week,
        lesson_duration_minutes: formData.lesson_duration_minutes,
        preferred_days: formData.preferred_days,
        preferred_time: formData.preferred_time,
        start_date: formData.start_date,
        currency: formData.currency.trim().toUpperCase() || 'USD',
        payment_type: formData.payment_type,
        status: 'active',
        payment_status: 'unpaid',
        created_by: user?.id,
      };

      if (formData.price) {
        const priceNum = parseFloat(formData.price);
        if (!isNaN(priceNum) && priceNum > 0) {
          if (formData.payment_type === 'monthly') {
            courseRow.monthly_price = priceNum;
          } else {
            courseRow.price_per_hour = priceNum;
          }
        }
      }
      if (formData.notes.trim()) courseRow.notes = formData.notes.trim();

      const { data: createdCourse, error: courseError } = await supabase
        .from('courses')
        .insert(courseRow)
        .select('id')
        .single();

      if (courseError) throw courseError;
      const courseId = createdCourse.id;

      // Resolve the teacher's Zoom link + the per-lesson rates
      const selectedTeacher = teachers.find(t => t.id === formData.teacher_id);
      const teacherZoom = selectedTeacher?.zoom_link || null;
      const teacherRateNum =
        formData.teacher_rate && !isNaN(parseFloat(formData.teacher_rate))
          ? parseFloat(formData.teacher_rate)
          : null;
      const studentPriceNum =
        formData.student_price && !isNaN(parseFloat(formData.student_price))
          ? parseFloat(formData.student_price)
          : null;

      // Generate and bulk-insert lessons for the initial student
      const lessonRows = buildCourseLessonRows({
        courseId,
        courseName: formData.name.trim(),
        studentId: formData.student_id,
        teacherId: formData.teacher_id,
        totalLessons: formData.total_lessons,
        preferredDays: formData.preferred_days,
        preferredTime: formData.preferred_time,
        durationMinutes: formData.lesson_duration_minutes,
        startDate: formData.start_date,
        createdBy: user?.id,
        meetingUrl: teacherZoom,
        teacherRate: teacherRateNum,
      });

      for (let i = 0; i < lessonRows.length; i += 50) {
        const batch = lessonRows.slice(i, i + 50);
        const { error: lessonsError } = await supabase.from('lessons').insert(batch);
        if (lessonsError) throw new Error(`Lessons batch ${i}: ${lessonsError.message}`);
      }

      // Connect the flow: register the enrollment + the teacher↔student assignment
      // so the student and teacher dashboards recognise the relationship.
      const { error: enrollError } = await supabase.from('course_enrollments').upsert(
        {
          course_id: courseId,
          student_id: formData.student_id,
          start_date: formData.start_date,
          lessons_generated: lessonRows.length,
          student_price: studentPriceNum,
          teacher_rate: teacherRateNum,
          is_active: true,
          enrolled_by: user?.id,
        },
        { onConflict: 'course_id,student_id', ignoreDuplicates: true },
      );
      if (enrollError) console.error('Enrollment record failed (non-fatal):', enrollError);

      const { error: assignError } = await supabase.from('student_teacher_assignments').upsert(
        {
          student_id: formData.student_id,
          teacher_id: formData.teacher_id,
          assigned_by: user?.id,
          is_active: true,
        },
        { onConflict: 'student_id,teacher_id', ignoreDuplicates: true },
      );
      if (assignError) console.error('Assignment record failed (non-fatal):', assignError);

      setGeneratedCount(lessonRows.length);
      setCreatedCourseName(formData.name.trim());
      setStep('success');
      onSuccess();
      toast.success(`Course created with ${lessonRows.length} lessons scheduled!`);
    } catch (err: any) {
      console.error('Error creating course:', err);
      toast.error(err.message || 'Failed to create course.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('form');
    setFormData(blankForm());
    setErrors({});
    setGeneratedCount(0);
    onClose();
  };

  const priceLabelMap: Record<PaymentType, string> = {
    monthly: 'Monthly Price',
    per_hour: 'Price per Hour',
    per_lesson: 'Price per Lesson',
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* ── FORM STEP ── */}
        {step === 'form' && (
          <>
            <DialogHeader>
              <DialogTitle>Create New Course</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6" noValidate>

              {/* Course Info */}
              <section className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Course Information
                </p>
                <div className="space-y-1">
                  <Label htmlFor="name">
                    Course Name <span className="text-destructive" aria-hidden>*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder="e.g. Quran Recitation — Beginner, Arabic Level 2"
                    value={formData.name}
                    onChange={e => { setFormData(p => ({ ...p, name: e.target.value })); clearErr('name'); }}
                    aria-invalid={!!errors.name}
                  />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="student_id">
                      Student <span className="text-destructive" aria-hidden>*</span>
                    </Label>
                    <select
                      id="student_id"
                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                      value={formData.student_id}
                      onChange={e => { setFormData(p => ({ ...p, student_id: e.target.value })); clearErr('student_id'); }}
                      disabled={fetchingData}
                    >
                      <option value="">
                        {fetchingData ? 'Loading…' : students.length === 0 ? 'No active students' : 'Select student'}
                      </option>
                      {students.map(s => (
                        <option key={s.id} value={s.id}>{s.full_name}</option>
                      ))}
                    </select>
                    {errors.student_id && <p className="text-xs text-destructive">{errors.student_id}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="teacher_id">
                      Teacher <span className="text-destructive" aria-hidden>*</span>
                    </Label>
                    <select
                      id="teacher_id"
                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                      value={formData.teacher_id}
                      onChange={e => { setFormData(p => ({ ...p, teacher_id: e.target.value })); clearErr('teacher_id'); }}
                      disabled={fetchingData}
                    >
                      <option value="">
                        {fetchingData ? 'Loading…' : teachers.length === 0 ? 'No active teachers' : 'Select teacher'}
                      </option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>{t.full_name}</option>
                      ))}
                    </select>
                    {errors.teacher_id && <p className="text-xs text-destructive">{errors.teacher_id}</p>}
                  </div>
                </div>
              </section>

              {/* Schedule */}
              <section className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Schedule
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="total_lessons">Total Lessons</Label>
                    <Input
                      id="total_lessons"
                      type="number"
                      min={1}
                      value={formData.total_lessons}
                      onChange={e => { setFormData(p => ({ ...p, total_lessons: parseInt(e.target.value) || 1 })); clearErr('total_lessons'); }}
                      aria-invalid={!!errors.total_lessons}
                    />
                    {errors.total_lessons && <p className="text-xs text-destructive">{errors.total_lessons}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="lessons_per_week">Per Week</Label>
                    <Input
                      id="lessons_per_week"
                      type="number"
                      min={1}
                      max={7}
                      value={formData.lessons_per_week}
                      onChange={e => setFormData(p => ({ ...p, lessons_per_week: parseInt(e.target.value) || 1 }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="lesson_duration_minutes">Duration (min)</Label>
                    <Input
                      id="lesson_duration_minutes"
                      type="number"
                      min={15}
                      step={15}
                      value={formData.lesson_duration_minutes}
                      onChange={e => { setFormData(p => ({ ...p, lesson_duration_minutes: parseInt(e.target.value) || 60 })); clearErr('lesson_duration_minutes'); }}
                      aria-invalid={!!errors.lesson_duration_minutes}
                    />
                    {errors.lesson_duration_minutes && <p className="text-xs text-destructive">{errors.lesson_duration_minutes}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="preferred_time">
                      Time <span className="text-destructive" aria-hidden>*</span>
                    </Label>
                    <Input
                      id="preferred_time"
                      type="time"
                      value={formData.preferred_time}
                      onChange={e => { setFormData(p => ({ ...p, preferred_time: e.target.value })); clearErr('preferred_time'); }}
                      aria-invalid={!!errors.preferred_time}
                    />
                    {errors.preferred_time && <p className="text-xs text-destructive">{errors.preferred_time}</p>}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>
                    Weekly Days <span className="text-destructive" aria-hidden>*</span>
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {DAY_LABELS.map((day, i) => {
                      const key = DAY_KEYS[i];
                      const checked = formData.preferred_days.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleDay(key)}
                          className={`px-3 py-1.5 rounded-full text-sm border font-medium transition-colors ${
                            checked
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-input hover:bg-accent'
                          }`}
                          aria-pressed={checked}
                        >
                          {day.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                  {errors.preferred_days && <p className="text-xs text-destructive">{errors.preferred_days}</p>}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="start_date">
                    Start Date <span className="text-destructive" aria-hidden>*</span>
                  </Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={e => { setFormData(p => ({ ...p, start_date: e.target.value })); clearErr('start_date'); }}
                    className="max-w-xs"
                    aria-invalid={!!errors.start_date}
                  />
                  {errors.start_date && <p className="text-xs text-destructive">{errors.start_date}</p>}
                </div>
              </section>

              {/* Pricing */}
              <section className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Pricing
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="payment_type">Payment Type</Label>
                    <select
                      id="payment_type"
                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                      value={formData.payment_type}
                      onChange={e => setFormData(p => ({ ...p, payment_type: e.target.value as PaymentType }))}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="per_hour">Per Hour</option>
                      <option value="per_lesson">Per Lesson</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="price">{priceLabelMap[formData.payment_type]}</Label>
                    <Input
                      id="price"
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                      value={formData.price}
                      onChange={e => setFormData(p => ({ ...p, price: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="currency">Currency</Label>
                    <Input
                      id="currency"
                      placeholder="USD"
                      maxLength={3}
                      value={formData.currency}
                      onChange={e => setFormData(p => ({ ...p, currency: e.target.value.toUpperCase() }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="student_price">Student Price / lesson</Label>
                    <Input
                      id="student_price"
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                      value={formData.student_price}
                      onChange={e => setFormData(p => ({ ...p, student_price: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="teacher_rate">Teacher Rate / lesson</Label>
                    <Input
                      id="teacher_rate"
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                      value={formData.teacher_rate}
                      onChange={e => setFormData(p => ({ ...p, teacher_rate: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      The teacher earns this amount for each completed lesson.
                    </p>
                  </div>
                </div>
              </section>

              {/* Notes */}
              <div className="space-y-1">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes about the course"
                  value={formData.notes}
                  onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading || fetchingData}>
                  {loading ? 'Creating Course…' : 'Create Course & Schedule Lessons'}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}

        {/* ── SUCCESS STEP ── */}
        {step === 'success' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" aria-hidden />
                Course Created
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <BookOpen className="h-8 w-8 text-primary mt-0.5 shrink-0" aria-hidden />
                  <div>
                    <p className="font-semibold">{createdCourseName}</p>
                    <p className="text-sm text-muted-foreground">
                      {generatedCount} lessons automatically scheduled
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  All lessons are now assigned to the student and teacher and visible on their
                  dashboards and calendars. You can assign more students or reschedule individual
                  lessons from the course detail page.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
