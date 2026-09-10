import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Lesson } from '@/types';
import { Search, Eye, Calendar } from 'lucide-react';
import { formatDate, formatTime } from '@/utils/format';
import { formatTimeInTimezone, formatDateInTimezone, getCurrentDateInTimezone } from '@/utils/timezone';

export function TeacherLessons() {
  const { user } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [teacherTimezone, setTeacherTimezone] = useState<string>('UTC');
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchTeacherData();
      fetchLessons();
    }
  }, [user]);

  const fetchTeacherData = async () => {
    const teacherId = user?.id;
    const { data: teacherRow } = await supabase
      .from('teachers')
      .select('timezone')
      .eq('id', teacherId)
      .single();
    setTeacherTimezone(teacherRow?.timezone || 'UTC');
  };

  const fetchLessons = async () => {
    const teacherId = user?.id;
    setLoading(true);

    try {
      // Get teacher's courses with timezones
      const { data: courses } = await supabase
        .from('courses')
        .select('id, timezone')
        .eq('teacher_id', teacherId)
        .eq('status', 'active');

      const courseTimezoneMap: Record<string, string> = {};
      (courses || []).forEach((c: any) => {
        if (c.timezone) courseTimezoneMap[c.id] = c.timezone;
      });

      // Query lessons directly by teacher_id so every lesson the teacher owns
      // appears — including course-generated ones.
      const { data: rows, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('scheduled_date', { ascending: false })
        .order('start_time');

      if (error) {
        console.error('Error fetching teacher lessons:', error);
        setLessons([]);
        setLoading(false);
        return;
      }

      const lessonRows = rows || [];
      const studentIds = [...new Set(lessonRows.map((l: any) => l.student_id).filter(Boolean))];
      const subjectIds = [...new Set(lessonRows.map((l: any) => l.subject_id).filter(Boolean))];
      const courseIds = [...new Set(lessonRows.map((l: any) => l.course_id).filter(Boolean))];

      const [profilesRes, subjectsRes, coursesRes] = await Promise.all([
        studentIds.length > 0
          ? supabase.from('profiles').select('id, full_name').in('id', studentIds)
          : Promise.resolve({ data: [] as any[] }),
        subjectIds.length > 0
          ? supabase.from('subjects').select('id, name, color').in('id', subjectIds)
          : Promise.resolve({ data: [] as any[] }),
        courseIds.length > 0
          ? supabase.from('courses').select('id, timezone').in('id', courseIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const courseTimezoneMap: Record<string, string> = {};
      (coursesRes.data || []).forEach((c: any) => {
        if (c.timezone) courseTimezoneMap[c.id] = c.timezone;
      });

      const enriched: Lesson[] = lessonRows.map((l: any) => {
        const sp = (profilesRes.data || []).find((p: any) => p.id === l.student_id);
        const subj = (subjectsRes.data || []).find((s: any) => s.id === l.subject_id);
        const courseTz = l.course_id ? courseTimezoneMap[l.course_id] || 'UTC' : 'UTC';
        
        // Convert times to teacher's timezone for display
        let displayStartTime = l.start_time;
        let displayEndTime = l.end_time;
        let displayDate = l.scheduled_date;
        
        if (l.start_time_utc) {
          displayStartTime = formatTimeInTimezone(l.start_time_utc, teacherTimezone);
          displayEndTime = formatTimeInTimezone(l.end_time_utc, teacherTimezone);
          displayDate = formatDateInTimezone(l.start_time_utc, teacherTimezone);
        }
        
        return {
          ...l,
          start_time: displayStartTime,
          end_time: displayEndTime,
          scheduled_date: displayDate,
          student: { id: l.student_id, profile: sp ? { id: sp.id, full_name: sp.full_name } : undefined },
          subject: subj || undefined,
        };
      });

      setLessons(enriched);
    } catch (err) {
      console.error('Unexpected error loading teacher lessons:', err);
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
                    <TableCell>{lesson.student?.profile?.full_name || '-'}</TableCell>
                    <TableCell>{lesson.subject?.name || '-'}</TableCell>
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
                        aria-label="View lesson"
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

function getStatusVariant(status: string) {
  switch (status) {
    case 'scheduled': return 'info';
    case 'live': return 'warning';
    case 'completed': return 'success';
    case 'cancelled': return 'destructive';
    case 'absent': return 'secondary';
    default: return 'default';
  }
}