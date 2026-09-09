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
import { Play, FileText, Users, Calendar, Clock } from 'lucide-react';

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

  useEffect(() => {
    if (user) {
      fetchTeacherData();
    }
  }, [user]);

  const fetchTeacherData = async () => {
    const today = new Date().toISOString().split('T')[0];
    const teacherId = user?.id;

    try {
      const { data: assignments } = await supabase
        .from('student_teacher_assignments')
        .select('student_id')
        .eq('teacher_id', teacherId)
        .eq('is_active', true);

      const studentIds = assignments?.map(a => a.student_id) || [];

      const { data: lessons } = await supabase
        .from('lessons')
        .select(`
          *,
          student:student_id (
            id,
            profile:user_id (full_name)
          ),
          subject:subject_id (*)
        `)
        .eq('scheduled_date', today)
        .in('student_id', studentIds)
        .order('start_time');

      setTodayLessons(lessons || []);

      const { data: pending } = await supabase
        .from('lessons')
        .select(`
          *,
          student:student_id (
            id,
            profile:user_id (full_name)
          ),
          subject:subject_id (*)
        `)
        .eq('status', 'completed')
        .in('student_id', studentIds)
        .not('id', 'in', (
          supabase.from('lesson_reports').select('lesson_id')
        ));

      setPendingReports(pending || []);

      const { count: totalStudents } = await supabase
        .from('student_teacher_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', teacherId)
        .eq('is_active', true);

      const { count: completedLessons } = await supabase
        .from('lessons')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .in('student_id', studentIds);

      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('status')
        .in('student_id', studentIds);

      const presentCount = attendanceData?.filter(a => a.status === 'present').length || 0;
      const totalAttendance = attendanceData?.length || 0;

      setStats({
        totalStudents: totalStudents || 0,
        todayLessons: lessons?.length || 0,
        completedLessons: completedLessons || 0,
        attendanceRate: totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0
      });
    } catch (error) {
      console.error('Error fetching teacher data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartLesson = async (lessonId: string) => {
    const { error } = await supabase
      .from('lessons')
      .update({
        status: 'live',
        actual_start_time: new Date().toISOString()
      })
      .eq('id', lessonId);

    if (!error) {
      const lesson = todayLessons.find(l => l.id === lessonId);
      if (lesson?.meeting_url) {
        window.open(lesson.meeting_url, '_blank');
      }
      fetchTeacherData();
    }
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
              day: 'numeric' 
            })}
          </p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <div>{stats.totalStudents} Students</div>
          <div>Attendance: {stats.attendanceRate}%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard title="Today's Lessons" value={stats.todayLessons} icon="calendar" />
        <StatsCard title="Total Students" value={stats.totalStudents} icon="users" />
        <StatsCard title="Completed" value={stats.completedLessons} icon="check" />
        <StatsCard title="Attendance Rate" value={`${stats.attendanceRate}%`} icon="attendance" />
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
                    <p className="font-medium">{lesson.student?.profile?.full_name}</p>
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
                        {lesson.subject?.name} • {lesson.student?.profile?.full_name}
                      </p>
                    </div>
                    <Badge variant={getStatusVariant(lesson.status)}>
                      {lesson.status}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    {lesson.status === 'scheduled' && (
                      <Button onClick={() => handleStartLesson(lesson.id)}>
                        <Play className="h-4 w-4 mr-2" />
                        Start Meeting
                      </Button>
                    )}
                    {lesson.status === 'live' && (
                      <Button variant="outline" onClick={() => window.open(lesson.meeting_url, '_blank')}>
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