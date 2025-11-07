import { useEffect, useMemo, useState } from 'react';
import { createMember, deleteMember, generatePaymentReport, importMembers, listMembers, listPayments, sendPaymentNotification, updateMember } from '../services/adminService.js';
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
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
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
    const collected = payments.filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const outstanding = payments.filter((payment) => payment.status !== 'paid').reduce((sum, payment) => sum + (payment.amount || 0), 0);
    return {
      collected: formatCurrency(collected),
      outstanding: formatCurrency(outstanding),
      memberCount: members.length,
    };
  }, [members.length, payments]);

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
                      <td className="row-actions">
                        <button type="button" onClick={() => handleEdit(member)}>Edit</button>
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
                  <th>Amount</th>
                  <th>Paid at</th>
                  <th>Invoice</th>
                  <th>Email receipt</th>
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
                    <td>{formatCurrency(payment.amount)}</td>
                    <td>{formatDateTime(payment.paidAt || payment.createdAt)}</td>
                    <td>
                      {payment.invoiceUrl ? (
                        <a href={payment.invoiceUrl} target="_blank" rel="noopener noreferrer">Download</a>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {payment.status !== 'paid' ? (
                        <span className="muted">Only for paid</span>
                      ) : !payment.member?.email ? (
                        <span className="muted">No email on file</span>
                      ) : (
                        <button
                          type="button"
                          className="notify-button"
                          onClick={() => handleSendPaymentEmail(payment)}
                          disabled={Boolean(emailSending[payment.orderId])}
                        >
                          {emailSending[payment.orderId] ? 'Sending...' : 'Send receipt'}
                        </button>
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

export default AdminDashboard;
