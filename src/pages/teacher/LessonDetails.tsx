import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase/client';
import { Lesson, LessonReport } from '@/types';
import { formatDate, formatTime } from '@/utils/format';
import { ArrowLeft, Calendar, Clock, Video, BookOpen, ClipboardList, Award } from 'lucide-react';
import { toast } from 'react-toastify';

const RATING_LABEL: Record<string, string> = {
  excellent: 'Excellent',
  very_good: 'Very Good',
  good: 'Good',
  needs_improvement: 'Needs Improvement',
};

type BadgeVariant = 'success' | 'info' | 'warning' | 'destructive' | 'secondary' | 'default';

const RATING_VARIANT: Record<string, BadgeVariant> = {
  excellent: 'success',
  very_good: 'success',
  good: 'info',
  needs_improvement: 'warning',
};

export function TeacherLessonDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [report, setReport] = useState<LessonReport | null>(null);
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [zoomLink, setZoomLink] = useState<string | null>(null);
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

      const [subjectRes, studentProfileRes, studentUserRes, teacherRes, reportRes] = await Promise.all([
        data.subject_id
          ? supabase.from('subjects').select('id, name, color').eq('id', data.subject_id).single()
          : Promise.resolve({ data: null }),
        supabase.from('profiles').select('full_name').eq('id', data.student_id).single(),
        supabase.from('users').select('email').eq('id', data.student_id).single(),
        supabase.from('teachers').select('zoom_link').eq('id', data.teacher_id).single(),
        supabase
          .from('lesson_reports')
          .select('*')
          .eq('lesson_id', id)
          .order('submitted_at', { ascending: false })
          .limit(1),
      ]);

      setLesson(prev => (prev ? { ...prev, subject: subjectRes.data || undefined } : prev));
      setStudentName(studentProfileRes.data?.full_name || 'Student');
      setStudentEmail(studentUserRes.data?.email || '');
      setZoomLink(teacherRes.data?.zoom_link || null);
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

  const resolveLink = () => zoomLink || lesson?.meeting_url || null;

  const handleStartLesson = async () => {
    if (!lesson) return;
    const link = resolveLink();
    if (!link) {
      toast.error('No Zoom link set. Ask management to add your personal Zoom link.');
      return;
    }

    const { data, error } = await supabase
      .from('lessons')
      .update({ status: 'live', actual_start_time: new Date().toISOString() })
      .eq('id', id)
      .select('id');

    if (error || !data || data.length === 0) {
      toast.error('Could not start the lesson.');
      return;
    }
    window.open(link, '_blank', 'noopener,noreferrer');
    fetchLesson();
  };

  const handleJoin = () => {
    const link = resolveLink();
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
    else toast.error('No Zoom link set.');
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
        <Button variant="outline" size="icon" onClick={() => navigate('/teacher/lessons')} aria-label="Back">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Student</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <p className="font-medium">{studentName}</p>
              <p className="text-sm text-muted-foreground">{studentEmail}</p>
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

        {/* Report card - same data teacher submitted, student sees, management sees */}
        {report ? (
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
                    ? <Badge variant={RATING_VARIANT[report.performance_rating] ?? 'default'}>
                        {RATING_LABEL[report.performance_rating] ?? report.performance_rating}
                      </Badge>
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
        ) : lesson.status === 'completed' ? (
          <Card className="md:col-span-2">
            <CardContent className="py-6 text-center text-muted-foreground">
              This lesson is completed. The report is not available yet.
            </CardContent>
          </Card>
        ) : null}

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            {lesson.status === 'scheduled' && (
              <Button onClick={handleStartLesson}>
                <Video className="h-4 w-4 mr-2" />
                Start Meeting
              </Button>
            )}
            {lesson.status === 'live' && (
              <>
                <Button variant="outline" onClick={handleJoin}>
                  <Video className="h-4 w-4 mr-2" />
                  Join Meeting
                </Button>
                <Button onClick={() => navigate(`/teacher/lessons/${id}/report`)}>
                  End Meeting
                </Button>
              </>
            )}
            {lesson.status === 'completed' && (
              <Button variant="outline" disabled>
                Lesson Completed
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}