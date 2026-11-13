import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { LessonReport } from '@/types';
import { Search, Eye } from 'lucide-react';
import { formatDate } from '@/utils/format';

export function TeacherReports() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<LessonReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const userId = user?.id;

  const fetchReports = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Student names resolved separately (student_id === profiles.id, no FK to embed through).
      const { data: rows, error } = await supabase
        .from('lesson_reports')
        .select('*, lesson:lesson_id (*)')
        .eq('teacher_id', userId)
        .order('submitted_at', { ascending: false });
      if (error) throw error;

      const list = (rows || []) as LessonReport[];
      const studentIds = [...new Set(list.map(r => r.student_id).filter(Boolean))];
      let profiles: { id: string; full_name: string }[] = [];
      if (studentIds.length > 0) {
        const { data, error: pErr } = await supabase.from('profiles').select('id, full_name').in('id', studentIds);
        if (pErr) throw pErr;
        profiles = data || [];
      }

      setReports(list.map(r => {
        const p = profiles.find(pr => pr.id === r.student_id);
        return { ...r, student: { id: r.student_id, profile: p ? { id: p.id, full_name: p.full_name } : undefined } as LessonReport['student'] };
      }));
    } catch (err) {
      console.error('Error fetching teacher reports:', err);
      toast.error('Failed to load reports.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const getAttendanceBadge = (status: string): 'success' | 'warning' | 'destructive' | 'info' | 'default' => {
    const variants: Record<string, 'success' | 'warning' | 'destructive' | 'info'> = {
      present: 'success',
      late: 'warning',
      absent: 'destructive',
      excused: 'info',
    };
    return variants[status] || 'default';
  };

  const filteredReports = reports.filter(report =>
    report.student?.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    report.lesson?.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Reports</h1>
        <p className="text-muted-foreground">View all your submitted lesson reports</p>
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
                    <TableCell>{report.student?.profile?.full_name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={getAttendanceBadge(report.attendance_status)}>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/teacher/lessons/${report.lesson_id}`)}
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
