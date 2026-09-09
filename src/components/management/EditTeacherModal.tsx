import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'react-toastify';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  teacherId: string | null;
}

interface FormData {
  full_name: string;
  phone: string;
  specialization: string;
  qualification: string;
  years_of_experience: string;
  zoom_link: string;
  is_active: boolean;
}

export function EditTeacherModal({ open, onClose, onSuccess, teacherId }: Props) {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [email, setEmail] = useState('');
  const [formData, setFormData] = useState<FormData>({
    full_name: '',
    phone: '',
    specialization: '',
    qualification: '',
    years_of_experience: '',
    zoom_link: '',
    is_active: true,
  });

  useEffect(() => {
    if (open && teacherId) {
      loadTeacher(teacherId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, teacherId]);

  const loadTeacher = async (id: string) => {
    setFetching(true);
    try {
      const [teacherRes, profileRes, userRes] = await Promise.all([
        supabase.from('teachers').select('*').eq('id', id).single(),
        supabase.from('profiles').select('full_name, phone').eq('id', id).single(),
        supabase.from('users').select('email').eq('id', id).single(),
      ]);

      const t = teacherRes.data;
      setEmail(userRes.data?.email ?? '');
      setFormData({
        full_name: profileRes.data?.full_name ?? '',
        phone: profileRes.data?.phone ?? '',
        specialization: t?.specialization ?? '',
        qualification: t?.qualification ?? '',
        years_of_experience: t?.years_of_experience != null ? String(t.years_of_experience) : '',
        zoom_link: t?.zoom_link ?? '',
        is_active: t?.is_active ?? true,
      });
    } catch (err) {
      console.error('Error loading teacher:', err);
      toast.error('Failed to load teacher.');
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId) return;
    if (!formData.full_name.trim()) {
      toast.error('Full name is required.');
      return;
    }
    setLoading(true);

    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', teacherId);
      if (profileError) throw new Error(`Profile: ${profileError.message}`);

      const { error: teacherError } = await supabase
        .from('teachers')
        .update({
          specialization: formData.specialization.trim() || null,
          qualification: formData.qualification.trim() || null,
          years_of_experience: formData.years_of_experience ? Number(formData.years_of_experience) : 0,
          zoom_link: formData.zoom_link.trim() || null,
          is_active: formData.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', teacherId);
      if (teacherError) throw new Error(`Teacher: ${teacherError.message}`);

      toast.success('Teacher updated successfully!');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error updating teacher:', err);
      toast.error(err.message || 'Failed to update teacher.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Teacher</DialogTitle>
        </DialogHeader>

        {fetching ? (
          <div className="py-8 text-center text-muted-foreground">Loading…</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={email} disabled className="opacity-70" />
              <p className="text-xs text-muted-foreground">Email is managed by the authentication system and cannot be changed here.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="edit_full_name">
                  Full Name <span className="text-destructive" aria-hidden>*</span>
                </Label>
                <Input
                  id="edit_full_name"
                  value={formData.full_name}
                  onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit_phone">Phone</Label>
                <Input
                  id="edit_phone"
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label htmlFor="edit_specialization">Specialization</Label>
                <Input
                  id="edit_specialization"
                  value={formData.specialization}
                  onChange={e => setFormData(p => ({ ...p, specialization: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit_qualification">Qualification</Label>
                <Input
                  id="edit_qualification"
                  value={formData.qualification}
                  onChange={e => setFormData(p => ({ ...p, qualification: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit_experience">Years of Experience</Label>
                <Input
                  id="edit_experience"
                  type="number"
                  min={0}
                  value={formData.years_of_experience}
                  onChange={e => setFormData(p => ({ ...p, years_of_experience: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="edit_zoom_link">Personal Zoom Meeting Link</Label>
              <Input
                id="edit_zoom_link"
                type="url"
                placeholder="https://zoom.us/j/..."
                value={formData.zoom_link}
                onChange={e => setFormData(p => ({ ...p, zoom_link: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Used automatically for this teacher's lessons. Updating it changes the link students and the teacher open.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="edit_is_active"
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={formData.is_active}
                onChange={e => setFormData(p => ({ ...p, is_active: e.target.checked }))}
              />
              <Label htmlFor="edit_is_active" className="cursor-pointer">Active</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving…' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
