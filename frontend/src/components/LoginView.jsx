import { useState } from 'react';
import './LoginView.css';

const LoginView = ({ onMemberLogin, onAdminLogin, isLoading, error }) => {
  const [activeTab, setActiveTab] = useState('member');
  const [memberForm, setMemberForm] = useState({ flatNumber: '', password: '' });
  const [adminForm, setAdminForm] = useState({ email: '', password: '' });

  const handleMemberSubmit = (event) => {
    event.preventDefault();
    if (isLoading) return;
    onMemberLogin(memberForm);
  };

  const handleAdminSubmit = (event) => {
    event.preventDefault();
    if (isLoading) return;
    onAdminLogin(adminForm);
  };

  return (
    <div className="auth-shell">
      <header className="auth-header">
        <h1>Society Maintenance Portal</h1>
        <p>Sign in as a member or administrator to continue.</p>
      </header>

      <div className="auth-card">
        <div className="auth-tabs">
          <button
            type="button"
            className={activeTab === 'member' ? 'active' : ''}
            onClick={() => setActiveTab('member')}
            disabled={isLoading && activeTab !== 'member'}
          >
            Member Login
          </button>
          <button
            type="button"
            className={activeTab === 'admin' ? 'active' : ''}
            onClick={() => setActiveTab('admin')}
            disabled={isLoading && activeTab !== 'admin'}
          >
            Admin Login
          </button>
        </div>

        {error && <div className="auth-error" role="alert">{error}</div>}

        {activeTab === 'member' ? (
          <form onSubmit={handleMemberSubmit} className="auth-form">
            <label>
              <span>Flat Number</span>
              <input
                type="text"
                value={memberForm.flatNumber}
                onChange={(event) => setMemberForm((prev) => ({ ...prev, flatNumber: event.target.value.trim() }))}
                placeholder="e.g. A-101"
                required
                autoComplete="username"
              />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                value={memberForm.password}
                onChange={(event) => setMemberForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
            </label>
            <button type="submit" className="auth-submit" disabled={isLoading}>
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleAdminSubmit} className="auth-form">
            <label>
              <span>Email</span>
              <input
                type="email"
                value={adminForm.email}
                onChange={(event) => setAdminForm((prev) => ({ ...prev, email: event.target.value.trim() }))}
                placeholder="admin@society.com"
                required
                autoComplete="username"
              />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                value={adminForm.password}
                onChange={(event) => setAdminForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
            </label>
            <button type="submit" className="auth-submit" disabled={isLoading}>
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}
      </div>

      <footer className="auth-footer">
        <small>Tip: contact your society office if you have trouble signing in.</small>
      </footer>
    </div>
  );
};

export default LoginView;
