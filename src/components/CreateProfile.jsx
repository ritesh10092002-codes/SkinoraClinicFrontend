import { useState, useEffect } from 'react';
import { createPatientProfile, createDoctorProfile, getJwtToken, decodeJWT, getUserRole } from '../services/api';

export default function CreateProfile({ onProfileCreated }) {
  const [userRole, setUserRole] = useState('PATIENT');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    age: '',
    gender: '',
    phoneNumber: '',
    specialization: '',
    available: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Extract email and role from JWT token on mount
  useEffect(() => {
    const token = getJwtToken();
    if (token) {
      const decoded = decodeJWT(token);
      if (decoded && decoded.sub) {
        setFormData((prev) => ({
          ...prev,
          email: decoded.sub,
        }));
        console.log('Email extracted from token:', decoded.sub);
      }
      // Get user role from token or localStorage
      const role = getUserRole() || localStorage.getItem('userRole') || 'PATIENT';
      setUserRole(role.toUpperCase());
      console.log('CreateProfile - User role:', role);
    }
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      // Validate common required fields
      if (!formData.name || !formData.phoneNumber) {
        throw new Error('Please fill in all required fields');
      }

      if (userRole === 'PATIENT' || userRole === 'ROLE_PATIENT') {
        // Patient validation
        if (!formData.age || !formData.gender) {
          throw new Error('Please fill in all required fields');
        }
        if (parseInt(formData.age) < 0 || parseInt(formData.age) > 150) {
          throw new Error('Please enter a valid age');
        }
      } else {
        // Doctor validation
        if (!formData.specialization) {
          throw new Error('Please enter your specialization');
        }
      }

      // Create profile based on user role
      let createdProfile;
      if (userRole === 'PATIENT' || userRole === 'ROLE_PATIENT') {
        // Create patient profile
        const profileDataToSave = {
          name: formData.name,
          email: formData.email,
          age: parseInt(formData.age),
          gender: formData.gender,
          phoneNumber: formData.phoneNumber,
        };

        console.log('Creating patient profile with data:', profileDataToSave);
        createdProfile = await createPatientProfile(profileDataToSave);
        console.log('Patient profile created successfully:', createdProfile);
      } else {
        // Create doctor profile
        const profileDataToSave = {
          name: formData.name,
          email: formData.email,
          phoneNumber: formData.phoneNumber,
          specialization: formData.specialization,
          available: formData.available,
        };

        console.log('Creating doctor profile with data:', profileDataToSave);
        createdProfile = await createDoctorProfile(profileDataToSave);
        console.log('Doctor profile created successfully:', createdProfile);
      }
      
console.log('Profile created successfully');
      setSuccessMessage('Profile created successfully! Redirecting to dashboard...');
      
      // Store profile completion flag AND the profile data in localStorage
      // Save to the correct key based on user role
      if (isDoctor) {
        localStorage.setItem('doctorProfile', JSON.stringify(createdProfile));
      } else {
        localStorage.setItem('patientProfile', JSON.stringify(createdProfile));
      }
      
      // Redirect after a short delay
      setTimeout(() => {
        if (onProfileCreated) {
          onProfileCreated({ ...createdProfile, role: userRole });
        }
      }, 1500);
    } catch (error) {
      console.error('Profile creation error:', error);
      setError(error.message || 'Failed to create profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isDoctor = userRole === 'DOCTOR' || userRole === 'ROLE_DOCTOR';

  return (
    <div className="create-profile-container">
      <div className="create-profile-card">
        <div className="profile-header">
          <h1>🏥 Skinora</h1>
          <h2>Complete Your {isDoctor ? 'Doctor' : 'Patient'} Profile</h2>
          <p>Welcome! Please fill in your details to get started.</p>
        </div>

        {error && (
          <div className="error-message">
            <p>❌ {error}</p>
          </div>
        )}

        {successMessage && (
          <div className="success-message">
            <p>✓ {successMessage}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="profile-form">
          {/* Common Fields - Name */}
          <div className="form-group">
            <label htmlFor="name">Full Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter your full name"
              required
            />
          </div>

          {/* Email (Read-only) */}
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              disabled
              className="disabled-field"
              readOnly
            />
            <small>Auto-populated from your account</small>
          </div>

          {/* Patient-specific Fields */}
          {!isDoctor && (
            <>
              <div className="form-group">
                <label htmlFor="age">Age *</label>
                <input
                  type="number"
                  id="age"
                  name="age"
                  value={formData.age}
                  onChange={handleInputChange}
                  placeholder="Enter your age"
                  min="0"
                  max="150"
                  required={!isDoctor}
                />
              </div>

              <div className="form-group">
                <label htmlFor="gender">Gender *</label>
                <select
                  id="gender"
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  required={!isDoctor}
                >
                  <option value="">Select Gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </>
          )}

          {/* Doctor-specific Fields */}
          {isDoctor && (
            <div className="form-group">
              <label htmlFor="specialization">Specialization *</label>
              <input
                type="text"
                id="specialization"
                name="specialization"
                value={formData.specialization}
                onChange={handleInputChange}
                placeholder="e.g., Dermatologist, Cardiologist"
                required={isDoctor}
              />
            </div>
          )}

          {/* Common Field - Phone Number */}
          <div className="form-group">
            <label htmlFor="phoneNumber">Phone Number *</label>
            <input
              type="tel"
              id="phoneNumber"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleInputChange}
              placeholder="Enter phone number"
              required
            />
          </div>

          {/* Doctor-specific - Availability Checkbox */}
          {isDoctor && (
            <div className="form-group checkbox-wrapper">
              <label className="checkbox-label" htmlFor="available">
                <input
                  type="checkbox"
                  id="available"
                  name="available"
                  checked={Boolean(formData.available)}
                  onChange={handleInputChange}
                />
                <span>Available for appointments</span>
              </label>
            </div>
          )}

          <div className="form-actions">
            <button
              type="submit"
              className="primary-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Creating Profile...
                </>
              ) : (
                'Create Profile'
              )}
            </button>
          </div>
        </form>

        <div className="profile-footer">
          <p className="info-text">
            💡 Your profile information helps us provide better healthcare services.
          </p>
        </div>
      </div>

      <style>{`
        .create-profile-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .create-profile-card {
          background: white;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          padding: 40px;
          width: 100%;
          max-width: 450px;
        }

        .profile-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .profile-header h1 {
          font-size: 2.5rem;
          color: #667eea;
          margin-bottom: 10px;
        }

        .profile-header h2 {
          font-size: 1.5rem;
          color: #333;
          margin-bottom: 10px;
        }

        .profile-header p {
          color: #666;
          font-size: 0.95rem;
        }

        .profile-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          font-weight: 600;
          color: #444;
          font-size: 0.9rem;
        }

        .form-group input,
        .form-group select {
          padding: 14px 16px;
          border: 2px solid #e0e0e0;
          border-radius: 10px;
          font-size: 1rem;
          transition: all 0.3s ease;
        }

        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
        }

        .form-group input.disabled-field {
          background-color: #f5f5f5;
          color: #888;
        }

        .form-group small {
          color: #888;
          font-size: 0.8rem;
        }

        .checkbox-wrapper {
          margin-top: 10px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          font-weight: normal;
        }

        .checkbox-label input[type="checkbox"] {
          width: 20px;
          height: 20px;
          cursor: pointer;
        }

        .form-actions {
          margin-top: 10px;
        }

        .primary-btn {
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .primary-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
        }

        .primary-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 1s ease-in-out infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-message {
          background: #fee2e2;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 12px 16px;
          border-radius: 10px;
          margin-bottom: 20px;
        }

        .error-message p {
          margin: 0;
        }

        .success-message {
          background: #dcfce7;
          border: 1px solid #bbf7d0;
          color: #16a34a;
          padding: 12px 16px;
          border-radius: 10px;
          margin-bottom: 20px;
        }

        .success-message p {
          margin: 0;
        }

        .profile-footer {
          margin-top: 25px;
          padding-top: 20px;
          border-top: 1px solid #e0e0e0;
        }

        .info-text {
          text-align: center;
          color: #888;
          font-size: 0.85rem;
          margin: 0;
        }
      `}</style>
    </div>
  );
}

