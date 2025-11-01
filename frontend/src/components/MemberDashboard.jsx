import { useEffect, useMemo, useState } from 'react';
import config from '../config/config.js';
import { fetchMemberProfile, fetchMemberPayments } from '../services/memberService.js';
import { createMemberOrder, ensureRazorpay, formatCurrency, formatDateTime, verifyMemberPayment } from '../services/paymentService.js';
import './MemberDashboard.css';

const emptyForm = {
  paymentPeriod: '',
  maintenanceType: 'monthly',
  amount: '',
  notes: '',
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

  const loadProfile = async () => {
    try {
      const data = await fetchMemberProfile(token);
      if (data) {
        setProfile(data);
        setForm((prev) => ({
          ...prev,
          amount: data.maintenanceAmount || prev.amount,
        }));
      }
    } catch (error) {
      setMessage(error.message || 'Failed to load profile');
    }
  };

  const loadPayments = async () => {
    try {
      const data = await fetchMemberPayments(token);
      setPayments(data);
    } catch (error) {
      setMessage(error.message || 'Failed to load payments');
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      setIsLoading(true);
      await Promise.all([loadProfile(), loadPayments()]);
      setIsLoading(false);
    };

    bootstrap();
  }, [token]);

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePayment = async (event) => {
    event.preventDefault();
    if (isPaying) return;

    if (!form.paymentPeriod.trim()) {
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
      const order = await createMemberOrder(token, {
        paymentPeriod: form.paymentPeriod.trim(),
        maintenanceType: form.maintenanceType,
        amount: amountNumber,
        notes: form.notes.trim(),
      });

      if (order.manual) {
        setManualMode(true);
        setInvoiceUrl(order.transaction.invoiceUrl || '');
        setMessage('Payment marked as paid. Download your invoice below.');
        await loadPayments();
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
          </div>
        </article>

        <article className="card">
          <h3>Make a payment</h3>
          <form className="payment-form" onSubmit={handlePayment}>
            <label>
              <span>Payment period</span>
              <input name="paymentPeriod" value={form.paymentPeriod} onChange={handleFormChange} placeholder="e.g. November 2025" required />
            </label>
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
            <button type="submit" disabled={isPaying}>{isPaying ? 'Processing…' : 'Pay now'}</button>
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
