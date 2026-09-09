import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Label } from '@/components/ui/Label';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'react-toastify';

export function TeacherReportForm() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lesson, setLesson] = useState<any>(null);
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
    is_visible_to_student: true
  });

  useEffect(() => {
    fetchLessonData();
  }, [lessonId]);

  const fetchLessonData = async () => {
    const { data, error } = await supabase
      .from('lessons')
      .select(`
        *,
        student:student_id (
          id,
          profile:user_id (full_name)
        ),
        subject:subject_id (*)
      `)
      .eq('id', lessonId)
      .single();

    if (data) {
      setLesson(data);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { data: report, error: reportError } = await supabase
        .from('lesson_reports')
        .insert({
          lesson_id: lessonId,
          student_id: lesson.student_id,
          teacher_id: user?.id,
          attendance_status: formData.attendance_status,
          performance_rating: formData.performance_rating,
          topics_covered: formData.topics_covered,
          what_was_taught: formData.what_was_taught,
          student_performance: formData.student_performance,
          strengths: formData.strengths,
          weaknesses: formData.weaknesses,
          homework: formData.homework,
          teacher_notes: formData.teacher_notes,
          additional_comments: formData.additional_comments,
          next_lesson_plan: formData.next_lesson_plan,
          is_visible_to_student: formData.is_visible_to_student,
          submitted_by: user?.id
        })
        .select()
        .single();

      if (reportError) throw reportError;

      await supabase
        .from('lessons')
        .update({
          status: 'completed',
          attendance_status: formData.attendance_status,
          actual_end_time: new Date().toISOString()
        })
        .eq('id', lessonId);

      await supabase
        .from('attendance')
        .insert({
          student_id: lesson.student_id,
          lesson_id: lessonId,
          teacher_id: user?.id,
          status: formData.attendance_status,
          marked_by: user?.id
        });

      await supabase
        .from('notifications')
        .insert({
          user_id: lesson.student_id,
          type: 'new_report',
          title: 'New Lesson Report Available',
          message: `Your lesson report for ${lesson.title} has been submitted.`,
          link: `/student/reports/${report.id}`
        });

      toast.success('Report submitted successfully!');
      navigate('/teacher');
    } catch (error) {
      toast.error('Failed to submit report');
      console.error('Error submitting report:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Lesson Report</h1>
        <p className="text-muted-foreground">
          {lesson?.title} • {lesson?.student?.profile?.full_name}
        </p>
        <p className="text-sm text-muted-foreground">
          {lesson?.scheduled_date} at {lesson?.start_time} - {lesson?.end_time}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Attendance & Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="attendance_status">Attendance Status</Label>
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
              <div className="space-y-2">
                <Label htmlFor="performance_rating">Performance Rating</Label>
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
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lesson Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="topics_covered">Topics Covered</Label>
              <Textarea
                id="topics_covered"
                placeholder="What topics were covered in this lesson?"
                value={formData.topics_covered}
                onChange={(e) => setFormData({ ...formData, topics_covered: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="what_was_taught">What Was Taught</Label>
              <Textarea
                id="what_was_taught"
                placeholder="Describe what was taught in this lesson"
                value={formData.what_was_taught}
                onChange={(e) => setFormData({ ...formData, what_was_taught: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Student Assessment</CardTitle>
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
            <div className="space-y-2">
              <Label htmlFor="strengths">Strengths</Label>
              <Textarea
                id="strengths"
                placeholder="What are the student's strengths?"
                value={formData.strengths}
                onChange={(e) => setFormData({ ...formData, strengths: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weaknesses">Weaknesses / Areas to Improve</Label>
              <Textarea
                id="weaknesses"
                placeholder="What areas need improvement?"
                value={formData.weaknesses}
                onChange={(e) => setFormData({ ...formData, weaknesses: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Homework & Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="homework">Homework</Label>
              <Textarea
                id="homework"
                placeholder="Assign homework for the next lesson"
                value={formData.homework}
                onChange={(e) => setFormData({ ...formData, homework: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teacher_notes">Teacher Notes</Label>
              <Textarea
                id="teacher_notes"
                placeholder="Additional notes from the teacher"
                value={formData.teacher_notes}
                onChange={(e) => setFormData({ ...formData, teacher_notes: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="additional_comments">Additional Comments</Label>
              <Textarea
                id="additional_comments"
                placeholder="Any additional comments"
                value={formData.additional_comments}
                onChange={(e) => setFormData({ ...formData, additional_comments: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next_lesson_plan">Next Lesson Plan</Label>
              <Textarea
                id="next_lesson_plan"
                placeholder="What should be covered in the next lesson?"
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
          <Button type="button" variant="outline" onClick={() => navigate('/teacher')}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Report'}
          </Button>
        </div>
      </form>
    </div>
  );
}