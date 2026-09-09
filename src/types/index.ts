export type UserRole = 'management' | 'teacher' | 'student';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  avatar_url?: string;
  phone?: string;
  date_of_birth?: string;
  address?: string;
  bio?: string;
}

export interface Student {
  id: string;
  student_id: string;
  enrollment_date: string;
  course?: string;
  grade_level?: string;
  parent_name?: string;
  parent_email?: string;
  parent_phone?: string;
  is_active: boolean;
  profile?: Profile;
  user?: User;
}

export interface Teacher {
  id: string;
  teacher_id: string;
  specialization?: string;
  qualification?: string;
  years_of_experience?: number;
  is_active: boolean;
  profile?: Profile;
  user?: User;
}

export interface Subject {
  id: string;
  name: string;
  description?: string;
  color: string;
}

export interface Lesson {
  id: string;
  student_id: string;
  teacher_id: string;
  subject_id: string;
  title: string;
  description?: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  meeting_platform: string;
  meeting_url?: string;
  meeting_id?: string;
  meeting_password?: string;
  status: 'scheduled' | 'live' | 'completed' | 'cancelled' | 'absent';
  attendance_status?: 'present' | 'late' | 'absent' | 'excused' | 'not_marked';
  actual_start_time?: string;
  actual_end_time?: string;
  is_recurring: boolean;
  recurrence_rule?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  student?: Student;
  teacher?: Teacher;
  subject?: Subject;
}

export interface LessonReport {
  id: string;
  lesson_id: string;
  student_id: string;
  teacher_id: string;
  attendance_status: 'present' | 'late' | 'absent' | 'excused';
  performance_rating?: 'excellent' | 'very_good' | 'good' | 'needs_improvement';
  topics_covered?: string;
  what_was_taught?: string;
  student_performance?: string;
  strengths?: string;
  weaknesses?: string;
  homework?: string;
  teacher_notes?: string;
  additional_comments?: string;
  next_lesson_plan?: string;
  is_visible_to_student: boolean;
  submitted_at: string;
  submitted_by?: string;
  lesson?: Lesson;
  student?: Student;
  teacher?: Teacher;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'lesson_reminder' | 'lesson_starting' | 'lesson_rescheduled' | 'lesson_cancelled' | 'new_report' | 'new_homework' | 'missed_lesson' | 'attendance_marked' | 'system';
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  todayLessons: number;
  upcomingLessons: number;
  completedLessons: number;
  attendanceRate: number;
}