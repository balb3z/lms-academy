import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { supabase } from '@/lib/supabase/client';
import { Teacher } from '@/types';
import { Search, Plus, Eye, Edit, Trash2, UserCog } from 'lucide-react';

export function Teachers() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    const { data } = await supabase
      .from('teachers')
      .select(`
        *,
        profile:user_id (
          full_name,
          email,
          phone,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false });

    setTeachers(data || []);
    setLoading(false);
  };

  const filteredTeachers = teachers.filter(teacher =>
    teacher.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    teacher.profile?.email?.toLowerCase().includes(search.toLowerCase()) ||
    teacher.teacher_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Teachers</h1>
          <p className="text-muted-foreground">Manage all teachers in the academy</p>
        </div>
        <Button>
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
                    <TableCell className="font-medium">{teacher.profile?.full_name}</TableCell>
                    <TableCell>{teacher.profile?.email}</TableCell>
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
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <UserCog className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive">
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
    </div>
  );
}