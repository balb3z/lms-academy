import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { supabase } from '@/lib/supabase/client';
import { Student } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Calendar, Mail, Phone, User, BookOpen, Clock } from 'lucide-react';

export function StudentProfile() {
  const { id } = useParams();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudent();
  }, [id]);

  const fetchStudent = async () => {
    const { data } = await supabase
      .from('students')
      .select(`
        *,
        profile:user_id (
          full_name,
          email,
          phone,
          avatar_url,
          date_of_birth,
          address
        )
      `)
      .eq('id', id)
      .single();

    setStudent(data);
    setLoading(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (!student) {
    return <div>Student not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-6">
        <Avatar className="h-24 w-24">
          <AvatarImage src={student.profile?.avatar_url} />
          <AvatarFallback className="text-2xl">
            {student.profile?.full_name?.[0]?.toUpperCase() || 'S'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{student.profile?.full_name}</h1>
          <p className="text-muted-foreground">Student ID: {student.student_id}</p>
          <div className="flex items-center gap-3 mt-2">
            <Badge variant={student.is_active ? 'success' : 'secondary'}>
              {student.is_active ? 'Active' : 'Inactive'}
            </Badge>
            <Badge variant="info">{student.course || 'No Course'}</Badge>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{student.profile?.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{student.profile?.phone || 'Not provided'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Enrolled: {student.enrollment_date}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>Grade: {student.grade_level || 'Not set'}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Parent Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{student.parent_name || 'Not provided'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{student.parent_email || 'Not provided'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{student.parent_phone || 'Not provided'}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}