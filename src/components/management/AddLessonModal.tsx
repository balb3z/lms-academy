import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'react-toastify';

interface AddLessonModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddLessonModal({ open, onClose, onSuccess }: AddLessonModalProps) {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    student_id: '',
    teacher_id: '',
    subject_id: '',
    title: '',
    description: '',
    scheduled_date: '',
    start_time: '',
    end_time: '',
    meeting_platform: 'zoom',
    meeting_url: '',
    notes: ''
  });

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    const [studentsRes, teachersRes, subjectsRes] = await Promise.all([
      supabase.from('students').select('*, profile:user_id(*)').eq('is_active', true),
      supabase.from('teachers').select('*, profile:user_id(*)').eq('is_active', true),
      supabase.from('subjects').select('*')
    ]);

    setStudents(studentsRes.data || []);
    setTeachers(teachersRes.data || []);
    setSubjects(subjectsRes.data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const start = new Date(`1970-01-01T${formData.start_time}`);
      const end = new Date(`1970-01-01T${formData.end_time}`);
      const duration = (end.getTime() - start.getTime()) / (1000 * 60);

      const { data: conflicts } = await supabase
        .from('lessons')
        .select('id')
        .eq('scheduled_date', formData.scheduled_date)
        .or(
          `and(teacher_id.eq.${formData.teacher_id}, start_time.lte.${formData.end_time}, end_time.gte.${formData.start_time})`
        );

      if (conflicts && conflicts.length > 0) {
        toast.error('This teacher already has a lesson at this time.');
        setLoading(false);
        return;
      }

      const lessonData = {
        student_id: formData.student_id,
        teacher_id: formData.teacher_id,
        subject_id: formData.subject_id,
        title: formData.title,
        description: formData.description,
        scheduled_date: formData.scheduled_date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        duration_minutes: duration,
        meeting_platform: formData.meeting_platform,
        meeting_url: formData.meeting_url,
        notes: formData.notes,
        created_by: user?.id,
        status: 'scheduled'
      };

      const { error } = await supabase
        .from('lessons')
        .insert(lessonData);

      if (error) throw error;

      toast.success('Lesson scheduled successfully!');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Failed to schedule lesson');
      console.error('Error creating lesson:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule New Lesson</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="student_id">Student</Label>
              <select
                id="student_id"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2"
                value={formData.student_id}
                onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                required
              >
                <option value="">Select student</option>
                {students.map((student: any) => (
                  <option key={student.id} value={student.id}>
                    {student.profile?.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="teacher_id">Teacher</Label>
              <select
                id="teacher_id"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2"
                value={formData.teacher_id}
                onChange={(e) => setFormData({ ...formData, teacher_id: e.target.value })}
                required
              >
                <option value="">Select teacher</option>
                {teachers.map((teacher: any) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.profile?.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject_id">Subject</Label>
              <select
                id="subject_id"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2"
                value={formData.subject_id}
                onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
                required
              >
                <option value="">Select subject</option>
                {subjects.map((subject: any) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Lesson Title</Label>
              <Input
                id="title"
                placeholder="Enter lesson title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Enter lesson description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduled_date">Date</Label>
              <Input
                id="scheduled_date"
                type="date"
                value={formData.scheduled_date}
                onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start_time">Start Time</Label>
              <Input
                id="start_time"
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_time">End Time</Label>
              <Input
                id="end_time"
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="meeting_platform">Meeting Platform</Label>
              <select
                id="meeting_platform"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2"
                value={formData.meeting_platform}
                onChange={(e) => setFormData({ ...formData, meeting_platform: e.target.value })}
              >
                <option value="zoom">Zoom</option>
                <option value="google_meet">Google Meet</option>
                <option value="teams">Microsoft Teams</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="meeting_url">Meeting URL</Label>
              <Input
                id="meeting_url"
                placeholder="https://..."
                value={formData.meeting_url}
                onChange={(e) => setFormData({ ...formData, meeting_url: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Scheduling...' : 'Schedule Lesson'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}