import { useEffect, useMemo, useState } from 'react';
import config from '../config/config.js';
import { fetchMemberProfile, fetchMemberPayments, fetchPendingPeriods } from '../services/memberService.js';
import { createMemberOrder, ensureRazorpay, formatCurrency, formatDateTime, verifyMemberPayment } from '../services/paymentService.js';
import './MemberDashboard.css';

const emptyForm = {
  paymentPeriod: '',
  maintenanceType: 'monthly',
  amount: '',
  notes: '',
  dueDate: '',
};

const MemberDashboard = ({ member: initialMember, token, onLogout }) => {
  const [profile, setProfile] = useState(initialMember || null);
  const [payments, setPayments] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaying, setIsPaying] = useState(false);
  const [message, setMessage] = useState('');
  const [invoiceUrl, setInvoiceUrl] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [pendingPeriods, setPendingPeriods] = useState([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');

  const formatDateOnly = (value) => {
    if (!value) {
      return '—';
    }

    try {
      return new Intl.DateTimeFormat('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(new Date(value));
    } catch (_error) {
      return '—';
    }
  };

  const formatNumberInputValue = (value) => {
    if (!Number.isFinite(value)) {
      return '';
    }

    const fixed = value.toFixed(2);
    return fixed.endsWith('.00') ? fixed.slice(0, -3) : fixed;
  };

  const loadProfile = async () => {
    try {
      const data = await fetchMemberProfile(token);
      if (data) {
        setProfile(data);
        setForm((prev) => {
          if (prev.amount) {
            return prev;
          }
          const baseAmount = Number(data.maintenanceAmount);
          if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
            return prev;
          }
          return {
            ...prev,
            amount: formatNumberInputValue(baseAmount),
          };
        });
      }
      return data;
    } catch (error) {
      setMessage(error.message || 'Failed to load profile');
      return null;
    }
  };

  const loadPayments = async () => {
    try {
      const data = await fetchMemberPayments(token);
      setPayments(data);
      return data;
    } catch (error) {
      setMessage(error.message || 'Failed to load payments');
      return [];
    }
  };

  const applyPeriodSelection = (period, { markSelected = true } = {}) => {
    if (!period) {
      return;
    }

    const totalRaw = Number(period.totalAmount ?? period.baseAmount);
    const totalValue = formatNumberInputValue(totalRaw);

    setForm((prev) => ({
      ...prev,
      paymentPeriod: period.label,
      dueDate: period.dueDate || '',
      amount: totalValue || prev.amount,
    }));

    if (markSelected) {
      setSelectedPeriodId(period.id);
    }
  };

  const loadPendingPeriods = async ({ autoSelect = false } = {}) => {
    try {
      const periods = await fetchPendingPeriods(token);
      setPendingPeriods(periods);

      if (periods.length === 0) {
        if (autoSelect) {
          setSelectedPeriodId('');
          setForm((prev) => ({
            ...prev,
            paymentPeriod: '',
            dueDate: '',
          }));
        }
        return periods;
      }

      if (autoSelect) {
        applyPeriodSelection(periods[0], { markSelected: true });
        return periods;
      }

      if (selectedPeriodId) {
        const current = periods.find((item) => item.id === selectedPeriodId);
        if (current) {
          applyPeriodSelection(current, { markSelected: false });
          return periods;
        }
      }

      applyPeriodSelection(periods[0], { markSelected: true });
      return periods;
    } catch (error) {
      setMessage(error.message || 'Failed to load pending periods');
      setPendingPeriods([]);
      if (autoSelect) {
        setSelectedPeriodId('');
        setForm((prev) => ({
          ...prev,
          paymentPeriod: '',
          dueDate: '',
        }));
      }
      return [];
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      setIsLoading(true);
      await Promise.all([loadProfile(), loadPayments(), loadPendingPeriods({ autoSelect: true })]);
      setIsLoading(false);
    };

    bootstrap();
  }, [token]);

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePendingPeriodChange = (event) => {
    const { value } = event.target;
    if (!value) {
      setSelectedPeriodId('');
      setForm((prev) => ({
        ...prev,
        paymentPeriod: '',
        dueDate: '',
      }));
      return;
    }

    const period = pendingPeriods.find((item) => item.id === value);
    if (period) {
      applyPeriodSelection(period, { markSelected: true });
    }
  };

  const handlePayment = async (event) => {
    event.preventDefault();
    if (isPaying) return;

    const hasOptions = pendingPeriods.length > 0;

    if (hasOptions) {
      if (!selectedPeriodId) {
        setMessage('Select a pending month to continue');
        return;
      }
      if (!form.paymentPeriod.trim()) {
        setMessage('Unable to identify payment period for the selected month');
        return;
      }
    } else if (!form.paymentPeriod.trim()) {
      setMessage('Payment period is required');
      return;
    }

    const amountNumber = Number(form.amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setMessage('Enter a valid amount');
      return;
    }

    setIsPaying(true);
    setMessage('');
    setInvoiceUrl('');
    setManualMode(false);

    try {
      const orderPayload = {
        paymentPeriod: form.paymentPeriod.trim(),
        maintenanceType: form.maintenanceType,
        amount: amountNumber,
        notes: form.notes.trim(),
      };

      if (form.dueDate) {
        orderPayload.dueDate = form.dueDate;
      }

      const order = await createMemberOrder(token, orderPayload);

      if (order.manual) {
        setManualMode(true);
        setInvoiceUrl(order.transaction.invoiceUrl || '');
        setMessage('Payment marked as paid. Download your invoice below.');
        await loadPayments();
        await loadProfile();
        await loadPendingPeriods({ autoSelect: true });
        setForm((prev) => ({ ...prev, notes: '' }));
        return;
      }

      if (!config.RAZORPAY_KEY_ID) {
        setMessage('Razorpay key is not configured on the frontend.');
        return;
      }

      await ensureRazorpay();

      const options = {
        key: config.RAZORPAY_KEY_ID,
        amount: order.order.amount,
        currency: order.order.currency,
        order_id: order.order.id,
        name: profile?.societyName || 'Society Maintenance',
        description: `${form.maintenanceType} maintenance for ${form.paymentPeriod}`,
        prefill: {
          name: profile?.name,
          email: profile?.email,
          contact: profile?.phone,
        },
      };

      const payment = await new Promise((resolve, reject) => {
        const instance = new window.Razorpay({
          ...options,
          handler: (response) => resolve(response),
          modal: {
            ondismiss: () => reject(new Error('Payment window closed before completion')),
          },
        });
        instance.open();
      });

      const verification = await verifyMemberPayment({
        orderId: payment.razorpay_order_id,
        paymentId: payment.razorpay_payment_id,
        signature: payment.razorpay_signature,
      });

      if (verification?.verified) {
        setMessage('Payment successful. Download your invoice below.');
        setInvoiceUrl(verification.invoiceUrl || '');
        await loadPayments();
        await loadProfile();
        await loadPendingPeriods({ autoSelect: true });
        setForm((prev) => ({ ...prev, notes: '' }));
      } else {
        setMessage('Payment verification failed. Please contact support.');
      }
    } catch (error) {
      setMessage(error.message || 'Payment failed');
    } finally {
      setIsPaying(false);
    }
  };

  const totalPaid = useMemo(() => {
    return payments.filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + (payment.amount || 0), 0);
  }, [payments]);

  const latestPaid = useMemo(() => {
    return payments.find((payment) => payment.status === 'paid');
  }, [payments]);

  const selectedPending = useMemo(() => {
    if (!selectedPeriodId) {
      return null;
    }
    return pendingPeriods.find((period) => period.id === selectedPeriodId) || null;
  }, [pendingPeriods, selectedPeriodId]);

  return (
    <div className="member-dashboard">
      <header className="dashboard-top">
        <div>
          <h2>Welcome, {profile?.name || 'Resident'}</h2>
          <p>{profile?.societyName} · Flat {profile?.flatNumber}</p>
        </div>
        <button type="button" className="outline" onClick={onLogout}>Sign out</button>
      </header>

      {message && <div className="status-banner">{message}</div>}
      {manualMode && (
        <div className="manual-banner">Payments run in manual mode because online keys are not configured.</div>
      )}

      <section className="member-cards">
        <article className="card">
          <h3>Maintenance summary</h3>
          <div className="stats-grid">
            <div>
              <span className="label">Monthly due</span>
              <strong>{formatCurrency(profile?.maintenanceAmount)}</strong>
            </div>
            <div>
              <span className="label">Total paid</span>
              <strong>{formatCurrency(totalPaid)}</strong>
            </div>
            <div>
              <span className="label">Last payment</span>
              <strong>{latestPaid ? formatDateTime(latestPaid.paidAt || latestPaid.createdAt) : '—'}</strong>
            </div>
            <div>
              <span className="label">Next due</span>
              <strong>
                {pendingPeriods.length > 0
                  ? pendingPeriods[0].dueDateDisplay
                  : profile?.nextDueDate
                    ? formatDateOnly(profile.nextDueDate)
                    : '—'}
              </strong>
            </div>
          </div>
        </article>

        <article className="card">
          <h3>Make a payment</h3>
          <form className="payment-form" onSubmit={handlePayment}>
            <label>
              <span>{pendingPeriods.length > 0 ? 'Pending months' : 'Payment period'}</span>
              {pendingPeriods.length > 0 ? (
                <select name="pendingPeriod" value={selectedPeriodId} onChange={handlePendingPeriodChange} required>
                  <option value="">Select a pending month</option>
                  {pendingPeriods.map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.label} · {formatCurrency(period.totalAmount)}
                      {period.isOverdue ? ' (Overdue)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name="paymentPeriod"
                  value={form.paymentPeriod}
                  onChange={handleFormChange}
                  placeholder="e.g. November 2025"
                  required
                />
              )}
            </label>
            {pendingPeriods.length > 0 && selectedPending && (
              <div className="pending-summary">
                <span className="pending-due">Due on {selectedPending.dueDateDisplay}</span>
                <span>Base: {formatCurrency(selectedPending.baseAmount)}</span>
                <span>Penalty: {formatCurrency(selectedPending.penaltyAmount)}</span>
                <span className="pending-total">Total: {formatCurrency(selectedPending.totalAmount)}</span>
                {selectedPending.isOverdue && <span className="pending-overdue">Overdue month</span>}
              </div>
            )}
            <label>
              <span>Amount (₹)</span>
              <input name="amount" type="number" min="1" value={form.amount} onChange={handleFormChange} required />
            </label>
            <label>
              <span>Maintenance type</span>
              <select name="maintenanceType" value={form.maintenanceType} onChange={handleFormChange}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </label>
            <label>
              <span>Notes</span>
              <textarea name="notes" value={form.notes} onChange={handleFormChange} placeholder="Optional message for the office" rows={2} />
            </label>
            <button type="submit" disabled={isPaying || (pendingPeriods.length > 0 && !selectedPeriodId)}>
              {isPaying ? 'Processing…' : 'Pay now'}
            </button>
          </form>
          {invoiceUrl && (
            <a className="invoice-link" href={invoiceUrl} target="_blank" rel="noopener noreferrer">Download invoice</a>
          )}
        </article>
      </section>

      <section className="card full">
        <header className="card-header">
          <div>
            <h3>Payment history</h3>
            <p>Latest {payments.length} entries</p>
          </div>
        </header>
        <div className="table-wrapper">
          {isLoading ? (
            <p className="muted">Loading…</p>
          ) : payments.length === 0 ? (
            <p className="muted">No payments recorded yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Paid at</th>
                  <th>Invoice</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.orderId}>
                    <td>{payment.paymentPeriod}</td>
                    <td><span className={`status-pill ${payment.status}`}>{payment.status}</span></td>
                    <td>{formatCurrency(payment.amount)}</td>
                    <td>{formatDateTime(payment.paidAt || payment.createdAt)}</td>
                    <td>
                      {payment.invoiceUrl ? (
                        <a href={payment.invoiceUrl} target="_blank" rel="noopener noreferrer">Invoice</a>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
};

export default MemberDashboard;
