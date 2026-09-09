import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { supabase } from '@/lib/supabase/client';
import { Course, Lesson, Payment } from '@/types';
import { ArrowLeft, DollarSign, BookOpen, CheckCircle, Clock, XCircle, AlertCircle, UserPlus, Users } from 'lucide-react';
import { CoursePaymentModal } from '@/components/management/CoursePaymentModal';
import { AssignStudentModal } from '@/components/management/AssignStudentModal';
import { toast } from 'react-toastify';

// ── helpers ────────────────────────────────────────────────────────────────────

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatTime(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

const STATUS_VARIANT: Record<string, any> = {
  scheduled: 'info',
  live: 'warning',
  completed: 'success',
  cancelled: 'secondary',
  absent: 'destructive',
};

const PAYMENT_STATUS_VARIANT: Record<string, any> = {
  paid: 'success',
  partial: 'warning',
  unpaid: 'secondary',
  overdue: 'destructive',
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  completed: 'text-green-600',
  pending: 'text-yellow-600',
  failed: 'text-red-600',
  refunded: 'text-muted-foreground',
};

interface EnrolledStudent {
  id: string;
  full_name: string;
}

// ── component ──────────────────────────────────────────────────────────────────

export function CourseDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [studentNames, setStudentNames] = useState<Record<string, string>>({});
  const [teacherName, setTeacherName] = useState('');
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [updatingLesson, setUpdatingLesson] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchAll(id);
  }, [id]);

  const fetchAll = async (courseId: string) => {
    setLoading(true);
    try {
      const [courseRes, lessonsRes, paymentsRes, enrollRes] = await Promise.all([
        supabase.from('courses').select('*').eq('id', courseId).single(),
        supabase
          .from('lessons')
          .select('*')
          .eq('course_id', courseId)
          .order('scheduled_date', { ascending: true })
          .order('start_time', { ascending: true }),
        supabase
          .from('payments')
          .select('*')
          .eq('course_id', courseId)
          .order('payment_date', { ascending: false }),
        supabase
          .from('course_enrollments')
          .select('student_id')
          .eq('course_id', courseId)
          .eq('is_active', true),
      ]);

      if (courseRes.error || !courseRes.data) {
        toast.error('Course not found.');
        navigate('/management/courses');
        return;
      }

      const c: Course = courseRes.data;
      setCourse(c);
      setLessons((lessonsRes.data as Lesson[]) || []);
      setPayments((paymentsRes.data as Payment[]) || []);

      // Enrolled students = the course's primary student + all active enrollments
      const enrolledIds = Array.from(
        new Set<string>([
          c.student_id,
          ...((enrollRes.data || []).map((e: any) => e.student_id as string)),
        ]),
      );

      // Names for every student referenced by an enrollment OR a lesson
      const lessonStudentIds = (lessonsRes.data || []).map((l: any) => l.student_id as string);
      const allStudentIds = Array.from(new Set<string>([...enrolledIds, ...lessonStudentIds]));

      const [profilesRes, teacherRes] = await Promise.all([
        allStudentIds.length > 0
          ? supabase.from('profiles').select('id, full_name').in('id', allStudentIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from('profiles').select('full_name').eq('id', c.teacher_id).single(),
      ]);

      const nameMap: Record<string, string> = {};
      (profilesRes.data || []).forEach((p: any) => { nameMap[p.id] = p.full_name; });

      setStudentNames(nameMap);
      setTeacherName(teacherRes.data?.full_name ?? '-');
      setEnrolledStudents(
        enrolledIds.map(sid => ({ id: sid, full_name: nameMap[sid] ?? '-' })),
      );
    } catch (err) {
      console.error('Error loading course details:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateLessonStatus = async (lessonId: string, newStatus: string) => {
    setUpdatingLesson(lessonId);
    const { error } = await supabase
      .from('lessons')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', lessonId);

    if (error) {
      toast.error('Failed to update lesson status.');
    } else {
      setLessons(prev =>
        prev.map(l => (l.id === lessonId ? { ...l, status: newStatus as Lesson['status'] } : l)),
      );
      toast.success(`Lesson marked as ${newStatus}.`);
    }
    setUpdatingLesson(null);
  };

  const updateCoursePaymentStatus = async (newStatus: string) => {
    if (!course) return;
    const { error } = await supabase
      .from('courses')
      .update({ payment_status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', course.id);
    if (error) {
      toast.error('Failed to update payment status.');
    } else {
      setCourse(prev => prev ? { ...prev, payment_status: newStatus as Course['payment_status'] } : prev);
      toast.success('Payment status updated.');
    }
  };

  const updateCourseStatus = async (newStatus: string) => {
    if (!course) return;
    const { error } = await supabase
      .from('courses')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', course.id);
    if (error) {
      toast.error('Failed to update course status.');
    } else {
      setCourse(prev => prev ? { ...prev, status: newStatus as Course['status'] } : prev);
      toast.success(`Course ${newStatus}.`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading course…
      </div>
    );
  }

  if (!course) return null;

  const completedLessons = lessons.filter(l => l.status === 'completed').length;
  const scheduledLessons = lessons.filter(l => l.status === 'scheduled').length;
  const cancelledLessons = lessons.filter(l => l.status === 'cancelled').length;
  const absentLessons = lessons.filter(l => l.status === 'absent').length;
  const totalLessonCount = lessons.length || course.total_lessons;
  const progress = totalLessonCount > 0
    ? Math.round((completedLessons / totalLessonCount) * 100)
    : 0;

  const totalPaid = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const expectedAmount =
    course.payment_type === 'monthly'
      ? course.monthly_price
      : course.price_per_hour;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/management/courses')}
          aria-label="Back to courses"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2">
            <h1 className="text-3xl font-bold truncate">{course.name}</h1>
            <Badge variant={STATUS_VARIANT[course.status] ?? 'default'}>
              {capitalize(course.status)}
            </Badge>
            <Badge variant={PAYMENT_STATUS_VARIANT[course.payment_status] ?? 'default'}>
              {capitalize(course.payment_status)}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-0.5">
            Teacher: {teacherName} &bull; {enrolledStudents.length} student{enrolledStudents.length === 1 ? '' : 's'} &bull; Started {formatDate(course.start_date)}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {course.status === 'active' && (
            <>
              <Button variant="outline" size="sm" onClick={() => updateCourseStatus('paused')}>
                Pause
              </Button>
              <Button variant="outline" size="sm" className="text-destructive" onClick={() => updateCourseStatus('cancelled')}>
                Cancel
              </Button>
            </>
          )}
          {course.status === 'paused' && (
            <Button variant="outline" size="sm" onClick={() => updateCourseStatus('active')}>
              Resume
            </Button>
          )}
          <Button size="sm" onClick={() => setShowPaymentModal(true)}>
            <DollarSign className="h-4 w-4 mr-1" />
            Record Payment
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Progress</p>
            <p className="text-2xl font-bold tabular-nums">{progress}%</p>
            <div className="h-1.5 mt-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{completedLessons}/{totalLessonCount} lessons</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Upcoming</p>
            <p className="text-2xl font-bold tabular-nums text-blue-600">{scheduledLessons}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Completed</p>
            <p className="text-2xl font-bold tabular-nums text-green-600">{completedLessons}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Absent</p>
            <p className="text-2xl font-bold tabular-nums text-red-600">{absentLessons}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Cancelled</p>
            <p className="text-2xl font-bold tabular-nums text-muted-foreground">{cancelledLessons}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Paid</p>
            <p className="text-2xl font-bold tabular-nums">
              {totalPaid.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">{course.currency}</p>
          </CardContent>
        </Card>
      </div>

      {/* Enrolled Students */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Enrolled Students ({enrolledStudents.length})
            </span>
            <Button size="sm" onClick={() => setShowAssignModal(true)}>
              <UserPlus className="h-4 w-4 mr-1" />
              Assign Student
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {enrolledStudents.map(s => (
              <span
                key={s.id}
                className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-sm"
              >
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center">
                  {s.full_name?.[0]?.toUpperCase() || '?'}
                </span>
                {s.full_name}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Details + Pricing side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Course Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Teacher</span>
              <span className="font-medium">{teacherName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Schedule</span>
              <span className="font-medium">
                {course.preferred_days.map(d => capitalize(d).slice(0, 3)).join(', ')} @ {formatTime(course.preferred_time)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-medium">{course.lesson_duration_minutes} min / lesson</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Frequency</span>
              <span className="font-medium">{course.lessons_per_week}x / week</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lessons / Student</span>
              <span className="font-medium">{course.total_lessons}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Start Date</span>
              <span className="font-medium">{formatDate(course.start_date)}</span>
            </div>
            {course.notes && (
              <div className="pt-2 border-t">
                <p className="text-muted-foreground text-xs mb-1">Notes</p>
                <p>{course.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              Billing
              <div className="flex gap-1">
                {(['paid', 'partial', 'unpaid', 'overdue'] as const).map(s => (
                  <button
                    key={s}
                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                      course.payment_status === s
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-input hover:bg-accent'
                    }`}
                    onClick={() => updateCoursePaymentStatus(s)}
                    aria-pressed={course.payment_status === s}
                    aria-label={`Mark as ${s}`}
                  >
                    {capitalize(s)}
                  </button>
                ))}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment Type</span>
              <span className="font-medium">{capitalize(course.payment_type.replace('_', ' '))}</span>
            </div>
            {expectedAmount && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {course.payment_type === 'monthly' ? 'Monthly Price' : 'Price / Hour'}
                </span>
                <span className="font-medium tabular-nums">
                  {Number(expectedAmount).toFixed(2)} {course.currency}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Paid</span>
              <span className="font-medium tabular-nums text-green-600">
                {totalPaid.toFixed(2)} {course.currency}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payments Recorded</span>
              <span className="font-medium">{payments.filter(p => p.status === 'completed').length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Lessons + Payments */}
      <Tabs defaultValue="lessons">
        <TabsList>
          <TabsTrigger value="lessons">
            <BookOpen className="h-4 w-4 mr-2" />
            Lessons ({lessons.length})
          </TabsTrigger>
          <TabsTrigger value="payments">
            <DollarSign className="h-4 w-4 mr-2" />
            Payments ({payments.length})
          </TabsTrigger>
        </TabsList>

        {/* Lessons tab */}
        <TabsContent value="lessons">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lessons.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No lessons found for this course.
                      </TableCell>
                    </TableRow>
                  ) : (
                    lessons.map(lesson => (
                      <TableRow key={lesson.id}>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {lesson.lesson_number ?? '-'}
                        </TableCell>
                        <TableCell>{formatDate(lesson.scheduled_date)}</TableCell>
                        <TableCell className="tabular-nums">
                          {formatTime(lesson.start_time)}
                        </TableCell>
                        <TableCell className="max-w-[140px] truncate">
                          {studentNames[lesson.student_id] ?? '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[lesson.status] ?? 'default'}>
                            {capitalize(lesson.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {lesson.status === 'scheduled' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-green-600"
                                  disabled={updatingLesson === lesson.id}
                                  onClick={() => updateLessonStatus(lesson.id, 'completed')}
                                  aria-label="Mark completed"
                                  title="Mark completed"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-red-600"
                                  disabled={updatingLesson === lesson.id}
                                  onClick={() => updateLessonStatus(lesson.id, 'absent')}
                                  aria-label="Mark absent"
                                  title="Mark absent"
                                >
                                  <AlertCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-muted-foreground"
                                  disabled={updatingLesson === lesson.id}
                                  onClick={() => updateLessonStatus(lesson.id, 'cancelled')}
                                  aria-label="Cancel lesson"
                                  title="Cancel lesson"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {lesson.status !== 'scheduled' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-muted-foreground"
                                disabled={updatingLesson === lesson.id}
                                onClick={() => updateLessonStatus(lesson.id, 'scheduled')}
                                aria-label="Revert to scheduled"
                                title="Revert to scheduled"
                              >
                                <Clock className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments tab */}
        <TabsContent value="payments">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No payments recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.map(payment => (
                      <TableRow key={payment.id}>
                        <TableCell>{formatDate(payment.payment_date)}</TableCell>
                        <TableCell className="tabular-nums font-medium">
                          {Number(payment.amount).toFixed(2)} {payment.currency}
                        </TableCell>
                        <TableCell>{payment.payment_method ? capitalize(payment.payment_method.replace('_', ' ')) : '-'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {payment.period_start && payment.period_end
                            ? `${formatDate(payment.period_start)} – ${formatDate(payment.period_end)}`
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <span className={`text-sm font-medium ${PAYMENT_STATUS_COLORS[payment.status] ?? ''}`}>
                            {capitalize(payment.status)}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate text-muted-foreground text-sm">
                          {payment.notes || '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CoursePaymentModal
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={() => fetchAll(id!)}
        courseId={course.id}
        studentId={course.student_id}
        currency={course.currency}
        courseName={course.name}
      />

      <AssignStudentModal
        open={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        onSuccess={() => fetchAll(id!)}
        course={{
          id: course.id,
          name: course.name,
          teacher_id: course.teacher_id,
          total_lessons: course.total_lessons,
          lesson_duration_minutes: course.lesson_duration_minutes,
          preferred_days: course.preferred_days,
          preferred_time: course.preferred_time,
          start_date: course.start_date,
        }}
        excludeStudentIds={enrolledStudents.map(s => s.id)}
      />
    </div>
  );
}
