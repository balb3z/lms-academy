export type UserRole = 'management' | 'teacher' | 'student';
export type CourseStatus = 'active' | 'completed' | 'paused' | 'cancelled';
export type PaymentStatus = 'paid' | 'unpaid' | 'partial' | 'overdue';
export type PaymentType = 'per_hour' | 'monthly' | 'per_lesson';

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
  zoom_link?: string;
  timezone?: string;
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

export interface Course {
  id: string;
  name: string;
  student_id: string;
  teacher_id: string;
  total_lessons: number;
  lessons_per_week: number;
  lesson_duration_minutes: number;
  preferred_days: string[];
  preferred_time: string;
  start_date: string;
  price_per_hour?: number;
  monthly_price?: number;
  currency: string;
  payment_type: PaymentType;
  status: CourseStatus;
  payment_status: PaymentStatus;
  timezone?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Joined / computed fields
  student?: Student;
  teacher?: Teacher;
  lessons?: Lesson[];
  payments?: Payment[];
}

export interface Lesson {
  id: string;
  student_id: string;
  teacher_id: string;
  subject_id?: string;
  course_id?: string;
  lesson_number?: number;
  teacher_rate?: number;
  title: string;
  description?: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  start_time_utc?: string;
  end_time_utc?: string;
  timezone?: string;
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
  course?: Course;
}

export interface Payment {
  id: string;
  course_id: string;
  student_id: string;
  amount: number;
  currency: string;
  payment_date: string;
  payment_method?: string;
  period_start?: string;
  period_end?: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  notes?: string;
  recorded_by?: string;
  created_at: string;
  updated_at: string;
  course?: Course;
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
