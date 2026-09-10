import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { supabase } from '@/lib/supabase/client';
import { Lesson } from '@/types';
import { Search, Plus, Eye, Calendar } from 'lucide-react';
import { formatDate, formatTime } from '@/utils/format';
import { AddLessonModal } from '@/components/management/AddLessonModal';

export function Lessons() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddLesson, setShowAddLesson] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchLessons();
  }, []);

  const fetchLessons = async () => {
    setLoading(true);

    const { data: rows, error } = await supabase
      .from('lessons')
      .select('*')
      .order('scheduled_date', { ascending: false })
      .order('start_time');

    if (error) {
      console.error('Error fetching lessons:', error);
      setLessons([]);
      setLoading(false);
      return;
    }

    const list = rows || [];
    const personIds = [
      ...new Set([
        ...list.map((l: any) => l.student_id),
        ...list.map((l: any) => l.teacher_id),
      ].filter(Boolean)),
    ];
    const subjectIds = [...new Set(list.map((l: any) => l.subject_id).filter(Boolean))];

    const [profilesRes, subjectsRes] = await Promise.all([
      personIds.length > 0
        ? supabase.from('profiles').select('id, full_name').in('id', personIds)
        : Promise.resolve({ data: [] as any[] }),
      subjectIds.length > 0
        ? supabase.from('subjects').select('id, name').in('id', subjectIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const nameById: Record<string, string> = {};
    (profilesRes.data || []).forEach((p: any) => { nameById[p.id] = p.full_name; });
    const subjectById: Record<string, any> = {};
    (subjectsRes.data || []).forEach((s: any) => { subjectById[s.id] = s; });

    const enriched = list.map((l: any) => ({
      ...l,
      student: { id: l.student_id, profile: { full_name: nameById[l.student_id] } },
      teacher: { id: l.teacher_id, profile: { full_name: nameById[l.teacher_id] } },
      subject: l.subject_id ? subjectById[l.subject_id] : undefined,
    }));

    setLessons(enriched);
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
    lesson.teacher?.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    lesson.subject?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Lessons</h1>
          <p className="text-muted-foreground">Manage all lessons in the academy</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/management/calendar')}>
            <Calendar className="h-4 w-4 mr-2" />
            Calendar View
          </Button>
          <Button onClick={() => setShowAddLesson(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Schedule Lesson
          </Button>
        </div>
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
                <TableHead>Teacher</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">Loading...</TableCell>
                </TableRow>
              ) : filteredLessons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
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
                        onClick={() => navigate(`/management/lessons/${lesson.id}`)}
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

      <AddLessonModal
        open={showAddLesson}
        onClose={() => setShowAddLesson(false)}
        onSuccess={() => { setShowAddLesson(false); fetchLessons(); }}
      />
    </div>
  );
}
