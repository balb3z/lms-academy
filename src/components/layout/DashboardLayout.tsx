import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
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
  User
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