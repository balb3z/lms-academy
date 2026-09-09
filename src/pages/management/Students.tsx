import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { supabase } from '@/lib/supabase/client';
import { Student } from '@/types';
import { Search, Plus, Eye, Edit, Trash2 } from 'lucide-react';
import { AddStudentModal } from '@/components/management/AddStudentModal';

// Augmented type that includes email merged from the users table
interface StudentRow extends Student {
  email?: string;
}

export function Students() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      // Fetch student rows
      const { data: studentRows, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .order('created_at', { ascending: false });

      if (studentsError) {
        console.error('Error fetching students:', studentsError);
        setLoading(false);
        return;
      }

      if (!studentRows || studentRows.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      const ids = studentRows.map((s) => s.id);

      // Fetch profiles and users in parallel
      const [{ data: profiles }, { data: users }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, phone, avatar_url').in('id', ids),
        supabase.from('users').select('id, email').in('id', ids),
      ]);

      // Merge everything into one object per student
      const enriched: StudentRow[] = studentRows.map((s) => {
        const profile = profiles?.find((p) => p.id === s.id);
        const user = users?.find((u) => u.id === s.id);
        return {
          ...s,
          email: user?.email,
          profile: profile
            ? { id: profile.id, full_name: profile.full_name, phone: profile.phone, avatar_url: profile.avatar_url }
            : undefined,
        };
      });

      setStudents(enriched);
    } catch (err) {
      console.error('Unexpected error loading students:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase()) ||
      s.student_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Students</h1>
          <p className="text-muted-foreground">Manage all students in the academy</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Student
        </Button>
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
            <Button variant="outline">Filter</Button>
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">Loading...</TableCell>
                </TableRow>
              ) : filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No students found
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-mono text-sm">{student.student_id}</TableCell>
                    <TableCell className="font-medium">{student.profile?.full_name || '-'}</TableCell>
                    <TableCell>{student.email || '-'}</TableCell>
                    <TableCell>{student.profile?.phone || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={student.is_active ? 'success' : 'secondary'}>
                        {student.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/management/students/${student.id}`)}
                          aria-label="View student"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Edit student">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" aria-label="Delete student">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AddStudentModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={fetchStudents}
      />
    </div>
  );
}
