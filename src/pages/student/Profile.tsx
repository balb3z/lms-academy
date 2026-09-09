import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Student } from '@/types';
import { toast } from 'react-toastify';

export function StudentProfilePage() {
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    address: '',
    parent_name: '',
    parent_email: '',
    parent_phone: ''
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from('students')
      .select(`
        *,
        profile:user_id (
          full_name,
          phone,
          address
        )
      `)
      .eq('id', user?.id)
      .single();

    setStudent(data);
    if (data) {
      setFormData({
        full_name: data.profile?.full_name || '',
        phone: data.profile?.phone || '',
        address: data.profile?.address || '',
        parent_name: data.parent_name || '',
        parent_email: data.parent_email || '',
        parent_phone: data.parent_phone || ''
      });
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Update profile
      await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          address: formData.address
        })
        .eq('id', user?.id);

      // Update student
      await supabase
        .from('students')
        .update({
          parent_name: formData.parent_name,
          parent_email: formData.parent_email,
          parent_phone: formData.parent_phone
        })
        .eq('id', user?.id);

      toast.success('Profile updated successfully');
      fetchProfile();
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Profile</h1>
        <p className="text-muted-foreground">Update your personal information</p>
      </div>

      <Card>
        <form onSubmit={handleSave}>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={student?.profile?.avatar_url} />
                <AvatarFallback className="text-2xl">
                  {formData.full_name?.[0]?.toUpperCase() || 'S'}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle>Personal Information</CardTitle>
                <p className="text-sm text-muted-foreground">Student ID: {student?.student_id}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </CardContent>
        </form>
      </Card>

      <Card>
        <form onSubmit={handleSave}>
          <CardHeader>
            <CardTitle>Parent Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="parent_name">Parent Name</Label>
                <Input
                  id="parent_name"
                  value={formData.parent_name}
                  onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parent_email">Parent Email</Label>
                <Input
                  id="parent_email"
                  type="email"
                  value={formData.parent_email}
                  onChange={(e) => setFormData({ ...formData, parent_email: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="parent_phone">Parent Phone</Label>
              <Input
                id="parent_phone"
                value={formData.parent_phone}
                onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
              />
            </div>
          </CardContent>
          <div className="p-6 pt-0">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}