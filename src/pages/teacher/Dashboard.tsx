import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatsCard } from '@/components/ui/StatsCard';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Lesson } from '@/types';
import { formatTimeInTimezone, formatDateInTimezone, getCurrentDateInTimezone } from '@/utils/timezone';
import { Play, FileText, Video } from 'lucide-react';
import { toast } from 'react-toastify';
import { openExternal, safeHttpsUrl } from '../../utils/safeUrl';

function getStatusVariant(status: string): 'success' | 'warning' | 'info' | 'default' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'live':
      return 'warning';
    case 'scheduled':
      return 'info';
    default:
      return 'default';
  }
}

// Attach student names + subjects to lessons, converting times to the teacher's timezone
async function attachRelations(rows: Lesson[], teacherTimezone: string, zoomLink?: string): Promise<Lesson[]> {
  if (!rows || rows.length === 0) return [];

  const studentIds = [...new Set(rows.map(r => r.student_id).filter(Boolean))];
  const subjectIds = [...new Set(rows.map(r => r.subject_id).filter((x): x is string => Boolean(x)))];

  const [studentProfilesRes, subjectsRes] = await Promise.all([
    studentIds.length > 0
      ? supabase.from('profiles').select('id, full_name').in('id', studentIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[], error: null }),
    subjectIds.length > 0
      ? supabase.from('subjects').select('id, name, color').in('id', subjectIds)
      : Promise.resolve({ data: [] as { id: string; name: string; color: string }[], error: null }),
  ]);

  const relErr = studentProfilesRes.error || subjectsRes.error;
  if (relErr) console.error('Error fetching lesson relations:', relErr);

  return rows.map(r => {
    const sp = (studentProfilesRes.data || []).find((p: { id: string; full_name: string }) => p.id === r.student_id);
    const subj = (subjectsRes.data || []).find((s: { id: string; name: string; color: string }) => s.id === r.subject_id);

    let displayStartTime = r.start_time;
    let displayEndTime = r.end_time;
    let displayDate = r.scheduled_date;

    if (r.start_time_utc && r.end_time_utc) {
      const s = formatTimeInTimezone(r.start_time_utc, teacherTimezone);
      const e = formatTimeInTimezone(r.end_time_utc, teacherTimezone);
      const d = formatDateInTimezone(r.start_time_utc, teacherTimezone);
      if (s) displayStartTime = s;
      if (e) displayEndTime = e;
      if (d) displayDate = d;
    }

    return {
      ...r,
      start_time: displayStartTime,
      end_time: displayEndTime,
      scheduled_date: displayDate,
      teacher: { id: r.teacher_id, zoom_link: zoomLink } as Lesson['teacher'],
      student: { id: r.student_id, profile: sp ? { id: sp.id, full_name: sp.full_name } : undefined } as Lesson['student'],
      subject: (subj || undefined) as Lesson['subject'],
    };
  });
}

export function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [todayLessons, setTodayLessons] = useState<Lesson[]>([]);
  const [pendingReports, setPendingReports] = useState<Lesson[]>([]);
  const [stats, setStats] = useState({
    totalStudents: 0,
    todayLessons: 0,
    completedLessons: 0,
    attendanceRate: 0
  });
  const [loading, setLoading] = useState(true);

  const userId = user?.id;

  const fetchTeacherData = useCallback(async () => {
    if (!userId) return;
    const teacherId = userId;
    setLoading(true);

    try {
      // Teacher's own record (timezone)
      const { data: teacherRow, error: teacherErr } = await supabase
        .from('teachers')
        .select('timezone, zoom_link')
        .eq('id', teacherId)
        .maybeSingle();
      if (teacherErr) throw teacherErr;
      const teacherTimezone = teacherRow?.timezone || 'UTC';
      const zoomLink = teacherRow?.zoom_link || undefined;

      // 1. Teacher's courses with timezones
      const { data: courses, error: coursesErr } = await supabase
        .from('courses')
        .select('id, timezone')
        .eq('teacher_id', teacherId)
        .eq('status', 'active');
      if (coursesErr) throw coursesErr;

      const courseTimezoneMap: Record<string, string> = {};
      ((courses || []) as { id: string; timezone: string | null }[]).forEach((c) => {
        courseTimezoneMap[c.id] = c.timezone || 'UTC';
      });

      const courseIds = Object.keys(courseTimezoneMap);

      // 2. Today's lessons across all courses ("today" per course timezone)
      const todayResults = await Promise.all(courseIds.map(courseId =>
        supabase
          .from('lessons')
          .select('*')
          .eq('teacher_id', teacherId)
          .eq('course_id', courseId)
          .eq('scheduled_date', getCurrentDateInTimezone(courseTimezoneMap[courseId]))
          .order('start_time')
      ));
      const todayErr = todayResults.find(r => r.error)?.error;
      if (todayErr) throw todayErr;
      const todayRows = todayResults.flatMap(r => (r.data || []) as Lesson[]);
      const todayEnriched = await attachRelations(todayRows, teacherTimezone, zoomLink);
      setTodayLessons(todayEnriched);

      // 3. Pending reports: completed lessons for this teacher that have no report
      const { data: completedRows, error: completedErr } = await supabase
        .from('lessons')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('status', 'completed')
        .order('scheduled_date', { ascending: false });
      if (completedErr) console.error('Error fetching completed lessons:', completedErr);

      let pending: Lesson[] = [];
      if (!completedErr && completedRows && completedRows.length > 0) {
        const completed = completedRows as Lesson[];
        const { data: existingReports, error: reportsErr } = await supabase
          .from('lesson_reports')
          .select('lesson_id')
          .in('lesson_id', completed.map(l => l.id));
        if (reportsErr) console.error('Error fetching lesson reports:', reportsErr);

        const reportedIds = new Set((existingReports || []).map((r: { lesson_id: string }) => r.lesson_id));
        const withoutReports = reportsErr ? [] : completed.filter(l => !reportedIds.has(l.id));
        pending = await attachRelations(withoutReports.slice(0, 10), teacherTimezone, zoomLink);
      }
      setPendingReports(pending);

      // 4. Stats
      const { count: totalStudents, error: studentsErr } = await supabase
        .from('student_teacher_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', teacherId)
        .eq('is_active', true);
      if (studentsErr) console.error('Error fetching students count:', studentsErr);

      const { count: completedLessons, error: completedCountErr } = await supabase
        .from('lessons')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', teacherId)
        .eq('status', 'completed');
      if (completedCountErr) console.error('Error fetching completed count:', completedCountErr);

      const { data: attendanceData, error: attErr } = await supabase
        .from('attendance')
        .select('status')
        .eq('teacher_id', teacherId);
      if (attErr) console.error('Error fetching attendance:', attErr);

      const presentCount = attendanceData?.filter(a => a.status === 'present').length || 0;
      const totalAttendance = attendanceData?.length || 0;

      setStats({
        totalStudents: totalStudents || 0,
        todayLessons: todayEnriched.length,
        completedLessons: completedLessons || 0,
        attendanceRate: totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0,
      });
    } catch (error) {
      console.error('Error fetching teacher data:', error);
      toast.error('Failed to load your dashboard. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchTeacherData();
    }
  }, [userId, fetchTeacherData]);

  const handleStartLesson = async (lesson: Lesson) => {
    const link = lesson.teacher?.zoom_link || lesson.meeting_url;
    if (!safeHttpsUrl(link)) {
      toast.error('No Zoom link set. Ask management to add your personal Zoom link.');
      return;
    }

    const { data, error } = await supabase
      .from('lessons')
      .update({ status: 'live', actual_start_time: new Date().toISOString() })
      .eq('id', lesson.id)
      .select('id');

    if (error || !data || data.length === 0) {
      toast.error(error?.message || 'Could not start the lesson.');
      return;
    }
    openExternal(link);
    fetchTeacherData();
  };

  const handleJoin = (lesson: Lesson) => {
    const link = lesson.teacher?.zoom_link || lesson.meeting_url;
    if (link) openExternal(link);
    else toast.error('No Zoom link set.');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{greeting}, Teacher!</h1>
          <p className="text-muted-foreground">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <div>{stats.totalStudents} Students</div>
          <div>Attendance: {stats.attendanceRate}%</div>
        </div>
      </div>

      {pendingReports.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-800 flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Reports Pending ({pendingReports.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingReports.map((lesson) => (
                <div key={lesson.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                  <div>
                    <p className="font-medium">{lesson.student?.profile?.full_name || 'Student'}</p>
                    <p className="text-sm text-muted-foreground">
                      {lesson.title} • {lesson.scheduled_date} at {lesson.start_time}
                    </p>
                  </div>
                  <Button onClick={() => navigate(`/teacher/lessons/${lesson.id}/report`)}>
                    Complete Report
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard title="Today's Lessons" value={stats.todayLessons} icon="calendar" />
        <StatsCard title="Total Students" value={stats.totalStudents} icon="users" />
        <StatsCard title="Completed" value={stats.completedLessons} icon="check" />
        <StatsCard title="Attendance Rate" value={`${stats.attendanceRate}%`} icon="attendance" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today's Lessons</CardTitle>
        </CardHeader>
        <CardContent>
          {todayLessons.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No lessons scheduled for today.
            </div>
          ) : (
            <div className="space-y-4">
              {todayLessons.map((lesson) => (
                <div key={lesson.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="text-center min-w-[60px]">
                      <div className="text-sm font-medium">{lesson.start_time}</div>
                      <div className="text-xs text-muted-foreground">{lesson.end_time}</div>
                    </div>
                    <div>
                      <p className="font-medium">{lesson.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {[lesson.subject?.name, lesson.student?.profile?.full_name].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <Badge variant={getStatusVariant(lesson.status)}>
                      {lesson.status}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    {lesson.status === 'scheduled' && (
                      <Button onClick={() => handleStartLesson(lesson)}>
                        <Play className="h-4 w-4 mr-2" />
                        Start Meeting
                      </Button>
                    )}
                    {lesson.status === 'live' && (
                      <Button variant="outline" onClick={() => handleJoin(lesson)}>
                        <Video className="h-4 w-4 mr-2" />
                        Join Meeting
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}