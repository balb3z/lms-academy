import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase/client';
import { Lesson, LessonReport } from '@/types';
import { formatDate, formatTime } from '@/utils/format';
import { formatTimeInTimezone, formatDateInTimezone } from '@/utils/timezone';
import { ArrowLeft, Calendar, Clock, Video, BookOpen, Award, ClipboardList, GraduationCap } from 'lucide-react';
import { RATING_LABEL, RATING_VARIANT, BadgeVariant } from '@/pages/management/LessonDetails';

export function StudentLessonDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [report, setReport] = useState<LessonReport | null>(null);
  const [teacherName, setTeacherName] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [courseTimezone, setCourseTimezone] = useState<string>('UTC');
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

      const [subjectRes, teacherProfileRes, teacherUserRes, teacherRes, reportRes, courseRes] = await Promise.all([
        data.subject_id
          ? supabase.from('subjects').select('id, name, color').eq('id', data.subject_id).single()
          : Promise.resolve({ data: null }),
        supabase.from('profiles').select('full_name').eq('id', data.teacher_id).single(),
        supabase.from('users').select('email').eq('id', data.teacher_id).single(),
        supabase.from('teachers').select('zoom_link').eq('id', data.teacher_id).single(),
        supabase
          .from('lesson_reports')
          .select('*')
          .eq('lesson_id', id)
          .eq('is_visible_to_student', true)
          .order('submitted_at', { ascending: false })
          .limit(1),
        data.course_id
          ? supabase.from('courses').select('timezone').eq('id', data.course_id).single()
          : Promise.resolve({ data: null }),
      ]);

      setLesson(prev => (prev ? { ...prev, subject: subjectRes.data || undefined } : prev));
      setTeacherName(teacherProfileRes.data?.full_name || 'Teacher');
      setTeacherEmail(teacherUserRes.data?.email || '');
      setCourseTimezone(courseRes.data?.timezone || 'UTC');
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

  // Student sees lesson in the course timezone (their timezone for this course)
  const courseTz = courseTimezone;
  const displayStartTime = lesson.start_time_utc 
    ? formatTimeInTimezone(lesson.start_time_utc, courseTz) 
    : lesson.start_time;
  const displayEndTime = lesson.end_time_utc 
    ? formatTimeInTimezone(lesson.end_time_utc, courseTz) 
    : lesson.end_time;
  const displayDate = lesson.start_time_utc 
    ? formatDateInTimezone(lesson.start_time_utc, courseTz) 
    : lesson.scheduled_date;

  const link = lesson.teacher?.zoom_link || lesson.meeting_url || null;

  const handleEnter = () => {
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
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
        <Button variant="outline" size="icon" onClick={() => navigate('/student/lessons')} aria-label="Back">
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
              <span>{formatDate(displayDate)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{formatTime(displayStartTime)} - {formatTime(displayEndTime)}</span>
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
            <CardTitle>Teacher</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <p className="font-medium">{teacherName}</p>
              <p className="text-sm text-muted-foreground">{teacherEmail}</p>
            </div>
            {(lesson.status === 'scheduled' || lesson.status === 'live') && (
              <div className="mt-4">
                {link ? (
                  <Button onClick={handleEnter}>
                    <Video className="h-4 w-4 mr-2" />
                    Enter
                  </Button>
                ) : (
                  <Button variant="outline" disabled>
                    No link yet
                  </Button>
                )}
              </div>
            )}
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

        {/* Completed-lesson report: grade, covered topics, homework */}
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
                  {report.performance_rating ? (
                    <Badge variant={RATING_VARIANT[report.performance_rating] ?? 'default'}>
                      {RATING_LABEL[report.performance_rating] ?? report.performance_rating}
                    </Badge>
                  ) : (
                    <span className="text-sm">-</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Attendance:</span>
                  <Badge variant="secondary">{report.attendance_status}</Badge>
                </div>
              </div>

              {report.topics_covered && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">What Was Covered</p>
                  <p className="whitespace-pre-wrap text-sm">{report.topics_covered}</p>
                </div>
              )}

              {report.what_was_taught && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Additional Detail</p>
                  <p className="whitespace-pre-wrap text-sm">{report.what_was_taught}</p>
                </div>
              )}

              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Homework / To-Submit</p>
                <p className="whitespace-pre-wrap text-sm">{report.homework || 'No homework assigned.'}</p>
              </div>

              {(report.strengths || report.weaknesses || report.student_performance) && (
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
      </div>
    </div>
  );
}
