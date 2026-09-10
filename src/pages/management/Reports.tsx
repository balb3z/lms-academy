import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase/client';
import { LessonReport } from '@/types';
import { Search, Eye } from 'lucide-react';
import { formatDate } from '@/utils/format';

export function Reports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<LessonReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);

    // Report + lesson in one query; student & teacher names resolved separately
    // (student_id / teacher_id === profiles.id, so there is no embed to join through).
    const { data: rows, error } = await supabase
      .from('lesson_reports')
      .select('*, lesson:lesson_id (*)')
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('Error fetching reports:', error);
      setReports([]);
      setLoading(false);
      return;
    }

    const list = rows || [];
    const personIds = [
      ...new Set([
        ...list.map((r: any) => r.student_id),
        ...list.map((r: any) => r.teacher_id),
      ].filter(Boolean)),
    ];

    const { data: profiles } = personIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', personIds)
      : { data: [] as any[] };

    const nameById: Record<string, string> = {};
    (profiles || []).forEach((p: any) => { nameById[p.id] = p.full_name; });

    const enriched = list.map((r: any) => ({
      ...r,
      student: { id: r.student_id, profile: { full_name: nameById[r.student_id] } },
      teacher: { id: r.teacher_id, profile: { full_name: nameById[r.teacher_id] } },
    }));

    setReports(enriched);
    setLoading(false);
  };

  const getAttendanceBadge = (status: string) => {
    const variants: Record<string, any> = {
      present: 'success',
      late: 'warning',
      absent: 'destructive',
      excused: 'info',
    };
    return variants[status] || 'default';
  };

  const getPerformanceBadge = (rating: string) => {
    const variants: Record<string, any> = {
      excellent: 'success',
      very_good: 'info',
      good: 'default',
      needs_improvement: 'warning',
    };
    return variants[rating] || 'default';
  };

  const filteredReports = reports.filter(report =>
    report.student?.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    report.teacher?.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    report.lesson?.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">View all lesson reports</p>
        </div>
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
                <TableHead>Student</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Attendance</TableHead>
                <TableHead>Performance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">Loading...</TableCell>
                </TableRow>
              ) : filteredReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
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
                    <TableCell>{report.student?.profile?.full_name || '-'}</TableCell>
                    <TableCell>{report.teacher?.profile?.full_name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={getAttendanceBadge(report.attendance_status)}>
                        {report.attendance_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {report.performance_rating && (
                        <Badge variant={getPerformanceBadge(report.performance_rating)}>
                          {report.performance_rating}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/management/lessons/${report.lesson_id}`)}
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
