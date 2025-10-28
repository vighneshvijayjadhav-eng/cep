import React, { useState, useEffect } from 'react';
import { saveFlatInfo, getAllFlats, updateFlatInfo, deleteFlatInfo } from '../services/flatService';
import './AdminDashboard.css';

const AdminDashboard = ({ onBack }) => {
  const [flats, setFlats] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingFlat, setEditingFlat] = useState(null);
  const [formData, setFormData] = useState({
    society_name: '',
    flat_number: '',
    wing: '',
    floor: '',
    member_name: '',
    member_email: '',
    member_phone: '',
    maintenance_type: 'monthly',
    maintenance_amount: ''
  });

  useEffect(() => {
    loadFlats();
  }, []);

  const loadFlats = () => {
    const savedFlats = getAllFlats();
    setFlats(savedFlats);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (editingFlat) {
      updateFlatInfo(editingFlat.id, formData);
    } else {
      saveFlatInfo(formData);
    }
    
    resetForm();
    loadFlats();
  };

  const handleEdit = (flat) => {
    setEditingFlat(flat);
    setFormData(flat);
    setShowForm(true);
  };

  const handleDelete = (flatId) => {
    if (window.confirm('Are you sure you want to delete this flat information?')) {
      deleteFlatInfo(flatId);
      loadFlats();
    }
  };

  const resetForm = () => {
    setFormData({
      society_name: '',
      flat_number: '',
      wing: '',
      floor: '',
      member_name: '',
      member_email: '',
      member_phone: '',
      maintenance_type: 'monthly',
      maintenance_amount: ''
    });
    setEditingFlat(null);
    setShowForm(false);
  };

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>🏢 Flat Management Dashboard</h1>
        <div className="admin-header-actions">
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            {showForm ? '📋 View All Flats' : '➕ Add New Flat'}
          </button>
          <button onClick={onBack} className="btn-secondary">
            🏠 Back to Payment
          </button>
        </div>
      </div>

      {showForm ? (
        <div className="admin-form-container">
          <div className="admin-form-card">
            <h2>{editingFlat ? '✏️ Edit Flat Information' : '➕ Add New Flat'}</h2>
            
            <form onSubmit={handleSubmit} className="admin-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="society_name">Society Name *</label>
                  <input
                    type="text"
                    id="society_name"
                    name="society_name"
                    value={formData.society_name}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="flat_number">Flat Number *</label>
                  <input
                    type="text"
                    id="flat_number"
                    name="flat_number"
                    value={formData.flat_number}
                    onChange={handleInputChange}
                    placeholder="e.g., A-101"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="wing">Wing</label>
                  <input
                    type="text"
                    id="wing"
                    name="wing"
                    value={formData.wing}
                    onChange={handleInputChange}
                    placeholder="e.g., A"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="floor">Floor</label>
                  <input
                    type="text"
                    id="floor"
                    name="floor"
                    value={formData.floor}
                    onChange={handleInputChange}
                    placeholder="e.g., 1st"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="member_name">Member Name *</label>
                  <input
                    type="text"
                    id="member_name"
                    name="member_name"
                    value={formData.member_name}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="member_phone">Phone Number *</label>
                  <input
                    type="tel"
                    id="member_phone"
                    name="member_phone"
                    value={formData.member_phone}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="member_email">Email Address *</label>
                  <input
                    type="email"
                    id="member_email"
                    name="member_email"
                    value={formData.member_email}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="maintenance_type">Maintenance Type *</label>
                  <select
                    id="maintenance_type"
                    name="maintenance_type"
                    value={formData.maintenance_type}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="monthly">Monthly Maintenance</option>
                    <option value="quarterly">Quarterly Maintenance</option>
                    <option value="annual">Annual Maintenance</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="maintenance_amount">Default Maintenance Amount (₹) *</label>
                <input
                  type="number"
                  id="maintenance_amount"
                  name="maintenance_amount"
                  value={formData.maintenance_amount}
                  onChange={handleInputChange}
                  placeholder="Enter default amount"
                  min="1"
                  step="0.01"
                  required
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-save">
                  {editingFlat ? '💾 Update Flat' : '➕ Add Flat'}
                </button>
                <button type="button" onClick={resetForm} className="btn-cancel">
                  ❌ Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div className="flats-list-container">
          <div className="flats-stats">
            <div className="stat-card">
              <div className="stat-icon">🏢</div>
              <div className="stat-info">
                <h3>{flats.length}</h3>
                <p>Total Flats</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">👥</div>
              <div className="stat-info">
                <h3>{new Set(flats.map(f => f.society_name)).size}</h3>
                <p>Societies</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">💰</div>
              <div className="stat-info">
                <h3>₹{flats.reduce((sum, f) => sum + parseFloat(f.maintenance_amount || 0), 0).toLocaleString()}</h3>
                <p>Total Monthly</p>
              </div>
            </div>
          </div>

          {flats.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <h3>No Flats Added Yet</h3>
              <p>Click "Add New Flat" to get started</p>
            </div>
          ) : (
            <div className="flats-grid">
              {flats.map((flat) => (
                <div key={flat.id} className="flat-card">
                  <div className="flat-header">
                    <h3>{flat.flat_number}</h3>
                    <span className="flat-badge">{flat.maintenance_type}</span>
                  </div>
                  
                  <div className="flat-details">
                    <div className="detail-item">
                      <span className="detail-label">🏢 Society:</span>
                      <span className="detail-value">{flat.society_name}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">👤 Member:</span>
                      <span className="detail-value">{flat.member_name}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">📧 Email:</span>
                      <span className="detail-value">{flat.member_email}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">📱 Phone:</span>
                      <span className="detail-value">{flat.member_phone}</span>
                    </div>
                    {flat.wing && (
                      <div className="detail-item">
                        <span className="detail-label">🏗️ Wing:</span>
                        <span className="detail-value">{flat.wing}</span>
                      </div>
                    )}
                    {flat.floor && (
                      <div className="detail-item">
                        <span className="detail-label">🔢 Floor:</span>
                        <span className="detail-value">{flat.floor}</span>
                      </div>
                    )}
                    <div className="detail-item amount">
                      <span className="detail-label">💰 Amount:</span>
                      <span className="detail-value">₹{parseFloat(flat.maintenance_amount).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flat-actions">
                    <button onClick={() => handleEdit(flat)} className="btn-edit">
                      ✏️ Edit
                    </button>
                    <button onClick={() => handleDelete(flat.id)} className="btn-delete">
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
