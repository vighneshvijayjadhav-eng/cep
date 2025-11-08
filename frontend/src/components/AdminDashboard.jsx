import { useEffect, useMemo, useState } from 'react';
import { createMember, deleteMember, generatePaymentReport, importMembers, listMembers, listPayments, sendPaymentNotification, sendPaymentReminder, updateMember } from '../services/adminService.js';
import { formatCurrency, formatDateTime } from '../services/paymentService.js';
import './AdminDashboard.css';

const emptyForm = {
  societyName: '',
  flatNumber: '',
  name: '',
  email: '',
  phone: '',
  tenantName: '',
  tenantPhone: '',
  maintenanceAmount: '',
  password: '',
  dueDayOfMonth: '',
  recurringDueEnabled: false,
  nextDueDate: '',
};

const toInputDateValue = (value) => {
  if (!value) {
    return '';
  }

  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toISOString().split('T')[0];
  } catch (_error) {
    return '';
  }
};

const AdminDashboard = ({ admin, token, onLogout }) => {
  const [members, setMembers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [fileSummary, setFileSummary] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [reportConfig, setReportConfig] = useState({
    startDate: '',
    endDate: '',
    sendEmail: false,
    email: '',
  });
  const [reportResult, setReportResult] = useState(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [emailSending, setEmailSending] = useState({});
  const [reminderSending, setReminderSending] = useState({});

  const toNumber = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const getTotalAmount = (payment) => {
    if (!payment) return 0;
    const total = payment.totalAmount !== undefined ? payment.totalAmount : payment.amount;
    return toNumber(total);
  };

  const getPenaltyAmount = (payment) => toNumber(payment?.penaltyAmount);

  const getBaseAmount = (payment) => {
    if (!payment) return 0;
    const base = payment.baseAmount !== undefined ? payment.baseAmount : getTotalAmount(payment) - getPenaltyAmount(payment);
    return toNumber(base);
  };

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

  const loadMembers = async (term = '') => {
    try {
      const data = await listMembers(token, term);
      setMembers(data);
    } catch (error) {
      console.error('Failed to load members', error);
      setStatusMessage(error.message || 'Failed to load members');
    }
  };

  const loadPayments = async () => {
    try {
      const data = await listPayments(token);
      setPayments(data);
    } catch (error) {
      console.error('Failed to load payments', error);
      setStatusMessage(error.message || 'Failed to load payments');
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      setIsLoading(true);
      await Promise.all([loadMembers(), loadPayments()]);
      setIsLoading(false);
    };

    bootstrap();
  }, [token]);

  useEffect(() => {
    if (admin?.email) {
      setReportConfig((prev) => {
        if (prev.email) {
          return prev;
        }
        return { ...prev, email: admin.email };
      });
    }
  }, [admin?.email]);

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const resetForm = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
  };

  const handleReportConfigChange = (event) => {
    const { name, value, type, checked } = event.target;
    setReportConfig((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleGenerateReport = async (event) => {
    event.preventDefault();
    if (isGeneratingReport) {
      return;
    }

    const payload = {};
    if (reportConfig.startDate) {
      payload.startDate = reportConfig.startDate;
    }
    if (reportConfig.endDate) {
      payload.endDate = reportConfig.endDate;
    }
    if (reportConfig.sendEmail) {
      payload.sendEmail = true;
      if (!reportConfig.email.trim()) {
        setStatusMessage('Enter an email address to send the report');
        return;
      }
      payload.email = reportConfig.email.trim();
    }

    if (payload.startDate && payload.endDate) {
      const start = new Date(payload.startDate);
      const end = new Date(payload.endDate);
      if (start > end) {
        setStatusMessage('Start date must be before end date');
        return;
      }
    }

    setIsGeneratingReport(true);
    setStatusMessage('');
    setReportResult(null);

    try {
      const response = await generatePaymentReport(token, payload);
      setReportResult(response);
      setStatusMessage('Payment report generated');
    } catch (error) {
      setStatusMessage(error.message || 'Failed to generate payment report');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleSendPaymentEmail = async (payment) => {
    const orderId = payment.orderId;
    if (!orderId || emailSending[orderId]) {
      return;
    }

    setEmailSending((prev) => ({ ...prev, [orderId]: true }));
    setStatusMessage('');

    try {
      const payload = {};
      if (payment.member?.email) {
        payload.email = payment.member.email;
      }
      const response = await sendPaymentNotification(token, orderId, payload);
      const recipient = response?.email?.recipient || payment.member?.email;
      setStatusMessage(`Payment confirmation email sent${recipient ? ` to ${recipient}` : ''}`);
    } catch (error) {
      setStatusMessage(error.message || 'Failed to send payment email');
    } finally {
      setEmailSending((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const handleSendPenaltyReminder = async (payment) => {
    const orderId = payment.orderId;
    if (!orderId || reminderSending[orderId]) {
      return;
    }

    setReminderSending((prev) => ({ ...prev, [orderId]: true }));
    setStatusMessage('');

    try {
      const payload = {};
      if (payment.member?.email) {
        payload.email = payment.member.email;
      }

      const response = await sendPaymentReminder(token, orderId, payload);
      const recipient = response?.email?.recipient || payload.email || payment.member?.email;
      const totalDue = response?.amounts?.totalAmount ?? getTotalAmount(payment);
      setStatusMessage(`Reminder sent${recipient ? ` to ${recipient}` : ''} for ${formatCurrency(totalDue)}`);
    } catch (error) {
      setStatusMessage(error.message || 'Failed to send payment reminder');
    } finally {
      setReminderSending((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    const payload = {
      societyName: form.societyName.trim(),
      flatNumber: form.flatNumber.trim(),
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      tenantName: form.tenantName.trim(),
      tenantPhone: form.tenantPhone.trim(),
      maintenanceAmount: Number(form.maintenanceAmount),
    };

    if (form.dueDayOfMonth !== '') {
      const dueDayNumber = Number(form.dueDayOfMonth);
      if (!Number.isInteger(dueDayNumber) || dueDayNumber < 1 || dueDayNumber > 31) {
        setStatusMessage('Due day must be between 1 and 31');
        return;
      }
      payload.dueDayOfMonth = dueDayNumber;
    } else if (editingId) {
      payload.dueDayOfMonth = null;
    }

    payload.recurringDueEnabled = Boolean(form.recurringDueEnabled);

    if (form.nextDueDate) {
      payload.nextDueDate = form.nextDueDate;
    } else if (editingId) {
      payload.nextDueDate = null;
    }

    if (payload.recurringDueEnabled && !payload.dueDayOfMonth && !form.nextDueDate) {
      setStatusMessage('Set a due day or next due date to enable recurring billing');
      return;
    }

    if (!editingId && !form.password) {
      setStatusMessage('Password is required when creating a member');
      return;
    }

    if (form.password) {
      payload.password = form.password;
    }

    setIsSubmitting(true);
    setStatusMessage('');

    try {
      if (editingId) {
        await updateMember(token, editingId, payload);
        setStatusMessage('Member updated');
      } else {
        await createMember(token, payload);
        setStatusMessage('Member created');
      }

      resetForm();
      await loadMembers(search);
    } catch (error) {
      setStatusMessage(error.message || 'Failed to save member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (member) => {
    setEditingId(member.id);
    setForm({
      societyName: member.societyName || '',
      flatNumber: member.flatNumber || '',
      name: member.name || '',
      email: member.email || '',
      phone: member.phone || '',
      tenantName: member.tenantName || '',
      tenantPhone: member.tenantPhone || '',
      maintenanceAmount: member.maintenanceAmount || '',
      password: '',
      dueDayOfMonth: member.dueDayOfMonth ? String(member.dueDayOfMonth) : '',
      recurringDueEnabled: Boolean(member.recurringDueEnabled),
      nextDueDate: toInputDateValue(member.nextDueDate),
    });
  };

  const handleDelete = async (memberId) => {
    if (!window.confirm('Delete this member and their payment history?')) {
      return;
    }

    try {
      await deleteMember(token, memberId);
      setStatusMessage('Member deleted');
      await Promise.all([loadMembers(search), loadPayments()]);
    } catch (error) {
      setStatusMessage(error.message || 'Failed to delete member');
    }
  };

  const handleFileImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsSubmitting(true);
      setStatusMessage('Importing members…');
      const summary = await importMembers(token, file);
      setFileSummary(summary.summary || null);
      setStatusMessage('Import completed');
      await Promise.all([loadMembers(search), loadPayments()]);
    } catch (error) {
      setStatusMessage(error.message || 'Import failed');
    } finally {
      setIsSubmitting(false);
      event.target.value = '';
    }
  };

  const filteredPayments = useMemo(() => payments.slice(0, 50), [payments]);

  const totals = useMemo(() => {
    const aggregate = payments.reduce(
      (acc, payment) => {
        const total = getTotalAmount(payment);
        if (payment.status === 'paid') {
          acc.collected += total;
        } else {
          acc.outstanding += total;
        }
        return acc;
      },
      { collected: 0, outstanding: 0 }
    );

    return {
      collected: formatCurrency(aggregate.collected),
      outstanding: formatCurrency(aggregate.outstanding),
      memberCount: members.length,
    };
  }, [members.length, payments]);

  const outstandingCount = useMemo(() => payments.filter((payment) => payment.status !== 'paid').length, [payments]);
  const recurringMembers = useMemo(() => members.filter((member) => member.recurringDueEnabled).length, [members]);

  const handleSearch = async (event) => {
    const term = event.target.value;
    setSearch(term);
    await loadMembers(term);
  };

  return (
    <div className="admin-dashboard">
      <header className="admin-topbar">
        <div>
          <h2>Admin Console</h2>
          <p>Signed in as {admin?.name || 'Administrator'}</p>
        </div>
        <button type="button" className="outline" onClick={onLogout}>Sign out</button>
      </header>

      <section className="dashboard-stats">
        <div className="stat-card primary">
          <span className="stat-label">Total collected</span>
          <strong className="stat-value">{totals.collected}</strong>
          <span className="stat-caption">Across all paid invoices</span>
        </div>
        <div className="stat-card warning">
          <span className="stat-label">Outstanding</span>
          <strong className="stat-value">{totals.outstanding}</strong>
          <span className="stat-caption">{outstandingCount} pending payments</span>
        </div>
        <div className="stat-card neutral">
          <span className="stat-label">Active members</span>
          <strong className="stat-value">{totals.memberCount}</strong>
          <span className="stat-caption">Linked flats on record</span>
        </div>
        <div className="stat-card success">
          <span className="stat-label">Recurring schedules</span>
          <strong className="stat-value">{recurringMembers}</strong>
          <span className="stat-caption">Auto reminders configured</span>
        </div>
      </section>

      {statusMessage && <div className="admin-status">{statusMessage}</div>}

      <section className="admin-grid">
        <article className="admin-card">
          <h3>{editingId ? 'Edit member' : 'Add member'}</h3>
          <form className="member-form" onSubmit={handleSubmit}>
            <div className="field-pair">
              <label>
                <span>Society</span>
                <input name="societyName" value={form.societyName} onChange={handleFormChange} required />
              </label>
              <label>
                <span>Flat number</span>
                <input name="flatNumber" value={form.flatNumber} onChange={handleFormChange} required />
              </label>
            </div>

            <div className="field-pair">
              <label>
                <span>Member name</span>
                <input name="name" value={form.name} onChange={handleFormChange} required />
              </label>
              <label>
                <span>Maintenance amount (₹)</span>
                <input name="maintenanceAmount" type="number" min="1" value={form.maintenanceAmount} onChange={handleFormChange} required />
              </label>
            </div>

            <div className="field-pair">
              <label>
                <span>Email</span>
                <input type="email" name="email" value={form.email} onChange={handleFormChange} />
              </label>
              <label>
                <span>Phone</span>
                <input name="phone" value={form.phone} onChange={handleFormChange} />
              </label>
            </div>

            <div className="field-pair">
              <label>
                <span>Tenant name</span>
                <input name="tenantName" value={form.tenantName} onChange={handleFormChange} />
              </label>
              <label>
                <span>Tenant phone</span>
                <input name="tenantPhone" value={form.tenantPhone} onChange={handleFormChange} />
              </label>
            </div>

            <div className="field-pair">
              <label>
                <span>Due day of month</span>
                <input
                  name="dueDayOfMonth"
                  type="number"
                  min="1"
                  max="31"
                  value={form.dueDayOfMonth}
                  onChange={handleFormChange}
                  placeholder="e.g. 5"
                />
              </label>
              <label>
                <span>Next due date</span>
                <input
                  name="nextDueDate"
                  type="date"
                  value={form.nextDueDate}
                  onChange={handleFormChange}
                />
              </label>
            </div>

            <label className="checkbox-field">
              <input
                type="checkbox"
                name="recurringDueEnabled"
                checked={Boolean(form.recurringDueEnabled)}
                onChange={handleFormChange}
              />
              <span>Enable recurring monthly dues for this member</span>
            </label>

            <label>
              <span>{editingId ? 'Reset password (optional)' : 'Password'}</span>
              <input type="password" name="password" value={form.password} onChange={handleFormChange} placeholder={editingId ? 'Leave blank to keep current password' : 'Temporary password for member'} />
            </label>

            <div className="form-actions">
              <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : editingId ? 'Update member' : 'Create member'}</button>
              {editingId && (
                <button type="button" className="outline" onClick={resetForm} disabled={isSubmitting}>Cancel edit</button>
              )}
            </div>
          </form>

          <div className="import-block">
            <label className="file-upload">
              <span>Import members (.xlsx)</span>
              <input type="file" accept=".xlsx,.xls" onChange={handleFileImport} disabled={isSubmitting} />
            </label>
            {fileSummary && (
              <dl>
                <div><dt>Created</dt><dd>{fileSummary.created}</dd></div>
                <div><dt>Updated</dt><dd>{fileSummary.updated}</dd></div>
                <div><dt>Failed</dt><dd>{fileSummary.failed}</dd></div>
              </dl>
            )}
          </div>
        </article>

        <article className="admin-card">
          <header className="card-header">
            <div>
              <h3>Members</h3>
              <p>{totals.memberCount} linked flats</p>
            </div>
            <input type="search" placeholder="Search by flat, name, email" value={search} onChange={handleSearch} />
          </header>

          <div className="table-wrapper">
            {isLoading ? (
              <p className="muted">Loading members…</p>
            ) : members.length === 0 ? (
              <p className="muted">No members found.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Flat</th>
                    <th>Member</th>
                    <th>Contact</th>
                    <th>Maintenance</th>
                    <th>Schedule</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <strong>{member.flatNumber}</strong>
                        <div className="muted">{member.societyName}</div>
                      </td>
                      <td>{member.name}</td>
                      <td>
                        {member.email && <div>{member.email}</div>}
                        {member.phone && <div>{member.phone}</div>}
                      </td>
                      <td>{formatCurrency(member.maintenanceAmount)}</td>
                      <td>
                        <div className={`schedule-chip ${member.recurringDueEnabled ? 'active' : 'inactive'}`}>
                          {member.recurringDueEnabled ? 'Recurring' : 'Manual'}
                        </div>
                        <div className="schedule-meta">
                          {member.dueDayOfMonth && <span>Due day {member.dueDayOfMonth}</span>}
                          {member.nextDueDate && <span>Next {formatDateOnly(member.nextDueDate)}</span>}
                          {!member.dueDayOfMonth && !member.nextDueDate && (
                            <span className="muted">No schedule set</span>
                          )}
                        </div>
                      </td>
                      <td className="row-actions">
                        <button type="button" className="ghost" onClick={() => handleEdit(member)}>Edit</button>
                        <button type="button" className="danger" onClick={() => handleDelete(member.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </article>
      </section>

      <section className="admin-card">
        <h3>Payment reports</h3>
        <form className="report-form" onSubmit={handleGenerateReport}>
          <div className="field-pair">
            <label>
              <span>Start date</span>
              <input type="date" name="startDate" value={reportConfig.startDate} onChange={handleReportConfigChange} />
            </label>
            <label>
              <span>End date</span>
              <input type="date" name="endDate" value={reportConfig.endDate} onChange={handleReportConfigChange} />
            </label>
          </div>

          <label className="checkbox-field">
            <input type="checkbox" name="sendEmail" checked={reportConfig.sendEmail} onChange={handleReportConfigChange} />
            <span>Send report via email</span>
          </label>

          {reportConfig.sendEmail && (
            <label>
              <span>Email recipient</span>
              <input type="email" name="email" value={reportConfig.email} onChange={handleReportConfigChange} placeholder="admin@example.com" />
            </label>
          )}

          <div className="form-actions">
            <button type="submit" disabled={isGeneratingReport}>{isGeneratingReport ? 'Generating...' : 'Generate report'}</button>
          </div>
        </form>

        {reportResult?.report && (
          <div className="report-summary">
            <div>
              <strong>Records</strong>
              <span>{reportResult.report.totals?.records || 0}</span>
            </div>
            <div>
              <strong>Base total</strong>
              <span>{formatCurrency(reportResult.report.totals?.base || 0)}</span>
            </div>
            <div>
              <strong>Penalty total</strong>
              <span>{formatCurrency(reportResult.report.totals?.penalty || 0)}</span>
            </div>
            <div>
              <strong>Collected</strong>
              <span>{formatCurrency(reportResult.report.totals?.paid || 0)}</span>
            </div>
            <div>
              <strong>Outstanding</strong>
              <span>{formatCurrency(reportResult.report.totals?.outstanding || 0)}</span>
            </div>
            <div>
              <strong>Download</strong>
              {reportResult.report.downloadUrl ? (
                <a href={reportResult.report.downloadUrl} target="_blank" rel="noopener noreferrer">CSV report</a>
              ) : (
                <span className="muted">Not available</span>
              )}
            </div>
          </div>
        )}

        {reportResult?.email?.requested && (
          <p className={`report-status ${reportResult.email.sent ? 'success' : 'error'}`}>
            {reportResult.email.sent ? 'Email sent successfully' : reportResult.email.error || 'Email notification not sent'}
          </p>
        )}
      </section>

      <section className="admin-card">
        <header className="card-header">
          <div>
            <h3>Recent payments</h3>
            <p>Showing last {filteredPayments.length} records</p>
          </div>
          <div className="amount-pills">
            <span>Collected: {totals.collected}</span>
            <span>Outstanding: {totals.outstanding}</span>
          </div>
        </header>

        <div className="table-wrapper">
          {filteredPayments.length === 0 ? (
            <p className="muted">No payments yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Flat</th>
                  <th>Period</th>
                  <th>Status</th>
                    <th>Due date</th>
                    <th>Amount</th>
                  <th>Paid at</th>
                  <th>Invoice</th>
                    <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => (
                  <tr key={payment.orderId}>
                    <td>
                      <strong>{payment.member?.flatNumber || '—'}</strong>
                      <div className="muted">{payment.member?.name || '—'}</div>
                    </td>
                    <td>{payment.paymentPeriod}</td>
                    <td>
                        <span className={`status-pill ${payment.status}`}>{payment.status}</span>
                      </td>
                      <td>{formatDateOnly(payment.dueDate)}</td>
                      <td>
                        <div className="amount-cell">
                          <span className="amount-total">{formatCurrency(getTotalAmount(payment))}</span>
                          <span className="amount-breakdown">Base: {formatCurrency(getBaseAmount(payment))}</span>
                          {getPenaltyAmount(payment) > 0 && (
                            <span className="amount-penalty">Penalty: {formatCurrency(getPenaltyAmount(payment))}</span>
                          )}
                        </div>
                    </td>
                    <td>{formatDateTime(payment.paidAt || payment.createdAt)}</td>
                    <td>
                      {payment.invoiceUrl ? (
                        <a href={payment.invoiceUrl} target="_blank" rel="noopener noreferrer">Download</a>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                      <td>
                        <div className="actions-stack">
                          {payment.status === 'paid' ? (
                            payment.member?.email ? (
                              <button
                                type="button"
                                className="notify-button"
                                onClick={() => handleSendPaymentEmail(payment)}
                                disabled={Boolean(emailSending[payment.orderId])}
                              >
                                {emailSending[payment.orderId] ? 'Sending...' : 'Send receipt'}
                              </button>
                            ) : (
                              <span className="muted">No email on file</span>
                            )
                          ) : payment.member?.email ? (
                            <button
                              type="button"
                              className="reminder-button"
                              onClick={() => handleSendPenaltyReminder(payment)}
                              disabled={Boolean(reminderSending[payment.orderId])}
                            >
                              {reminderSending[payment.orderId] ? 'Notifying...' : 'Send reminder'}
                            </button>
                          ) : (
                            <span className="muted">No email on file</span>
                          )}
                        </div>
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

export default AdminDashboard;
