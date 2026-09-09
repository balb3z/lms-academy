import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import {
  LayoutDashboard,
  Users,
  UserCog,
  Calendar,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  BookOpen,
  User,
  GraduationCap,
} from 'lucide-react';
import { cn } from '@/utils/cn';

interface NavItem {
  label: string;
  href: string;
  icon: any;
  roles: string[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/management', icon: LayoutDashboard, roles: ['management'] },
  { label: 'Students', href: '/management/students', icon: Users, roles: ['management'] },
  { label: 'Teachers', href: '/management/teachers', icon: UserCog, roles: ['management'] },
  { label: 'Courses', href: '/management/courses', icon: GraduationCap, roles: ['management'] },
  { label: 'Lessons', href: '/management/lessons', icon: BookOpen, roles: ['management'] },
  { label: 'Calendar', href: '/management/calendar', icon: Calendar, roles: ['management'] },
  { label: 'Reports', href: '/management/reports', icon: FileText, roles: ['management'] },
  { label: 'Settings', href: '/management/settings', icon: Settings, roles: ['management'] },
  { label: 'Dashboard', href: '/teacher', icon: LayoutDashboard, roles: ['teacher'] },
  { label: 'My Lessons', href: '/teacher/lessons', icon: BookOpen, roles: ['teacher'] },
  { label: 'My Students', href: '/teacher/students', icon: Users, roles: ['teacher'] },
  { label: 'Reports', href: '/teacher/reports', icon: FileText, roles: ['teacher'] },
  { label: 'Dashboard', href: '/student', icon: LayoutDashboard, roles: ['student'] },
  { label: 'My Lessons', href: '/student/lessons', icon: BookOpen, roles: ['student'] },
  { label: 'Reports', href: '/student/reports', icon: FileText, roles: ['student'] },
  { label: 'Profile', href: '/student/profile', icon: User, roles: ['student'] },
];

export function DashboardLayout() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const filteredNav = navItems.filter(item =>
    role && item.roles.includes(role),
  );

  const isActive = (href: string) => {
    // Exact match for dashboard roots, prefix match for sub-pages
    if (href === '/management' || href === '/teacher' || href === '/student') {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  const handleNavigation = (href: string) => {
    navigate(href);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">LMS Academy</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-full w-64 bg-white border-r transition-transform duration-300 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Navigation"
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b">
            <h1 className="text-2xl font-bold text-primary">LMS Academy</h1>
            <p className="text-sm text-muted-foreground capitalize">{role}</p>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {filteredNav.map(item => (
              <Button
                key={item.href}
                variant={isActive(item.href) ? 'secondary' : 'ghost'}
                className={cn(
                  'w-full justify-start gap-3',
                  isActive(item.href) && 'font-semibold',
                )}
                onClick={() => handleNavigation(item.href)}
                aria-current={isActive(item.href) ? 'page' : undefined}
              >
                <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {item.label}
              </Button>
            ))}
          </nav>

          <div className="p-4 border-t">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-medium text-primary">
                  {user?.email?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.email}</p>
                <p className="text-xs text-muted-foreground capitalize">{role}</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full justify-center gap-2"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-4 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
