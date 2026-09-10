import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { supabase } from '@/lib/supabase/client';
import { Teacher } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Mail, Phone, User, GraduationCap, Briefcase, Video, Wallet, CheckCircle } from 'lucide-react';

export function TeacherProfile() {
  const { id } = useParams();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [email, setEmail] = useState('');
  const [earnings, setEarnings] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchTeacher(id);
  }, [id]);

  const fetchTeacher = async (teacherId: string) => {
    setLoading(true);
    try {
      // Fetch base rows separately (profiles.id === users.id === teachers.id),
      // avoiding the invalid profile:user_id embed that returned nothing.
      const [teacherRes, profileRes, userRes, completedRes] = await Promise.all([
        supabase.from('teachers').select('*').eq('id', teacherId).single(),
        supabase.from('profiles').select('full_name, phone, avatar_url').eq('id', teacherId).single(),
        supabase.from('users').select('email').eq('id', teacherId).single(),
        supabase.from('lessons').select('teacher_rate, course_id, student_id').eq('teacher_id', teacherId).eq('status', 'completed'),
      ]);

      if (teacherRes.data) {
        setTeacher({ ...teacherRes.data, profile: profileRes.data || undefined });
      }
      setEmail(userRes.data?.email ?? '');

      const completed = completedRes.data || [];
      setCompletedCount(completed.length);

      // Earnings with enrollment-rate fallback for lessons missing a stamped rate
      const missingRate = completed.filter((l: any) => l.teacher_rate == null && l.course_id);
      const enrollmentRateMap: Record<string, number> = {};
      if (missingRate.length > 0) {
        const courseIds = [...new Set(missingRate.map((l: any) => l.course_id))];
        const { data: enrollments } = await supabase
          .from('course_enrollments')
          .select('course_id, student_id, teacher_rate')
          .in('course_id', courseIds);
        (enrollments || []).forEach((e: any) => {
          if (e.teacher_rate != null) {
            enrollmentRateMap[`${e.course_id}|${e.student_id}`] = Number(e.teacher_rate);
          }
        });
      }
      setEarnings(
        completed.reduce((sum: number, l: any) => {
          const rate = l.teacher_rate != null
            ? Number(l.teacher_rate)
            : (enrollmentRateMap[`${l.course_id}|${l.student_id}`] ?? 0);
          return sum + (rate || 0);
        }, 0),
      );
    } catch (err) {
      console.error('Error loading teacher profile:', err);
    } finally {
      setLoading(false);
    }
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

      {/* Earnings summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Earnings</p>
                <p className="text-2xl font-bold mt-1 tabular-nums">{earnings.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">From completed lessons</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <Wallet className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed Lessons</p>
                <p className="text-2xl font-bold mt-1 tabular-nums">{completedCount}</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <CheckCircle className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Experience</p>
                <p className="text-2xl font-bold mt-1 tabular-nums">{teacher.years_of_experience || 0} yrs</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <GraduationCap className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{email || 'Not provided'}</span>
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
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-muted-foreground" />
              {teacher.zoom_link ? (
                <a
                  href={teacher.zoom_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 truncate"
                >
                  {teacher.zoom_link}
                </a>
              ) : (
                <span className="text-muted-foreground">No Zoom link set</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
