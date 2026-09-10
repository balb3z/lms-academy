import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatsCard } from '@/components/ui/StatsCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { supabase } from '@/lib/supabase/client';
import { formatTime } from '@/utils/format';
import { Lesson } from '@/types';
import { Plus, Users, UserCog, BookOpen, GraduationCap } from 'lucide-react';
import { AddLessonModal } from '@/components/management/AddLessonModal';
import { AddStudentModal } from '@/components/management/AddStudentModal';
import { AddTeacherModal } from '@/components/management/AddTeacherModal';
import { AddCourseModal } from '@/components/management/AddCourseModal';

export function ManagementDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalCourses: 0,
    todayLessons: 0,
    upcomingLessons: 0,
    completedLessons: 0,
  });
  const [todayLessons, setTodayLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddLesson, setShowAddLesson] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const [showAddCourse, setShowAddCourse] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const today = new Date().toISOString().split('T')[0];

    try {
      const [
        { count: totalStudents },
        { count: totalTeachers },
        { count: totalCourses },
        { count: todayLessons },
        { count: upcomingLessons },
        { count: completedLessons },
      ] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }),
        supabase.from('teachers').select('*', { count: 'exact', head: true }),
        supabase.from('courses').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('lessons').select('*', { count: 'exact', head: true })
          .eq('scheduled_date', today),
        supabase.from('lessons').select('*', { count: 'exact', head: true })
          .gt('scheduled_date', today)
          .neq('status', 'completed'),
        supabase.from('lessons').select('*', { count: 'exact', head: true })
          .eq('status', 'completed'),
      ]);

      // Fetch today's lessons — profiles resolved with separate round-trips
      const { data: lessonRows } = await supabase
        .from('lessons')
        .select('*, subject:subject_id(*)')
        .eq('scheduled_date', today)
        .order('start_time');

      let enrichedLessons: Lesson[] = [];

      if (lessonRows && lessonRows.length > 0) {
        const studentIds = [...new Set(lessonRows.map((l: { student_id: string }) => l.student_id))];
        const teacherIds = [...new Set(lessonRows.map((l: { teacher_id: string }) => l.teacher_id))];

        const [spRes, tpRes] = await Promise.all([
          supabase.from('profiles').select('id, full_name').in('id', studentIds),
          supabase.from('profiles').select('id, full_name').in('id', teacherIds),
        ]);

        enrichedLessons = lessonRows.map((l: { student_id: string; teacher_id: string }) => {
          const sp = (spRes.data || []).find((p) => p.id === l.student_id);
          const tp = (tpRes.data || []).find((p) => p.id === l.teacher_id);
          return {
            ...l,
            student: { id: l.student_id, profile: sp ? { id: sp.id, full_name: sp.full_name } : undefined },
            teacher: { id: l.teacher_id, profile: tp ? { id: tp.id, full_name: tp.full_name } : undefined },
          };
        });
      }

      setTodayLessons(enrichedLessons);
      setStats({
        totalStudents: totalStudents || 0,
        totalTeachers: totalTeachers || 0,
        totalCourses: totalCourses || 0,
        todayLessons: todayLessons || 0,
        upcomingLessons: upcomingLessons || 0,
        completedLessons: completedLessons || 0,
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
              day: 'numeric',
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAddLesson(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Schedule Lesson
          </Button>
          <Button onClick={() => setShowAddCourse(true)}>
            <GraduationCap className="h-4 w-4 mr-2" />
            Create Course
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatsCard title="Total Students" value={stats.totalStudents} icon="students" />
        <StatsCard title="Total Teachers" value={stats.totalTeachers} icon="teachers" />
        <StatsCard title="Active Courses" value={stats.totalCourses} icon="lessons" />
        <StatsCard title="Today's Lessons" value={stats.todayLessons} icon="calendar" />
        <StatsCard title="Upcoming" value={stats.upcomingLessons} icon="calendar" />
        <StatsCard title="Completed" value={stats.completedLessons} icon="check" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Button
          variant="outline"
          className="h-20 flex flex-col gap-1"
          onClick={() => setShowAddStudent(true)}
        >
          <Users className="h-5 w-5" aria-hidden="true" />
          <span className="text-xs">Add Student</span>
        </Button>
        <Button
          variant="outline"
          className="h-20 flex flex-col gap-1"
          onClick={() => setShowAddTeacher(true)}
        >
          <UserCog className="h-5 w-5" aria-hidden="true" />
          <span className="text-xs">Add Teacher</span>
        </Button>
        <Button
          variant="outline"
          className="h-20 flex flex-col gap-1"
          onClick={() => setShowAddCourse(true)}
        >
          <GraduationCap className="h-5 w-5" aria-hidden="true" />
          <span className="text-xs">Create Course</span>
        </Button>
        <Button
          variant="outline"
          className="h-20 flex flex-col gap-1"
          onClick={() => navigate('/management/courses')}
        >
          <BookOpen className="h-5 w-5" aria-hidden="true" />
          <span className="text-xs">View Courses</span>
        </Button>
      </div>

      {/* Today's Schedule */}
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
              {todayLessons.map(lesson => (
                <div
                  key={lesson.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center min-w-[60px]">
                      <div className="text-sm font-medium tabular-nums">{formatTime(lesson.start_time)}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">{formatTime(lesson.end_time)}</div>
                    </div>
                    <div>
                      <p className="font-medium">{lesson.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {[
                          lesson.subject?.name,
                          lesson.student?.profile?.full_name,
                          lesson.teacher?.profile?.full_name,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={getStatusVariant(lesson.status)}>
                      {lesson.status}
                    </Badge>
                    {lesson.meeting_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(lesson.meeting_url, '_blank', 'noopener,noreferrer')}
                      >
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

      {/* Modals */}
      <AddLessonModal
        open={showAddLesson}
        onClose={() => setShowAddLesson(false)}
        onSuccess={() => { setShowAddLesson(false); fetchDashboardData(); }}
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
      <AddCourseModal
        open={showAddCourse}
        onClose={() => setShowAddCourse(false)}
        onSuccess={() => { setShowAddCourse(false); fetchDashboardData(); }}
      />
    </div>
  );
}
