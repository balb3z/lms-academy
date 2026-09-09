import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase/client';
import { Lesson } from '@/types';
import { formatDate, formatTime } from '@/utils/format';
import { ArrowLeft, Calendar, Clock, Video, BookOpen } from 'lucide-react';
import { toast } from 'react-toastify';

export function TeacherLessonDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [zoomLink, setZoomLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchLesson();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchLesson = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('lessons').select('*').eq('id', id).single();
      if (error || !data) {
        setLesson(null);
        setLoading(false);
        return;
      }
      setLesson(data);

      // Resolve related data with separate round-trips (no broken embeds).
      const [subjectRes, studentProfileRes, studentUserRes, teacherRes] = await Promise.all([
        data.subject_id
          ? supabase.from('subjects').select('id, name, color').eq('id', data.subject_id).single()
          : Promise.resolve({ data: null }),
        supabase.from('profiles').select('full_name').eq('id', data.student_id).single(),
        supabase.from('users').select('email').eq('id', data.student_id).single(),
        supabase.from('teachers').select('zoom_link').eq('id', data.teacher_id).single(),
      ]);

      setLesson(prev => (prev ? { ...prev, subject: subjectRes.data || undefined } : prev));
      setStudentName(studentProfileRes.data?.full_name || 'Student');
      setStudentEmail(studentUserRes.data?.email || '');
      setZoomLink(teacherRes.data?.zoom_link || null);
    } catch (err) {
      console.error('Error loading lesson:', err);
    } finally {
      setLoading(false);
    }
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

  const resolveLink = () => zoomLink || lesson?.meeting_url || null;

  const handleStartLesson = async () => {
    if (!lesson) return;
    const link = resolveLink();
    if (!link) {
      toast.error('No Zoom link set. Ask management to add your personal Zoom link.');
      return;
    }

    const { data, error } = await supabase
      .from('lessons')
      .update({ status: 'live', actual_start_time: new Date().toISOString() })
      .eq('id', id)
      .select('id');

    if (error || !data || data.length === 0) {
      toast.error('Could not start the lesson.');
      return;
    }
    window.open(link, '_blank', 'noopener,noreferrer');
    fetchLesson();
  };

  const handleJoin = () => {
    const link = resolveLink();
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
    else toast.error('No Zoom link set.');
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
        <Button variant="outline" size="icon" onClick={() => navigate('/teacher/lessons')} aria-label="Back">
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
            {lesson.subject?.name && (
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <span>Subject: {lesson.subject.name}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-muted-foreground" />
              <span>Platform: {lesson.meeting_platform}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Student</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <p className="font-medium">{studentName}</p>
              <p className="text-sm text-muted-foreground">{studentEmail}</p>
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

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            {lesson.status === 'scheduled' && (
              <Button onClick={handleStartLesson}>
                <Video className="h-4 w-4 mr-2" />
                Start Meeting
              </Button>
            )}
            {lesson.status === 'live' && (
              <>
                <Button variant="outline" onClick={handleJoin}>
                  <Video className="h-4 w-4 mr-2" />
                  Join Meeting
                </Button>
                <Button onClick={() => navigate(`/teacher/lessons/${id}/report`)}>
                  End Meeting
                </Button>
              </>
            )}
            {lesson.status === 'completed' && (
              <Button variant="outline" disabled>
                Lesson Completed
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
