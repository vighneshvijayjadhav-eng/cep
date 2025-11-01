import { useEffect, useMemo, useState } from 'react';
import { createMember, deleteMember, importMembers, listMembers, listPayments, updateMember } from '../services/adminService.js';
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

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
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
