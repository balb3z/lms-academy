import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatsCard } from '@/components/ui/StatsCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { supabase } from '@/lib/supabase/client';
import { formatTime } from '@/utils/format';
import { Lesson } from '@/types';
import { Calendar, Plus, Users, UserCog, BookOpen } from 'lucide-react';
import { AddLessonModal } from '@/components/management/AddLessonModal';
import { AddStudentModal } from '@/components/management/AddStudentModal';
import { AddTeacherModal } from '@/components/management/AddTeacherModal';

export function ManagementDashboard() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    todayLessons: 0,
    upcomingLessons: 0,
    completedLessons: 0,
    attendanceRate: 0
  });
  const [todayLessons, setTodayLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddLesson, setShowAddLesson] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showAddTeacher, setShowAddTeacher] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const [
        { count: totalStudents },
        { count: totalTeachers },
        { count: todayLessons },
        { count: upcomingLessons },
        { count: completedLessons }
      ] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }),
        supabase.from('teachers').select('*', { count: 'exact', head: true }),
        supabase.from('lessons').select('*', { count: 'exact', head: true })
          .eq('scheduled_date', today),
        supabase.from('lessons').select('*', { count: 'exact', head: true })
          .gt('scheduled_date', today)
          .neq('status', 'completed'),
        supabase.from('lessons').select('*', { count: 'exact', head: true })
          .eq('status', 'completed')
      ]);

      const { data: lessons } = await supabase
        .from('lessons')
        .select(`
          *,
          student:student_id (
            id,
            profile:id (full_name)
          ),
          teacher:teacher_id (
            id,
            profile:id (full_name)
          ),
          subject:subject_id (*)
        `)
        .eq('scheduled_date', today)
        .order('start_time');

      setTodayLessons(lessons || []);
      setStats({
        totalStudents: totalStudents || 0,
        totalTeachers: totalTeachers || 0,
        todayLessons: todayLessons || 0,
        upcomingLessons: upcomingLessons || 0,
        completedLessons: completedLessons || 0,
        attendanceRate: 0
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAddLesson(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Schedule Lesson
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatsCard title="Total Students" value={stats.totalStudents} icon="students" />
        <StatsCard title="Total Teachers" value={stats.totalTeachers} icon="teachers" />
        <StatsCard title="Today's Lessons" value={stats.todayLessons} icon="lessons" />
        <StatsCard title="Upcoming" value={stats.upcomingLessons} icon="calendar" />
        <StatsCard title="Completed" value={stats.completedLessons} icon="check" />
        <StatsCard title="Attendance" value={`${stats.attendanceRate}%`} icon="attendance" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Button
          variant="outline"
          className="h-20 flex flex-col gap-1"
          onClick={() => setShowAddStudent(true)}
        >
          <Users className="h-5 w-5" />
          <span className="text-xs">Add Student</span>
        </Button>
        <Button
          variant="outline"
          className="h-20 flex flex-col gap-1"
          onClick={() => setShowAddTeacher(true)}
        >
          <UserCog className="h-5 w-5" />
          <span className="text-xs">Add Teacher</span>
        </Button>
        <Button
          variant="outline"
          className="h-20 flex flex-col gap-1"
          onClick={() => setShowAddLesson(true)}
        >
          <Calendar className="h-5 w-5" />
          <span className="text-xs">Schedule Lesson</span>
        </Button>
        <Button variant="outline" className="h-20 flex flex-col gap-1" onClick={() => {}}>
          <BookOpen className="h-5 w-5" />
          <span className="text-xs">View Reports</span>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today's Schedule</CardTitle>
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
                        {lesson.subject?.name} • {lesson.student?.profile?.full_name} • {lesson.teacher?.profile?.full_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={getStatusVariant(lesson.status)}>
                      {lesson.status}
                    </Badge>
                    {lesson.meeting_url && (
                      <Button size="sm" variant="outline" onClick={() => window.open(lesson.meeting_url, '_blank')}>
                        Join
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddLessonModal 
        open={showAddLesson} 
        onClose={() => setShowAddLesson(false)}
        onSuccess={() => {
          setShowAddLesson(false);
          fetchDashboardData();
        }}
      />

      <AddStudentModal
        open={showAddStudent}
        onClose={() => setShowAddStudent(false)}
        onSuccess={fetchDashboardData}
      />

      <AddTeacherModal
        open={showAddTeacher}
        onClose={() => setShowAddTeacher(false)}
        onSuccess={fetchDashboardData}
      />
    </div>
  );
}
