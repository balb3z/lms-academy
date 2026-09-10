import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Label } from '@/components/ui/Label';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'react-toastify';
import { CheckCircle, ArrowLeft } from 'lucide-react';

export function TeacherReportForm() {
  // Route is /teacher/lessons/:id/report → the param is `id`.
  const { id: lessonId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [lesson, setLesson] = useState<any>(null);
  const [studentName, setStudentName] = useState('');
  const [errors, setErrors] = useState<{ topics_covered?: string; homework?: string }>({});

  const [formData, setFormData] = useState({
    attendance_status: 'present',
    performance_rating: 'good',
    topics_covered: '',
    what_was_taught: '',
    student_performance: '',
    strengths: '',
    weaknesses: '',
    homework: '',
    teacher_notes: '',
    additional_comments: '',
    next_lesson_plan: '',
    is_visible_to_student: true,
  });

  useEffect(() => {
    if (lessonId) fetchLessonData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  const fetchLessonData = async () => {
    setLoading(true);
    try {
      const [lessonRes, existingRes] = await Promise.all([
        supabase.from('lessons').select('*').eq('id', lessonId).single(),
        supabase.from('lesson_reports').select('id').eq('lesson_id', lessonId).limit(1),
      ]);

      if (lessonRes.error || !lessonRes.data) {
        toast.error('Lesson not found.');
        navigate('/teacher');
        return;
      }

      const l = lessonRes.data;
      setLesson(l);

      // Already completed or already reported → block a second submission
      if (l.status === 'completed' || (existingRes.data && existingRes.data.length > 0)) {
        setAlreadyDone(true);
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', l.student_id)
        .single();
      setStudentName(profile?.full_name || 'Student');
    } catch (err) {
      console.error('Error loading lesson:', err);
      toast.error('Failed to load lesson.');
    } finally {
      setLoading(false);
    }
  };

  const validate = () => {
    const next: { topics_covered?: string; homework?: string } = {};
    if (!formData.topics_covered.trim()) next.topics_covered = 'Please describe what was covered.';
    if (!formData.homework.trim()) next.homework = 'Please enter the homework / what to submit.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lesson) return;
    if (!validate()) {
      toast.error('Please complete the required fields before ending the meeting.');
      return;
    }
    setSubmitting(true);

    try {
      // 1. Save the lesson report (visible to the student)
      const { data: report, error: reportError } = await supabase
        .from('lesson_reports')
        .insert({
          lesson_id: lessonId,
          student_id: lesson.student_id,
          teacher_id: user?.id,
          attendance_status: formData.attendance_status,
          performance_rating: formData.performance_rating,
          topics_covered: formData.topics_covered.trim(),
          what_was_taught: formData.what_was_taught.trim() || null,
          student_performance: formData.student_performance.trim() || null,
          strengths: formData.strengths.trim() || null,
          weaknesses: formData.weaknesses.trim() || null,
          homework: formData.homework.trim(),
          teacher_notes: formData.teacher_notes.trim() || null,
          additional_comments: formData.additional_comments.trim() || null,
          next_lesson_plan: formData.next_lesson_plan.trim() || null,
          is_visible_to_student: formData.is_visible_to_student,
          submitted_by: user?.id,
        })
        .select()
        .single();

      if (reportError) throw new Error(`Report: ${reportError.message}`);

      // If the lesson has no stamped teacher_rate yet (e.g. it was generated
      // before rates existed), pull it from the course enrollment so the
      // teacher's earnings actually update on completion.
      let teacherRate = lesson.teacher_rate ?? null;
      if (teacherRate === null && lesson.course_id) {
        const { data: enrollment } = await supabase
          .from('course_enrollments')
          .select('teacher_rate')
          .eq('course_id', lesson.course_id)
          .eq('student_id', lesson.student_id)
          .maybeSingle();
        if (enrollment?.teacher_rate != null) teacherRate = Number(enrollment.teacher_rate);
      }

      // 2. Complete the lesson — this drives teacher earnings + student progress.
      //    We .select() so a silent RLS no-op is detected instead of ignored.
      const { data: updatedLesson, error: lessonError } = await supabase
        .from('lessons')
        .update({
          status: 'completed',
          attendance_status: formData.attendance_status,
          actual_end_time: new Date().toISOString(),
          teacher_rate: teacherRate,
        })
        .eq('id', lessonId)
        .select('id');

      if (lessonError) throw new Error(`Lesson: ${lessonError.message}`);
      if (!updatedLesson || updatedLesson.length === 0) {
        throw new Error('Could not complete the lesson (permission denied). Ensure the teacher RLS migration has been applied.');
      }

      // 3. Record attendance (idempotent on the unique lesson+student pair)
      const { error: attendanceError } = await supabase
        .from('attendance')
        .upsert(
          {
            student_id: lesson.student_id,
            lesson_id: lessonId,
            teacher_id: user?.id,
            status: formData.attendance_status,
            marked_by: user?.id,
            marked_at: new Date().toISOString(),
          },
          { onConflict: 'lesson_id,student_id' },
        );
      if (attendanceError) console.error('Attendance save failed (non-fatal):', attendanceError);

      // 4. Notify the student (non-fatal if it fails)
      try {
        await supabase.from('notifications').insert({
          user_id: lesson.student_id,
          type: 'new_report',
          title: 'Lesson completed — report available',
          message: `Your report for "${lesson.title}" is ready. Grade: ${formData.performance_rating.replace('_', ' ')}.`,
          link: `/student/lessons/${lessonId}`,
        });
      } catch (notifyErr) {
        console.error('Notification failed (non-fatal):', notifyErr);
      }

      toast.success('Meeting ended and report submitted. Lesson marked completed.');
      navigate('/teacher');
      return report;
    } catch (error: any) {
      console.error('Error submitting report:', error);
      toast.error(error.message || 'Failed to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (alreadyDone) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardContent className="py-10 text-center space-y-4">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <div>
              <h1 className="text-2xl font-bold">Lesson Already Completed</h1>
              <p className="text-muted-foreground mt-1">
                A report for "{lesson?.title}" has already been submitted.
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={() => navigate('/teacher')}>
                Back to Dashboard
              </Button>
              <Button onClick={() => navigate('/teacher/lessons')}>My Lessons</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">End Meeting — Lesson Report</h1>
          <p className="text-muted-foreground">
            {lesson?.title} • {studentName}
          </p>
          <p className="text-sm text-muted-foreground">
            {lesson?.scheduled_date} at {lesson?.start_time} - {lesson?.end_time}
          </p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground border-l-2 border-primary/40 pl-3">
        Complete the required fields below. The lesson is only marked <strong>Completed</strong> after you submit this report.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {/* Required: grade / performance */}
        <Card>
          <CardHeader>
            <CardTitle>Grade &amp; Attendance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="performance_rating">
                  Grade / Performance <span className="text-destructive" aria-hidden>*</span>
                </Label>
                <select
                  id="performance_rating"
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2"
                  value={formData.performance_rating}
                  onChange={(e) => setFormData({ ...formData, performance_rating: e.target.value })}
                >
                  <option value="excellent">Excellent</option>
                  <option value="very_good">Very Good</option>
                  <option value="good">Good</option>
                  <option value="needs_improvement">Needs Improvement</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="attendance_status">Attendance</Label>
                <select
                  id="attendance_status"
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2"
                  value={formData.attendance_status}
                  onChange={(e) => setFormData({ ...formData, attendance_status: e.target.value })}
                >
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                  <option value="excused">Excused</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Required: what was covered */}
        <Card>
          <CardHeader>
            <CardTitle>What Was Covered</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="topics_covered">
                Topics Covered <span className="text-destructive" aria-hidden>*</span>
              </Label>
              <Textarea
                id="topics_covered"
                placeholder="What was covered in this lesson?"
                value={formData.topics_covered}
                onChange={(e) => {
                  setFormData({ ...formData, topics_covered: e.target.value });
                  if (errors.topics_covered) setErrors((p) => ({ ...p, topics_covered: undefined }));
                }}
                aria-invalid={!!errors.topics_covered}
              />
              {errors.topics_covered && <p className="text-xs text-destructive">{errors.topics_covered}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="what_was_taught">Additional Detail (optional)</Label>
              <Textarea
                id="what_was_taught"
                placeholder="Any extra detail about what was taught"
                value={formData.what_was_taught}
                onChange={(e) => setFormData({ ...formData, what_was_taught: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Required: homework */}
        <Card>
          <CardHeader>
            <CardTitle>Homework / To-Submit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="homework">
                Homework <span className="text-destructive" aria-hidden>*</span>
              </Label>
              <Textarea
                id="homework"
                placeholder="What should the student prepare or submit before the next lesson?"
                value={formData.homework}
                onChange={(e) => {
                  setFormData({ ...formData, homework: e.target.value });
                  if (errors.homework) setErrors((p) => ({ ...p, homework: undefined }));
                }}
                aria-invalid={!!errors.homework}
              />
              {errors.homework && <p className="text-xs text-destructive">{errors.homework}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Optional assessment */}
        <Card>
          <CardHeader>
            <CardTitle>Assessment &amp; Notes (optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="student_performance">Student Performance</Label>
              <Textarea
                id="student_performance"
                placeholder="How did the student perform?"
                value={formData.student_performance}
                onChange={(e) => setFormData({ ...formData, student_performance: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="strengths">Strengths</Label>
                <Textarea
                  id="strengths"
                  placeholder="Student's strengths"
                  value={formData.strengths}
                  onChange={(e) => setFormData({ ...formData, strengths: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weaknesses">Areas to Improve</Label>
                <Textarea
                  id="weaknesses"
                  placeholder="Areas that need improvement"
                  value={formData.weaknesses}
                  onChange={(e) => setFormData({ ...formData, weaknesses: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="next_lesson_plan">Next Lesson Plan</Label>
              <Textarea
                id="next_lesson_plan"
                placeholder="What should be covered next time?"
                value={formData.next_lesson_plan}
                onChange={(e) => setFormData({ ...formData, next_lesson_plan: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="is_visible_to_student"
            checked={formData.is_visible_to_student}
            onChange={(e) => setFormData({ ...formData, is_visible_to_student: e.target.checked })}
            className="h-4 w-4 rounded border-input"
          />
          <Label htmlFor="is_visible_to_student">Make this report visible to the student</Label>
        </div>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit & Complete Lesson'}
          </Button>
        </div>
      </form>
    </div>
  );
}
