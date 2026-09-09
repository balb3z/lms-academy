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
import { Play, FileText, Video } from 'lucide-react';
import { toast } from 'react-toastify';

export function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [todayLessons, setTodayLessons] = useState<Lesson[]>([]);
  const [pendingReports, setPendingReports] = useState<Lesson[]>([]);
  const [zoomLink, setZoomLink] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalStudents: 0,
    todayLessons: 0,
    completedLessons: 0,
    attendanceRate: 0,
    earnings: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    fetchTeacherData();

    // Re-fetch whenever a lesson row changes for this teacher (e.g. status
    // flips to 'completed' after submitting the end-meeting report).
    const channel = supabase
      .channel('teacher-lessons-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lessons', filter: `teacher_id=eq.${user.id}` },
        () => { fetchTeacherData(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Attach student names + subjects using separate round-trips instead of the
  // broken `profile:user_id(...)` embed that previously failed the whole query.
  const attachRelations = async (rows: any[]): Promise<Lesson[]> => {
    if (!rows || rows.length === 0) return [];

    const studentIds = [...new Set(rows.map(r => r.student_id).filter(Boolean))];
    const subjectIds = [...new Set(rows.map(r => r.subject_id).filter(Boolean))];

    const [studentProfilesRes, subjectsRes] = await Promise.all([
      studentIds.length > 0
        ? supabase.from('profiles').select('id, full_name').in('id', studentIds)
        : Promise.resolve({ data: [] as any[] }),
      subjectIds.length > 0
        ? supabase.from('subjects').select('id, name, color').in('id', subjectIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    return rows.map(r => {
      const sp = (studentProfilesRes.data || []).find((p: any) => p.id === r.student_id);
      const subj = (subjectsRes.data || []).find((s: any) => s.id === r.subject_id);
      return {
        ...r,
        student: { id: r.student_id, profile: sp ? { id: sp.id, full_name: sp.full_name } : undefined },
        subject: subj || undefined,
      };
    });
  };

  const fetchTeacherData = async () => {
    const today = new Date().toISOString().split('T')[0];
    const teacherId = user?.id;

    try {
      // Teacher's own record (for the personal Zoom link)
      const { data: teacherRow } = await supabase
        .from('teachers')
        .select('zoom_link')
        .eq('id', teacherId)
        .single();
      setZoomLink(teacherRow?.zoom_link || null);

      // Today's lessons — driven directly by teacher_id so ALL of the teacher's
      // lessons appear (course-generated and manually scheduled alike).
      const { data: todayRows, error: todayError } = await supabase
        .from('lessons')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('scheduled_date', today)
        .order('start_time');

      if (todayError) console.error('Error fetching today lessons:', todayError);
      const todayEnriched = await attachRelations(todayRows || []);
      setTodayLessons(todayEnriched);

      // Pending reports: completed lessons for this teacher that have no report.
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

      // Earnings = SUM(teacher_rate) over the teacher's completed lessons.
      const earnings = (completedRows || []).reduce(
        (sum: number, l: any) => sum + (Number(l.teacher_rate) || 0),
        0,
      );

      // Stats
      const { count: totalStudents } = await supabase
        .from('student_teacher_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', teacherId)
        .eq('is_active', true);

      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('status')
        .eq('teacher_id', teacherId);

      const presentCount = attendanceData?.filter(a => a.status === 'present').length || 0;
      const totalAttendance = attendanceData?.length || 0;

      setStats({
        totalStudents: totalStudents || 0,
        todayLessons: todayEnriched.length,
        completedLessons: completedRows?.length || 0,
        attendanceRate: totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0,
        earnings,
      });
    } catch (error) {
      console.error('Error fetching teacher data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Resolve the link to open: the teacher's saved Zoom link takes priority,
  // falling back to whatever is stored on the lesson.
  const resolveLink = (lesson: Lesson) => zoomLink || lesson.meeting_url || null;

  const handleStartLesson = async (lesson: Lesson) => {
    const link = resolveLink(lesson);
    if (!link) {
      toast.error('No Zoom link set. Add your personal Zoom link in your profile.');
      return;
    }

    const { error } = await supabase
      .from('lessons')
      .update({
        status: 'live',
        actual_start_time: new Date().toISOString(),
      })
      .eq('id', lesson.id);

    if (!error) {
      window.open(link, '_blank', 'noopener,noreferrer');
      fetchTeacherData();
    } else {
      toast.error('Failed to start the lesson.');
    }
  };

  const handleJoin = (lesson: Lesson) => {
    const link = resolveLink(lesson);
    if (!link) {
      toast.error('No Zoom link set. Add your personal Zoom link in your profile.');
      return;
    }
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'scheduled': return 'info';
      case 'live': return 'warning';
      case 'completed': return 'success';
      case 'cancelled': return 'destructive';
      default: return 'default';
    }
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
              day: 'numeric',
            })}
          </p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <div>{stats.totalStudents} Students</div>
          <div>Attendance: {stats.attendanceRate}%</div>
        </div>
      </div>

      {!zoomLink && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="py-3 text-sm text-yellow-800">
            You have no personal Zoom link set yet. Ask management to add it so your
            "Start Meeting" button and your students' "Enter" button work.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatsCard title="Today's Lessons" value={stats.todayLessons} icon="calendar" />
        <StatsCard title="Total Students" value={stats.totalStudents} icon="users" />
        <StatsCard title="Completed" value={stats.completedLessons} icon="check" />
        <StatsCard title="Attendance Rate" value={`${stats.attendanceRate}%`} icon="attendance" />
        <StatsCard title="Earnings" value={stats.earnings.toFixed(2)} icon="attendance" />
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
                      {lesson.title} • {lesson.scheduled_date} at {formatTime(lesson.start_time)}
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
                      <div className="text-sm font-medium">{formatTime(lesson.start_time)}</div>
                      <div className="text-xs text-muted-foreground">{formatTime(lesson.end_time)}</div>
                    </div>
                    <div>
                      <p className="font-medium">{lesson.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {[lesson.subject?.name, lesson.student?.profile?.full_name].filter(Boolean).join(' • ')}
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
                      <>
                        <Button variant="outline" onClick={() => handleJoin(lesson)}>
                          <Video className="h-4 w-4 mr-2" />
                          Join
                        </Button>
                        <Button onClick={() => navigate(`/teacher/lessons/${lesson.id}/report`)}>
                          End Meeting
                        </Button>
                      </>
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
