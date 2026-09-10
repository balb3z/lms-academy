import { Card, CardContent } from "./Card";
import { cn } from "@/utils/cn";
import { 
  Users, 
  UserCog, 
  Calendar, 
  Clock, 
  CheckCircle, 
  BarChart,
  GraduationCap,
  BookOpen
} from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string;
  trend?: number;
  className?: string;
}

import { LucideIcon } from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  users: Users,
  teachers: UserCog,
  calendar: Calendar,
  clock: Clock,
  check: CheckCircle,
  attendance: BarChart,
  students: GraduationCap,
  lessons: BookOpen
};

export function StatsCard({ title, value, icon, trend, className }: StatsCardProps) {
  const Icon = iconMap[icon] || Calendar;

  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {trend !== undefined && (
              <p className={cn(
                "text-xs mt-1",
                trend > 0 ? "text-green-600" : trend < 0 ? "text-red-600" : "text-muted-foreground"
              )}>
                {trend > 0 ? '+' : ''}{trend}% from last month
              </p>
            )}
          </div>
          <div className="p-3 bg-primary/10 rounded-lg">
            <Icon className="w-6 h-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}