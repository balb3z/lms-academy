import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase/client';
import { Lesson } from '@/types';
import { formatDate, formatTime } from '@/utils/format';
import { ArrowLeft, Calendar, Clock, User, Video, BookOpen } from 'lucide-react';

export function StudentLessonDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLesson();
  }, [id]);

  const fetchLesson = async () => {
    const { data } = await supabase
      .from('lessons')
      .select(`
        *,
        teacher:teacher_id (
          id,
          profile:user_id (full_name, email, phone)
        ),
        subject:subject_id (*)
      `)
      .eq('id', id)
      .single();

    setLesson(data);
    setLoading(false);
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'scheduled': return 'info';
      case 'live': return 'warning';
      case 'completed': return 'success';
      case 'cancelled': return 'destructive';
      case 'absent': return 'secondary';
      default: return 'default';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (!lesson) {
    return <div>Lesson not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/student/lessons')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{lesson.title}</h1>
          <p className="text-muted-foreground">Lesson Details</p>
        </div>
        <Badge variant={getStatusVariant(lesson.status)} className="ml-auto">
          {lesson.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Lesson Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{formatDate(lesson.scheduled_date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{formatTime(lesson.start_time)} - {formatTime(lesson.end_time)}</span>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span>Subject: {lesson.subject?.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-muted-foreground" />
              <span>Platform: {lesson.meeting_platform}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Teacher</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <p className="font-medium">{lesson.teacher?.profile?.full_name}</p>
              <p className="text-sm text-muted-foreground">{lesson.teacher?.profile?.email}</p>
              <p className="text-sm text-muted-foreground">{lesson.teacher?.profile?.phone}</p>
            </div>
          </CardContent>
        </Card>

        {lesson.notes && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{lesson.notes}</p>
            </CardContent>
          </Card>
        )}

        {lesson.status === 'live' && lesson.meeting_url && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Meeting</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={() => window.open(lesson.meeting_url, '_blank')}>
                <Video className="h-4 w-4 mr-2" />
                Join Meeting
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}