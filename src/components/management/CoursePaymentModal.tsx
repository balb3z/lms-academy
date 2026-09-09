import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'react-toastify';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  courseId: string;
  studentId: string;
  currency: string;
  courseName: string;
}

interface FormData {
  amount: string;
  payment_method: string;
  payment_date: string;
  period_start: string;
  period_end: string;
  update_payment_status: '' | 'paid' | 'partial' | 'unpaid' | 'overdue';
  notes: string;
}

export function CoursePaymentModal({
  open,
  onClose,
  onSuccess,
  courseId,
  studentId,
  currency,
  courseName,
}: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const blankForm = (): FormData => ({
    amount: '',
    payment_method: 'cash',
    payment_date: new Date().toISOString().split('T')[0],
    period_start: '',
    period_end: '',
    update_payment_status: '',
    notes: '',
  });

  const [formData, setFormData] = useState<FormData>(blankForm());
  const [amountError, setAmountError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      setAmountError('Please enter a valid amount greater than 0.');
      return;
    }
    setAmountError('');
    setLoading(true);

    try {
      const paymentRow: Record<string, any> = {
        course_id: courseId,
        student_id: studentId,
        amount,
        currency,
        payment_date: formData.payment_date,
        payment_method: formData.payment_method,
        status: 'completed',
        recorded_by: user?.id,
      };
      if (formData.period_start) paymentRow.period_start = formData.period_start;
      if (formData.period_end) paymentRow.period_end = formData.period_end;
      if (formData.notes.trim()) paymentRow.notes = formData.notes.trim();

      const { error: paymentError } = await supabase.from('payments').insert(paymentRow);
      if (paymentError) throw paymentError;

      // Optionally update course-level payment status
      if (formData.update_payment_status) {
        const { error: courseError } = await supabase
          .from('courses')
          .update({ payment_status: formData.update_payment_status, updated_at: new Date().toISOString() })
          .eq('id', courseId);
        if (courseError) console.error('Failed to update course payment status:', courseError);
      }

      toast.success('Payment recorded successfully!');
      onSuccess();
      onClose();
      setFormData(blankForm());
    } catch (err: any) {
      console.error('Error recording payment:', err);
      toast.error(err.message || 'Failed to record payment.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData(blankForm());
    setAmountError('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2 truncate">{courseName}</p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="amount">
                Amount ({currency}) <span className="text-destructive" aria-hidden>*</span>
              </Label>
              <Input
                id="amount"
                type="number"
                min={0.01}
                step={0.01}
                placeholder="0.00"
                value={formData.amount}
                onChange={e => {
                  setFormData(p => ({ ...p, amount: e.target.value }));
                  setAmountError('');
                }}
                aria-invalid={!!amountError}
                aria-describedby={amountError ? 'amount-err' : undefined}
                required
              />
              {amountError && <p id="amount-err" className="text-xs text-destructive">{amountError}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="payment_method">Method</Label>
              <select
                id="payment_method"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                value={formData.payment_method}
                onChange={e => setFormData(p => ({ ...p, payment_method: e.target.value }))}
              >
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="card">Card</option>
                <option value="online">Online</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="payment_date">Payment Date</Label>
            <Input
              id="payment_date"
              type="date"
              value={formData.payment_date}
              onChange={e => setFormData(p => ({ ...p, payment_date: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="period_start">Period Start</Label>
              <Input
                id="period_start"
                type="date"
                value={formData.period_start}
                onChange={e => setFormData(p => ({ ...p, period_start: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="period_end">Period End</Label>
              <Input
                id="period_end"
                type="date"
                value={formData.period_end}
                onChange={e => setFormData(p => ({ ...p, period_end: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="update_payment_status">Update Course Payment Status</Label>
            <select
              id="update_payment_status"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              value={formData.update_payment_status}
              onChange={e => setFormData(p => ({ ...p, update_payment_status: e.target.value as any }))}
            >
              <option value="">— Keep current status —</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="unpaid">Unpaid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Payment reference, receipt number, etc. (optional)"
              value={formData.notes}
              onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Recording…' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
