import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { supabase } from '@/lib/supabase/client';
import { Teacher } from '@/types';
import { Search, Plus, Eye, Edit, Trash2, UserCog } from 'lucide-react';
import { AddTeacherModal } from '@/components/management/AddTeacherModal';
import { EditTeacherModal } from '@/components/management/EditTeacherModal';

// Augmented type that includes email merged from the users table
interface TeacherRow extends Teacher {
  email?: string;
}

export function Teachers() {
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTeacherId, setEditTeacherId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    setLoading(true);
    try {
      // Fetch teacher rows
      const { data: teacherRows, error: teachersError } = await supabase
        .from('teachers')
        .select('*')
        .order('created_at', { ascending: false });

      if (teachersError) {
        console.error('Error fetching teachers:', teachersError);
        setLoading(false);
        return;
      }

      if (!teacherRows || teacherRows.length === 0) {
        setTeachers([]);
        setLoading(false);
        return;
      }

      const ids = teacherRows.map((t) => t.id);

      // Fetch profiles and users in parallel
      const [{ data: profiles }, { data: users }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, phone, avatar_url').in('id', ids),
        supabase.from('users').select('id, email').in('id', ids),
      ]);

      // Merge everything into one object per teacher
      const enriched: TeacherRow[] = teacherRows.map((t) => {
        const profile = profiles?.find((p) => p.id === t.id);
        const user = users?.find((u) => u.id === t.id);
        return {
          ...t,
          email: user?.email,
          profile: profile
            ? { id: profile.id, full_name: profile.full_name, phone: profile.phone, avatar_url: profile.avatar_url }
            : undefined,
        };
      });

      setTeachers(enriched);
    } catch (err) {
      console.error('Unexpected error loading teachers:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTeachers = teachers.filter(
    (t) =>
      t.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.email?.toLowerCase().includes(search.toLowerCase()) ||
      t.teacher_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Teachers</h1>
          <p className="text-muted-foreground">Manage all teachers in the academy</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Teacher
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search teachers..."
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
                <TableHead>Teacher ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Specialization</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">Loading...</TableCell>
                </TableRow>
              ) : filteredTeachers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No teachers found
                  </TableCell>
                </TableRow>
              ) : (
                filteredTeachers.map((teacher) => (
                  <TableRow key={teacher.id}>
                    <TableCell className="font-mono text-sm">{teacher.teacher_id}</TableCell>
                    <TableCell className="font-medium">{teacher.profile?.full_name || '-'}</TableCell>
                    <TableCell>{teacher.email || '-'}</TableCell>
                    <TableCell>{teacher.specialization || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={teacher.is_active ? 'success' : 'secondary'}>
                        {teacher.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/management/teachers/${teacher.id}`)}
                          aria-label="View teacher"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Manage teacher">
                          <UserCog className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Edit teacher" onClick={() => setEditTeacherId(teacher.id)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" aria-label="Delete teacher">
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

      <AddTeacherModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={fetchTeachers}
      />

      <EditTeacherModal
        open={editTeacherId !== null}
        onClose={() => setEditTeacherId(null)}
        onSuccess={fetchTeachers}
        teacherId={editTeacherId}
      />
    </div>
  );
}
