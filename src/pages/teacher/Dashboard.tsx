import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatsCard } from '@/components/ui/StatsCard';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Lesson } from '@/types';
import { formatTime } from '@/utils/format';
import { formatTimeInTimezone, formatDateInTimezone, getCurrentDateInTimezone } from '@/utils/timezone';
import { Play, FileText, Users, Calendar, Clock, Video } from 'lucide-react';

export function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [todayLessons, setTodayLessons] = useState<Lesson[]>([]);
  const [pendingReports, setPendingReports] = useState<Lesson[]>([]);
  const [zoomLink, setZoomLink] = useState<string | null>(null);
  const [teacherTimezone, setTeacherTimezone] = useState<string>('UTC');
  const [stats, setStats] = useState({
    totalStudents: 0,
    todayLessons: 0,
    completedLessons: 0,
    attendanceRate: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTeacherData();
    }
  }, [user]);

  // Helper to attach student names + subjects + course timezone to lessons
  const attachRelations = async (rows: { student_id: string; subject_id?: string; course_id?: string; start_time_utc?: string }[]): Promise<Lesson[]> => {
    if (!rows || rows.length === 0) return [];

    const studentIds = [...new Set(rows.map(r => r.student_id).filter(Boolean))];
    const subjectIds = [...new Set(rows.map(r => r.subject_id).filter(Boolean))];
    const courseIds = [...new Set(rows.map(r => r.course_id).filter(Boolean))];

    const [studentProfilesRes, subjectsRes, coursesRes] = await Promise.all([
      studentIds.length > 0
        ? supabase.from('profiles').select('id, full_name').in('id', studentIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
      subjectIds.length > 0
        ? supabase.from('subjects').select('id, name, color').in('id', subjectIds)
        : Promise.resolve({ data: [] as { id: string; name: string; color: string }[] }),
      courseIds.length > 0
        ? supabase.from('courses').select('id, timezone').in('id', courseIds)
        : Promise.resolve({ data: [] as { id: string; timezone: string }[] }),
    ]);

    const courseTimezoneMap: Record<string, string> = {};
    (coursesRes.data || []).forEach((c: any) => {
      courseTimezoneMap[c.id] = c.timezone || 'UTC';
    });

    return rows.map(r => {
      const sp = (studentProfilesRes.data || []).find((p: { id: string; full_name: string }) => p.id === r.student_id);
      const subj = (subjectsRes.data || []).find((s: { id: string; name: string; color: string }) => s.id === r.subject_id);
      const courseTz = r.course_id ? courseTimezoneMap[r.course_id] || 'UTC' : 'UTC';
      
      // Convert lesson times to teacher's timezone for display
      let displayStartTime = r.start_time;
      let displayEndTime = r.end_time;
      let displayDate = r.scheduled_date;
      
      if (r.start_time_utc && r.end_time_utc && teacherTimezone) {
        try {
          displayStartTime = formatTimeInTimezone(r.start_time_utc, teacherTimezone);
          displayEndTime = formatTimeInTimezone(r.end_time_utc, teacherTimezone);
          displayDate = formatDateInTimezone(r.start_time_utc, teacherTimezone);
        } catch (e) {
          console.warn('Failed to convert timezone for lesson:', r.id, e);
        }
      }
      
      return {
        ...r,
        start_time: displayStartTime,
        end_time: displayEndTime,
        scheduled_date: displayDate,
        student: { id: r.student_id, profile: sp ? { id: sp.id, full_name: sp.full_name } : undefined },
        subject: subj || undefined,
      };
    });
  };

  const fetchTeacherData = async () => {
    const teacherId = user?.id;
    setLoading(true);

    try {
      // Teacher's own record (for the personal Zoom link and timezone)
      const { data: teacherRow } = await supabase
        .from('teachers')
        .select('zoom_link, timezone')
        .eq('id', teacherId)
        .single();
      setZoomLink(teacherRow?.zoom_link || null);
      setTeacherTimezone(teacherRow?.timezone || 'UTC');

      // 1. Get teacher's courses with timezones
      const { data: courses } = await supabase
        .from('courses')
        .select('id, timezone')
        .eq('teacher_id', teacherId)
        .eq('status', 'active');

      const courseTimezoneMap: Record<string, string> = {};
      (courses || []).forEach((c: any) => {
        if (c.timezone) courseTimezoneMap[c.id] = c.timezone;
      });

      const courseIds = Object.keys(courseTimezoneMap);
      
      // Determine "today" in each course timezone
      const courseTodayMap: Record<string, string> = {};
      courseIds.forEach(courseId => {
        const tz = courseTimezoneMap[courseId] || 'UTC';
        courseTodayMap[courseId] = getCurrentDateInTimezone(tz);
      });

      // 2. Today's lessons across all courses
      const todayPromises = courseIds.map(courseId => {
        const today = courseTodayMap[courseId];
        return supabase
          .from('lessons')
          .select('*')
          .eq('teacher_id', teacherId)
          .eq('course_id', courseId)
          .eq('scheduled_date', today)
          .order('start_time');
      });

      const todayResults = await Promise.all(todayPromises);
      const todayRows = todayResults.flatMap(r => r.data || []);
      const todayEnriched = await attachRelations(todayRows);
      setTodayLessons(todayEnriched);

      // 3. Pending reports: completed lessons for this teacher that have no report
      const { data: completedRows } = await supabase
        .from('lessons')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('status', 'completed')
        .order('scheduled_date', { ascending: false });

      let pending: Lesson[] = [];
      if (completedRows && completedRows.length > 0) {
        const completedIds = completedRows.map((l: any) => l.id);
        const { data: existingReports } = await supabase
          .from('lesson_reports')
          .select('lesson_id')
          .in('lesson_id', completedIds);

        const reportedIds = new Set((existingReports || []).map((r: any) => r.lesson_id));
        const withoutReports = completedRows.filter((l: any) => !reportedIds.has(l.id));
        pending = await attachRelations(withoutReports.slice(0, 10));
      }
      setPendingReports(pending);

      // 4. Stats
      const { count: totalStudents } = await supabase
        .from('student_teacher_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', teacherId)
        .eq('is_active', true);

      const { count: completedLessons } = await supabase
        .from('lessons')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', teacherId)
        .eq('status', 'completed');

      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('status')
        .eq('teacher_id', teacherId);

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
    } finally {
      setLoading(false);
    }
  };

  const handleStartLesson = async (lesson: Lesson) => {
    const link = lesson.teacher?.zoom_link || lesson.meeting_url;
    if (!link) {
      toast.error('No Zoom link set. Ask management to add your personal Zoom link.');
      return;
    }

    const { data, error } = await supabase
      .from('lessons')
      .update({ status: 'live', actual_start_time: new Date().toISOString() })
      .eq('id', lesson.id)
      .select('id');

    if (error || !data || data.length === 0) {
      toast.error('Could not start the lesson.');
      return;
    }
    window.open(link, '_blank', 'noopener,noreferrer');
    fetchTeacherData();
  };

  const handleJoin = (lesson: Lesson) => {
    const link = lesson.teacher?.zoom_link || lesson.meeting_url;
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
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

function getStatusVariant(status: string) {
  switch (status) {
    case 'scheduled': return 'info';
    case 'live': return 'warning';
    case 'completed': return 'success';
    case 'cancelled': return 'destructive';
    default: return 'default';
  }
}