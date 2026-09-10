import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase/client';
import { Lesson, LessonReport } from '@/types';
import { formatDate, formatTime } from '@/utils/format';
import { ArrowLeft, Calendar, Clock, Video, BookOpen, ClipboardList, Award } from 'lucide-react';

const RATING_LABEL: Record<string, string> = {
  excellent: 'Excellent',
  very_good: 'Very Good',
  good: 'Good',
  needs_improvement: 'Needs Improvement',
};

export function LessonDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [report, setReport] = useState<LessonReport | null>(null);
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchLesson();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchLesson = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('lessons').select('*').eq('id', id).single();
      if (error || !data) {
        setLesson(null);
        setLoading(false);
        return;
      }
      setLesson(data);

      const [subjectRes, profilesRes, usersRes, reportRes] = await Promise.all([
        data.subject_id
          ? supabase.from('subjects').select('id, name').eq('id', data.subject_id).single()
          : Promise.resolve({ data: null }),
        supabase.from('profiles').select('id, full_name').in('id', [data.student_id, data.teacher_id]),
        supabase.from('users').select('id, email').in('id', [data.student_id, data.teacher_id]),
        supabase
          .from('lesson_reports')
          .select('*')
          .eq('lesson_id', id)
          .order('submitted_at', { ascending: false })
          .limit(1),
      ]);

      const nameById: Record<string, string> = {};
      (profilesRes.data || []).forEach((p: { id: string; full_name: string }) => { nameById[p.id] = p.full_name; });
      const emailById: Record<string, string> = {};
      (usersRes.data || []).forEach((u: { id: string; email: string }) => { emailById[u.id] = u.email; });

      setLesson(prev => (prev ? { ...prev, subject: subjectRes.data || undefined } : prev));
      setStudentName(nameById[data.student_id] || '-');
      setStudentEmail(emailById[data.student_id] || '');
      setTeacherName(nameById[data.teacher_id] || '-');
      setTeacherEmail(emailById[data.teacher_id] || '');
      setReport(((reportRes.data as LessonReport[]) || [])[0] || null);
    } catch (err) {
      console.error('Error loading lesson:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'scheduled': return 'info';
      case 'live': return 'warning';
      case 'completed': return 'success';
      case 'cancelled': return 'destructive';
      case 'absent': return 'secondary';
      default: return 'default';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (!lesson) {
    return <div>Lesson not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/management/lessons')} aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{lesson.title}</h1>
          <p className="text-muted-foreground">Lesson Details</p>
        </div>
        <Badge variant={getStatusVariant(lesson.status)} className="ml-auto">
          {lesson.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Lesson Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{formatDate(lesson.scheduled_date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{formatTime(lesson.start_time)} - {formatTime(lesson.end_time)}</span>
            </div>
            {lesson.subject?.name && (
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <span>Subject: {lesson.subject.name}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-muted-foreground" />
              <span>Platform: {lesson.meeting_platform}</span>
            </div>
            {lesson.meeting_url && (
              <div>
                <Button variant="outline" size="sm" onClick={() => window.open(lesson.meeting_url, '_blank', 'noopener,noreferrer')}>
                  Open Meeting Link
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Participants</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Student</p>
              <p className="font-medium">{studentName}</p>
              <p className="text-sm text-muted-foreground">{studentEmail}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Teacher</p>
              <p className="font-medium">{teacherName}</p>
              <p className="text-sm text-muted-foreground">{teacherEmail}</p>
            </div>
          </CardContent>
        </Card>

        {lesson.notes && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{lesson.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Same report the teacher submitted and the student sees */}
        {report && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Lesson Report
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Grade:</span>
                  {report.performance_rating
                    ? <Badge variant="info">{RATING_LABEL[report.performance_rating] ?? report.performance_rating}</Badge>
                    : <span className="text-sm">-</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Attendance:</span>
                  <Badge variant="secondary">{report.attendance_status}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Visible to student:</span>
                  <Badge variant={report.is_visible_to_student ? 'success' : 'secondary'}>
                    {report.is_visible_to_student ? 'Yes' : 'No'}
                  </Badge>
                </div>
              </div>

              {report.topics_covered && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">What Was Covered</p>
                  <p className="whitespace-pre-wrap text-sm">{report.topics_covered}</p>
                </div>
              )}

              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Homework / To-Submit</p>
                <p className="whitespace-pre-wrap text-sm">{report.homework || 'No homework assigned.'}</p>
              </div>

              {(report.student_performance || report.strengths || report.weaknesses || report.next_lesson_plan) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {report.student_performance && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Performance</p>
                      <p className="whitespace-pre-wrap text-sm">{report.student_performance}</p>
                    </div>
                  )}
                  {report.strengths && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Strengths</p>
                      <p className="whitespace-pre-wrap text-sm">{report.strengths}</p>
                    </div>
                  )}
                  {report.weaknesses && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Areas to Improve</p>
                      <p className="whitespace-pre-wrap text-sm">{report.weaknesses}</p>
                    </div>
                  )}
                  {report.next_lesson_plan && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Next Lesson Plan</p>
                      <p className="whitespace-pre-wrap text-sm">{report.next_lesson_plan}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
