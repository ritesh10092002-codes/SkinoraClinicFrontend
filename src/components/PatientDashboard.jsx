import { useState, useEffect } from 'react';
import { getPatientProfile, getPatientAppointments, updatePatientProfile, logoutUser, getJwtToken, createPatientProfile, bookAppointment, getAllDoctors, getDoctorById } from '../services/api';

// Helper function to decode JWT and extract email
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

// Helper function to format date for display
const formatDate = (dateString) => {
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const isToday = date.toDateString() === today.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  
  // Full format with weekday, month, day, year
  const fullFormat = date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  
  // Short format with weekday, month, day, and year
  const shortFormat = date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  
  if (isToday) {
    return { datePart: 'Today', fullDate: fullFormat, urgency: 'today' };
  } else if (isTomorrow) {
    return { datePart: 'Tomorrow', fullDate: fullFormat, urgency: 'upcoming' };
  } else {
    return { datePart: shortFormat, fullDate: '', urgency: date > today ? 'upcoming' : 'past' };
  }
};

// Helper function to format time slot for display
const formatTimeSlot = (timeSlot) => {
  if (!timeSlot) return { start: '-', end: '-' };
  const [start, end] = timeSlot.split('-');
  return { start: start.trim(), end: end?.trim() || '' };
};

// Helper function to sort appointments by date (most recent first)
const sortAppointmentsByDate = (appointments) => {
  if (!Array.isArray(appointments)) return [];
  
  return [...appointments].sort((a, b) => {
    const dateA = new Date(a.appointmentDate);
    const dateB = new Date(b.appointmentDate);
    
    // If dates are the same, sort by time slot
    if (dateA.getTime() === dateB.getTime()) {
      const timeA = a.timeSlot || '';
      const timeB = b.timeSlot || '';
      return timeB.localeCompare(timeA); // Reverse alphabetical for same date
    }
    
    // Sort by date descending (most recent first)
    return dateB.getTime() - dateA.getTime();
  });
};

// Helper function to filter appointments by month and year
const filterAppointmentsByMonthYear = (appointments, month, year) => {
  if (!Array.isArray(appointments)) return [];
  
  // If no filter selected, return all appointments
  if (!month && !year) return appointments;
  
  return appointments.filter(apt => {
    const aptDate = new Date(apt.appointmentDate);
    const aptMonth = aptDate.getMonth() + 1; // getMonth() returns 0-11
    const aptYear = aptDate.getFullYear();
    
    const monthMatch = !month || aptMonth === parseInt(month);
    const yearMatch = !year || aptYear === parseInt(year);
    
    return monthMatch && yearMatch;
  });
};

// Get current and next year for the filter dropdown
const getYearOptions = () => {
  const currentYear = new Date().getFullYear();
  return [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
};

export default function PatientDashboard({ user, onLogout, initialSection = 'overview' }) {
  const [activeSection, setActiveSection] = useState(initialSection);
  const [profileData, setProfileData] = useState(null);
  const [appointments, setAppointments] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [isBookingAppointment, setIsBookingAppointment] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [appointmentFormData, setAppointmentFormData] = useState({});
  const [userEmail, setUserEmail] = useState('');
  const [profileExists, setProfileExists] = useState(true);
  const [loading, setLoading] = useState({
    profile: false,
    appointments: false,
    saving: false,
    bookingAppointment: false,
  });
  const [errors, setErrors] = useState({
    profile: null,
    appointments: null,
    saving: null,
    bookingAppointment: null,
  });
  const [successMessage, setSuccessMessage] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [doctorsError, setDoctorsError] = useState(null);
  const [doctorNamesCache, setDoctorNamesCache] = useState({});
  const [appointmentDoctorNames, setAppointmentDoctorNames] = useState({});
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');

  // Verify token exists on mount and extract email
  useEffect(() => {
    const token = getJwtToken();
    console.log('PatientDashboard mounted - Token present:', token ? 'Yes' : 'No');
    if (!token) {
      console.warn('Warning: No JWT token found in localStorage');
    } else {
      const decoded = decodeJWT(token);
      if (decoded && decoded.sub) {
        setUserEmail(decoded.sub);
        console.log('Email extracted from token:', decoded.sub);
      }
    }
  }, []);

  // Fetch profile data when component mounts
  useEffect(() => {
    if (!profileData && !loading.profile) {
      fetchProfileData();
    }
  }, []);

  // Fetch appointments when component mounts
  useEffect(() => {
    if (!appointments && !loading.appointments) {
      fetchAppointments();
    }
  }, []);

const fetchProfileData = async () => {
    setLoading((prev) => ({ ...prev, profile: true }));
    setErrors((prev) => ({ ...prev, profile: null }));
    
    // First, check if we have a cached profile in localStorage
    const cachedProfile = localStorage.getItem('patientProfile');
    if (cachedProfile) {
      const parsedProfile = JSON.parse(cachedProfile);
      console.log('Using cached patient profile from localStorage:', parsedProfile);
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
      const data = await getPatientProfile();
      console.log('Patient profile fetched from API:', data);
      if (data && Object.keys(data).length > 0) {
        setProfileData(data);
        setProfileExists(true);
        setEditFormData(data || {});
        // Cache the profile data
        localStorage.setItem('patientProfile', JSON.stringify(data));
      } else {
        // No profile found from API either
        setProfileData(null);
        setProfileExists(false);
        setEditFormData({ email: userEmail });
      }
    } catch (error) {
      console.log('Patient profile not found from API:', error.message);
      // Profile doesn't exist - user needs to create one
      setProfileData(null);
      setProfileExists(false);
      setEditFormData({ email: userEmail });
    } finally {
      setLoading((prev) => ({ ...prev, profile: false }));
    }
  };

  const fetchAppointments = async () => {
    setLoading((prev) => ({ ...prev, appointments: true }));
    setErrors((prev) => ({ ...prev, appointments: null }));
    try {
      console.log('Fetching appointments...');
      const data = await getPatientAppointments();
      console.log('Appointments fetched successfully:', data);
      
      // Debug: Log each appointment's fields to identify the doctor field name
      if (data && data.length > 0) {
        console.log('=== DEBUG: Appointment fields ===');
        data.forEach((apt, index) => {
          console.log(`Appointment ${index + 1}:`, apt);
          console.log(`Keys:`, Object.keys(apt));
        });
      }
      
      setAppointments(data);
      
      // Fetch doctor names for all appointments
      if (data && data.length > 0) {
        const doctorIds = [...new Set(data.map(apt => apt.doctorId).filter(id => id))];
        const namesMap = {};
        
        for (const doctorId of doctorIds) {
          if (!doctorNamesCache[doctorId]) {
            try {
              const doctor = await getDoctorById(doctorId);
              namesMap[doctorId] = doctor.name || doctor.doctorName || `Dr. ${doctorId}`;
              setDoctorNamesCache(prev => ({ ...prev, [doctorId]: namesMap[doctorId] }));
            } catch (err) {
              console.error(`Error fetching doctor ${doctorId}:`, err);
              namesMap[doctorId] = `Dr. ${doctorId}`;
            }
          } else {
            namesMap[doctorId] = doctorNamesCache[doctorId];
          }
        }
        setAppointmentDoctorNames(namesMap);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
      const errorMessage = error.message || 'Failed to load appointments';
      setErrors((prev) => ({ ...prev, appointments: errorMessage }));
      
      // Check if it's a real auth error that requires re-login
      if (errorMessage.toLowerCase().includes('authentication failed') || 
          errorMessage.toLowerCase().includes('no authentication token')) {
        console.warn('Authentication error detected - redirecting to login');
        handleLogout();
      } else if (errorMessage.toLowerCase().includes('token refresh failed')) {
        console.warn('Token refresh failed - server may be down or token is invalid');
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
    const { name, value } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAppointmentInputChange = (e) => {
    const { name, value } = e.target;
    setAppointmentFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

const handleSaveProfile = async () => {
    setLoading((prev) => ({ ...prev, saving: true }));
    setErrors((prev) => ({ ...prev, saving: null }));
    try {
      // Always include email from JWT
      const profileDataToSave = {
        ...editFormData,
        email: userEmail,
      };
      
      let updatedData;
      if (isCreatingProfile) {
        updatedData = await createPatientProfile(profileDataToSave);
        setIsCreatingProfile(false);
        setProfileExists(true);
        // Save to localStorage permanently
        localStorage.setItem('patientProfile', JSON.stringify(updatedData));
        localStorage.setItem('profileCreated', 'true');
      } else {
        updatedData = await updatePatientProfile(profileDataToSave);
        // Update localStorage cache
        localStorage.setItem('patientProfile', JSON.stringify(updatedData));
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

  const handleBookAppointment = () => {
    setAppointmentFormData({});
    setIsBookingAppointment(true);
    setSuccessMessage('');
    // Fetch doctors list when opening booking form
    fetchDoctors();
  };

const fetchDoctors = async () => {
    setLoadingDoctors(true);
    setDoctorsError(null);
    try {
      console.log('Fetching doctors list...');
      const data = await getAllDoctors();
      console.log('Doctors fetched successfully:', data);
      setDoctors(data);
      
      // Also cache doctor names for quick lookup
      const namesCache = {};
      data.forEach(doctor => {
        namesCache[doctor.id] = doctor.name || doctor.doctorName || doctor.displayName || `Dr. ${doctor.id}`;
      });
      setDoctorNamesCache(prev => ({ ...prev, ...namesCache }));
    } catch (error) {
      console.error('Error fetching doctors:', error);
      // More detailed error message
      const errorMsg = error.message || 'Failed to load doctors';
      if (errorMsg.includes('403')) {
        setDoctorsError('Access denied. Please check if you are logged in as a patient account.');
      } else {
        setDoctorsError(errorMsg);
      }
    } finally {
      setLoadingDoctors(false);
    }
  };
  
  // Function to get doctor name by ID (with caching)
  const getDoctorName = async (doctorId) => {
    if (!doctorId) return 'Unknown Doctor';
    
    // Check cache first
    if (doctorNamesCache[doctorId]) {
      return doctorNamesCache[doctorId];
    }
    
    // Fetch from API if not in cache
    try {
      const doctor = await getDoctorById(doctorId);
      const name = doctor.name || doctor.doctorName || `Dr. ${doctorId}`;
      setDoctorNamesCache(prev => ({ ...prev, [doctorId]: name }));
      return name;
    } catch (error) {
      console.error(`Error fetching doctor ${doctorId}:`, error);
      return `Dr. ${doctorId}`;
    }
  };

  const handleCancelBooking = () => {
    setIsBookingAppointment(false);
    setAppointmentFormData({});
    setErrors((prev) => ({ ...prev, bookingAppointment: null }));
    setSuccessMessage('');
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    if (name === 'filterMonth') {
      setFilterMonth(value);
    } else if (name === 'filterYear') {
      setFilterYear(value);
    }
  };

  const clearFilters = () => {
    setFilterMonth('');
    setFilterYear('');
  };

  const handleSaveAppointment = async () => {
    setLoading((prev) => ({ ...prev, bookingAppointment: true }));
    setErrors((prev) => ({ ...prev, bookingAppointment: null }));
    try {
      // Find the selected doctor to get both ID and name
      const selectedDoctor = doctors.find(d => d.id === parseInt(appointmentFormData.doctorId));
      
      // Extract the name without "Dr." prefix and without specialization
      // Format is like: "Dr. John - Dermatologist" or just "John"
      let doctorName = selectedDoctor ? (selectedDoctor.name || selectedDoctor.doctorName || '') : '';
      
      // Remove "Dr. " or "Dr " prefix if present
      doctorName = doctorName.replace(/^Dr\.?\s*/i, '');
      
      // Remove specialization part if present (e.g., " - Dermatologist")
      doctorName = doctorName.split(' - ')[0].trim();
      
      // Get doctor ID
      const doctorId = selectedDoctor ? selectedDoctor.id : null;
      
      // Send both doctorId and doctorName to backend
      const appointmentData = {
        doctorId: doctorId,
        doctorName: doctorName,
        appointmentDate: appointmentFormData.appointmentDate,
        timeSlot: appointmentFormData.timeSlot,
      };
      
      console.log('Booking appointment with data:', appointmentData);
      
      await bookAppointment(appointmentData);
      
      // Store in localStorage for persistence
      const bookedAppointmentKey = `booked_${appointmentFormData.appointmentDate}_${appointmentFormData.timeSlot}`;
      localStorage.setItem(bookedAppointmentKey, JSON.stringify({
        doctorName: doctorName,
        doctorId: doctorId,
        appointmentDate: appointmentFormData.appointmentDate,
        timeSlot: appointmentFormData.timeSlot
      }));
      
      // Also update local doctorNamesCache for immediate display
      if (doctorId && doctorName) {
        setDoctorNamesCache(prev => ({ ...prev, [doctorId]: doctorName }));
        setAppointmentDoctorNames(prev => ({ ...prev, [doctorId]: doctorName }));
      }
      
      // Refetch appointments from server to keep in sync
      const data = await getPatientAppointments();
      setAppointments(data);
      
      setIsBookingAppointment(false);
      setSuccessMessage('Appointment booked successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setErrors((prev) => ({ ...prev, bookingAppointment: error.message }));
    } finally {
      setLoading((prev) => ({ ...prev, bookingAppointment: false }));
    }
  };

  const handleLogout = () => {
    logoutUser();
    onLogout();
  };

  return (
    <div className="dashboard-container">
      <nav className="dashboard-nav">
        <div className="nav-header">
          <h1>Skinora Dashboard</h1>
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
            <h2>Welcome, {profileData?.name || userEmail || 'Patient'}!</h2>
            <div className="overview-cards">
              <div className="card">
                <h3>Upcoming Appointments</h3>
                <p>{appointments?.length > 0 ? `${appointments.length} scheduled` : 'No appointments scheduled'}</p>
              </div>
              <div className="card">
                <h3>Health Status</h3>
                <p>All good</p>
              </div>
            </div>
          </section>
        )}

        {activeSection === 'appointments' && (
          <section className="content-section">
            <h2>Appointments</h2>
            {successMessage && (
              <div className="success-message">
                <p>✓ {successMessage}</p>
              </div>
            )}
            
            {/* Month/Year Filter */}
            <div className="appointment-filter">
              <h3>Filter by Month/Year</h3>
              <div className="filter-controls">
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
                {(filterMonth || filterYear) && (
                  <button 
                    type="button" 
                    className="secondary-btn"
                    onClick={clearFilters}
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            </div>
            {isBookingAppointment ? (
              <div className="appointment-booking-form">
                <h3>Book New Appointment</h3>
                {errors.bookingAppointment && (
                  <div className="error-message">
                    <p>Error: {errors.bookingAppointment}</p>
                  </div>
                )}
                <form onSubmit={(e) => { e.preventDefault(); handleSaveAppointment(); }}>
                  <div className="form-group">
                    <label htmlFor="doctorId">Select Doctor</label>
                    {loadingDoctors ? (
                      <div className="loading-state">
                        <p>Loading doctors...</p>
                      </div>
                    ) : doctorsError ? (
                      <div className="error-message">
                        <p>Error loading doctors: {doctorsError}</p>
                        <button 
                          type="button" 
                          className="secondary-btn" 
                          onClick={fetchDoctors}
                          style={{ marginTop: '10px' }}
                        >
                          🔄 Retry
                        </button>
                      </div>
                    ) : doctors.length > 0 ? (
                      <select
                        id="doctorId"
                        name="doctorId"
                        value={appointmentFormData.doctorId || ''}
                        onChange={handleAppointmentInputChange}
                        required
                      >
                        <option value="">Select a Doctor</option>
                        {doctors.map((doctor) => (
                          <option key={doctor.id} value={doctor.id}>
                            Dr. {doctor.displayName || doctor.name || doctor.doctorName || `ID: ${doctor.id}`}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="empty-state">
                        <p>No doctors available. Please try again later.</p>
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="appointmentDate">Appointment Date</label>
                    <input
                      type="date"
                      id="appointmentDate"
                      name="appointmentDate"
                      value={appointmentFormData.appointmentDate || ''}
                      onChange={handleAppointmentInputChange}
                      min={new Date().toISOString().split('T')[0]}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="timeSlot">Time Slot</label>
                    <select
                      id="timeSlot"
                      name="timeSlot"
                      value={appointmentFormData.timeSlot || ''}
                      onChange={handleAppointmentInputChange}
                      required
                    >
                      <option value="">Select Time Slot</option>
                      <option value="09:00-09:30">09:00 - 09:30</option>
                      <option value="09:30-10:00">09:30 - 10:00</option>
                      <option value="10:00-10:30">10:00 - 10:30</option>
                      <option value="10:30-11:00">10:30 - 11:00</option>
                      <option value="14:00-14:30">14:00 - 14:30</option>
                      <option value="14:30-15:00">14:30 - 15:00</option>
                      <option value="15:00-15:30">15:00 - 15:30</option>
                      <option value="15:30-16:00">15:30 - 16:00</option>
                    </select>
                  </div>

                  <div className="form-actions">
                    <button
                      type="submit"
                      className="primary-btn"
                      disabled={loading.bookingAppointment}
                    >
                      {loading.bookingAppointment ? 'Booking...' : 'Book Appointment'}
                    </button>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={handleCancelBooking}
                      disabled={loading.bookingAppointment}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            ) : loading.appointments ? (
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
                    <li>Check the browser console for detailed error logs</li>
                    <li>Ensure CORS is properly configured on the backend</li>
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
                {/* Apply filter to appointments */}
                {(() => {
                  const filteredAppointments = filterAppointmentsByMonthYear(sortAppointmentsByDate(appointments), filterMonth, filterYear);
                  return (
                    <>
                      <p style={{ marginBottom: '20px', color: '#666' }}>
                        📅 Showing <strong>{filteredAppointments.length}</strong> of <strong>{appointments.length}</strong> appointment(s)
                        {(filterMonth || filterYear) && <span> (filtered)</span>}
                      </p>
                      {filteredAppointments.length > 0 ? (
                        filteredAppointments.map((appointment) => {
                          const dateInfo = formatDate(appointment.appointmentDate);
                          const timeInfo = formatTimeSlot(appointment.timeSlot);
                          const cardKey = appointment.id || appointment.appointmentId;
                          
                          // Get doctor name - use what we sent when booking if available
                          // Check multiple possible field names to handle different API response formats
                          console.log('=== DEBUG: Doctor display calculation ===');
                          console.log('appointment object:', appointment);
                          console.log('appointment keys:', Object.keys(appointment));
                          console.log('appointment.doctorName:', appointment.doctorName);
                          console.log('appointment.doctor:', appointment.doctor);
                          console.log('appointment.doctorId:', appointment.doctorId);
                          console.log('appointmentDoctorNames:', appointmentDoctorNames);
                          
                          // Try multiple field names
                          let doctorDisplayName = null;
                          
                          // Priority 1: Check direct fields from backend
                          if (appointment.doctorName) {
                            doctorDisplayName = appointment.doctorName;
                          } else if (appointment.doctor && typeof appointment.doctor === 'string') {
                            doctorDisplayName = appointment.doctor;
                          } else if (appointment.doctorName_) {
                            doctorDisplayName = appointment.doctorName_;
                          } 
                          // Priority 2: Try to get from cached names by doctorId
                          else if (appointment.doctorId && appointmentDoctorNames[appointment.doctorId]) {
                            doctorDisplayName = appointmentDoctorNames[appointment.doctorId];
                          }
                          // Priority 3: Check localStorage for this appointment
                          else if (appointment.appointmentDate && appointment.timeSlot) {
                            const bookedKey = `booked_${appointment.appointmentDate}_${appointment.timeSlot}`;
                            const storedData = localStorage.getItem(bookedKey);
                            if (storedData) {
                              const parsed = JSON.parse(storedData);
                              doctorDisplayName = parsed.doctorName || parsed.doctorId;
                            }
                          }
                          // Priority 4: If doctorId exists but no name found
                          else if (appointment.doctorId) {
                            doctorDisplayName = `Doctor ID: ${appointment.doctorId}`;
                          }
                          
                          // If still no name found, use fallback
                          if (!doctorDisplayName) {
                            doctorDisplayName = 'Not Assigned';
                          }
                          
                          // Clean up the name - remove "Dr." prefix since we already have "Doctor:" label
                          doctorDisplayName = doctorDisplayName.replace(/^Dr\.?\s*/i, '').trim();
                          // Also remove " - Specialization" if present
                          doctorDisplayName = doctorDisplayName.split(' - ')[0].trim();
                          
                          console.log('Final doctorDisplayName:', doctorDisplayName);
                          
                          return (
                            <div key={cardKey} className={`appointment-card ${dateInfo.urgency}`}>
                              <div className="appointment-date-badge">
                                <span className="date-label">{dateInfo.datePart}</span>
                                {dateInfo.fullDate && <span className="date-full">{dateInfo.fullDate}</span>}
                              </div>
                              <div className="appointment-content"> 
                                <h4>{appointment.title || 'Appointment'}</h4>
                                <div className="appointment-details-grid">
                                  <div className="detail-item">
                                    <span className="detail-icon">👨‍⚕️</span>
                                    <span className="detail-label">Doctor:</span>
                                    <span className="detail-value">{doctorDisplayName}</span>
                                  </div>
                                  <div className="detail-item">
                                    <span className="detail-icon">🕐</span>
                                    <span className="detail-label">Time:</span>
                                    <span className="detail-value time-range">{timeInfo.start} - {timeInfo.end}</span>
                                  </div>
                                  <div className="detail-item">
                                    <span className="detail-icon">📋</span>
                                    <span className="detail-label">Status:</span>
                                    <span className={`status-badge ${(appointment.status || 'Scheduled').toLowerCase()}`}>
                                      {appointment.status || 'Scheduled'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="empty-state">
                          <p>📭 No appointments found for the selected month/year.</p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="empty-state">
                <p>📭 No appointments scheduled yet. Schedule your first appointment!</p>
              </div>
            )}
            {!isBookingAppointment && (
              <button 
                className="primary-btn"
                onClick={handleBookAppointment}
                style={{ marginTop: '20px' }}
              >
                + Schedule Appointment
              </button>
            )}
          </section>
        )}

        {activeSection === 'profile' && (
          <section className="content-section profile-section">
            <h2>Profile</h2>
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
                    <label htmlFor="age">Age</label>
                    <input
                      type="number"
                      id="age"
                      name="age"
                      value={editFormData.age || ''}
                      onChange={handleInputChange}
                      placeholder="Enter your age"
                      min="0"
                      max="150"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="gender">Gender</label>
                    <select
                      id="gender"
                      name="gender"
                      value={editFormData.gender || ''}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="">Select Gender</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
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
                    <span className="label">Age:</span>
                    <span className="value">{profileData.age || 'Not provided'}</span>
                  </div>
                  <div className="profile-field">
                    <span className="label">Gender:</span>
                    <span className="value">{profileData.gender || 'Not provided'}</span>
                  </div>
                  <div className="profile-field">
                    <span className="label">Phone Number:</span>
                    <span className="value">{profileData.phoneNumber || 'Not provided'}</span>
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
                  <p>Your profile information is not created. Let's get started by creating your profile now.</p>
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
