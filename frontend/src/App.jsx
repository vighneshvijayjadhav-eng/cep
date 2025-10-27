import { useState } from 'react';
import PaymentForm from './components/PaymentForm';
import PaymentSuccess from './components/PaymentSuccess';
import PaymentHistory from './components/PaymentHistory';
import AdminDashboard from './components/AdminDashboard';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('form'); // 'form', 'success', 'history', 'admin'
  const [transactionDetails, setTransactionDetails] = useState(null);

  const handlePaymentSuccess = (details) => {
    setTransactionDetails(details);
    setCurrentView('success');
  };

  const handleNewPayment = () => {
    setTransactionDetails(null);
    setCurrentView('form');
  };

  const handleViewHistory = () => {
    setCurrentView('history');
  };

  const handleBackToForm = () => {
    setCurrentView('form');
  };

  const handleAdminDashboard = () => {
    setCurrentView('admin');
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'success':
        return (
          <PaymentSuccess
            transactionDetails={transactionDetails}
            onNewPayment={handleNewPayment}
            onViewHistory={handleViewHistory}
          />
        );
      case 'history':
        return (
          <PaymentHistory
            onBackToForm={handleBackToForm}
          />
        );
      case 'admin':
        return (
          <AdminDashboard
            onBack={handleBackToForm}
          />
        );
      case 'form':
      default:
        return (
          <PaymentForm
            onPaymentSuccess={handlePaymentSuccess}
            onAdminDashboard={handleAdminDashboard}
          />
        );
    }
  };

  return (
    <div className="app">
      {/* Navigation Header */}
      <nav className="app-nav">
        <div className="nav-container">
          <h1 className="nav-title">Society Maintenance Payment</h1>
          <div className="nav-links">
            <button 
              className={`nav-link ${currentView === 'form' ? 'active' : ''}`}
              onClick={handleNewPayment}
            >
              💳 New Payment
            </button>
            <button 
              className={`nav-link ${currentView === 'history' ? 'active' : ''}`}
              onClick={handleViewHistory}
            >
              📜 Payment History
            </button>
            <button 
              className={`nav-link ${currentView === 'admin' ? 'active' : ''}`}
              onClick={handleAdminDashboard}
            >
              ⚙️ Manage Flats
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="app-main">
        {renderCurrentView()}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>&copy; 2025 Society Maintenance Payment System. Powered by Razorpay.</p>
      </footer>
    </div>
  );
}

export default App;
