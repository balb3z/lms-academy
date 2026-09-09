import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'react-toastify';

interface StudentOption {
  id: string;
  full_name: string;
}

interface TeacherOption {
  id: string;
  full_name: string;
}

interface Subject {
  id: string;
  name: string;
}

interface AddLessonModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddLessonModal({ open, onClose, onSuccess }: AddLessonModalProps) {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
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
    setFetchingData(true);
    try {
      // Fetch students, teachers (base rows) and subjects in parallel
      const [studentsRes, teachersRes, subjectsRes] = await Promise.all([
        supabase.from('students').select('id').eq('is_active', true),
        supabase.from('teachers').select('id').eq('is_active', true),
        supabase.from('subjects').select('*').order('name'),
      ]);

      // Collect IDs so we can fetch profiles in a single round-trip each
      const studentIds = (studentsRes.data || []).map((s: { id: string }) => s.id);
      const teacherIds = (teachersRes.data || []).map((t: { id: string }) => t.id);

      const [studentProfilesRes, teacherProfilesRes] = await Promise.all([
        studentIds.length > 0
          ? supabase.from('profiles').select('id, full_name').in('id', studentIds)
          : Promise.resolve({ data: [] }),
        teacherIds.length > 0
          ? supabase.from('profiles').select('id, full_name').in('id', teacherIds)
          : Promise.resolve({ data: [] }),
      ]);

      // Build display-friendly option lists
      const studentOptions: StudentOption[] = studentIds.map((id) => {
        const profile = (studentProfilesRes.data || []).find((p: { id: string; full_name: string }) => p.id === id);
        return { id, full_name: profile?.full_name || `Student (${id.slice(0, 8)})` };
      });

      const teacherOptions: TeacherOption[] = teacherIds.map((id) => {
        const profile = (teacherProfilesRes.data || []).find((p: { id: string; full_name: string }) => p.id === id);
        return { id, full_name: profile?.full_name || `Teacher (${id.slice(0, 8)})` };
      });

      setStudents(studentOptions);
      setTeachers(teacherOptions);
      setSubjects((subjectsRes.data as Subject[]) || []);
    } catch (error) {
      console.error('Error fetching lesson form data:', error);
      toast.error('Failed to load students and teachers. Please try again.');
    } finally {
      setFetchingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.student_id) { toast.error('Please select a student.'); return; }
    if (!formData.teacher_id) { toast.error('Please select a teacher.'); return; }
    if (!formData.subject_id) { toast.error('Please select a subject.'); return; }
    if (!formData.title.trim()) { toast.error('Please enter a lesson title.'); return; }
    if (!formData.scheduled_date) { toast.error('Please select a date.'); return; }
    if (!formData.start_time || !formData.end_time) { toast.error('Please set start and end times.'); return; }
    if (!formData.meeting_url.trim()) { toast.error('Please enter a meeting URL.'); return; }

    setLoading(true);

    try {
      const start = new Date(`1970-01-01T${formData.start_time}`);
      const end = new Date(`1970-01-01T${formData.end_time}`);
      const duration = (end.getTime() - start.getTime()) / (1000 * 60);

      if (duration <= 0) {
        toast.error('End time must be after start time.');
        setLoading(false);
        return;
      }

      // Check for teacher scheduling conflicts
      const { data: conflicts } = await supabase
        .from('lessons')
        .select('id')
        .eq('scheduled_date', formData.scheduled_date)
        .eq('teacher_id', formData.teacher_id)
        .neq('status', 'cancelled')
        .lte('start_time', formData.end_time)
        .gte('end_time', formData.start_time);

      if (conflicts && conflicts.length > 0) {
        toast.error('This teacher already has a lesson scheduled at this time.');
        setLoading(false);
        return;
      }

      const { error } = await supabase.from('lessons').insert({
        student_id: formData.student_id,
        teacher_id: formData.teacher_id,
        subject_id: formData.subject_id,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        scheduled_date: formData.scheduled_date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        duration_minutes: duration,
        meeting_platform: formData.meeting_platform,
        meeting_url: formData.meeting_url.trim(),
        notes: formData.notes.trim() || null,
        created_by: user?.id,
        status: 'scheduled',
        is_recurring: false,
      });

      if (error) throw error;

      toast.success('Lesson scheduled successfully!');
      onSuccess();
      onClose();
      // Reset form
      setFormData({
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
    } catch (error: any) {
      console.error('Error creating lesson:', error);
      toast.error(error.message || 'Failed to schedule lesson.');
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
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="student_id">Student</Label>
              <select
                id="student_id"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={formData.student_id}
                onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                required
                disabled={fetchingData}
              >
                <option value="">
                  {fetchingData ? 'Loading students…' : students.length === 0 ? 'No active students' : 'Select student'}
                </option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="teacher_id">Teacher</Label>
              <select
                id="teacher_id"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={formData.teacher_id}
                onChange={(e) => setFormData({ ...formData, teacher_id: e.target.value })}
                required
                disabled={fetchingData}
              >
                <option value="">
                  {fetchingData ? 'Loading teachers…' : teachers.length === 0 ? 'No active teachers' : 'Select teacher'}
                </option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.full_name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject_id">Subject</Label>
              <select
                id="subject_id"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={formData.subject_id}
                onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
                required
                disabled={fetchingData}
              >
                <option value="">
                  {fetchingData ? 'Loading subjects…' : 'Select subject'}
                </option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
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
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
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
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || fetchingData}>
              {loading ? 'Scheduling…' : 'Schedule Lesson'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
