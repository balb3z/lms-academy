import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { LessonReport } from '@/types';
import { Search, Eye } from 'lucide-react';
import { formatDate } from '@/utils/format';

export function StudentReports() {
  const { user } = useAuth();
  const [reports, setReports] = useState<LessonReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (user) {
      fetchReports();
    }
  }, [user]);

  const fetchReports = async () => {
    const studentId = user?.id;

    // Fetch reports + lesson in one query. Teacher name is resolved separately
    // because lesson_reports.teacher_id is the auth user id, which maps to
    // profiles.id — there is no user_id FK on the teachers table to join through.
    const { data: rows } = await supabase
      .from('lesson_reports')
      .select('*, lesson:lesson_id (*)')
      .eq('student_id', studentId)
      .eq('is_visible_to_student', true)
      .order('submitted_at', { ascending: false });

    if (!rows || rows.length === 0) {
      setReports([]);
      setLoading(false);
      return;
    }

    // Resolve teacher names from profiles using teacher_id directly.
    const teacherIds = [...new Set(rows.map((r: any) => r.teacher_id).filter(Boolean))];
    const { data: profiles } = teacherIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', teacherIds)
      : { data: [] as any[] };

    const enriched = rows.map((r: any) => {
      const p = (profiles || []).find((pr: any) => pr.id === r.teacher_id);
      return { ...r, teacher: { id: r.teacher_id, profile: p ? { full_name: p.full_name } : undefined } };
    });

    setReports(enriched);
    setLoading(false);
  };

  const filteredReports = reports.filter(report =>
    report.teacher?.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    report.lesson?.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Reports</h1>
        <p className="text-muted-foreground">View all your lesson reports</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search reports..."
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
                <TableHead>Lesson</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Attendance</TableHead>
                <TableHead>Performance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">Loading...</TableCell>
                </TableRow>
              ) : filteredReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No reports found
                  </TableCell>
                </TableRow>
              ) : (
                filteredReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      {report.lesson?.scheduled_date ? formatDate(report.lesson.scheduled_date) : '-'}
                    </TableCell>
                    <TableCell className="font-medium">{report.lesson?.title}</TableCell>
                    <TableCell>{report.teacher?.profile?.full_name}</TableCell>
                    <TableCell>
                      <Badge variant={
                        report.attendance_status === 'present' ? 'success' :
                        report.attendance_status === 'late' ? 'warning' :
                        report.attendance_status === 'absent' ? 'destructive' :
                        'info'
                      }>
                        {report.attendance_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {report.performance_rating && (
                        <Badge variant="info">
                          {report.performance_rating}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon">
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