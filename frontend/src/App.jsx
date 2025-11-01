import { useEffect, useState } from 'react';
import AdminDashboard from './components/AdminDashboard.jsx';
import LoginView from './components/LoginView.jsx';
import MemberDashboard from './components/MemberDashboard.jsx';
import { adminLogin, memberLogin } from './services/authService.js';
import './App.css';

const STORAGE_KEY = 'society-portal-auth';

const loadAuth = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (_error) {
    return null;
  }
};

const App = () => {
  const [auth, setAuth] = useState(() => loadAuth());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (auth) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [auth]);

  const handleMemberLogin = async (credentials) => {
    setIsLoading(true);
    setError('');
    try {
      const result = await memberLogin(credentials);
      setAuth({ role: 'member', token: result.token, member: result.member });
    } catch (err) {
      setError(err.message || 'Unable to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async (credentials) => {
    setIsLoading(true);
    setError('');
    try {
      const result = await adminLogin(credentials);
      setAuth({ role: 'admin', token: result.token, admin: result.admin });
    } catch (err) {
      setError(err.message || 'Unable to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setAuth(null);
  };

  return (
    <div className="app-shell">
      <div className="app-content">
        {!auth?.token ? (
          <LoginView
            onMemberLogin={handleMemberLogin}
            onAdminLogin={handleAdminLogin}
            isLoading={isLoading}
            error={error}
          />
        ) : auth.role === 'member' ? (
          <MemberDashboard member={auth.member} token={auth.token} onLogout={handleLogout} />
        ) : (
          <AdminDashboard admin={auth.admin} token={auth.token} onLogout={handleLogout} />
        )}
      </div>
    </div>
  );
};

export default App;
