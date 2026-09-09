import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Student } from '@/types';
import { Search } from 'lucide-react';

export function TeacherStudents() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (user) {
      fetchStudents();
    }
  }, [user]);

  const fetchStudents = async () => {
    const teacherId = user?.id;

    const { data: assignments } = await supabase
      .from('student_teacher_assignments')
      .select('student_id')
      .eq('teacher_id', teacherId)
      .eq('is_active', true);

    const studentIds = assignments?.map(a => a.student_id) || [];

    const { data } = await supabase
      .from('students')
      .select(`
        *,
        profile:user_id (
          full_name,
          email,
          phone
        )
      `)
      .in('id', studentIds)
      .order('created_at', { ascending: false });

    setStudents(data || []);
    setLoading(false);
  };

  const filteredStudents = students.filter(student =>
    student.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    student.profile?.email?.toLowerCase().includes(search.toLowerCase()) ||
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
                    <TableCell>{student.profile?.email}</TableCell>
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