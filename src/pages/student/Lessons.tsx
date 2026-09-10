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
import { Search, Eye } from 'lucide-react';
import { formatDate, formatTime } from '@/utils/format';
import { formatTimeInTimezone, formatDateInTimezone } from '@/utils/timezone';

export function StudentLessons() {
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
    const studentId = user?.id;
    setLoading(true);

    try {
      // Fetch the student's lessons, then resolve teacher names + subjects + course timezone via
      // separate round-trips. (Previously the broken profile:user_id embed made
      // the whole query fail, so no lessons were listed.)
      const { data: rows, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('student_id', studentId)
        .order('scheduled_date', { ascending: false })
        .order('start_time');

      if (error) {
        console.error('Error fetching student lessons:', error);
        setLessons([]);
        setLoading(false);
        return;
      }

      const lessonRows = rows || [];
      const teacherIds = [...new Set(lessonRows.map((l: any) => l.teacher_id).filter(Boolean))];
      const subjectIds = [...new Set(lessonRows.map((l: any) => l.subject_id).filter(Boolean))];
      const courseIds = [...new Set(lessonRows.map((l: any) => l.course_id).filter(Boolean))];

      const [profilesRes, subjectsRes, coursesRes] = await Promise.all([
        teacherIds.length > 0
          ? supabase.from('profiles').select('id, full_name').in('id', teacherIds)
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
        courseTimezoneMap[c.id] = c.timezone || 'UTC';
      });

      const enriched: Lesson[] = lessonRows.map((l: any) => {
        const tp = (profilesRes.data || []).find((p: any) => p.id === l.teacher_id);
        const subj = (subjectsRes.data || []).find((s: any) => s.id === l.subject_id);
        const courseTz = l.course_id ? courseTimezoneMap[l.course_id] || 'UTC' : 'UTC';
        
        // Convert times to course timezone
        let displayStartTime = l.start_time;
        let displayEndTime = l.end_time;
        let displayDate = l.scheduled_date;
        
        if (l.start_time_utc) {
          displayStartTime = formatTimeInTimezone(l.start_time_utc, courseTz);
          displayEndTime = formatTimeInTimezone(l.end_time_utc, courseTz);
          displayDate = formatDateInTimezone(l.start_time_utc, courseTz);
        }
        
        return {
          ...l,
          start_time: displayStartTime,
          end_time: displayEndTime,
          scheduled_date: displayDate,
          teacher: { id: l.teacher_id, profile: tp ? { id: tp.id, full_name: tp.full_name } : undefined },
          subject: subj || undefined,
        };
      });

      setLessons(enriched);
    } catch (err) {
      console.error('Unexpected error loading student lessons:', err);
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
    lesson.teacher?.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    lesson.subject?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Lessons</h1>
        <p className="text-muted-foreground">View all your lessons</p>
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
                <TableHead>Teacher</TableHead>
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
                    <TableCell>{lesson.teacher?.profile?.full_name || '-'}</TableCell>
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
                        onClick={() => navigate(`/student/lessons/${lesson.id}`)}
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
