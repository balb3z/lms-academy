import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'react-toastify';

export function Settings() {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    academyName: 'LMS Academy',
    timezone: 'America/New_York',
    meetingPlatform: 'zoom',
    defaultMeetingUrl: '',
    emailNotifications: true,
    lessonReminderHours: 24
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await supabase
        .from('academy_settings')
        .upsert([
          { key: 'academy_name', value: settings.academyName },
          { key: 'timezone', value: settings.timezone },
          { key: 'meeting_platform', value: settings.meetingPlatform },
          { key: 'default_meeting_url', value: settings.defaultMeetingUrl },
          { key: 'email_notifications', value: settings.emailNotifications },
          { key: 'lesson_reminder_hours', value: settings.lessonReminderHours }
        ]);
      
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage academy settings and preferences</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="meetings">Meetings</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <form onSubmit={handleSave}>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>
                  Configure basic academy settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="academyName">Academy Name</Label>
                  <Input
                    id="academyName"
                    value={settings.academyName}
                    onChange={(e) => setSettings({ ...settings, academyName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Time Zone</Label>
                  <select
                    id="timezone"
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2"
                    value={settings.timezone}
                    onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                  >
                    <option value="America/New_York">America/New York</option>
                    <option value="America/Chicago">America/Chicago</option>
                    <option value="America/Denver">America/Denver</option>
                    <option value="America/Los_Angeles">America/Los Angeles</option>
                    <option value="Europe/London">Europe/London</option>
                    <option value="Europe/Paris">Europe/Paris</option>
                    <option value="Asia/Dubai">Asia/Dubai</option>
                  </select>
                </div>
              </CardContent>
              <div className="p-6 pt-0">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="meetings">
          <Card>
            <form onSubmit={handleSave}>
              <CardHeader>
                <CardTitle>Meeting Settings</CardTitle>
                <CardDescription>
                  Configure online meeting preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="meetingPlatform">Default Meeting Platform</Label>
                  <select
                    id="meetingPlatform"
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2"
                    value={settings.meetingPlatform}
                    onChange={(e) => setSettings({ ...settings, meetingPlatform: e.target.value })}
                  >
                    <option value="zoom">Zoom</option>
                    <option value="google_meet">Google Meet</option>
                    <option value="teams">Microsoft Teams</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultMeetingUrl">Default Meeting URL</Label>
                  <Input
                    id="defaultMeetingUrl"
                    placeholder="https://..."
                    value={settings.defaultMeetingUrl}
                    onChange={(e) => setSettings({ ...settings, defaultMeetingUrl: e.target.value })}
                  />
                </div>
              </CardContent>
              <div className="p-6 pt-0">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <form onSubmit={handleSave}>
              <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
                <CardDescription>
                  Configure notification preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="emailNotifications"
                    checked={settings.emailNotifications}
                    onChange={(e) => setSettings({ ...settings, emailNotifications: e.target.checked })}
                    className="h-4 w-4 rounded border-input"
                  />
                  <Label htmlFor="emailNotifications">Enable Email Notifications</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lessonReminderHours">Lesson Reminder (hours before)</Label>
                  <Input
                    id="lessonReminderHours"
                    type="number"
                    value={settings.lessonReminderHours}
                    onChange={(e) => setSettings({ ...settings, lessonReminderHours: parseInt(e.target.value) })}
                  />
                </div>
              </CardContent>
              <div className="p-6 pt-0">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </form>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}