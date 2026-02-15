import { useState, useEffect } from 'react';
import { 
  getDoctorAppointments, 
  logoutUser, 
  getJwtToken, 
  getUserRole, 
  getUserEmailFromToken,
  getDoctorProfile,
  createDoctorProfile,
  updateDoctorProfile,
  getPatientById
} from '../services/api';

export default function DoctorDashboard({ user, onLogout, initialSection = 'overview' }) {
  const [activeSection, setActiveSection] = useState(initialSection);
  const [appointments, setAppointments] = useState([]);
  const [profileData, setProfileData] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [profileExists, setProfileExists] = useState(null); // null = not checked yet
  const [loading, setLoading] = useState({
    appointments: false,
    profile: false,
    saving: false,
  });
  const [errors, setErrors] = useState({
    appointments: null,
    profile: null,
    saving: null,
  });
  const [successMessage, setSuccessMessage] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [patientNamesCache, setPatientNamesCache] = useState({});

  // Verify token exists on mount and extract email
  useEffect(() => {
    const token = getJwtToken();
    console.log('DoctorDashboard mounted - Token present:', token ? 'Yes' : 'No');
    
    if (!token) {
      console.warn('Warning: No JWT token found in localStorage');
    } else {
      const email = getUserEmailFromToken();
      if (email) {
        setUserEmail(email);
        console.log('Email extracted from token:', email);
      }
    }
  }, []);

  // Helper function to use user profile data (passed from CreateProfile or from localStorage)
  const useUserProfileData = () => {
    // First check if we have data passed from CreateProfile via user prop
    if (user && (user.name || user.specialization)) {
      console.log('Using profile data from user prop:', user);
      setProfileData(user);
      setProfileExists(true);
      setEditFormData(user || {});
      // Also cache it to localStorage for persistence
      localStorage.setItem('doctorProfile', JSON.stringify(user));
      return;
    }
    
    // Fallback to localStorage cache
    const cachedProfile = localStorage.getItem('doctorProfile');
    if (cachedProfile) {
      const parsedProfile = JSON.parse(cachedProfile);
      console.log('Using cached doctor profile from localStorage:', parsedProfile);
      setProfileData(parsedProfile);
      setProfileExists(true);
      setEditFormData(parsedProfile || {});
      return;
    }
    
    // Also check if profileCreated flag exists
    const profileCreated = localStorage.getItem('profileCreated');
    if (profileCreated === 'true') {
      // Profile was created, but maybe API hasn't returned it yet
      console.log('Profile created flag is set, but no cached data yet');
    }
    
    // No profile found
    console.log('No doctor profile found');
    setProfileData(null);
    setProfileExists(false);
    setEditFormData({ email: userEmail });
  };

// Fetch doctor profile data
  const fetchProfileData = async () => {
    setLoading((prev) => ({ ...prev, profile: true }));
    setErrors((prev) => ({ ...prev, profile: null }));
    
    // First, check if we have a cached profile in localStorage
    const cachedProfile = localStorage.getItem('doctorProfile');
    if (cachedProfile) {
      const parsedProfile = JSON.parse(cachedProfile);
      console.log('Using cached doctor profile from localStorage:', parsedProfile);
      setProfileData(parsedProfile);
      setProfileExists(true);
      setEditFormData(parsedProfile || {});
      setLoading((prev) => ({ ...prev, profile: false }));
      return;
    }
    
    // Also check profileCreated flag as fallback
    const profileCreated = localStorage.getItem('profileCreated');
    if (profileCreated === 'true') {
      console.log('Profile created flag is set, but no cached data yet');
    }
    
    // If no cached profile, try to fetch from API
    try {
      console.log('No cached profile found, fetching from API...');
      const data = await getDoctorProfile();
      console.log('Doctor profile fetched from API:', data);
      if (data && Object.keys(data).length > 0) {
        setProfileData(data);
        setProfileExists(true);
        setEditFormData(data || {});
        // Cache the profile data
        localStorage.setItem('doctorProfile', JSON.stringify(data));
      } else {
        // No profile found from API either
        setProfileData(null);
        setProfileExists(false);
        setEditFormData({ email: userEmail });
      }
    } catch (error) {
      console.log('Doctor profile not found from API:', error.message);
      // Profile doesn't exist - user needs to create one
      setProfileData(null);
      setProfileExists(false);
      setEditFormData({ email: userEmail });
    } finally {
      setLoading((prev) => ({ ...prev, profile: false }));
    }
  };

  // Fetch profile data when component mounts
  useEffect(() => {
    fetchProfileData();
  }, []);

  // Also refetch profile when initialSection changes to 'profile' (after profile creation)
  useEffect(() => {
    if (initialSection === 'profile') {
      // Force refetch profile when redirected from CreateProfile
      setLoading((prev) => ({ ...prev, profile: true }));
      fetchProfileData();
    }
  }, [initialSection]);

  // Watch for changes in user prop (profile data from CreateProfile)
  useEffect(() => {
    if (user && (user.name || user.specialization)) {
      console.log('User prop changed, updating profile data:', user);
      setProfileData(user);
      setProfileExists(true);
      setEditFormData(user || {});
      localStorage.setItem('doctorProfile', JSON.stringify(user));
    }
  }, [user]);

  // Fetch appointments when component mounts
  useEffect(() => {
    if (appointments.length === 0 && !loading.appointments) {
      fetchAppointments();
    }
  }, []);

  // Helper function to decode JWT
  const decodeJWT = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding JWT:', error);
      return null;
    }
  };

  const fetchAppointments = async () => {
    setLoading((prev) => ({ ...prev, appointments: true }));
    setErrors((prev) => ({ ...prev, appointments: null }));
    try {
      console.log('Fetching doctor appointments...');
      const data = await getDoctorAppointments();
      console.log('Doctor appointments fetched successfully:', data);
      
      // Fetch patient names for all appointments
      if (data && data.length > 0) {
        const patientIds = [...new Set(data.map(apt => apt.patientId).filter(id => id))];
        const namesMap = {};
        
        for (const patientId of patientIds) {
          if (!patientNamesCache[patientId]) {
            try {
              const patient = await getPatientById(patientId);
              namesMap[patientId] = patient.name || `Patient ${patientId}`;
              setPatientNamesCache(prev => ({ ...prev, [patientId]: namesMap[patientId] }));
            } catch (err) {
              console.error(`Error fetching patient ${patientId}:`, err);
              namesMap[patientId] = `Patient ${patientId}`;
            }
          } else {
            namesMap[patientId] = patientNamesCache[patientId];
          }
        }
      }
      
      setAppointments(data || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      const errorMessage = error.message || 'Failed to load appointments';
      setErrors((prev) => ({ ...prev, appointments: errorMessage }));
      
      // Check if it's an auth error that requires re-login
      if (errorMessage.toLowerCase().includes('authentication failed') || 
          errorMessage.toLowerCase().includes('no authentication token')) {
        console.warn('Authentication error detected - redirecting to login');
        handleLogout();
      }
    } finally {
      setLoading((prev) => ({ ...prev, appointments: false }));
    }
  };

  const handleCreateProfile = () => {
    setEditFormData({ email: userEmail });
    setIsCreatingProfile(true);
    setSuccessMessage('');
  };

  const handleEditProfile = () => {
    setEditFormData({ ...profileData, email: userEmail });
    setIsEditingProfile(true);
    setSuccessMessage('');
  };

  const handleCancelEdit = () => {
    setIsEditingProfile(false);
    setIsCreatingProfile(false);
    setEditFormData({});
    setErrors((prev) => ({ ...prev, saving: null }));
    setSuccessMessage('');
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

const handleSaveProfile = async () => {
    setLoading((prev) => ({ ...prev, saving: true }));
    setErrors((prev) => ({ ...prev, saving: null }));
    try {
      // Include email from JWT
      const profileDataToSave = {
        ...editFormData,
        email: userEmail,
      };
      
      let updatedData;
      if (isCreatingProfile) {
        updatedData = await createDoctorProfile(profileDataToSave);
        setIsCreatingProfile(false);
        setProfileExists(true);
        // Save to localStorage permanently
        localStorage.setItem('doctorProfile', JSON.stringify(updatedData));
        localStorage.setItem('profileCreated', 'true');
      } else {
        updatedData = await updateDoctorProfile(profileDataToSave);
        // Update localStorage cache
        localStorage.setItem('doctorProfile', JSON.stringify(updatedData));
      }
      setProfileData(updatedData);
      setIsEditingProfile(false);
      setSuccessMessage('Profile ' + (isCreatingProfile ? 'created' : 'updated') + ' successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setErrors((prev) => ({ ...prev, saving: error.message }));
    } finally {
      setLoading((prev) => ({ ...prev, saving: false }));
    }
  };

  const handleLogout = () => {
    logoutUser();
    onLogout();
  };

  return (
    <div className="dashboard-container doctor-dashboard">
      <nav className="dashboard-nav">
        <div className="nav-header">
          <h1>🩺 Doctor Dashboard</h1>
        </div>
        <ul className="nav-menu">
          <li>
            <button 
              className={activeSection === 'overview' ? 'active' : ''}
              onClick={() => setActiveSection('overview')}
            >
              Overview
            </button>
          </li>
          <li>
            <button 
              className={activeSection === 'appointments' ? 'active' : ''}
              onClick={() => setActiveSection('appointments')}
            >
              Appointments
            </button>
          </li>
          <li>
            <button 
              className={activeSection === 'profile' ? 'active' : ''}
              onClick={() => setActiveSection('profile')}
            >
              Profile
            </button>
          </li>
          <li>
            <button 
              className="logout-btn"
              onClick={handleLogout}
            >
              Logout
            </button>
          </li>
        </ul>
      </nav>

      <main className="dashboard-content">
        {activeSection === 'overview' && (
          <section className="content-section">
            <h2>Welcome, Dr. {profileData?.name || userEmail || 'Doctor'}!</h2>
            <div className="overview-cards">
              <div className="card">
                <h3>Total Appointments</h3>
                <p className="count total">{appointments.length}</p>
              </div>
            </div>
          </section>
        )}

        {activeSection === 'appointments' && (
          <section className="content-section">
            <h2>Patient Appointments</h2>
            {successMessage && (
              <div className="success-message">
                <p>✓ {successMessage}</p>
              </div>
            )}
            {errors.saving && (
              <div className="error-message">
                <p>Error: {errors.saving}</p>
              </div>
            )}
            {loading.appointments ? (
              <div className="loading-state">
                <p>⏳ Loading appointments...</p>
              </div>
            ) : errors.appointments ? (
              <div className="error-message">
                <p>❌ Error loading appointments:</p>
                <p><strong>{errors.appointments}</strong></p>
                <p style={{ fontSize: '0.9em', marginTop: '10px', color: '#666' }}>
                  Troubleshooting steps:
                  <ul style={{ marginTop: '5px' }}>
                    <li>Check that the appointment service (port 8085) is running</li>
                    <li>Verify your authentication token is valid</li>
                    <li>Ensure you're logged in as a doctor</li>
                  </ul>
                </p>
                <button 
                  className="secondary-btn"
                  onClick={fetchAppointments}
                  style={{ marginTop: '10px' }}
                >
                  🔄 Retry
                </button>
              </div>
            ) : appointments && appointments.length > 0 ? (
              <div className="appointments-list">
                <p style={{ marginBottom: '20px', color: '#666' }}>
                  📅 You have <strong>{appointments.length}</strong> appointment(s) with patients
                </p>
                {appointments.map((appointment) => (
                  <div key={appointment.id || appointment.appointmentId} className="appointment-card doctor-appointment-card">
                    <div className="appointment-header">
                      <h4>{appointment.patientName || patientNamesCache[appointment.patientId] || `Patient #${appointment.patientId}`}</h4>
                    </div>
                    <div className="appointment-details">
                      <p><strong>📅 Date:</strong> {appointment.appointmentDate ? new Date(appointment.appointmentDate).toLocaleDateString() : 'N/A'}</p>
                      <p><strong>⏰ Time Slot:</strong> {appointment.timeSlot}</p>
                      <p><strong>👤 Patient:</strong> {patientNamesCache[appointment.patientId] || appointment.patientName || `Patient ID: ${appointment.patientId}`}</p>
                      {appointment.notes && <p><strong>📝 Notes:</strong> {appointment.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>📭 No appointments scheduled yet. Patients will book appointments with you.</p>
              </div>
            )}
            <button 
              className="secondary-btn"
              onClick={fetchAppointments}
              style={{ marginTop: '20px' }}
            >
              🔄 Refresh Appointments
            </button>
          </section>
        )}

        {activeSection === 'profile' && (
          <section className="content-section profile-section">
            <h2>Doctor Profile</h2>
            {successMessage && (
              <div className="success-message">
                <p>✓ {successMessage}</p>
              </div>
            )}
            {loading.profile ? (
              <div className="loading-state">
                <p>Loading profile information...</p>
              </div>
            ) : errors.profile ? (
              <div className="error-message">
                <p>Error: {errors.profile}</p>
              </div>
            ) : isEditingProfile || isCreatingProfile ? (
              <div className="profile-edit-form">
                {errors.saving && (
                  <div className="error-message">
                    <p>Error: {errors.saving}</p>
                  </div>
                )}
                <form onSubmit={(e) => { e.preventDefault(); handleSaveProfile(); }}>
                  <div className="form-group">
                    <label htmlFor="name">Full Name</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={editFormData.name || ''}
                      onChange={handleInputChange}
                      placeholder="Enter your full name"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="email">Email</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={userEmail}
                      disabled
                      className="auto-filled"
                    />
                    <small>Auto-populated from your account</small>
                  </div>

                  <div className="form-group">
                    <label htmlFor="specialization">Specialization</label>
                    <input
                      type="text"
                      id="specialization"
                      name="specialization"
                      value={editFormData.specialization || ''}
                      onChange={handleInputChange}
                      placeholder="e.g., Dermatologist, Cardiologist"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="phoneNumber">Phone Number</label>
                    <input
                      type="tel"
                      id="phoneNumber"
                      name="phoneNumber"
                      value={editFormData.phoneNumber || ''}
                      onChange={handleInputChange}
                      placeholder="Enter phone number"
                      required
                    />
                  </div>

                  <div className="form-group checkbox-wrapper">
                    <label className="checkbox-label" htmlFor="available">
                      <input
                        type="checkbox"
                        id="available"
                        name="available"
                        checked={Boolean(editFormData.available)}
                        onChange={handleCheckboxChange}
                      />
                      <span>Available for appointments</span>
                    </label>
                  </div>

                  <div className="form-actions">
                    <button
                      type="submit"
                      className="primary-btn"
                      disabled={loading.saving}
                    >
                      {loading.saving ? 'Saving...' : isCreatingProfile ? 'Create Profile' : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={handleCancelEdit}
                      disabled={loading.saving}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            ) : profileExists && profileData ? (
              <div className="profile-view">
                <div className="profile-info">
                  <div className="profile-field">
                    <span className="label">Full Name:</span>
                    <span className="value">{profileData.name || 'N/A'}</span>
                  </div>
                  <div className="profile-field">
                    <span className="label">Email:</span>
                    <span className="value">{profileData.email || 'N/A'}</span>
                  </div>
                  <div className="profile-field">
                    <span className="label">Specialization:</span>
                    <span className="value">{profileData.specialization || 'Not provided'}</span>
                  </div>
                  <div className="profile-field">
                    <span className="label">Phone Number:</span>
                    <span className="value">{profileData.phoneNumber || 'Not provided'}</span>
                  </div>
                  <div className="profile-field availability-field">
                    <span className="label">Availability:</span>
                    <div className="availability-toggle">
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={profileData.available === true}
                          onChange={async () => {
                            // Toggle availability
                            const newAvailability = profileData.available !== true;
                            try {
                              const updatedData = await updateDoctorProfile({
                                ...profileData,
                                available: newAvailability
                              });
                              // Update local state and localStorage
                              setProfileData((prev) => ({ ...prev, available: newAvailability }));
                              // Also update localStorage for persistence
                              localStorage.setItem('doctorProfile', JSON.stringify({ ...profileData, available: newAvailability }));
                              setSuccessMessage(`Availability ${newAvailability ? 'enabled' : 'disabled'}!`);
                              setTimeout(() => setSuccessMessage(''), 3000);
                            } catch (error) {
                              setErrors((prev) => ({ ...prev, saving: error.message }));
                            }
                          }}
                        />
                        <span className="slider"></span>
                      </label>
                      <span className={`availability-status ${profileData.available === true ? 'available' : 'unavailable'}`}>
                        {profileData.available === true ? '✓ Available' : '✗ Not Available'}
                      </span>
                    </div>
                  </div>
                </div>
                <button 
                  className="primary-btn"
                  onClick={handleEditProfile}
                >
                  Edit Profile
                </button>
              </div>
            ) : (
              <div className="profile-not-created">
                <div className="empty-state">
                  <h3>Profile Not Created Yet</h3>
                  <p>Your doctor profile information is not created. Let's get started by creating your profile now.</p>
                  <p><strong>Email:</strong> {userEmail}</p>
                </div>
                <button 
                  className="primary-btn"
                  onClick={handleCreateProfile}
                >
                  Create Profile
                </button>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

// Add toggle switch styles
const style = document.createElement('style');
style.textContent = `
  .availability-toggle {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 56px;
    height: 28px;
  }
  
  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    transition: 0.4s;
    border-radius: 28px;
  }
  
  .slider:before {
    position: absolute;
    content: "";
    height: 20px;
    width: 20px;
    left: 4px;
    bottom: 4px;
    background-color: white;
    transition: 0.4s;
    border-radius: 50%;
  }
  
  input:checked + .slider {
    background-color: #22c55e;
  }
  
  input:checked + .slider:before {
    transform: translateX(28px);
  }
  
  input:not(:checked) + .slider {
    background-color: #ef4444;
  }
  
  .availability-status {
    font-weight: 600;
    font-size: 0.95rem;
  }
  
  .availability-status.available {
    color: #22c55e;
  }
  
  .availability-status.unavailable {
    color: #ef4444;
  }
  
  .profile-field.availability-field {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
  
  .label {
    font-weight: 600;
    color: #444;
    min-width: 120px;
  }
  
  .value {
    color: #333;
  }
`;
document.head.appendChild(style);

