import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Student } from '@/types';
import { Search } from 'lucide-react';

type StudentRow = Student & { email?: string };

export function TeacherStudents() {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const userId = user?.id;

  const fetchStudents = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    try {
      const { data: assignments, error: assignErr } = await supabase
        .from('student_teacher_assignments')
        .select('student_id')
        .eq('teacher_id', userId)
        .eq('is_active', true);
      if (assignErr) throw assignErr;

      const studentIds = [...new Set((assignments || []).map(a => a.student_id as string))];

      if (studentIds.length === 0) {
        setStudents([]);
        return;
      }

      const { data: studentRows, error: studentsErr } = await supabase
        .from('students')
        .select('*')
        .in('id', studentIds)
        .order('created_at', { ascending: false });
      if (studentsErr) throw studentsErr;

      const rows = (studentRows || []) as Student[];
      const ids = rows.map(s => s.id);
      const [profilesRes, usersRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, phone').in('id', ids),
        supabase.from('users').select('id, email').in('id', ids),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (usersRes.error) throw usersRes.error;

      setStudents(rows.map(s => {
        const p = (profilesRes.data || []).find((x: { id: string }) => x.id === s.id);
        const u = (usersRes.data || []).find((x: { id: string }) => x.id === s.id);
        return {
          ...s,
          email: u?.email,
          profile: p ? { id: p.id, full_name: p.full_name, phone: p.phone || undefined } : undefined,
        };
      }));
    } catch (err) {
      console.error('Error fetching students:', err);
      toast.error('Failed to load students.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const filteredStudents = students.filter(student =>
    student.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    student.email?.toLowerCase().includes(search.toLowerCase()) ||
    student.student_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Students</h1>
        <p className="text-muted-foreground">View all students assigned to you</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
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
                <TableHead>Student ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">Loading...</TableCell>
                </TableRow>
              ) : filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No students assigned to you
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-mono text-sm">{student.student_id}</TableCell>
                    <TableCell className="font-medium">{student.profile?.full_name}</TableCell>
                    <TableCell>{student.email}</TableCell>
                    <TableCell>{student.profile?.phone || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={student.is_active ? 'success' : 'secondary'}>
                        {student.is_active ? 'Active' : 'Inactive'}
                      </Badge>
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