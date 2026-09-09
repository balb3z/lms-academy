import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/types';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  allowedRoles: UserRole[];
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();

  console.log('🛡️ ProtectedRoute:', { user: user?.email, role, loading, allowedRoles });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !role || !allowedRoles.includes(role)) {
    console.log('🛡️ ProtectedRoute: Redirecting to login');
    return <Navigate to="/auth/login" replace />;
  }

  console.log('🛡️ ProtectedRoute: Access granted');
  return <Outlet />;
}