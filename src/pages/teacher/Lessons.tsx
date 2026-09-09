import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Lesson } from '@/types';
import { Search, Eye, Calendar } from 'lucide-react';
import { formatDate, formatTime } from '@/utils/format';

export function TeacherLessons() {
  const { user } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchLessons();
    }
  }, [user]);

  const fetchLessons = async () => {
    const teacherId = user?.id;

    const { data: assignments } = await supabase
      .from('student_teacher_assignments')
      .select('student_id')
      .eq('teacher_id', teacherId)
      .eq('is_active', true);

    const studentIds = assignments?.map(a => a.student_id) || [];

    const { data } = await supabase
      .from('lessons')
      .select(`
        *,
        student:student_id (
          id,
          profile:user_id (full_name)
        ),
        subject:subject_id (*)
      `)
      .in('student_id', studentIds)
      .order('scheduled_date', { ascending: false })
      .order('start_time');

    setLessons(data || []);
    setLoading(false);
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

  const filteredLessons = lessons.filter(lesson =>
    lesson.title?.toLowerCase().includes(search.toLowerCase()) ||
    lesson.student?.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    lesson.subject?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">My Lessons</h1>
          <p className="text-muted-foreground">View all your lessons</p>
        </div>
        <Button variant="outline">
          <Calendar className="h-4 w-4 mr-2" />
          Calendar View
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search lessons..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">Loading...</TableCell>
                </TableRow>
              ) : filteredLessons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No lessons found
                  </TableCell>
                </TableRow>
              ) : (
                filteredLessons.map((lesson) => (
                  <TableRow key={lesson.id}>
                    <TableCell>{formatDate(lesson.scheduled_date)}</TableCell>
                    <TableCell>{formatTime(lesson.start_time)} - {formatTime(lesson.end_time)}</TableCell>
                    <TableCell className="font-medium">{lesson.title}</TableCell>
                    <TableCell>{lesson.student?.profile?.full_name}</TableCell>
                    <TableCell>{lesson.subject?.name}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(lesson.status)}>
                        {lesson.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/teacher/lessons/${lesson.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}