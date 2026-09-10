import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase/client';
import { Lesson } from '@/types';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { AddLessonModal } from '@/components/management/AddLessonModal';

export function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [showAddLesson, setShowAddLesson] = useState(false);

  useEffect(() => {
    fetchLessons();
  }, [currentDate]);

  const fetchLessons = async () => {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const startStr = startOfMonth.toISOString().split('T')[0];
    const endStr = endOfMonth.toISOString().split('T')[0];

    // Calendar only renders lesson title + time, so no profile join is needed.
    const { data, error } = await supabase
      .from('lessons')
      .select('*')
      .gte('scheduled_date', startStr)
      .lte('scheduled_date', endStr)
      .order('scheduled_date')
      .order('start_time');

    if (error) console.error('Error fetching calendar lessons:', error);
    setLessons(data || []);
    setLoading(false);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startDayOfWeek };
  };

  const getLessonsForDay = (day: number) => {
    const dateStr = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      day
    ).toISOString().split('T')[0];
    
    return lessons.filter(lesson => lesson.scheduled_date === dateStr);
  };

  const { daysInMonth, startDayOfWeek } = getDaysInMonth(currentDate);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const year = currentDate.getFullYear();

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const today = new Date();
  const isToday = (day: number) => {
    return today.getDate() === day && 
           today.getMonth() === currentDate.getMonth() && 
           today.getFullYear() === currentDate.getFullYear();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Calendar</h1>
          <p className="text-muted-foreground">View and manage your schedule</p>
        </div>
        <Button onClick={() => setShowAddLesson(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Schedule Lesson
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{monthName} {year}</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={prevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
            
            {Array.from({ length: startDayOfWeek }, (_, i) => (
              <div key={`empty-${i}`} className="h-24" />
            ))}
            
            {days.map((day) => {
              const dayLessons = getLessonsForDay(day);
              return (
                <div
                  key={day}
                  className={`min-h-24 border rounded-lg p-1 ${
                    isToday(day) ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <div className="text-right text-sm font-medium p-1">{day}</div>
                  <div className="space-y-1">
                    {dayLessons.slice(0, 3).map((lesson) => (
                      <div
                        key={lesson.id}
                        className="text-xs bg-primary/10 rounded px-1 py-0.5 truncate"
                        title={lesson.title}
                      >
                        {lesson.start_time.slice(0, 5)} {lesson.title}
                      </div>
                    ))}
                    {dayLessons.length > 3 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{dayLessons.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <AddLessonModal
        open={showAddLesson}
        onClose={() => setShowAddLesson(false)}
        onSuccess={() => { setShowAddLesson(false); fetchLessons(); }}
      />
    </div>
  );
}