import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { supabase } from '@/lib/supabase/client';
import { Search, Plus, Eye } from 'lucide-react';
import { AddCourseModal } from '@/components/management/AddCourseModal';

// ── types ──────────────────────────────────────────────────────────────────────

interface CourseRow {
  id: string;
  name: string;
  student_id: string;
  teacher_id: string;
  total_lessons: number;
  lessons_per_week: number;
  lesson_duration_minutes: number;
  preferred_days: string[];
  preferred_time: string;
  start_date: string;
  payment_type: string;
  currency: string;
  status: string;
  payment_status: string;
  student_name: string;
  teacher_name: string;
  completed_lessons: number;
}

const STATUS_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'secondary' | 'default'> = {
  active: 'success',
  completed: 'info',
  paused: 'warning',
  cancelled: 'secondary',
};

const PAYMENT_VARIANT: Record<string, 'success' | 'warning' | 'secondary' | 'destructive' | 'default'> = {
  paid: 'success',
  partial: 'warning',
  unpaid: 'secondary',
  overdue: 'destructive',
};

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── component ──────────────────────────────────────────────────────────────────

export function Courses() {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const { data: courseRows, error } = await supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching courses:', error);
        setLoading(false);
        return;
      }

      if (!courseRows || courseRows.length === 0) {
        setCourses([]);
        setLoading(false);
        return;
      }

      const studentIds = [...new Set(courseRows.map((c: any) => c.student_id as string))];
      const teacherIds = [...new Set(courseRows.map((c: any) => c.teacher_id as string))];
      const courseIds = courseRows.map((c: any) => c.id as string);

      const [spRes, tpRes, lessonsRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name').in('id', studentIds),
        supabase.from('profiles').select('id, full_name').in('id', teacherIds),
        supabase
          .from('lessons')
          .select('course_id')
          .in('course_id', courseIds)
          .eq('status', 'completed'),
      ]);

      // Build completed-lesson count per course
      const completedMap: Record<string, number> = {};
      (lessonsRes.data || []).forEach((l: any) => {
        completedMap[l.course_id] = (completedMap[l.course_id] || 0) + 1;
      });

      const enriched: CourseRow[] = courseRows.map((c: any) => {
        const sp = (spRes.data || []).find((p: any) => p.id === c.student_id);
        const tp = (tpRes.data || []).find((p: any) => p.id === c.teacher_id);
        return {
          ...c,
          student_name: sp?.full_name ?? '-',
          teacher_name: tp?.full_name ?? '-',
          completed_lessons: completedMap[c.id] ?? 0,
        };
      });

      setCourses(enriched);
    } catch (err) {
      console.error('Unexpected error loading courses:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = courses.filter(
    c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.student_name.toLowerCase().includes(search.toLowerCase()) ||
      c.teacher_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Courses</h1>
          <p className="text-muted-foreground">Create courses and manage their auto-generated lesson schedules</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Course
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by course name, student, or teacher…"
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">Loading…</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {courses.length === 0 ? 'No courses yet. Create the first one.' : 'No courses match your search.'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(course => {
                  const progress =
                    course.total_lessons > 0
                      ? Math.round((course.completed_lessons / course.total_lessons) * 100)
                      : 0;

                  return (
                    <TableRow key={course.id}>
                      <TableCell className="font-medium">{course.name}</TableCell>
                      <TableCell>{course.student_name}</TableCell>
                      <TableCell>{course.teacher_name}</TableCell>
                      <TableCell>
                        <div className="space-y-1 min-w-[80px]">
                          <span className="text-sm tabular-nums">
                            {course.completed_lessons}/{course.total_lessons}
                          </span>
                          <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all duration-300"
                              style={{ width: `${progress}%` }}
                              aria-label={`${progress}% complete`}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>
                          {course.preferred_days
                            .map(d => capitalize(d).slice(0, 3))
                            .join(', ')}
                        </div>
                        <div className="text-muted-foreground">{course.preferred_time}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[course.status] ?? 'default'}>
                          {capitalize(course.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={PAYMENT_VARIANT[course.payment_status] ?? 'default'}>
                          {capitalize(course.payment_status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/management/courses/${course.id}`)}
                          aria-label={`View ${course.name}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AddCourseModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={fetchCourses}
      />
    </div>
  );
}
