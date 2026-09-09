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
import { Video, FileText, Bell, Clock } from 'lucide-react';

export function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [todayLessons, setTodayLessons] = useState<Lesson[]>([]);
  const [upcomingLessons, setUpcomingLessons] = useState<Lesson[]>([]);
  const [attendanceStats, setAttendanceStats] = useState({
    present: 0,
    late: 0,
    absent: 0,
    rate: 0,
  });
  const [progress, setProgress] = useState({ completed: 0, remaining: 0 });
  const [recentReports, setRecentReports] = useState<LessonReport[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchStudentData();
      fetchNotifications();
    }
  }, [user]);

  // Attach teacher names + subjects to lessons using separate round-trips.
  // The old embedded `profile:user_id(...)` join does not exist in the schema
  // (profiles.id == users.id) and made the whole query fail, so no lessons
  // were ever shown. This resolves names without a broken embed.
  const attachRelations = async (rows: any[]): Promise<Lesson[]> => {
    if (!rows || rows.length === 0) return [];

    const teacherIds = [...new Set(rows.map(r => r.teacher_id).filter(Boolean))];
    const subjectIds = [...new Set(rows.map(r => r.subject_id).filter(Boolean))];

    const [teacherProfilesRes, teacherZoomRes, subjectsRes] = await Promise.all([
      teacherIds.length > 0
        ? supabase.from('profiles').select('id, full_name').in('id', teacherIds)
        : Promise.resolve({ data: [] as any[] }),
      teacherIds.length > 0
        ? supabase.from('teachers').select('id, zoom_link').in('id', teacherIds)
        : Promise.resolve({ data: [] as any[] }),
      subjectIds.length > 0
        ? supabase.from('subjects').select('id, name, color').in('id', subjectIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    return rows.map(r => {
      const tp = (teacherProfilesRes.data || []).find((p: any) => p.id === r.teacher_id);
      const tz = (teacherZoomRes.data || []).find((t: any) => t.id === r.teacher_id);
      const subj = (subjectsRes.data || []).find((s: any) => s.id === r.subject_id);
      return {
        ...r,
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
    const today = new Date().toISOString().split('T')[0];

    try {
      const { data: todayRows, error: todayError } = await supabase
        .from('lessons')
        .select('*')
        .eq('student_id', studentId)
        .eq('scheduled_date', today)
        .order('start_time');

      if (todayError) console.error('Error fetching today lessons:', todayError);
      setTodayLessons(await attachRelations(todayRows || []));

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const { data: upcomingRows } = await supabase
        .from('lessons')
        .select('*')
        .eq('student_id', studentId)
        .gt('scheduled_date', today)
        .lte('scheduled_date', nextWeek.toISOString().split('T')[0])
        .neq('status', 'completed')
        .order('scheduled_date')
        .order('start_time');

      setUpcomingLessons(await attachRelations(upcomingRows || []));

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
        rate: total > 0 ? Math.round((present / total) * 100) : 0,
      });

      // Remaining lessons = scheduled (not yet completed/cancelled); completed count for progress
      const [{ count: completedCount }, { count: remainingCount }] = await Promise.all([
        supabase.from('lessons').select('*', { count: 'exact', head: true })
          .eq('student_id', studentId).eq('status', 'completed'),
        supabase.from('lessons').select('*', { count: 'exact', head: true })
          .eq('student_id', studentId).eq('status', 'scheduled'),
      ]);
      setProgress({ completed: completedCount || 0, remaining: remainingCount || 0 });

      // Reports: lesson embed is valid; resolve teacher names separately
      const { data: reportRows } = await supabase
        .from('lesson_reports')
        .select('*, lesson:lesson_id (*)')
        .eq('student_id', studentId)
        .eq('is_visible_to_student', true)
        .order('submitted_at', { ascending: false })
        .limit(3);

      let reports: LessonReport[] = (reportRows as LessonReport[]) || [];
      if (reports.length > 0) {
        const tIds = [...new Set(reports.map((r: any) => r.teacher_id).filter(Boolean))];
        const { data: tProfiles } = tIds.length > 0
          ? await supabase.from('profiles').select('id, full_name').in('id', tIds)
          : { data: [] as any[] };
        reports = reports.map((r: any) => {
          const tp = (tProfiles || []).find((p: any) => p.id === r.teacher_id);
          return { ...r, teacher: { id: r.teacher_id, profile: tp ? { id: tp.id, full_name: tp.full_name } : undefined } };
        });
      }
      setRecentReports(reports);
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

  const handleEnter = (lesson: Lesson) => {
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
              day: 'numeric',
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
                      <span className="text-lg font-bold text-primary text-center leading-tight">
                        {formatTime(lesson.start_time)}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold">{lesson.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {[lesson.subject?.name, lesson.teacher?.profile?.full_name].filter(Boolean).join(' • ')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatTime(lesson.start_time)} - {formatTime(lesson.end_time)}
                      </p>
                      <Badge variant={lesson.status === 'live' ? 'warning' : 'info'}>
                        {lesson.status}
                      </Badge>
                    </div>
                  </div>
                  {(() => {
                    const link = lesson.teacher?.zoom_link || lesson.meeting_url;
                    return link ? (
                      <Button onClick={() => handleEnter(lesson)}>
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

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatsCard title="Attendance Rate" value={`${attendanceStats.rate}%`} icon="attendance" />
        <StatsCard title="Completed" value={progress.completed} icon="check" />
        <StatsCard title="Lessons Left" value={progress.remaining} icon="lessons" />
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
                      {lesson.scheduled_date} at {formatTime(lesson.start_time)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {[lesson.subject?.name, lesson.teacher?.profile?.full_name].filter(Boolean).join(' • ')}
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
                  <Button variant="outline" onClick={() => navigate(`/student/reports/${report.id}`)}>
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
