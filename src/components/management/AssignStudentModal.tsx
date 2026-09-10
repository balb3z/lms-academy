import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'react-toastify';
import { DAY_LABELS, DAY_KEYS, buildCourseLessonRows } from '@/utils/courseSchedule';

interface StudentOption {
  id: string;
  student_id: string;
  full_name: string;
}

export interface AssignStudentCourse {
  id: string;
  name: string;
  teacher_id: string;
  total_lessons: number;
  lesson_duration_minutes: number;
  preferred_days: string[];
  preferred_time: string;
  start_date: string;
  timezone: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  course: AssignStudentCourse;
  /** Student ids already enrolled in the course (excluded from the picker). */
  excludeStudentIds: string[];
}

export function AssignStudentModal({ open, onClose, onSuccess, course, excludeStudentIds }: Props) {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [fetchingData, setFetchingData] = useState(false);
  const [loading, setLoading] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [totalLessons, setTotalLessons] = useState(course.total_lessons);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [teacherZoom, setTeacherZoom] = useState<string | null>(null);
  const [studentPrice, setStudentPrice] = useState('');
  const [teacherRate, setTeacherRate] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setStudentId('');
      setTotalLessons(course.total_lessons);
      setStartDate(new Date().toISOString().split('T')[0]);
      setStudentPrice('');
      setTeacherRate('');
      setError('');
      fetchStudents();
      fetchTeacherZoom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fetchTeacherZoom = async () => {
    const { data } = await supabase
      .from('teachers')
      .select('zoom_link')
      .eq('id', course.teacher_id)
      .single();
    setTeacherZoom(data?.zoom_link || null);
  };

  const fetchStudents = async () => {
    setFetchingData(true);
    try {
      const { data: studentRows } = await supabase
        .from('students')
        .select('id, student_id')
        .eq('is_active', true);

      const available = (studentRows || []).filter(
        (s: any) => !excludeStudentIds.includes(s.id),
      );
      const ids = available.map((s: any) => s.id);

      const { data: profiles } = ids.length > 0
        ? await supabase.from('profiles').select('id, full_name').in('id', ids)
        : { data: [] as any[] };

      setStudents(
        available.map((s: any) => {
          const p = (profiles || []).find((x: any) => x.id === s.id);
          return { id: s.id, student_id: s.student_id, full_name: p?.full_name || `Student (${s.student_id})` };
        }),
      );
    } catch (err) {
      console.error('Error fetching assignable students:', err);
      toast.error('Failed to load students.');
    } finally {
      setFetchingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) {
      setError('Please select a student to assign.');
      return;
    }
    if (!totalLessons || totalLessons < 1) {
      setError('Total lessons must be at least 1.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const teacherRateNum =
        teacherRate && !isNaN(parseFloat(teacherRate)) ? parseFloat(teacherRate) : null;
      const studentPriceNum =
        studentPrice && !isNaN(parseFloat(studentPrice)) ? parseFloat(studentPrice) : null;

      // 1. Generate the student's lessons from the course schedule
      const lessonRows = buildCourseLessonRows({
        courseId: course.id,
        courseName: course.name,
        studentId,
        teacherId: course.teacher_id,
        totalLessons,
        preferredDays: course.preferred_days,
        preferredTime: course.preferred_time,
        durationMinutes: course.lesson_duration_minutes,
        startDate,
        createdBy: user?.id,
        meetingUrl: teacherZoom,
        teacherRate: teacherRateNum,
        courseTimezone: course.timezone || 'UTC',
      });

      if (lessonRows.length === 0) {
        throw new Error('No lessons could be generated. Check the course schedule days.');
      }

      for (let i = 0; i < lessonRows.length; i += 50) {
        const batch = lessonRows.slice(i, i + 50);
        const { error: lessonsError } = await supabase.from('lessons').insert(batch);
        if (lessonsError) throw new Error(lessonsError.message);
      }

      // 2. Record the enrollment
      const { error: enrollError } = await supabase.from('course_enrollments').upsert(
        {
          course_id: course.id,
          student_id: studentId,
          start_date: startDate,
          lessons_generated: lessonRows.length,
          student_price: studentPriceNum,
          teacher_rate: teacherRateNum,
          is_active: true,
          enrolled_by: user?.id,
        },
        { onConflict: 'course_id,student_id', ignoreDuplicates: false },
      );
      if (enrollError) throw new Error(enrollError.message);

      // 3. Register the teacher↔student assignment so the teacher's dashboard
      //    and "My Students" list include this student.
      const { error: assignError } = await supabase.from('student_teacher_assignments').upsert(
        {
          student_id: studentId,
          teacher_id: course.teacher_id,
          assigned_by: user?.id,
          is_active: true,
        },
        { onConflict: 'student_id,teacher_id', ignoreDuplicates: true },
      );
      if (assignError) console.error('Assignment record failed (non-fatal):', assignError);

      toast.success(`Student assigned — ${lessonRows.length} lessons scheduled.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error assigning student to course:', err);
      toast.error(err.message || 'Failed to assign student.');
    } finally {
      setLoading(false);
    }
  };

  const scheduleSummary = course.preferred_days
    .map(d => DAY_LABELS[DAY_KEYS.indexOf(d.toLowerCase())]?.slice(0, 3) ?? d)
    .join(', ');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Student to Course</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2 truncate">{course.name}</p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Schedule</span>
              <span className="font-medium">{scheduleSummary || '—'} @ {course.preferred_time}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-medium">{course.lesson_duration_minutes} min / lesson</span>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              The same schedule is used to generate this student's lessons with the course teacher.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="assign_student">
              Student <span className="text-destructive" aria-hidden>*</span>
            </Label>
            <select
              id="assign_student"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              value={studentId}
              onChange={e => { setStudentId(e.target.value); setError(''); }}
              disabled={fetchingData}
            >
              <option value="">
                {fetchingData
                  ? 'Loading…'
                  : students.length === 0
                    ? 'No available students'
                    : 'Select student'}
              </option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="assign_total_lessons">Total Lessons</Label>
              <Input
                id="assign_total_lessons"
                type="number"
                min={1}
                value={totalLessons}
                onChange={e => setTotalLessons(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="assign_start_date">Start Date</Label>
              <Input
                id="assign_start_date"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="assign_student_price">Student Price / lesson</Label>
              <Input
                id="assign_student_price"
                type="number"
                min={0}
                step={0.01}
                placeholder="0.00"
                value={studentPrice}
                onChange={e => setStudentPrice(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="assign_teacher_rate">Teacher Rate / lesson</Label>
              <Input
                id="assign_teacher_rate"
                type="number"
                min={0}
                step={0.01}
                placeholder="0.00"
                value={teacherRate}
                onChange={e => setTeacherRate(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || fetchingData || students.length === 0}>
              {loading ? 'Assigning…' : 'Assign & Generate Lessons'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
