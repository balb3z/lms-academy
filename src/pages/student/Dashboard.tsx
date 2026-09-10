import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatsCard } from '@/components/ui/StatsCard';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Lesson, LessonReport } from '@/types';
import { formatTime } from '@/utils/format';
import { formatTimeInTimezone, formatDateInTimezone, getCurrentDateInTimezone } from '@/utils/timezone';
import { Video, Calendar, FileText, Bell, Clock } from 'lucide-react';

export function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [todayLessons, setTodayLessons] = useState<Lesson[]>([]);
  const [upcomingLessons, setUpcomingLessons] = useState<Lesson[]>([]);
  const [attendanceStats, setAttendanceStats] = useState({
    present: 0,
    late: 0,
    absent: 0,
    rate: 0
  });
  const [recentReports, setRecentReports] = useState<LessonReport[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchStudentData();
      fetchNotifications();
    }
  }, [user]);

  // Helper to attach teacher names + subjects + course timezone to lessons
  const attachRelations = async (rows: { teacher_id: string; subject_id?: string; course_id?: string; start_time_utc?: string }[]): Promise<Lesson[]> => {
    if (!rows || rows.length === 0) return [];

    const teacherIds = [...new Set(rows.map(r => r.teacher_id).filter(Boolean))];
    const subjectIds = [...new Set(rows.map(r => r.subject_id).filter(Boolean))];
    const courseIds = [...new Set(rows.map(r => r.course_id).filter(Boolean))];

    const [teacherProfilesRes, teacherZoomRes, subjectsRes, coursesRes] = await Promise.all([
      teacherIds.length > 0
        ? supabase.from('profiles').select('id, full_name').in('id', teacherIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
      teacherIds.length > 0
        ? supabase.from('teachers').select('id, zoom_link').in('id', teacherIds)
        : Promise.resolve({ data: [] as { id: string; zoom_link: string }[] }),
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
      const tp = (teacherProfilesRes.data || []).find((p: { id: string; full_name: string }) => p.id === r.teacher_id);
      const tz = (teacherZoomRes.data || []).find((t: { id: string; zoom_link: string }) => t.id === r.teacher_id);
      const subj = (subjectsRes.data || []).find((s: { id: string; name: string; color: string }) => s.id === r.subject_id);
      const courseTz = r.course_id ? courseTimezoneMap[r.course_id] || 'UTC' : 'UTC';
      
      // Convert lesson times to course timezone for display
      let displayStartTime = r.start_time;
      let displayEndTime = r.end_time;
      let displayDate = r.scheduled_date;
      
      if (r.start_time_utc) {
        displayStartTime = formatTimeInTimezone(r.start_time_utc, courseTz);
        displayEndTime = formatTimeInTimezone(r.end_time_utc, courseTz);
        displayDate = formatDateInTimezone(r.start_time_utc, courseTz);
      }
      
      return {
        ...r,
        start_time: displayStartTime,
        end_time: displayEndTime,
        scheduled_date: displayDate,
        teacher: {
          id: r.teacher_id,
          zoom_link: tz?.zoom_link || undefined,
          profile: tp ? { id: tp.id, full_name: tp.full_name } : undefined,
        },
        subject: subj || undefined,
      };
    });
  };

  const fetchStudentData = async () => {
    const studentId = user?.id;
    setLoading(true);

    try {
      // 1. Get student's courses with timezones
      const { data: enrollments } = await supabase
        .from('course_enrollments')
        .select('course_id, course:course_id(timezone)')
        .eq('student_id', studentId)
        .eq('is_active', true);

      const courseTimezoneMap: Record<string, string> = {};
      (enrollments || []).forEach((e: any) => {
        if (e.course?.timezone) {
          courseTimezoneMap[e.course_id] = e.course.timezone;
        }
      });

      const courseIds = Object.keys(courseTimezoneMap);
      
      // 2. For each course, determine "today" in that course's timezone
      const courseTodayMap: Record<string, string> = {};
      courseIds.forEach(courseId => {
        const tz = courseTimezoneMap[courseId] || 'UTC';
        courseTodayMap[courseId] = getCurrentDateInTimezone(tz);
      });

      // 3. Fetch today's lessons across all courses
      const todayLessonsPromises = courseIds.map(courseId => {
        const today = courseTodayMap[courseId];
        return supabase
          .from('lessons')
          .select('*')
          .eq('student_id', studentId)
          .eq('course_id', courseId)
          .eq('scheduled_date', today)
          .order('start_time');
      });

      const todayResults = await Promise.all(todayLessonsPromises);
      const todayRows = todayResults.flatMap(r => r.data || []);

      // 4. Fetch upcoming lessons (next 7 days across all courses)
      const nextWeekMap: Record<string, string> = {};
      courseIds.forEach(courseId => {
        const tz = courseTimezoneMap[courseId] || 'UTC';
        const nextWeek = new Date();
        // Get current date in that timezone, add 7 days
        const nowInTz = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        const parts = formatter.formatToParts(nowInTz);
        const get = (type: string) => parts.find(p => p.type === type)?.value || '';
        const year = parseInt(get('year'));
        const month = parseInt(get('month')) - 1;
        const day = parseInt(get('day'));
        const nextWeekDate = new Date(Date.UTC(year, month, day + 7));
        const nextWeekFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        const nextWeekParts = nextWeekFormatter.formatToParts(nextWeekDate);
        const getNext = (type: string) => nextWeekParts.find(p => p.type === type)?.value || '';
        courseTodayMap[courseId] = `${getNext('year')}-${getNext('month')}-${getNext('day')}`;
        nextWeekMap[courseId] = `${getNext('year')}-${getNext('month')}-${getNext('day')}`;
      });

      const upcomingPromises = courseIds.map(courseId => {
        const today = courseTodayMap[courseId];
        const nextWeek = nextWeekMap[courseId];
        return supabase
          .from('lessons')
          .select('*')
          .eq('student_id', studentId)
          .eq('course_id', courseId)
          .gt('scheduled_date', today)
          .lte('scheduled_date', nextWeek)
          .neq('status', 'completed')
          .order('scheduled_date')
          .order('start_time');
      });

      const upcomingResults = await Promise.all(upcomingPromises);
      const upcomingRows = upcomingResults.flatMap(r => r.data || []);

      // 5. Enrich today's lessons
      setTodayLessons(await attachRelations(todayRows));
      
      // 6. Enrich upcoming lessons
      setUpcomingLessons(await attachRelations(upcomingRows));

      // 7. Attendance stats
      const { data: attendance } = await supabase
        .from('attendance')
        .select('status')
        .eq('student_id', studentId);

      const present = attendance?.filter(a => a.status === 'present').length || 0;
      const late = attendance?.filter(a => a.status === 'late').length || 0;
      const absent = attendance?.filter(a => a.status === 'absent').length || 0;
      const total = present + late + absent;

      setAttendanceStats({
        present,
        late,
        absent,
        rate: total > 0 ? Math.round((present / total) * 100) : 0
      });

      // 8. Recent reports
      const { data: reports } = await supabase
        .from('lesson_reports')
        .select('*, lesson:lesson_id (*)')
        .eq('student_id', studentId)
        .eq('is_visible_to_student', true)
        .order('submitted_at', { ascending: false })
        .limit(3);

      let reportsEnriched: LessonReport[] = (reports as LessonReport[]) || [];
      if (reportsEnriched.length > 0) {
        const tIds = [...new Set(reportsEnriched.map((r: any) => r.teacher_id).filter(Boolean))];
        const { data: tProfiles } = tIds.length > 0
          ? await supabase.from('profiles').select('id, full_name').in('id', tIds)
          : { data: [] as any[] };
        reportsEnriched = reportsEnriched.map((r: any) => {
          const tp = (tProfiles || []).find((p: any) => p.id === r.teacher_id);
          return { ...r, teacher: { id: r.teacher_id, profile: tp ? { id: tp.id, full_name: tp.full_name } : undefined } };
        });
      }
      setRecentReports(reportsEnriched);
    } catch (error) {
      console.error('Error fetching student data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user?.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(5);

    setNotifications(data || []);
  };

  const handleJoinMeeting = (lesson: Lesson) => {
    const link = lesson.teacher?.zoom_link || lesson.meeting_url;
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Welcome back, Student!</h1>
          <p className="text-muted-foreground">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
        {notifications.length > 0 && (
          <Button variant="outline">
            <Bell className="h-4 w-4 mr-2" />
            {notifications.length} Notifications
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today's Lessons</CardTitle>
        </CardHeader>
        <CardContent>
          {todayLessons.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No lessons scheduled for today. Enjoy your day!
            </div>
          ) : (
            <div className="space-y-4">
              {todayLessons.map((lesson) => (
                <div key={lesson.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
                      <span className="text-2xl font-bold text-primary text-center leading-tight">
                        {lesson.start_time}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold">{lesson.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {lesson.subject?.name} • {lesson.teacher?.profile?.full_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {lesson.start_time} - {lesson.end_time}
                      </p>
                      <Badge variant={lesson.status === 'live' ? 'warning' : 'info'}>
                        {lesson.status}
                      </Badge>
                    </div>
                  </div>
                  {(() => {
                    const link = lesson.teacher?.zoom_link || lesson.meeting_url;
                    return link ? (
                      <Button onClick={() => handleJoinMeeting(lesson)}>
                        <Video className="h-4 w-4 mr-2" />
                        Enter
                      </Button>
                    ) : (
                      <Button variant="outline" disabled>
                        <Clock className="h-4 w-4 mr-2" />
                        No link yet
                      </Button>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard title="Attendance Rate" value={`${attendanceStats.rate}%`} icon="attendance" />
        <StatsCard title="Present" value={attendanceStats.present} icon="check" />
        <StatsCard title="Late" value={attendanceStats.late} icon="clock" />
        <StatsCard title="Absent" value={attendanceStats.absent} icon="users" />
      </div>

      {upcomingLessons.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Lessons</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcomingLessons.map((lesson) => (
                <div key={lesson.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{lesson.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {lesson.scheduled_date} at {lesson.start_time}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {lesson.subject?.name} • {lesson.teacher?.profile?.full_name}
                    </p>
                  </div>
                  <Badge variant="info">Upcoming</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {recentReports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentReports.map((report) => (
                <div key={report.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{report.lesson?.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {report.teacher?.profile?.full_name} • {report.lesson?.scheduled_date}
                    </p>
                    <Badge variant={report.performance_rating === 'excellent' ? 'success' : 'default'}>
                      {report.performance_rating}
                    </Badge>
                  </div>
                  <Button variant="outline" onClick={() => navigate(`/student/lessons/${report.lesson_id}`)}>
                    <FileText className="h-4 w-4 mr-2" />
                    View
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}