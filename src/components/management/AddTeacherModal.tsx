import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { supabase, provisioningClient } from '@/lib/supabase/client';
import { toast } from 'react-toastify';
import { Eye, EyeOff, Copy, CheckCircle } from 'lucide-react';

// ── helpers ────────────────────────────────────────────────────────────────────

function generatePassword(length = 14): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join('');
}

function generateTeacherId(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `TCH-${year}-${rand}`;
}

// ── types ──────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'form' | 'credentials';

interface FormData {
  full_name: string;
  email: string;
  password: string;
  phone: string;
  date_of_birth: string;
  specialization: string;
  qualification: string;
  years_of_experience: string;
}

type FormErrors = Partial<Record<keyof FormData, string>>;

// ── component ──────────────────────────────────────────────────────────────────

export function AddTeacherModal({ open, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<'email' | 'password' | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});

  const blankForm = (): FormData => ({
    full_name: '',
    email: '',
    password: generatePassword(),
    phone: '',
    date_of_birth: '',
    specialization: '',
    qualification: '',
    years_of_experience: '',
  });

  const [formData, setFormData] = useState<FormData>(blankForm);

  // ── validation ───────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!formData.full_name.trim()) next.full_name = 'Full name is required.';
    if (!formData.email.trim()) {
      next.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      next.email = 'Enter a valid email address.';
    }
    if (!formData.password || formData.password.length < 8) {
      next.password = 'Password must be at least 8 characters.';
    }
    if (formData.years_of_experience && isNaN(Number(formData.years_of_experience))) {
      next.years_of_experience = 'Must be a number.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const clearError = (key: keyof FormData) =>
    errors[key] && setErrors((prev) => ({ ...prev, [key]: undefined }));

  // ── submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    const email = formData.email.trim().toLowerCase();
    const { password } = formData;

    try {
      // Step 1 — create auth account via isolated provisioning client so the
      // management session in the main client is never interrupted.
      const { data: authData, error: authError } = await provisioningClient.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: formData.full_name.trim(), role: 'teacher' },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Auth user was not returned. Check Supabase email settings.');

      const userId = authData.user.id;

      // Step 2 — public.users
      const { error: userError } = await supabase.from('users').insert({
        id: userId,
        email,
        role: 'teacher',
      });
      if (userError) throw new Error(`User record: ${userError.message}`);

      // Step 3 — public.profiles
      const profileRow: Record<string, unknown> = { id: userId, full_name: formData.full_name.trim() };
      if (formData.phone) profileRow.phone = formData.phone.trim();
      if (formData.date_of_birth) profileRow.date_of_birth = formData.date_of_birth;

      const { error: profileError } = await supabase.from('profiles').insert(profileRow);
      if (profileError) throw new Error(`Profile record: ${profileError.message}`);

      // Step 4 — public.teachers
      const teacherRow: Record<string, unknown> = {
        id: userId,
        teacher_id: generateTeacherId(),
        is_active: true,
        years_of_experience: 0,
      };
      if (formData.specialization) teacherRow.specialization = formData.specialization.trim();
      if (formData.qualification) teacherRow.qualification = formData.qualification.trim();
      if (formData.years_of_experience) {
        teacherRow.years_of_experience = Number(formData.years_of_experience);
      }

      const { error: teacherError } = await supabase.from('teachers').insert(teacherRow);
      if (teacherError) throw new Error(`Teacher record: ${teacherError.message}`);

      setCreatedCredentials({ email, password });
      setStep('credentials');
      onSuccess();
      toast.success('Teacher account created successfully!');
    } catch (err: any) {
      console.error('Error creating teacher:', err);
      toast.error(err.message || 'Failed to create teacher account.');
    } finally {
      setLoading(false);
    }
  };

  // ── copy helper ──────────────────────────────────────────────────────────────

  const handleCopy = async (field: 'email' | 'password') => {
    if (!createdCredentials) return;
    const text = field === 'email' ? createdCredentials.email : createdCredentials.password;
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  // ── close / reset ────────────────────────────────────────────────────────────

  const handleClose = () => {
    setStep('form');
    setFormData(blankForm());
    setCreatedCredentials(null);
    setShowPassword(false);
    setCopied(null);
    setErrors({});
    onClose();
  };

  // ── render helpers ───────────────────────────────────────────────────────────

  const Field = ({
    id,
    label,
    type = 'text',
    required = false,
  }: {
    id: keyof FormData;
    label: string;
    type?: string;
    required?: boolean;
  }) => (
    <div className="space-y-1">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
      </Label>
      <Input
        id={id}
        type={type}
        value={formData[id] as string}
        onChange={(e) => {
          setFormData((prev) => ({ ...prev, [id]: e.target.value }));
          clearError(id);
        }}
        aria-invalid={!!errors[id]}
        aria-describedby={errors[id] ? `${id}-err` : undefined}
      />
      {errors[id] && (
        <p id={`${id}-err`} className="text-xs text-destructive">{errors[id]}</p>
      )}
    </div>
  );

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* ── FORM STEP ── */}
        {step === 'form' && (
          <>
            <DialogHeader>
              <DialogTitle>Add New Teacher</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6" noValidate>

              {/* Account */}
              <section className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Login Credentials
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field id="full_name" label="Full Name" required />
                  <Field id="email" label="Email Address" type="email" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="password">
                    Password <span className="text-destructive" aria-hidden="true">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, password: e.target.value }));
                        clearError('password');
                      }}
                      className="pr-10"
                      aria-invalid={!!errors.password}
                      aria-describedby={errors.password ? 'password-err' : 'password-hint'}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password ? (
                    <p id="password-err" className="text-xs text-destructive">{errors.password}</p>
                  ) : (
                    <p id="password-hint" className="text-xs text-muted-foreground">
                      Auto-generated. You can edit it. The credentials will be shown after saving.
                    </p>
                  )}
                </div>
              </section>

              {/* Personal */}
              <section className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Personal Information
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field id="phone" label="Phone" type="tel" />
                  <Field id="date_of_birth" label="Date of Birth" type="date" />
                </div>
              </section>

              {/* Professional */}
              <section className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Professional Information
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field id="specialization" label="Specialization" />
                  <Field id="qualification" label="Qualification" />
                  <Field id="years_of_experience" label="Years of Experience" type="number" />
                </div>
              </section>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Creating Account…' : 'Create Teacher Account'}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}

        {/* ── CREDENTIALS STEP ── */}
        {step === 'credentials' && createdCredentials && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" aria-hidden="true" />
                Teacher Account Created
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Share these login credentials with the teacher. The password will not be displayed again, so copy it now.
              </p>

              <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                {/* Email row */}
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded border bg-background px-3 py-2 text-sm font-mono break-all">
                      {createdCredentials.email}
                    </code>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => handleCopy('email')}
                      aria-label="Copy email"
                    >
                      {copied === 'email'
                        ? <CheckCircle className="h-4 w-4 text-green-500" />
                        : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Password row */}
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Password</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded border bg-background px-3 py-2 text-sm font-mono">
                      {showPassword ? createdCredentials.password : '••••••••••••••'}
                    </code>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => handleCopy('password')}
                      aria-label="Copy password"
                    >
                      {copied === 'password'
                        ? <CheckCircle className="h-4 w-4 text-green-500" />
                        : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground border-l-2 border-border pl-3">
                If your Supabase project requires email confirmation, the teacher must verify their
                email before they can log in. You can confirm it manually in the Supabase
                Authentication dashboard under Users.
              </p>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}

      </DialogContent>
    </Dialog>
  );
}
