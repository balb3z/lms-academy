import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatsCard } from '@/components/ui/StatsCard';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Lesson, LessonReport } from '@/types';
import { formatTimeInTimezone, formatDateInTimezone, getCurrentDateInTimezone } from '@/utils/timezone';
import { Video, FileText, Bell, Clock } from 'lucide-react';
import { toast } from 'react-toastify';
import { openExternal } from '../../utils/safeUrl';

interface CourseTzRow {
  id: string;
  timezone: string | null;
}

// Attach teacher names + subjects + course timezone to lessons
async function attachRelations(rows: Lesson[]): Promise<Lesson[]> {
  if (!rows || rows.length === 0) return [];

  const teacherIds = [...new Set(rows.map(r => r.teacher_id).filter(Boolean))];
  const subjectIds = [...new Set(rows.map(r => r.subject_id).filter((x): x is string => Boolean(x)))];
  const courseIds = [...new Set(rows.map(r => r.course_id).filter((x): x is string => Boolean(x)))];

  const [teacherProfilesRes, teacherZoomRes, subjectsRes, coursesRes] = await Promise.all([
    teacherIds.length > 0
      ? supabase.from('profiles').select('id, full_name').in('id', teacherIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[], error: null }),
    teacherIds.length > 0
      ? supabase.from('teachers').select('id, zoom_link').in('id', teacherIds)
      : Promise.resolve({ data: [] as { id: string; zoom_link: string | null }[], error: null }),
    subjectIds.length > 0
      ? supabase.from('subjects').select('id, name, color').in('id', subjectIds)
      : Promise.resolve({ data: [] as { id: string; name: string; color: string }[], error: null }),
    courseIds.length > 0
      ? supabase.from('courses').select('id, timezone').in('id', courseIds)
      : Promise.resolve({ data: [] as CourseTzRow[], error: null }),
  ]);

  const relErr = teacherProfilesRes.error || teacherZoomRes.error || subjectsRes.error || coursesRes.error;
  if (relErr) console.error('Error fetching lesson relations:', relErr);

  const courseTimezoneMap: Record<string, string> = {};
  (coursesRes.data || []).forEach((c: CourseTzRow) => {
    courseTimezoneMap[c.id] = c.timezone || 'UTC';
  });

  return rows.map(r => {
    const tp = (teacherProfilesRes.data || []).find((p: { id: string; full_name: string }) => p.id === r.teacher_id);
    const tz = (teacherZoomRes.data || []).find((t: { id: string; zoom_link: string | null }) => t.id === r.teacher_id);
    const subj = (subjectsRes.data || []).find((s: { id: string; name: string; color: string }) => s.id === r.subject_id);
    const courseTz = r.course_id ? courseTimezoneMap[r.course_id] || 'UTC' : 'UTC';

    // Convert lesson times to course timezone for display
    let displayStartTime = r.start_time;
    let displayEndTime = r.end_time;
    let displayDate = r.scheduled_date;

    if (r.start_time_utc && r.end_time_utc) {
      const s = formatTimeInTimezone(r.start_time_utc, courseTz);
      const e = formatTimeInTimezone(r.end_time_utc, courseTz);
      const d = formatDateInTimezone(r.start_time_utc, courseTz);
      if (s) displayStartTime = s;
      if (e) displayEndTime = e;
      if (d) displayDate = d;
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
      } as Lesson['teacher'],
      subject: (subj || undefined) as Lesson['subject'],
    };
  });
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

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
  const [notifications, setNotifications] = useState<{ id: string; title: string; message: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const userId = user?.id;

  const fetchStudentData = useCallback(async () => {
    if (!userId) return;
    const studentId = userId;
    setLoading(true);

    try {
      // 1. Get student's courses with timezones
      const { data: enrollments, error: enrollErr } = await supabase
        .from('course_enrollments')
        .select('course_id, course:course_id(timezone)')
        .eq('student_id', studentId)
        .eq('is_active', true);
      if (enrollErr) throw enrollErr;

      const courseTimezoneMap: Record<string, string> = {};
      ((enrollments || []) as unknown as { course_id: string; course: { timezone: string | null } | null }[]).forEach((e) => {
        courseTimezoneMap[e.course_id] = e.course?.timezone || 'UTC';
      });

      const courseIds = Object.keys(courseTimezoneMap);

      // 2. For each course, "today" in that course's timezone
      const courseTodayMap: Record<string, string> = {};
      courseIds.forEach(courseId => {
        courseTodayMap[courseId] = getCurrentDateInTimezone(courseTimezoneMap[courseId] || 'UTC');
      });

      // 3. Today's lessons across all courses
      const todayResults = await Promise.all(courseIds.map(courseId =>
        supabase
          .from('lessons')
          .select('*')
          .eq('student_id', studentId)
          .eq('course_id', courseId)
          .eq('scheduled_date', courseTodayMap[courseId])
          .order('start_time')
      ));
      const todayErr = todayResults.find(r => r.error)?.error;
      if (todayErr) throw todayErr;
      const todayRows = todayResults.flatMap(r => (r.data || []) as Lesson[]);

      // 4. Upcoming lessons (next 7 days across all courses)
      const upcomingResults = await Promise.all(courseIds.map(courseId =>
        supabase
          .from('lessons')
          .select('*')
          .eq('student_id', studentId)
          .eq('course_id', courseId)
          .gt('scheduled_date', courseTodayMap[courseId])
          .lte('scheduled_date', addDays(courseTodayMap[courseId], 7))
          .neq('status', 'completed')
          .order('scheduled_date')
          .order('start_time')
      ));
      const upErr = upcomingResults.find(r => r.error)?.error;
      if (upErr) throw upErr;
      const upcomingRows = upcomingResults.flatMap(r => (r.data || []) as Lesson[]);

      setTodayLessons(await attachRelations(todayRows));
      setUpcomingLessons(await attachRelations(upcomingRows));

      // 5. Attendance stats
      const { data: attendance, error: attErr } = await supabase
        .from('attendance')
        .select('status')
        .eq('student_id', studentId);
      if (attErr) console.error('Error fetching attendance:', attErr);

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

      // 6. Recent reports
      const { data: reports, error: repErr } = await supabase
        .from('lesson_reports')
        .select('*, lesson:lesson_id (*)')
        .eq('student_id', studentId)
        .eq('is_visible_to_student', true)
        .order('submitted_at', { ascending: false })
        .limit(3);
      if (repErr) console.error('Error fetching reports:', repErr);

      let reportsEnriched: LessonReport[] = (reports as LessonReport[]) || [];
      if (reportsEnriched.length > 0) {
        const tIds = [...new Set(reportsEnriched.map(r => r.teacher_id).filter(Boolean))];
        const { data: tProfiles, error: tpErr } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', tIds);
        if (tpErr) console.error('Error fetching teacher profiles:', tpErr);
        reportsEnriched = reportsEnriched.map(r => {
          const tp = (tProfiles || []).find((p: { id: string; full_name: string }) => p.id === r.teacher_id);
          return {
            ...r,
            teacher: { id: r.teacher_id, profile: tp ? { id: tp.id, full_name: tp.full_name } : undefined } as LessonReport['teacher'],
          };
        });
      }
      setRecentReports(reportsEnriched);
    } catch (error) {
      console.error('Error fetching student data:', error);
      toast.error('Failed to load your dashboard. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error fetching notifications:', error);
      return;
    }
    setNotifications(data || []);
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchStudentData();
      fetchNotifications();
    }
  }, [userId, fetchStudentData, fetchNotifications]);

  const handleJoinMeeting = (lesson: Lesson) => {
    const link = lesson.teacher?.zoom_link || lesson.meeting_url;
    if (link) {
      openExternal(link);
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