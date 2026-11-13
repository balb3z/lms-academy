import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase/client';
import { Lesson, LessonReport } from '@/types';
import { formatDate, formatTime } from '@/utils/format';
import { formatTimeInTimezone, formatDateInTimezone } from '@/utils/timezone';
import { ArrowLeft, Calendar, Clock, Video, BookOpen, Award, ClipboardList, GraduationCap } from 'lucide-react';
import { RATING_LABEL, RATING_VARIANT } from '@/utils/rating';
import { openExternal } from '../../utils/safeUrl';

export function StudentLessonDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [report, setReport] = useState<LessonReport | null>(null);
  const [teacherName, setTeacherName] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [courseTimezone, setCourseTimezone] = useState<string>('UTC');
  const [loading, setLoading] = useState(true);

  const fetchLesson = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('lessons').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data) {
        setLesson(null);
        return;
      }
      const row = data as Lesson;

      const [subjectRes, teacherProfileRes, teacherUserRes, teacherRes, reportRes, courseRes] = await Promise.all([
        row.subject_id
          ? supabase.from('subjects').select('id, name, color').eq('id', row.subject_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase.from('profiles').select('full_name').eq('id', row.teacher_id).maybeSingle(),
        supabase.from('users').select('email').eq('id', row.teacher_id).maybeSingle(),
        supabase.from('teachers').select('zoom_link').eq('id', row.teacher_id).maybeSingle(),
        supabase
          .from('lesson_reports')
          .select('*')
          .eq('lesson_id', id)
          .eq('is_visible_to_student', true)
          .order('submitted_at', { ascending: false })
          .limit(1),
        row.course_id
          ? supabase.from('courses').select('timezone').eq('id', row.course_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      const relErr = subjectRes.error || teacherProfileRes.error || teacherUserRes.error || teacherRes.error || reportRes.error || courseRes.error;
      if (relErr) throw relErr;

      setLesson({
        ...row,
        subject: (subjectRes.data || undefined) as Lesson['subject'],
        teacher: { id: row.teacher_id, zoom_link: teacherRes.data?.zoom_link || undefined } as Lesson['teacher'],
      });
      setTeacherName(teacherProfileRes.data?.full_name || 'Teacher');
      setTeacherEmail(teacherUserRes.data?.email || '');
      setCourseTimezone(courseRes.data?.timezone || 'UTC');
      setReport(((reportRes.data as LessonReport[]) || [])[0] || null);
    } catch (err) {
      console.error('Error loading lesson:', err);
      toast.error('Failed to load lesson details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLesson();
  }, [fetchLesson]);

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
  const hasUtc = Boolean(lesson.start_time_utc && lesson.end_time_utc);
  const displayStartTime = (hasUtc && formatTimeInTimezone(lesson.start_time_utc, courseTz)) || formatTime(lesson.start_time);
  const displayEndTime = (hasUtc && formatTimeInTimezone(lesson.end_time_utc, courseTz)) || formatTime(lesson.end_time);
  const displayDate = (lesson.start_time_utc && formatDateInTimezone(lesson.start_time_utc, courseTz)) || formatDate(lesson.scheduled_date);

  const link = lesson.teacher?.zoom_link || lesson.meeting_url || null;

  const handleEnter = () => {
    if (link) openExternal(link);
  };

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
              <span>{displayDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{displayStartTime} - {displayEndTime}</span>
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
