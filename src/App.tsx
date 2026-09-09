import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Login } from '@/pages/auth/Login';
import { ForgotPassword } from '@/pages/auth/ForgotPassword';
import { ResetPassword } from '@/pages/auth/ResetPassword';
import { ManagementDashboard } from '@/pages/management/Dashboard';
import { Students } from '@/pages/management/Students';
import { StudentProfile } from '@/pages/management/StudentProfile';
import { Teachers } from '@/pages/management/Teachers';
import { TeacherProfile } from '@/pages/management/TeacherProfile';
import { Lessons } from '@/pages/management/Lessons';
import { LessonDetails } from '@/pages/management/LessonDetails';
import { Reports } from '@/pages/management/Reports';
import { Calendar } from '@/pages/management/Calendar';
import { Settings } from '@/pages/management/Settings';
import { TeacherDashboard } from '@/pages/teacher/Dashboard';
import { TeacherLessons } from '@/pages/teacher/Lessons';
import { TeacherLessonDetails } from '@/pages/teacher/LessonDetails';
import { TeacherReportForm } from '@/pages/teacher/ReportForm';
import { TeacherReports } from '@/pages/teacher/Reports';
import { TeacherStudents } from '@/pages/teacher/Students';
import { StudentDashboard } from '@/pages/student/Dashboard';
import { StudentLessons } from '@/pages/student/Lessons';
import { StudentLessonDetails } from '@/pages/student/LessonDetails';
import { StudentReports } from '@/pages/student/Reports';
import { StudentProfilePage } from '@/pages/student/Profile';
import { NotFound } from '@/pages/NotFound';
import 'react-toastify/dist/ReactToastify.css';
import './index.css';

console.log('✅ App component loading...');

// Error Boundary component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    console.error('❌ ErrorBoundary caught error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('❌ Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-red-50">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
            <div className="bg-red-50 p-4 rounded-lg mb-4 overflow-auto max-h-60">
              <code className="text-sm text-red-800 whitespace-pre-wrap">
                {this.state.error?.toString() || 'Unknown error'}
              </code>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthLayout />}>
            <Route path="login" element={<Login />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="reset-password" element={<ResetPassword />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['management']} />}>
            <Route path="/management" element={<DashboardLayout />}>
              <Route index element={<ManagementDashboard />} />
              <Route path="students" element={<Students />} />
              <Route path="students/:id" element={<StudentProfile />} />
              <Route path="teachers" element={<Teachers />} />
              <Route path="teachers/:id" element={<TeacherProfile />} />
              <Route path="lessons" element={<Lessons />} />
              <Route path="lessons/:id" element={<LessonDetails />} />
              <Route path="reports" element={<Reports />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['teacher']} />}>
            <Route path="/teacher" element={<DashboardLayout />}>
              <Route index element={<TeacherDashboard />} />
              <Route path="lessons" element={<TeacherLessons />} />
              <Route path="lessons/:id" element={<TeacherLessonDetails />} />
              <Route path="lessons/:id/report" element={<TeacherReportForm />} />
              <Route path="reports" element={<TeacherReports />} />
              <Route path="students" element={<TeacherStudents />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['student']} />}>
            <Route path="/student" element={<DashboardLayout />}>
              <Route index element={<StudentDashboard />} />
              <Route path="lessons" element={<StudentLessons />} />
              <Route path="lessons/:id" element={<StudentLessonDetails />} />
              <Route path="reports" element={<StudentReports />} />
              <Route path="profile" element={<StudentProfilePage />} />
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/auth/login" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <ToastContainer 
          position="bottom-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;