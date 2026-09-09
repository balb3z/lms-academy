import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
      <h2 className="text-2xl font-semibold mb-2">Page Not Found</h2>
      <p className="text-muted-foreground mb-6">The page you're looking for doesn't exist.</p>
      <Link to="/">
        <Button>Go Home</Button>
      </Link>
    </div>
  );
}