import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { supabase } from '@/lib/supabase/client';
import { Teacher } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Mail, Phone, User, GraduationCap, Briefcase } from 'lucide-react';

export function TeacherProfile() {
  const { id } = useParams();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeacher();
  }, [id]);

  const fetchTeacher = async () => {
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
      .eq('id', id)
      .single();

    setTeacher(data);
    setLoading(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (!teacher) {
    return <div>Teacher not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-6">
        <Avatar className="h-24 w-24">
          <AvatarImage src={teacher.profile?.avatar_url} />
          <AvatarFallback className="text-2xl">
            {teacher.profile?.full_name?.[0]?.toUpperCase() || 'T'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{teacher.profile?.full_name}</h1>
          <p className="text-muted-foreground">Teacher ID: {teacher.teacher_id}</p>
          <div className="flex items-center gap-3 mt-2">
            <Badge variant={teacher.is_active ? 'success' : 'secondary'}>
              {teacher.is_active ? 'Active' : 'Inactive'}
            </Badge>
            <Badge variant="info">{teacher.specialization || 'General'}</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{teacher.profile?.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{teacher.profile?.phone || 'Not provided'}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{teacher.qualification || 'Not specified'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Professional Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <span>Specialization: {teacher.specialization || 'Not specified'}</span>
            </div>
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
              <span>Years of Experience: {teacher.years_of_experience || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}