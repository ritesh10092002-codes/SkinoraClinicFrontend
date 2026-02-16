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
  getPatientById,
  approveAppointment,
  rejectAppointment,
  completeAppointment
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
  const [filterPatientName, setFilterPatientName] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

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
      
      // Ensure data is an array - defensive coding
      const appointmentsData = Array.isArray(data) ? data : [];
      console.log('Doctor appointments data after validation:', appointmentsData);
      
      setAppointments(appointmentsData);
      
      // Fetch patient names for all appointments
      if (appointmentsData && appointmentsData.length > 0) {
        const patientIds = [...new Set(appointmentsData.map(apt => apt.patientId).filter(id => id))];
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

  // Helper function to get year options for filter dropdown
  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    return [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
  };

  // Handle filter changes
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    if (name === 'filterPatientName') {
      setFilterPatientName(value);
    } else if (name === 'filterMonth') {
      setFilterMonth(value);
    } else if (name === 'filterYear') {
      setFilterYear(value);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setFilterPatientName('');
    setFilterMonth('');
    setFilterYear('');
    setCurrentPage(1);
  };

  // Pagination calculations
  const getFilteredAndPaginatedAppointments = () => {
    const filtered = getFilteredAppointments();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return {
      filtered,
      paginated: filtered.slice(startIndex, endIndex),
      totalPages: Math.ceil(filtered.length / itemsPerPage),
      totalItems: filtered.length
    };
  };

  // Handle page change
  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle items per page change
  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(parseInt(e.target.value));
    setCurrentPage(1);
  };

  // Filter appointments based on current filters
  const getFilteredAppointments = () => {
    if (!appointments || appointments.length === 0) return [];
    
    return appointments.filter(apt => {
      // Filter by patient name
      if (filterPatientName) {
        const patientName = patientNamesCache[apt.patientId] || apt.patientName || '';
        if (!patientName.toLowerCase().includes(filterPatientName.toLowerCase())) {
          return false;
        }
      }
      
      // Filter by month and year
      if (filterMonth || filterYear) {
        const aptDate = new Date(apt.appointmentDate);
        const aptMonth = aptDate.getMonth() + 1;
        const aptYear = aptDate.getFullYear();
        
        if (filterMonth && aptMonth !== parseInt(filterMonth)) {
          return false;
        }
        if (filterYear && aptYear !== parseInt(filterYear)) {
          return false;
        }
      }
      
      return true;
    });
  };

  // Calculate pagination data for use in header
  const paginationData = appointments && appointments.length > 0 ? getFilteredAndPaginatedAppointments() : { filtered: [], paginated: [], totalPages: 0, totalItems: 0 };

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
            <div className="overview-cards-modern">
              <div className="overview-card-modern">
                <div className="overview-card-icon">📅</div>
                <div className="overview-card-content">
                  <h3>Total Appointments</h3>
                  <p className="overview-count">{appointments.length}</p>
                </div>
              </div>
              <div className="overview-card-modern">
                <div className="overview-card-icon">⏳</div>
                <div className="overview-card-content">
                  <h3>Pending</h3>
                  <p className="overview-count pending">{appointments.filter(a => a.status === 'PENDING' || a.status === 'Pending').length}</p>
                </div>
              </div>
              <div className="overview-card-modern">
                <div className="overview-card-icon">✅</div>
                <div className="overview-card-content">
                  <h3>Approved</h3>
                  <p className="overview-count approved">{appointments.filter(a => a.status === 'APPROVED' || a.status === 'Approved').length}</p>
                </div>
              </div>
              <div className="overview-card-modern">
                <div className="overview-card-icon">🏥</div>
                <div className="overview-card-content">
                  <h3>Completed</h3>
                  <p className="overview-count completed">{appointments.filter(a => a.status === 'COMPLETED' || a.status === 'Completed').length}</p>
                </div>
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
            
            {/* Filter Controls */}
            <div className="doctor-appointments-header">
              <button 
                className="secondary-btn refresh-btn-top"
                onClick={fetchAppointments}
              >
                🔄 Refresh Appointments
              </button>
            </div>
            
            <div className="appointment-filter">
              <h3>Filter Appointments</h3>
              <div className="filter-controls">
                <div className="filter-group">
                  <label htmlFor="filterPatientName">Patient Name:</label>
                  <input
                    type="text"
                    id="filterPatientName"
                    name="filterPatientName"
                    value={filterPatientName}
                    onChange={handleFilterChange}
                    placeholder="Search by patient name"
                  />
                </div>
                <div className="filter-group">
                  <label htmlFor="filterMonth">Month:</label>
                  <select
                    id="filterMonth"
                    name="filterMonth"
                    value={filterMonth}
                    onChange={handleFilterChange}
                  >
                    <option value="">All Months</option>
                    <option value="1">January</option>
                    <option value="2">February</option>
                    <option value="3">March</option>
                    <option value="4">April</option>
                    <option value="5">May</option>
                    <option value="6">June</option>
                    <option value="7">July</option>
                    <option value="8">August</option>
                    <option value="9">September</option>
                    <option value="10">October</option>
                    <option value="11">November</option>
                    <option value="12">December</option>
                  </select>
                </div>
                <div className="filter-group">
                  <label htmlFor="filterYear">Year:</label>
                  <select
                    id="filterYear"
                    name="filterYear"
                    value={filterYear}
                    onChange={handleFilterChange}
                  >
                    <option value="">All Years</option>
                    {getYearOptions().map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                {(filterPatientName || filterMonth || filterYear) && (
                  <button 
                    type="button" 
                    className="secondary-btn"
                    onClick={clearFilters}
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
            
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
            ) : (appointments && appointments.length > 0) ? (
              <div className="appointments-list doctor-appointments-list">
                {/* Apply filters and pagination to appointments */}
                {(() => {
                  const { filtered, paginated, totalPages, totalItems } = getFilteredAndPaginatedAppointments();
                  return (
                    <>
                      {paginated && paginated.length > 0 ? (
                        paginated.map((appointment) => {
                          // Get formatted date info
                          const appointmentDate = appointment.appointmentDate ? new Date(appointment.appointmentDate) : null;
                          const isToday = appointmentDate ? appointmentDate.toDateString() === new Date().toDateString() : false;
                          const isPast = appointmentDate ? appointmentDate < new Date() : false;
                          
                          // Get patient name
                          const patientName = appointment.patientName || patientNamesCache[appointment.patientId] || `Patient #${appointment.patientId}`;
                          
                          // Get status
                          const status = appointment.status || 'Pending';
                          const statusClass = status.toLowerCase();
                          
                          return (
                            <div key={appointment.id || appointment.appointmentId} className={`doctor-appointment-card-modern ${isToday ? 'today-appointment' : ''} ${isPast ? 'past-appointment' : ''}`}>
                              <div className="appointment-card-left">
                                <div className="date-badge">
                                  <span className="day">{appointmentDate ? appointmentDate.getDate() : '-'}</span>
                                  <span className="month">{appointmentDate ? appointmentDate.toLocaleDateString('en-US', { month: 'short' }) : '-'}</span>
                                  <span className="year">{appointmentDate ? appointmentDate.getFullYear() : '-'}</span>
                                </div>
                              </div>
                              <div className="appointment-card-content">
                                <div className="appointment-card-header">
                                  <div className="patient-info">
                                    <span className="patient-avatar">👤</span>
                                    <h4>{patientName}</h4>
                                  </div>
                                  <span className={`status-badge-doctor ${statusClass}`}>
                                    {status}
                                  </span>
                                </div>
                                <div className="appointment-card-body">
                                  <div className="detail-row">
                                    <span className="detail-icon">📅</span>
                                    <span className="detail-label">Date:</span>
                                    <span className="detail-value">{appointmentDate ? appointmentDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</span>
                                  </div>
                                  <div className="detail-row">
                                    <span className="detail-icon">⏰</span>
                                    <span className="detail-label">Time:</span>
                                    <span className="detail-value time-slot">{appointment.timeSlot || 'N/A'}</span>
                                  </div>
                                  <div className="detail-row">
                                    <span className="detail-icon">👤</span>
                                    <span className="detail-label">Patient ID:</span>
                                    <span className="detail-value">{appointment.patientId || 'N/A'}</span>
                                  </div>
                                  {appointment.notes && (
                                    <div className="detail-row notes-row">
                                      <span className="detail-icon">📝</span>
                                      <span className="detail-label">Notes:</span>
                                      <span className="detail-value">{appointment.notes}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="appointment-card-actions">
                                  {status === 'Pending' && (
                                    <>
                                      <button 
                                        className="action-btn approve-btn"
                                        onClick={async () => {
                                          try {
                                            await approveAppointment(appointment.id || appointment.appointmentId);
                                            setSuccessMessage('Appointment approved successfully!');
                                            fetchAppointments();
                                            setTimeout(() => setSuccessMessage(''), 3000);
                                          } catch (error) {
                                            setErrors(prev => ({ ...prev, saving: error.message }));
                                          }
                                        }}
                                      >
                                        ✓ Approve
                                      </button>
                                      <button 
                                        className="action-btn reject-btn"
                                        onClick={async () => {
                                          try {
                                            await rejectAppointment(appointment.id || appointment.appointmentId);
                                            setSuccessMessage('Appointment rejected!');
                                            fetchAppointments();
                                            setTimeout(() => setSuccessMessage(''), 3000);
                                          } catch (error) {
                                            setErrors(prev => ({ ...prev, saving: error.message }));
                                          }
                                        }}
                                      >
                                        ✕ Reject
                                      </button>
                                    </>
                                  )}
                                  {status === 'Approved' && (
                                    <button 
                                      className="action-btn complete-btn"
                                      onClick={async () => {
                                        try {
                                          await completeAppointment(appointment.id || appointment.appointmentId);
                                          setSuccessMessage('Appointment completed!');
                                          fetchAppointments();
                                          setTimeout(() => setSuccessMessage(''), 3000);
                                        } catch (error) {
                                          setErrors(prev => ({ ...prev, saving: error.message }));
                                        }
                                      }}
                                    >
                                      ✓ Mark Complete
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="empty-state">
                          <p>📭 No appointments match your filter criteria.</p>
                        </div>
                      )}
                      
                      {/* Pagination Controls */}
                      {totalPages > 1 && (
                        <div className="pagination">
                          <div className="pagination-info">
                            Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                          </div>
                          <div className="pagination-controls">
                            <button
                              className="pagination-btn"
                              onClick={() => handlePageChange(currentPage - 1)}
                              disabled={currentPage === 1}
                            >
                              ← Previous
                            </button>
                            
                            {/* Page Numbers */}
                            <div className="page-numbers">
                              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button
                                  key={page}
                                  className={`page-number ${currentPage === page ? 'active' : ''}`}
                                  onClick={() => handlePageChange(page)}
                                >
                                  {page}
                                </button>
                              ))}
                            </div>
                            
                            <button
                              className="pagination-btn"
                              onClick={() => handlePageChange(currentPage + 1)}
                              disabled={currentPage === totalPages}
                            >
                              Next →
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="empty-state">
                <p>📭 No appointments scheduled yet. Patients will book appointments with you.</p>
              </div>
            )}
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
              <div className="profile-edit-form-modern">
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
              <div className="profile-view-modern">
                <div className="profile-card">
                  <div className="profile-card-header">
                    <div className="profile-avatar-large">
                      <span className="avatar-icon">🩺</span>
                    </div>
                    <div className="profile-card-title">
                      <h3>Dr. {profileData.name || 'Your Name'}</h3>
                      <p className="profile-specialization">{profileData.specialization || 'Specialization'}</p>
                    </div>
                    <div className={`profile-status-badge ${profileData.available === true ? 'available' : 'unavailable'}`}>
                      {profileData.available === true ? '✓ Available' : '✗ Not Available'}
                    </div>
                  </div>
                  <div className="profile-card-body">
                    <div className="profile-field-modern">
                      <span className="field-icon">📧</span>
                      <div className="field-content">
                        <span className="field-label">Email</span>
                        <span className="field-value">{profileData.email || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="profile-field-modern">
                      <span className="field-icon">📱</span>
                      <div className="field-content">
                        <span className="field-label">Phone Number</span>
                        <span className="field-value">{profileData.phoneNumber || 'Not provided'}</span>
                      </div>
                    </div>
                    <div className="profile-field-modern">
                      <span className="field-icon">🏥</span>
                      <div className="field-content">
                        <span className="field-label">Specialization</span>
                        <span className="field-value">{profileData.specialization || 'Not provided'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <button 
                  className="primary-btn edit-profile-btn"
                  onClick={handleEditProfile}
                >
                  ✏️ Edit Profile
                </button>
              </div>
            ) : (
              <div className="profile-not-created-modern">
                <div className="empty-state">
                  <div className="empty-state-icon">👨‍⚕️</div>
                  <h3>Profile Not Created Yet</h3>
                  <p>Your doctor profile information is not created. Let's get started by creating your profile now.</p>
                  <p><strong>Email:</strong> {userEmail}</p>
                </div>
                <button 
                  className="primary-btn create-profile-btn"
                  onClick={handleCreateProfile}
                >
                  ➕ Create Profile
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
  /* Appointment Filter Styles */
  .appointment-filter {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 25px;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
  }

  .appointment-filter h3 {
    color: white;
    margin: 0 0 15px 0;
    font-size: 1.1rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .filter-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: flex-end;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    min-width: 150px;
  }

  .filter-group label {
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.85rem;
    font-weight: 500;
    letter-spacing: 0.3px;
  }

  .filter-group input[type="text"],
  .filter-group select {
    padding: 10px 14px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.95);
    font-size: 0.9rem;
    color: #333;
    transition: all 0.3s ease;
    outline: none;
  }

  .filter-group input[type="text"]:focus,
  .filter-group select:focus {
    border-color: rgba(255, 255, 255, 0.5);
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.2);
    background: white;
  }

  .filter-group input[type="text"]::placeholder {
    color: #999;
  }

  .filter-group select {
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23667eea' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 35px;
  }

  .filter-group select option {
    background: white;
    color: #333;
    padding: 10px;
  }

  .secondary-btn {
    padding: 10px 20px;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    white-space: nowrap;
  }

  .secondary-btn:hover {
    background: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.5);
    transform: translateY(-1px);
  }

  .secondary-btn:active {
    transform: translateY(0);
  }

  /* Search Icon for Patient Name */
  .filter-group:has(input[type="text"]) {
    position: relative;
  }

  .filter-group:has(input[type="text"])::before {
    content: "🔍";
    position: absolute;
    left: 12px;
    bottom: 10px;
    font-size: 0.9rem;
    pointer-events: none;
    opacity: 0.6;
  }

  .filter-group:has(input[type="text"]) input[type="text"] {
    padding-left: 36px;
  }

  @media (max-width: 768px) {
    .filter-controls {
      flex-direction: column;
    }
    
    .filter-group {
      width: 100%;
    }
    
    .secondary-btn {
      width: 100%;
    }
  }
  
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

  /* Doctor Dashboard Header Row */
  .appointments-header-row.doctor-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .refresh-btn {
    background: white !important;
    color: #667eea !important;
    font-weight: 700 !important;
    padding: 12px 28px !important;
    border-radius: 10px !important;
    font-size: 1rem !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15) !important;
    transition: all 0.3s ease !important;
  }

  .refresh-btn:hover {
    transform: translateY(-2px) !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
  }

  .items-select {
    color: #667eea !important;
  }
  
  /* Pagination Styles */
  .appointments-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    flex-wrap: wrap;
    gap: 12px;
  }
  
  .appointments-count {
    margin: 0;
    color: #666;
    font-size: 0.95rem;
  }
  
  .items-per-page {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .items-per-page label {
    color: #666;
    font-size: 0.9rem;
    font-weight: 500;
  }
  
  .items-per-page-select {
    padding: 6px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    background: white;
    font-size: 0.9rem;
    color: #333;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .items-per-page-select:hover {
    border-color: #667eea;
  }
  
  .items-per-page-select:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
  }
  
  .pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 30px;
    padding-top: 20px;
    border-top: 1px solid #eee;
    flex-wrap: wrap;
    gap: 16px;
  }
  
  .pagination-info {
    color: #666;
    font-size: 0.9rem;
  }
  
  .pagination-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .pagination-btn {
    padding: 8px 16px;
    border: 1px solid #ddd;
    border-radius: 6px;
    background: white;
    color: #333;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .pagination-btn:hover:not(:disabled) {
    background: #667eea;
    border-color: #667eea;
    color: white;
  }
  
  .pagination-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .page-numbers {
    display: flex;
    gap: 4px;
  }
  
  .page-number {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #ddd;
    border-radius: 6px;
    background: white;
    color: #333;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .page-number:hover {
    border-color: #667eea;
    color: #667eea;
  }
  
  .page-number.active {
    background: #667eea;
    border-color: #667eea;
    color: white;
    font-weight: 600;
  }
  
  @media (max-width: 600px) {
    .pagination {
      flex-direction: column;
      text-align: center;
    }
    
    .pagination-controls {
      flex-wrap: wrap;
      justify-content: center;
    }
    
    .page-numbers {
      order: -1;
      width: 100%;
      justify-content: center;
      margin-bottom: 8px;
    }
  }

  /* ===== DOCTOR APPOINTMENT CARDS - TOP NOTCH CSS ===== */
  
  .doctor-appointments-list {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .doctor-appointment-card-modern {
    display: flex;
    background: white;
    border-radius: 16px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    overflow: hidden;
    transition: all 0.3s ease;
    border: 1px solid rgba(102, 126, 234, 0.1);
  }

  .doctor-appointment-card-modern:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 30px rgba(102, 126, 234, 0.2);
  }

  .doctor-appointment-card-modern.today-appointment {
    border: 2px solid #f59e0b;
    background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
  }

  .doctor-appointment-card-modern.past-appointment {
    opacity: 0.7;
    background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
  }

  .appointment-card-left {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 24px 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 100px;
  }

  .doctor-appointment-card-modern.today-appointment .appointment-card-left {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  }

  .doctor-appointment-card-modern.past-appointment .appointment-card-left {
    background: linear-gradient(135deg, #9ca3af 0%, #6b7280 100%);
  }

  .date-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    color: white;
  }

  .date-badge .day {
    font-size: 2rem;
    font-weight: 800;
    line-height: 1;
  }

  .date-badge .month {
    font-size: 0.9rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-top: 4px;
  }

  .date-badge .year {
    font-size: 0.75rem;
    opacity: 0.8;
    margin-top: 2px;
  }

  .appointment-card-content {
    flex: 1;
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .appointment-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }

  .patient-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .patient-avatar {
    font-size: 1.5rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .patient-info h4 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: #1f2937;
  }

  .status-badge-doctor {
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .status-badge-doctor.pending {
    background: linear-gradient(135deg, #fef3c7 0%, #fcd34d 100%);
    color: #92400e;
    border: 1px solid #fcd34d;
  }

  .status-badge-doctor.approved {
    background: linear-gradient(135deg, #d1fae5 0%, #6ee7b7 100%);
    color: #065f46;
    border: 1px solid #6ee7b7;
  }

  .status-badge-doctor.completed {
    background: linear-gradient(135deg, #dbeafe 0%, #93c5fd 100%);
    color: #1e40af;
    border: 1px solid #93c5fd;
  }

  .status-badge-doctor.cancelled,
  .status-badge-doctor.rejected {
    background: linear-gradient(135deg, #fee2e2 0%, #fca5a5 100%);
    color: #991b1b;
    border: 1px solid #fca5a5;
  }

  .appointment-card-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 0;
    border-top: 1px solid #e5e7eb;
    border-bottom: 1px solid #e5e7eb;
  }

  .detail-row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.95rem;
  }

  .detail-row .detail-icon {
    font-size: 1.1rem;
    width: 24px;
    text-align: center;
  }

  .detail-row .detail-label {
    color: #6b7280;
    font-weight: 500;
    min-width: 70px;
  }

  .detail-row .detail-value {
    color: #1f2937;
    font-weight: 600;
  }

  .detail-row .time-slot {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 4px 12px;
    border-radius: 6px;
    font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
    font-size: 0.85rem;
  }

  .detail-row.notes-row .detail-value {
    font-style: italic;
    color: #4b5563;
  }

  .appointment-card-actions {
    display: flex;
    gap: 12px;
    margin-top: 8px;
  }

  .action-btn {
    flex: 1;
    padding: 12px 20px;
    border: none;
    border-radius: 10px;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s ease;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .action-btn.approve-btn {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
  }

  .action-btn.approve-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
  }

  .action-btn.reject-btn {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    box-shadow: 0 4px 14px rgba(239, 68, 68, 0.3);
  }

  .action-btn.reject-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
  }

  .action-btn.complete-btn {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);
  }

  .action-btn.complete-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .doctor-appointment-card-modern {
      flex-direction: column;
    }

    .appointment-card-left {
      padding: 16px;
      min-width: auto;
    }

    .date-badge {
      flex-direction: row;
      gap: 8px;
    }

    .date-badge .day {
      font-size: 1.5rem;
    }

    .date-badge .month,
    .date-badge .year {
      font-size: 0.8rem;
      margin-top: 0;
    }

    .appointment-card-content {
      padding: 16px;
    }

    .appointment-card-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .appointment-card-actions {
      flex-direction: column;
    }

    .action-btn {
      width: 100%;
    }
  }

  @media (max-width: 480px) {
    .detail-row {
      flex-wrap: wrap;
    }

    .detail-row .detail-label {
      min-width: 60px;
      font-size: 0.85rem;
    }
  }

  /* Top Refresh Button */
  .doctor-appointments-header {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 20px;
  }

  .refresh-btn-top {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    color: white !important;
    font-weight: 700 !important;
    padding: 12px 28px !important;
    border-radius: 10px !important;
    font-size: 1rem !important;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4) !important;
    transition: all 0.3s ease !important;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .refresh-btn-top:hover {
    transform: translateY(-2px) !important;
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5) !important;
  }

  .refresh-btn-top:active {
    transform: translateY(0) !important;
  }

  @media (max-width: 768px) {
    .doctor-appointments-header {
      justify-content: center;
    }
    
    .refresh-btn-top {
      width: 100%;
      justify-content: center;
    }
  }

  /* ===== DOCTOR PROFILE - TOP NOTCH CSS ===== */
  
  .profile-edit-form-modern {
    background: white;
    padding: 2.5rem;
    border-radius: 16px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(102, 126, 234, 0.1);
  }

  .profile-edit-form-modern form {
    max-width: 600px;
    margin: 0 auto;
  }

  .profile-view-modern {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .profile-card {
    background: white;
    border-radius: 20px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    border: 1px solid rgba(102, 126, 234, 0.1);
  }

  .profile-card-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    position: relative;
    text-align: center;
  }

  .profile-avatar-large {
    width: 100px;
    height: 100px;
    background: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
    flex-shrink: 0;
    border: 4px solid rgba(255, 255, 255, 0.3);
  }

  .profile-avatar-large .avatar-icon {
    font-size: 3rem;
  }

  .profile-card-title {
    flex: 1;
    width: 100%;
  }

  .profile-card-title h3 {
    margin: 0;
    color: white;
    font-size: 1.75rem;
    font-weight: 800;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    letter-spacing: 0.5px;
  }

  .profile-specialization {
    margin: 0.75rem auto 0;
    padding: 0.5rem 1.5rem;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 25px;
    display: inline-block;
    color: white;
    font-size: 0.95rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    border: 2px solid rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(5px);
  }

  .profile-status-badge {
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 0.85rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .profile-status-badge.available {
    background: rgba(255, 255, 255, 0.25);
    color: white;
    border: 2px solid #10b981;
  }

  .profile-status-badge.unavailable {
    background: rgba(255, 255, 255, 0.25);
    color: white;
    border: 2px solid #ef4444;
  }

  .profile-card-body {
    padding: 1.5rem 2rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .profile-field-modern {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    border-radius: 12px;
    transition: all 0.3s ease;
  }

  .profile-field-modern:hover {
    transform: translateX(5px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }

  .profile-field-modern .field-icon {
    font-size: 1.5rem;
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
  }

  .profile-field-modern .field-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .profile-field-modern .field-label {
    font-size: 0.8rem;
    color: #64748b;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .profile-field-modern .field-value {
    font-size: 1rem;
    color: #1e293b;
    font-weight: 600;
  }

  .edit-profile-btn,
  .create-profile-btn {
    align-self: flex-start;
    padding: 14px 32px !important;
    font-size: 1rem !important;
    border-radius: 12px !important;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4) !important;
  }

  .edit-profile-btn:hover,
  .create-profile-btn:hover {
    transform: translateY(-3px) !important;
    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.5) !important;
  }

  .profile-not-created-modern {
    text-align: center;
    padding: 3rem 2rem;
    background: white;
    border-radius: 20px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
    border: 2px dashed rgba(102, 126, 234, 0.3);
  }

  .profile-not-created-modern .empty-state-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .profile-not-created-modern h3 {
    color: #1e293b;
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
  }

  .profile-not-created-modern p {
    color: #64748b;
    margin-bottom: 0.5rem;
  }

  @media (max-width: 768px) {
    .profile-card-header {
      flex-direction: column;
      text-align: center;
      padding: 1.5rem;
    }

    .profile-status-badge {
      position: absolute;
      top: 1rem;
      right: 1rem;
    }

    .profile-card-body {
      padding: 1rem 1.5rem;
    }

    .profile-field-modern {
      flex-direction: column;
      text-align: center;
    }

    .edit-profile-btn,
    .create-profile-btn {
      width: 100%;
    }
  }

  /* ===== DOCTOR OVERVIEW - TOP NOTCH CSS ===== */
  
  .overview-cards-modern {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1.5rem;
    margin-top: 2rem;
  }

  .overview-card-modern {
    background: white;
    border-radius: 16px;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1.25rem;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
    border: 1px solid rgba(102, 126, 234, 0.1);
    transition: all 0.3s ease;
  }

  .overview-card-modern:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.2);
  }

  .overview-card-icon {
    font-size: 2.5rem;
    width: 70px;
    height: 70px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .overview-card-content h3 {
    margin: 0;
    color: #64748b;
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .overview-count {
    margin: 0.5rem 0 0 0;
    font-size: 2rem;
    font-weight: 800;
    color: #1e293b;
  }

  .overview-count.pending {
    color: #f59e0b;
  }

  .overview-count.approved {
    color: #10b981;
  }

  .overview-count.completed {
    color: #3b82f6;
  }

  @media (max-width: 768px) {
    .overview-cards-modern {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .overview-card-modern {
      padding: 1.25rem;
    }

    .overview-card-icon {
      width: 60px;
      height: 60px;
      font-size: 2rem;
    }

    .overview-count {
      font-size: 1.75rem;
    }
  }
`;
document.head.appendChild(style);

