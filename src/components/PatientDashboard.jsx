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

// Helper function to filter appointments by month, year, and doctor name
const filterAppointmentsByMonthYear = (appointments, month, year, doctorName, appointmentDoctorNames) => {
  if (!Array.isArray(appointments)) return [];
  
  // If no filter selected, return all appointments
  if (!month && !year && !doctorName) return appointments;
  
  return appointments.filter(apt => {
    const aptDate = new Date(apt.appointmentDate);
    const aptMonth = aptDate.getMonth() + 1; // getMonth() returns 0-11
    const aptYear = aptDate.getFullYear();
    
    const monthMatch = !month || aptMonth === parseInt(month);
    const yearMatch = !year || aptYear === parseInt(year);
    
    // Filter by doctor name
    let doctorNameMatch = true;
    if (doctorName) {
      // Get doctor name from multiple possible sources
      let docName = '';
      
      // Priority 1: Direct field from backend
      if (apt.doctorName) {
        docName = apt.doctorName;
      } else if (apt.doctor && typeof apt.doctor === 'string') {
        docName = apt.doctor;
      } 
      // Priority 2: From cached names by doctorId
      else if (apt.doctorId && appointmentDoctorNames && appointmentDoctorNames[apt.doctorId]) {
        docName = appointmentDoctorNames[apt.doctorId];
      }
      // Priority 3: Check localStorage
      else if (apt.appointmentDate && apt.timeSlot) {
        const bookedKey = `booked_${apt.appointmentDate}_${apt.timeSlot}`;
        const storedData = localStorage.getItem(bookedKey);
        if (storedData) {
          const parsed = JSON.parse(storedData);
          docName = parsed.doctorName || '';
        }
      }
      
      // Clean up the name
      docName = docName.replace(/^Dr\.?\s*/i, '').trim();
      docName = docName.split(' - ')[0].trim();
      
      doctorNameMatch = docName.toLowerCase().includes(doctorName.toLowerCase());
    }
    
    return monthMatch && yearMatch && doctorNameMatch;
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
  const [filterDoctorName, setFilterDoctorName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

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
      
      // Ensure data is an array - defensive coding
      const appointmentsData = Array.isArray(data) ? data : [];
      console.log('Appointments data after validation:', appointmentsData);
      
      setAppointments(appointmentsData);
      
      // Fetch doctor names for all appointments
      if (appointmentsData && appointmentsData.length > 0) {
        const doctorIds = [...new Set(appointmentsData.map(apt => apt.doctorId).filter(id => id))];
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
    } else if (name === 'filterDoctorName') {
      setFilterDoctorName(value);
    }
  };

  const clearFilters = () => {
    setFilterMonth('');
    setFilterYear('');
    setFilterDoctorName('');
    setCurrentPage(1);
  };

  // Pagination calculations
  const getPaginatedAppointments = (appointmentsList) => {
    const filtered = filterAppointmentsByMonthYear(sortAppointmentsByDate(appointmentsList), filterMonth, filterYear, filterDoctorName, appointmentDoctorNames);
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

  // Helper function to clean up old booking keys from localStorage
  const cleanupOldBookingKeys = () => {
    try {
      const maxKeysToKeep = 20; // Keep only last 20 booking keys
      const bookingKeys = [];
      
      // Find all booking and booked keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('booking_') || key.startsWith('booked_'))) {
          const value = localStorage.getItem(key);
          try {
            const parsed = JSON.parse(value);
            const bookedAt = parsed.bookedAt || 0;
            bookingKeys.push({ key, bookedAt });
          } catch (e) {
            // If not JSON, try to parse as timestamp
            const timestamp = parseInt(value);
            if (!isNaN(timestamp)) {
              bookingKeys.push({ key, bookedAt: timestamp });
            }
          }
        }
      }
      
      // Sort by timestamp (newest first) and keep only the most recent
      bookingKeys.sort((a, b) => b.bookedAt - a.bookedAt);
      
      // Remove old keys beyond the limit
      if (bookingKeys.length > maxKeysToKeep) {
        const keysToRemove = bookingKeys.slice(maxKeysToKeep);
        keysToRemove.forEach(({ key }) => {
          localStorage.removeItem(key);
          console.log(`Cleaned up old booking key: ${key}`);
        });
      }
    } catch (error) {
      console.error('Error cleaning up old booking keys:', error);
    }
  };

  const handleSaveAppointment = async () => {
    // Prevent multiple clicks - check if already booking
    if (loading.bookingAppointment) {
      console.log('Appointment booking already in progress, ignoring duplicate click');
      return;
    }
    
    // Validate form data before proceeding
    if (!appointmentFormData.doctorId || !appointmentFormData.appointmentDate || !appointmentFormData.timeSlot) {
      setErrors((prev) => ({ ...prev, bookingAppointment: 'Please fill in all fields' }));
      return;
    }
    
    // Create a unique key for this booking attempt to prevent race conditions
    const bookingAttemptKey = `booking_${appointmentFormData.appointmentDate}_${appointmentFormData.timeSlot}`;
    const lastAttemptTime = localStorage.getItem(bookingAttemptKey);
    
    // If there's a recent booking attempt (within 10 seconds), prevent duplicate
    if (lastAttemptTime) {
      const timeSinceLastAttempt = Date.now() - parseInt(lastAttemptTime);
      if (timeSinceLastAttempt < 10000) {
        console.log('Duplicate booking attempt detected, ignoring');
        setErrors((prev) => ({ ...prev, bookingAppointment: 'Please wait a moment before trying again' }));
        return;
      }
    }
    
    // Mark this booking attempt
    localStorage.setItem(bookingAttemptKey, Date.now().toString());
    
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
      
      // Clear the booking attempt key on success
      localStorage.removeItem(bookingAttemptKey);
      
      // Clean up old booking keys (keep only recent ones)
      cleanupOldBookingKeys();
      
      // Store in localStorage for persistence
      const bookedAppointmentKey = `booked_${appointmentFormData.appointmentDate}_${appointmentFormData.timeSlot}`;
      localStorage.setItem(bookedAppointmentKey, JSON.stringify({
        doctorName: doctorName,
        doctorId: doctorId,
        appointmentDate: appointmentFormData.appointmentDate,
        timeSlot: appointmentFormData.timeSlot,
        bookedAt: Date.now()
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
      // Clear the booking attempt key on error too
      localStorage.removeItem(bookingAttemptKey);
      
      console.log('=== BOOKING ERROR DEBUG ===');
      console.log('Error caught:', error);
      console.log('Error message:', error.message);
      console.log('Error toString:', error.toString());
      
      // Provide more user-friendly error message
      let errorMessage = error.message || 'Failed to book appointment';
      
      console.log('Original error message:', errorMessage);
      
      // Check for various error patterns from backend runtime exceptions
      if (errorMessage.toLowerCase().includes('already booked') || 
          errorMessage.toLowerCase().includes('slot') ||
          errorMessage.toLowerCase().includes('not available') ||
          errorMessage.toLowerCase().includes('already book') ||
          errorMessage.toLowerCase().includes('occupied') ||
          errorMessage.toLowerCase().includes('runtime') ||
          errorMessage.toLowerCase().includes('exception') ||
          errorMessage.toLowerCase().includes('duplicate')) {
        errorMessage = 'Already booked appointment. Please choose a different time slot.';
      }
      
      console.log('Final error message to display:', errorMessage);
      
      setErrors((prev) => ({ ...prev, bookingAppointment: errorMessage }));
    } finally {
      setLoading((prev) => ({ ...prev, bookingAppointment: false }));
    }
  };

  const handleLogout = () => {
    logoutUser();
    onLogout();
  };

  // Calculate pagination data for use in header
  const paginationData = (appointments && appointments.length > 0) ? getPaginatedAppointments(appointments) : { filtered: [], paginated: [], totalPages: 0, totalItems: 0 };

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
            <div className="overview-cards-modern">
              <div className="overview-card-modern">
                <div className="overview-card-icon">📅</div>
                <div className="overview-card-content">
                  <h3>Upcoming Appointments</h3>
                  <p className="overview-count">{appointments && appointments.length > 0 ? appointments.length : 0}</p>
                </div>
              </div>
              <div className="overview-card-modern">
                <div className="overview-card-icon">✅</div>
                <div className="overview-card-content">
                  <h3>Confirmed</h3>
                  <p className="overview-count approved">{appointments?.filter(a => a.status === 'CONFIRMED' || a.status === 'Approved').length || 0}</p>
                </div>
              </div>
              <div className="overview-card-modern">
                <div className="overview-card-icon">💚</div>
                <div className="overview-card-content">
                  <h3>Health Status</h3>
                  <p className="overview-count healthy">All Good</p>
                </div>
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
            
            {/* Month/Year/Doctor Filter */}
            <div className="appointment-filter">
              <h3>🔍 Filter Appointments</h3>
              <div className="filter-controls">
                <div className="filter-group search-group">
                  <label htmlFor="filterDoctorName">Doctor Name:</label>
                  <div className="search-input-wrapper">
                    <span className="search-icon">👨‍⚕️</span>
                    <input
                      type="text"
                      id="filterDoctorName"
                      name="filterDoctorName"
                      value={filterDoctorName}
                      onChange={handleFilterChange}
                      placeholder="Search by doctor name"
                      className="search-input"
                    />
                  </div>
                </div>
                <div className="filter-group">
                  <label htmlFor="filterMonth">Month:</label>
                  <select
                    id="filterMonth"
                    name="filterMonth"
                    value={filterMonth}
                    onChange={handleFilterChange}
                    className="filter-select"
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
                    className="filter-select"
                  >
                    <option value="">All Years</option>
                    {getYearOptions().map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                {(filterMonth || filterYear || filterDoctorName) && (
                  <button 
                    type="button" 
                    className="clear-filter-btn"
                    onClick={clearFilters}
                  >
                    ✕ Clear
                  </button>
                )}
              </div>
            </div>
            
            {/* Schedule Appointment Button and Pagination Controls */}
            <div className="appointments-header-row">
              <button 
                className="primary-btn schedule-btn"
                onClick={handleBookAppointment}
              >
                + Schedule Appointment
              </button>
              
              {appointments && appointments.length > 0 && (
                <div className="header-controls">
                  <div className="showing-info">
                    <span className="showing-icon">📋</span>
                    <span className="showing-text">
                      Showing <strong>{Math.min(paginationData.paginated.length, itemsPerPage)}</strong> of <strong>{paginationData.totalItems}</strong> appointments
                    </span>
                  </div>
                  
                  <div className="items-per-page-inline">
                    <label htmlFor="itemsPerPage">Show:</label>
                    <select
                      id="itemsPerPage"
                      value={itemsPerPage}
                      onChange={handleItemsPerPageChange}
                      className="items-select"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={15}>15</option>
                      <option value={20}>20</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
            
            {isBookingAppointment ? (
              <div className="appointment-booking-form">
                <h3>Book New Appointment</h3>
                {errors.bookingAppointment && (
                  <div className="error-popup">
                    <span className="error-icon">⚠</span>
                    <span className="error-text">{errors.bookingAppointment}</span>
                    <button 
                      type="button" 
                      className="dismiss-btn" 
                      onClick={() => setErrors(prev => ({ ...prev, bookingAppointment: null }))}
                    >
                      ×
                    </button>
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
            ) : (appointments && appointments.length > 0) ? (
              <div className="appointments-list">
                {/* Apply filter and pagination to appointments */}
                {(() => {
                  const { filtered, paginated, totalPages, totalItems } = getPaginatedAppointments(appointments);
                  return (
                    <>
                      {paginated && paginated.length > 0 ? (
                        paginated.map((appointment) => {
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
                          <p>📭 No appointments found for the selected criteria.</p>
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
                <p>📭 No appointments scheduled yet. Schedule your first appointment!</p>
              </div>
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
              <div className="profile-view-modern">
                <div className="profile-card">
                  <div className="profile-card-header">
                    <div className="profile-avatar-large">
                      <span className="avatar-icon">👤</span>
                    </div>
                    <div className="profile-card-title">
                      <h3>{profileData.name || 'Your Name'}</h3>
                      <p className="profile-specialization">Patient</p>
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
                      <span className="field-icon">🎂</span>
                      <div className="field-content">
                        <span className="field-label">Age</span>
                        <span className="field-value">{profileData.age || 'Not provided'}</span>
                      </div>
                    </div>
                    <div className="profile-field-modern">
                      <span className="field-icon">🚻</span>
                      <div className="field-content">
                        <span className="field-label">Gender</span>
                        <span className="field-value">{profileData.gender || 'Not provided'}</span>
                      </div>
                    </div>
                    <div className="profile-field-modern">
                      <span className="field-icon">📱</span>
                      <div className="field-content">
                        <span className="field-label">Phone Number</span>
                        <span className="field-value">{profileData.phoneNumber || 'Not provided'}</span>
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
                  <div className="empty-state-icon">👤</div>
                  <h3>Profile Not Created Yet</h3>
                  <p>Your profile information is not created. Let's get started by creating your profile now.</p>
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

// Add filter styles for Patient Dashboard
const patientFilterStyle = document.createElement('style');
patientFilterStyle.textContent = `
  /* Patient Dashboard Filter Styles */
  .appointment-filter {
    background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 24px;
    box-shadow: 0 8px 32px rgba(56, 239, 125, 0.25);
  }

  .appointment-filter h3 {
    color: white;
    margin: 0 0 20px 0;
    font-size: 1.2rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 10px;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .filter-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: flex-end;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
    min-width: 180px;
  }

  .filter-group label {
    color: rgba(255, 255, 255, 0.95);
    font-size: 0.85rem;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .search-group {
    flex: 1.5;
    min-width: 250px;
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 14px;
    font-size: 1.1rem;
    z-index: 1;
    pointer-events: none;
  }

  .search-input,
  .filter-select {
    width: 100%;
    padding: 12px 16px;
    border: 2px solid rgba(255, 255, 255, 0.25);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.95);
    font-size: 0.95rem;
    color: #1a1a2e;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    outline: none;
    font-weight: 500;
  }

  .search-input {
    padding-left: 44px;
  }

  .search-input:focus,
  .filter-select:focus {
    border-color: rgba(255, 255, 255, 0.6);
    box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.2), 0 4px 12px rgba(0, 0, 0, 0.1);
    background: white;
    transform: translateY(-1px);
  }

  .search-input::placeholder {
    color: #888;
    font-weight: 400;
  }

  .filter-select {
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2311998e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 14px center;
    padding-right: 42px;
  }

  .filter-select option {
    background: white;
    color: #1a1a2e;
    padding: 12px;
    font-weight: 500;
  }

  .clear-filter-btn {
    padding: 12px 24px;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-radius: 10px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .clear-filter-btn:hover {
    background: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.6);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .clear-filter-btn:active {
    transform: translateY(0);
  }

  @media (max-width: 768px) {
    .filter-controls {
      flex-direction: column;
    }
    
    .filter-group {
      width: 100%;
    }
    
    .search-group {
      min-width: 100%;
    }
    
    .clear-filter-btn {
      width: 100%;
      justify-content: center;
    }
  }
  
  /* Animation for filter appearance */
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .appointment-filter {
    animation: slideDown 0.4s ease-out;
  }
`;
document.head.appendChild(patientFilterStyle);

// Add pagination styles for Patient Dashboard
const patientPaginationStyle = document.createElement('style');
patientPaginationStyle.textContent = `
  /* Patient Dashboard Header Row */
  .appointments-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    flex-wrap: wrap;
    gap: 16px;
    padding: 16px 20px;
    background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
    border-radius: 12px;
    box-shadow: 0 4px 15px rgba(56, 239, 125, 0.3);
  }

  .schedule-btn {
    background: white !important;
    color: #11998e !important;
    font-weight: 700 !important;
    padding: 12px 28px !important;
    border-radius: 10px !important;
    font-size: 1rem !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15) !important;
    transition: all 0.3s ease !important;
  }

  .schedule-btn:hover {
    transform: translateY(-2px) !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
  }

  .header-controls {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  .showing-info {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.2);
    padding: 8px 16px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .showing-icon {
    font-size: 1.1rem;
  }

  .showing-text {
    color: white;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .showing-text strong {
    font-weight: 700;
    font-size: 1rem;
  }

  .items-per-page-inline {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.2);
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .items-per-page-inline label {
    color: white;
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .items-select {
    padding: 6px 12px;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-radius: 6px;
    background: white;
    font-size: 0.9rem;
    font-weight: 600;
    color: #11998e;
    cursor: pointer;
    transition: all 0.2s ease;
    outline: none;
  }

  .items-select:hover {
    border-color: white;
  }

  .items-select:focus {
    border-color: white;
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.3);
  }

  .items-select option {
    background: white;
    color: #333;
    font-weight: 500;
  }

  @media (max-width: 768px) {
    .appointments-header-row {
      flex-direction: column;
      align-items: stretch;
      text-align: center;
    }

    .schedule-btn {
      width: 100%;
    }

    .header-controls {
      flex-direction: column;
      gap: 10px;
    }

    .showing-info,
    .items-per-page-inline {
      width: 100%;
      justify-content: center;
    }
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
    border-color: #11998e;
  }
  
  .items-per-page-select:focus {
    outline: none;
    border-color: #11998e;
    box-shadow: 0 0 0 2px rgba(17, 153, 142, 0.2);
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
    background: #11998e;
    border-color: #11998e;
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
    border-color: #11998e;
    color: #11998e;
  }
  
  .page-number.active {
    background: #11998e;
    border-color: #11998e;
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

  /* ===== PATIENT PROFILE - TOP NOTCH CSS ===== */
  
  .profile-edit-form-modern {
    background: white;
    padding: 2.5rem;
    border-radius: 16px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(17, 153, 142, 0.1);
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
    border: 1px solid rgba(17, 153, 142, 0.1);
  }

  .profile-card-header {
    background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
    padding: 2rem;
    display: flex;
    align-items: center;
    gap: 1.5rem;
    position: relative;
  }

  .profile-avatar-large {
    width: 80px;
    height: 80px;
    background: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    flex-shrink: 0;
  }

  .profile-avatar-large .avatar-icon {
    font-size: 2.5rem;
  }

  .profile-card-title {
    flex: 1;
  }

  .profile-card-title h3 {
    margin: 0;
    color: white;
    font-size: 1.5rem;
    font-weight: 700;
  }

  .profile-specialization {
    margin: 0.5rem 0 0 0;
    color: rgba(255, 255, 255, 0.9);
    font-size: 1rem;
    font-weight: 500;
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
    background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%);
    border-radius: 12px;
    transition: all 0.3s ease;
  }

  .profile-field-modern:hover {
    transform: translateX(5px);
    box-shadow: 0 4px 12px rgba(17, 153, 142, 0.1);
  }

  .profile-field-modern .field-icon {
    font-size: 1.5rem;
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
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
    box-shadow: 0 4px 15px rgba(17, 153, 142, 0.4) !important;
  }

  .edit-profile-btn:hover,
  .create-profile-btn:hover {
    transform: translateY(-3px) !important;
    box-shadow: 0 8px 25px rgba(17, 153, 142, 0.5) !important;
  }

  .profile-not-created-modern {
    text-align: center;
    padding: 3rem 2rem;
    background: white;
    border-radius: 20px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
    border: 2px dashed rgba(17, 153, 142, 0.3);
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

  /* ===== PATIENT OVERVIEW - TOP NOTCH CSS ===== */
  
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
    border: 1px solid rgba(17, 153, 142, 0.1);
    transition: all 0.3s ease;
  }

  .overview-card-modern:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 25px rgba(17, 153, 142, 0.2);
  }

  .overview-card-icon {
    font-size: 2.5rem;
    width: 70px;
    height: 70px;
    background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
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

  .overview-count.approved {
    color: #10b981;
  }

  .overview-count.healthy {
    color: #10b981;
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
document.head.appendChild(patientPaginationStyle);
