import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
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

type DisplayLesson = Lesson & { displayDate: string; displayTime: string };

export function StudentLessons() {
  const { user } = useAuth();
  const [lessons, setLessons] = useState<DisplayLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const userId = user?.id;

  const fetchLessons = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    try {
      // Fetch the student's lessons, then resolve teacher names + subjects + course timezone
      // via separate round-trips.
      const { data: rows, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('student_id', userId)
        .order('scheduled_date', { ascending: false })
        .order('start_time');
      if (error) throw error;

      const lessonRows = (rows || []) as Lesson[];
      const teacherIds = [...new Set(lessonRows.map(l => l.teacher_id).filter(Boolean))];
      const subjectIds = [...new Set(lessonRows.map(l => l.subject_id).filter((x): x is string => Boolean(x)))];
      const courseIds = [...new Set(lessonRows.map(l => l.course_id).filter((x): x is string => Boolean(x)))];

      const [profilesRes, subjectsRes, coursesRes] = await Promise.all([
        teacherIds.length > 0
          ? supabase.from('profiles').select('id, full_name').in('id', teacherIds)
          : Promise.resolve({ data: [] as { id: string; full_name: string }[], error: null }),
        subjectIds.length > 0
          ? supabase.from('subjects').select('id, name, color').in('id', subjectIds)
          : Promise.resolve({ data: [] as { id: string; name: string; color: string }[], error: null }),
        courseIds.length > 0
          ? supabase.from('courses').select('id, timezone').in('id', courseIds)
          : Promise.resolve({ data: [] as { id: string; timezone: string | null }[], error: null }),
      ]);
      const relErr = profilesRes.error || subjectsRes.error || coursesRes.error;
      if (relErr) throw relErr;

      const courseTimezoneMap: Record<string, string> = {};
      (coursesRes.data || []).forEach((c: { id: string; timezone: string | null }) => {
        courseTimezoneMap[c.id] = c.timezone || 'UTC';
      });

      const enriched: DisplayLesson[] = lessonRows.map(l => {
        const tp = (profilesRes.data || []).find((p: { id: string; full_name: string }) => p.id === l.teacher_id);
        const subj = (subjectsRes.data || []).find((s: { id: string; name: string; color: string }) => s.id === l.subject_id);
        const courseTz = l.course_id ? courseTimezoneMap[l.course_id] || 'UTC' : 'UTC';

        // Convert times to course timezone for display (helpers return '' for invalid input)
        const hasUtc = Boolean(l.start_time_utc && l.end_time_utc);
        return {
          ...l,
          displayDate: (hasUtc && formatDateInTimezone(l.start_time_utc, courseTz)) || formatDate(l.scheduled_date),
          displayTime: `${(hasUtc && formatTimeInTimezone(l.start_time_utc, courseTz)) || formatTime(l.start_time)} - ${(hasUtc && formatTimeInTimezone(l.end_time_utc, courseTz)) || formatTime(l.end_time)}`,
          teacher: { id: l.teacher_id, profile: tp ? { id: tp.id, full_name: tp.full_name } : undefined } as Lesson['teacher'],
          subject: (subj || undefined) as Lesson['subject'],
        };
      });

      setLessons(enriched);
    } catch (err) {
      console.error('Error loading student lessons:', err);
      toast.error('Failed to load lessons.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

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
                    <TableCell>{lesson.displayDate}</TableCell>
                    <TableCell>{lesson.displayTime}</TableCell>
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