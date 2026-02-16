// API configuration
const API_BASE_URL = 'http://localhost:8082/auth'; // Update this with your backend URL

// ===== SESSION MANAGEMENT =====
const SESSION_TIMEOUT_MINUTES = 15;
const SESSION_TIMEOUT_MS = SESSION_TIMEOUT_MINUTES * 60 * 1000; // 15 minutes in milliseconds
const SESSION_TIMESTAMP_KEY = 'sessionTimestamp';

// Initialize session timestamp when user logs in
export const initializeSession = () => {
  const timestamp = Date.now();
  localStorage.setItem(SESSION_TIMESTAMP_KEY, timestamp.toString());
  console.log('Session initialized at:', new Date(timestamp).toLocaleTimeString());
};

// Check if session has expired
export const isSessionExpired = () => {
  const sessionTimestamp = localStorage.getItem(SESSION_TIMESTAMP_KEY);
  
  if (!sessionTimestamp) {
    return true; // No session found
  }
  
  const timestamp = parseInt(sessionTimestamp, 10);
  const currentTime = Date.now();
  const elapsedTime = currentTime - timestamp;
  const isExpired = elapsedTime > SESSION_TIMEOUT_MS;
  
  if (isExpired) {
    console.log('Session expired - elapsed time:', Math.floor(elapsedTime / 1000), 'seconds');
  }
  
  return isExpired;
};

// Get remaining session time in seconds
export const getSessionRemainingTime = () => {
  const sessionTimestamp = localStorage.getItem(SESSION_TIMESTAMP_KEY);
  
  if (!sessionTimestamp) {
    return 0;
  }
  
  const timestamp = parseInt(sessionTimestamp, 10);
  const currentTime = Date.now();
  const elapsedTime = currentTime - timestamp;
  const remainingTime = Math.max(0, SESSION_TIMEOUT_MS - elapsedTime);
  
  return Math.floor(remainingTime / 1000); // Return in seconds
};

// Check if session is about to expire (within 5 minutes)
export const isSessionAboutToExpire = () => {
  const remainingSeconds = getSessionRemainingTime();
  const WARNING_THRESHOLD_SECONDS = 5 * 60; // 5 minutes
  return remainingSeconds > 0 && remainingSeconds <= WARNING_THRESHOLD_SECONDS;
};

// Refresh session timestamp (called on user activity)
export const refreshSession = () => {
  const timestamp = Date.now();
  localStorage.setItem(SESSION_TIMESTAMP_KEY, timestamp.toString());
  console.log('Session refreshed at:', new Date(timestamp).toLocaleTimeString());
};

// Clear session
export const clearSession = () => {
  localStorage.removeItem(SESSION_TIMESTAMP_KEY);
};

// Login API call
export const loginUser = async (email, password) => {
  try {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    let data;
    const contentType = response.headers.get('content-type');
    
    // Handle both JSON and plain text responses
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { message: text };
    }

    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    // Log the complete response for debugging
    console.log('=== LOGIN DEBUG ===');
    console.log('Full response data:', data);
    console.log('Response type:', typeof data);
    console.log('Response keys:', Object.keys(data));
    console.log('Response JSON:', JSON.stringify(data, null, 2));

    // Extract token - check all possible field names
    const token = data.token || data.accessToken || data.jwtToken || data.jwt || data.access_token;
    const refreshToken = data.refreshToken || data.refresh_token;
    
    console.log('Token found:', token ? `${token.substring(0, 20)}...` : 'NOT FOUND');
    console.log('Refresh token found:', refreshToken ? 'YES' : 'NO');
    
    if (token) {
      localStorage.setItem('jwtToken', token);
      console.log('✓ Token stored in localStorage successfully');
    } else {
      console.error('✗ Token NOT found in response');
      console.error('Available fields in response:', Object.keys(data));
      throw new Error('No token received from server. Response: ' + JSON.stringify(data));
    }

    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }
    if (data.user) {
      localStorage.setItem('user', JSON.stringify(data.user));
    }

    // Initialize session timestamp
    initializeSession();

    return data;
  } catch (error) {
    throw new Error(error.message || 'Login error');
  }
};

// Signup API call
export const signupUser = async (email, password, role = 'PATIENT') => {
  try {
    const response = await fetch(`${API_BASE_URL}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, role }),
    });

    let data;
    const contentType = response.headers.get('content-type');
    
    // Handle both JSON and plain text responses
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { message: text };
    }

    if (!response.ok) {
      // Check if user already exists
      if (response.status === 409 || data.message?.toLowerCase().includes('already exists')) {
        throw new Error('User already exists. Please login');
      }
      throw new Error(data.message || 'Signup failed');
    }

    // Log the complete response for debugging
    console.log('=== SIGNUP DEBUG ===');
    console.log('Full response data:', data);
    console.log('Response type:', typeof data);
    console.log('Response keys:', Object.keys(data));
    console.log('Response JSON:', JSON.stringify(data, null, 2));

    // Check if the response indicates success even without a token
    // Some backends save user successfully but don't return a token on signup
    if (data.message && data.message.toLowerCase().includes('saved successfully')) {
      console.log('✓ User saved successfully (no token required for signup)');
      // Return success data - don't require token for signup
      return { success: true, message: data.message };
    }

    // Extract token - check all possible field names
    const token = data.token || data.accessToken || data.jwtToken || data.jwt || data.access_token;
    const refreshToken = data.refreshToken || data.refresh_token;
    
    console.log('Token found:', token ? `${token.substring(0, 20)}...` : 'NOT FOUND');
    console.log('Refresh token found:', refreshToken ? 'YES' : 'NO');
    
    if (token) {
      localStorage.setItem('jwtToken', token);
      console.log('✓ Token stored in localStorage successfully');
    } else {
      // If no token but response is OK, consider it a successful signup
      // (some backends don't return tokens on signup, only on login)
      console.log('✓ No token in response but signup was successful');
    }
    
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }
    if (data.user) {
      localStorage.setItem('user', JSON.stringify(data.user));
    }

    // Initialize session timestamp
    initializeSession();

    return { success: true, ...data };
  } catch (error) {
    throw new Error(error.message || 'Signup error');
  }
};

// Logout
export const logoutUser = () => {
  localStorage.removeItem('jwtToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  clearSession();
};

// Get stored JWT token
export const getJwtToken = () => {
  return localStorage.getItem('jwtToken');
};

// Get stored refresh token
export const getRefreshToken = () => {
  return localStorage.getItem('refreshToken');
};

// Get stored user
export const getUser = () => {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};

// Check if JWT token is actually expired
const isTokenExpired = () => {
  const token = getJwtToken();
  if (!token) return true;
  
  try {
    const decoded = decodeJWT(token);
    if (!decoded || !decoded.exp) return true;
    
    // exp is in seconds, multiply by 1000 to get milliseconds
    const expirationTime = decoded.exp * 1000;
    const currentTime = Date.now();
    
    // Add a small buffer (30 seconds) to avoid edge cases
    return currentTime > (expirationTime - 30000);
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return true;
  }
};

// Authenticated API request helper - includes JWT token in headers
export const authenticatedFetch = async (url, options = {}) => {
  const jwtToken = getJwtToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add JWT token to Authorization header if available
  if (jwtToken) {
    headers.Authorization = `Bearer ${jwtToken}`;
  } else {
    console.warn('No JWT token found - user may need to login again');
  }

  let response = await fetch(url, {
    ...options,
    headers,
  });

  // If unauthorized and token is actually expired, try to refresh
  if (response.status === 401 && getRefreshToken() && isTokenExpired()) {
    try {
      console.log('Token expired (401), attempting to refresh...');
      await refreshToken();
      const newToken = getJwtToken();
      
      if (newToken) {
        headers.Authorization = `Bearer ${newToken}`;
        // Refresh session on successful token refresh
        refreshSession();
        console.log('✓ Token refreshed successfully, retrying original request');
        response = await fetch(url, {
          ...options,
          headers,
        });
      } else {
        throw new Error('Failed to obtain new token after refresh');
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      console.error('Unable to refresh authentication token. This may indicate a server issue.');
      throw new Error('Authentication token refresh failed. Please try again or login again.');
    }
  } else if (response.status === 401) {
    console.error('Unauthorized request (401) but token is not expired - possible server issue');
    throw new Error('Authentication failed. Please login again.');
  }

  return response;
};

// Refresh JWT token using refresh token
export const refreshToken = async () => {
  try {
    const refreshToken = getRefreshToken();
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    console.log('Attempting to refresh token with refresh token endpoint...');

    const response = await fetch(`${API_BASE_URL}/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    // Handle both JSON and plain text responses
    let data;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.error('Refresh endpoint returned non-JSON response:', text);
      throw new Error(`Refresh endpoint error: ${text || 'No response body'}`);
    }

    if (!response.ok) {
      console.error('Refresh token response not ok:', {
        status: response.status,
        data: data
      });
      throw new Error(data.message || `Token refresh failed (${response.status})`);
    }

    if (data.token || data.accessToken) {
      const newToken = data.token || data.accessToken;
      localStorage.setItem('jwtToken', newToken);
      console.log('✓ New JWT token stored successfully');
    } else {
      console.error('No token in refresh response:', data);
      throw new Error('No token in refresh response');
    }

    return data;
  } catch (error) {
    console.error('Refresh token error:', error.message);
    throw error;
  }
};

// ===== JWT UTILITY FUNCTIONS =====

/**
 * Decode JWT token and extract payload
 */
export const decodeJWT = (token) => {
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

/**
 * Extract user role from JWT token
 * Checks for: role, userType, authorities, or typical JWT claim names
 */
export const getUserRole = () => {
  const token = getJwtToken();
  if (!token) {
    console.warn('No JWT token found');
    return null;
  }
  
  const decoded = decodeJWT(token);
  if (!decoded) {
    return null;
  }
  
  // Check for various role claim names
  const role = decoded.role || decoded.userType || decoded.authorities || decoded.authority || decoded.type;
  
  console.log('Extracted role from token:', role);
  return role;
};

/**
 * Extract user email (subject) from JWT token
 */
export const getUserEmailFromToken = () => {
  const token = getJwtToken();
  if (!token) {
    return null;
  }
  
  const decoded = decodeJWT(token);
  if (!decoded) {
    return null;
  }
  
  // Common claims for email
  return decoded.sub || decoded.email || decoded.userEmail;
};

/**
 * Check if current user is a doctor
 */
export const isDoctor = () => {
  const role = getUserRole();
  if (!role) {
    return false;
  }
  
  const roleUpper = role.toUpperCase();
  return roleUpper === 'DOCTOR' || roleUpper === 'ROLE_DOCTOR' || roleUpper === 'DOCTOR_ROLE';
};

/**
 * Check if current user is a patient
 */
export const isPatient = () => {
  const role = getUserRole();
  if (!role) {
    return false;
  }
  
  const roleUpper = role.toUpperCase();
  return roleUpper === 'PATIENT' || roleUpper === 'ROLE_PATIENT' || roleUpper === 'PATIENT_ROLE';
};

// ===== PATIENT PROFILE SERVICE =====

// Helper function to safely parse JSON response
const safeJsonParse = async (response) => {
  const contentType = response.headers.get('content-type');
  const text = await response.text();

  // Check if response is empty
  if (!text || text.trim().length === 0) {
    return {};
  }

// Try to parse as JSON if content-type indicates JSON
  if (contentType && contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse JSON:', text);
      return { message: text };
    }
  }

  // If not JSON, return as message
  return { message: text };
};

// Check if patient profile exists (quick check without full error throwing)
export const checkPatientProfileExists = async () => {
  try {
    const jwtToken = getJwtToken();
    
    if (!jwtToken) {
      throw new Error('No authentication token found. Please login again.');
    }

    const response = await authenticatedFetch('http://localhost:8083/api/patients/profile', {
      method: 'GET',
    });

    // Log response status for debugging
    console.log('Profile check response status:', response.status);

    if (response.ok) {
      const data = await safeJsonParse(response);
      console.log('Patient profile exists response:', data);
      
      // Check if the response is empty or null - treat as no profile
      if (!data || Object.keys(data).length === 0 || data.message) {
        console.log('Patient profile is empty - treating as no profile');
        return { exists: false, profile: null };
      }
      
      console.log('Profile exists:', data);
      return { exists: true, profile: data };
    } else if (response.status === 404) {
      console.log('Profile does not exist (404)');
      return { exists: false, profile: null };
    } else {
      const data = await safeJsonParse(response);
      console.error('Profile check failed:', data);
      // If we get an error response, treat as no profile exists
      return { exists: false, profile: null, error: data.message };
    }
  } catch (error) {
    console.error('Profile check error:', error.message);
    // On any error, treat as no profile exists so user can create one
    return { exists: false, profile: null, error: error.message };
  }
};

// Get patient profile
export const getPatientProfile = async () => {
  try {
    const jwtToken = getJwtToken();
    
    // Log for debugging
    console.log('Fetching profile with token:', jwtToken ? 'Present' : 'Missing');
    
    if (!jwtToken) {
      throw new Error('No authentication token found. Please login again.');
    }

    const response = await authenticatedFetch('http://localhost:8083/api/patients/profile', {
      method: 'GET',
    });

    // Log response status for debugging
    console.log('Profile response status:', response.status);

    const data = await safeJsonParse(response);

    if (!response.ok) {
      console.error('Profile fetch failed:', {
        status: response.status,
        data: data
      });
      throw new Error(data.message || `Failed to fetch profile (${response.status})`);
    }

    return data;
  } catch (error) {
    console.error('Profile fetch error:', error.message);
    throw error;
  }
};

// Update patient profile
export const updatePatientProfile = async (profileData) => {
  try {
    const response = await authenticatedFetch('http://localhost:8083/api/patients/updateProfile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });

    const data = await safeJsonParse(response);

    if (!response.ok) {
      throw new Error(data.message || 'Failed to update profile');
    }

    return data;
  } catch (error) {
    console.error('Profile update error:', error);
    throw new Error(error.message || 'Error updating profile');
  }
};

// Create patient profile
export const createPatientProfile = async (profileData) => {
  try {
    const response = await authenticatedFetch('http://localhost:8083/api/patients/createProfile', {
      method: 'POST',
      body: JSON.stringify(profileData),
    });

    const data = await safeJsonParse(response);

    if (!response.ok) {
      throw new Error(data.message || 'Failed to create profile');
    }

    return data;
  } catch (error) {
    console.error('Profile creation error:', error);
    throw new Error(error.message || 'Error creating profile');
  }
};

// Get patient appointments
export const getPatientAppointments = async () => {
  try {
    const jwtToken = getJwtToken();
    
    // Log for debugging
    console.log('Fetching appointments with token:', jwtToken ? 'Present' : 'Missing');
    
    if (!jwtToken) {
      throw new Error('No authentication token found. Please login again.');
    }

    const response = await authenticatedFetch('http://localhost:8085/api/appointment/getPatientAppointment', {
      method: 'GET',
    });

    // Log response status for debugging
    console.log('Appointments response status:', response.status);
    console.log('Appointments response headers:', {
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
    });

    const data = await safeJsonParse(response);

    console.log('Appointments raw data:', data);
    console.log('Appointments data type:', typeof data);
    console.log('Is array:', Array.isArray(data));

    // DEBUG: Log each appointment's fields to identify doctor field name
    if (Array.isArray(data)) {
      console.log('=== API DEBUG: Checking appointment fields ===');
      data.forEach((apt, index) => {
        console.log(`Appointment ${index + 1} keys:`, Object.keys(apt));
        console.log(`Appointment ${index + 1} full:`, apt);
      });
    }

    if (!response.ok) {
      console.error('Appointments fetch failed:', {
        status: response.status,
        data: data
      });
      throw new Error(data.message || `Failed to fetch appointments (${response.status})`);
    }

    // Handle different response formats
    let appointmentsArray = [];
    
    if (Array.isArray(data)) {
      appointmentsArray = data;
      console.log(`✓ Received ${appointmentsArray.length} appointments as array`);
    } else if (data && typeof data === 'object') {
      // Check if appointments are nested in the response
      if (data.appointments && Array.isArray(data.appointments)) {
        appointmentsArray = data.appointments;
        console.log(`✓ Found appointments nested in response: ${appointmentsArray.length} items`);
      } else if (data.data && Array.isArray(data.data)) {
        appointmentsArray = data.data;
        console.log(`✓ Found appointments in data field: ${appointmentsArray.length} items`);
      } else if (data.content && Array.isArray(data.content)) {
        appointmentsArray = data.content;
        console.log(`✓ Found appointments in content field: ${appointmentsArray.length} items`);
      } else {
        // If it's a single appointment object, wrap it in an array
        if (data.id || data.appointmentId || data.appointmentDate) {
          appointmentsArray = [data];
          console.log('✓ Wrapped single appointment in array');
        }
      }
    }

    console.log('Final appointments to return:', appointmentsArray);
    return appointmentsArray;
  } catch (error) {
    console.error('Appointments fetch error:', error.message);
    console.error('Full error:', error);
    throw new Error(error.message || 'Error fetching appointments');
  }
};

// Get patient medical history
export const getPatientMedicalHistory = async () => {
  try {
    const response = await authenticatedFetch('http://localhost:8082/patient/medical-history', {
      method: 'GET',
    });

    const data = await safeJsonParse(response);

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch medical history');
    }

    return data;
  } catch (error) {
    console.error('Medical history fetch error:', error);
    throw new Error(error.message || 'Error fetching medical history');
  }
};

// Book new appointment
export const bookAppointment = async (appointmentData) => {
  try {
    console.log('=== BOOKING APPOINTMENT DEBUG ===');
    console.log('Appointment data:', appointmentData);
    
    const jwtToken = getJwtToken();
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (jwtToken) {
      headers.Authorization = `Bearer ${jwtToken}`;
    }
    
    const response = await fetch('http://localhost:8085/api/appointment/book', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(appointmentData),
    });

    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    console.log('Response headers:', response.headers.get('content-type'));
    
    // Get response text first to handle both JSON and non-JSON responses
    const responseText = await response.text();
    console.log('Response text:', responseText);
    
    // Check if response is null or empty - this indicates already booked
    if (!responseText || responseText === 'null' || responseText.trim() === '') {
      console.log('Response is null or empty - slot is already booked');
      throw new Error('Already booked appointment. Please choose a different time slot.');
    }
    
    // Check if response is HTML (like Spring Whitelabel Error Page)
    const contentType = response.headers.get('content-type');
    const isHtml = contentType && contentType.includes('text/html');
    
    if (isHtml) {
      console.log('Response is HTML, extracting error message...');
      // Try to extract error message from HTML
      // Look for common error patterns in HTML
      const errorPatterns = [
        /<h1[^>]*>([^<]+)<\/h1>/i,
        /<p[^>]*>([^<]+)<\/p>/i,
        /exception/i,
        /error/i,
      ];
      
      // Check if it contains runtime exception message
      if (responseText.toLowerCase().includes('runtimeexception') || 
          responseText.toLowerCase().includes('already booked')) {
        throw new Error('Already booked appointment. Please choose a different time slot.');
      }
      
      // If we can't parse the HTML, throw a generic error with status
      throw new Error(`Server error: ${response.status}`);
    }
    
    // Try to parse as JSON if possible
    let data;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
      // If not valid JSON, treat the text as the error message
      console.log('Response is not valid JSON, treating as error message');
      data = { message: responseText || 'Unknown error occurred' };
    }

    console.log('Parsed data:', data);

    // Check if data is null or empty after parsing
    if (!data || data === null || data === 'null') {
      console.log('Data is null - slot is already booked');
      throw new Error('Already booked appointment. Please choose a different time slot.');
    }

    if (!response.ok) {
      // Check for specific error messages and throw appropriate errors
      const errorMessage = data.message || data.error || `Server error: ${response.status}`;
      
      console.log('Error message from server:', errorMessage);
      
      // Check for slot already booked - various possible error messages from backend
      if (errorMessage.toLowerCase().includes('already booked') || 
          errorMessage.toLowerCase().includes('slot') ||
          errorMessage.toLowerCase().includes('not available') ||
          errorMessage.toLowerCase().includes('already book') ||
          errorMessage.toLowerCase().includes('occupied') ||
          errorMessage.toLowerCase().includes('runtime') ||
          errorMessage.toLowerCase().includes('exception')) {
        throw new Error('Already booked appointment. Please choose a different time slot.');
      }
      
      // Check for invalid date/time
      if (errorMessage.toLowerCase().includes('past') || 
          errorMessage.toLowerCase().includes('invalid date')) {
        throw new Error('Cannot book appointments for past dates.');
      }
      
      // Check for doctor unavailable
      if (errorMessage.toLowerCase().includes('doctor') && 
          errorMessage.toLowerCase().includes('unavailable')) {
        throw new Error('Doctor is not available. Please choose a different doctor.');
      }
      
      // For any other error, show the actual error message from backend
      throw new Error(errorMessage);
    }

    // Try to parse successful response
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      // If response is OK but empty, return success
      return { success: true };
    }
    
    return data;
  } catch (error) {
    console.error('Appointment booking error:', error);
    console.error('Error message:', error.message);
    // Re-throw the error with the message we set, or a default message
    throw new Error(error.message || 'Failed to book appointment');
  }
};

// ===== DOCTOR PROFILE SERVICE =====

/**
 * Check if doctor profile exists (quick check without full error throwing)
 */
export const checkDoctorProfileExists = async () => {
  try {
    const jwtToken = getJwtToken();
    
    if (!jwtToken) {
      throw new Error('No authentication token found. Please login again.');
    }

    const response = await authenticatedFetch('http://localhost:8083/api/doctors/profile', {
      method: 'GET',
    });

    // Log response status for debugging
    console.log('Doctor profile check response status:', response.status);

    if (response.ok) {
      const data = await safeJsonParse(response);
      console.log('Doctor profile exists response:', data);
      
      // Check if the response is empty or null - treat as no profile
      if (!data || Object.keys(data).length === 0 || data.message) {
        console.log('Doctor profile is empty - treating as no profile');
        return { exists: false, profile: null };
      }
      
      console.log('Doctor profile exists:', data);
      return { exists: true, profile: data };
    } else if (response.status === 404) {
      console.log('Doctor profile does not exist (404)');
      return { exists: false, profile: null };
    } else {
      const data = await safeJsonParse(response);
      console.error('Doctor profile check failed:', data);
      // If we get an error response, treat as no profile exists
      return { exists: false, profile: null, error: data.message };
    }
  } catch (error) {
    console.error('Doctor profile check error:', error.message);
    // On any error, treat as no profile exists so user can create one
    return { exists: false, profile: null, error: error.message };
  }
};

/**
 * Get doctor profile
 */
export const getDoctorProfile = async () => {
  try {
    const jwtToken = getJwtToken();
    
    // Log for debugging
    console.log('Fetching doctor profile with token:', jwtToken ? 'Present' : 'Missing');
    
    if (!jwtToken) {
      throw new Error('No authentication token found. Please login again.');
    }

    const response = await authenticatedFetch('http://localhost:8083/api/doctors/profile', {
      method: 'GET',
    });

    // Log response status for debugging
    console.log('Doctor profile response status:', response.status);

    const data = await safeJsonParse(response);

    if (!response.ok) {
      console.error('Doctor profile fetch failed:', {
        status: response.status,
        data: data
      });
      
      // Try to get from localStorage as fallback
      const cachedProfile = localStorage.getItem('doctorProfile');
      if (cachedProfile) {
        console.log('Using cached doctor profile from localStorage');
        return JSON.parse(cachedProfile);
      }
      
      throw new Error(data.message || `Failed to fetch doctor profile (${response.status})`);
    }

    // Cache the profile data in localStorage
    localStorage.setItem('doctorProfile', JSON.stringify(data));
    
    return data;
  } catch (error) {
    console.error('Doctor profile fetch error:', error.message);
    
    // Try to get from localStorage as fallback
    const cachedProfile = localStorage.getItem('doctorProfile');
    if (cachedProfile) {
      console.log('Using cached doctor profile from localStorage after error');
      return JSON.parse(cachedProfile);
    }
    
    throw error;
  }
};

/**
 * Create doctor profile
 */
export const createDoctorProfile = async (profileData) => {
  try {
    const response = await authenticatedFetch('http://localhost:8084/api/doctors/profile', {
      method: 'POST',
      body: JSON.stringify(profileData),
    });

    const data = await safeJsonParse(response);

    if (!response.ok) {
      throw new Error(data.message || 'Failed to create doctor profile');
    }

    // Store the created profile in localStorage for persistence  
    localStorage.setItem('doctorProfile', JSON.stringify(data));
    
    return data;
  } catch (error) {
    console.error('Doctor profile creation error:', error);
    throw new Error(error.message || 'Error creating doctor profile');
  }
};

/**
 * Update doctor profile
 */
export const updateDoctorProfile = async (profileData) => {
  try {
    const response = await authenticatedFetch('http://localhost:8084/api/doctors/update', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });

    const data = await safeJsonParse(response);

    if (!response.ok) {
      throw new Error(data.message || 'Failed to update doctor profile');
    }

    // Store the updated profile in localStorage for persistence
    localStorage.setItem('doctorProfile', JSON.stringify(data));
    console.log('Doctor profile updated and cached to localStorage:', data);
    
    return data;
  } catch (error) {
    console.error('Doctor profile update error:', error);
    throw new Error(error.message || 'Error updating doctor profile');
  }
};

// ===== DOCTOR APPOINTMENTS SERVICE =====

/**
 * Get appointments for a specific doctor
 * This endpoint returns all appointments booked with the logged-in doctor
 */
export const getDoctorAppointments = async () => {
  try {
    const jwtToken = getJwtToken();
    
    // Log for debugging
    console.log('Fetching doctor appointments with token:', jwtToken ? 'Present' : 'Missing');
    
    if (!jwtToken) {
      throw new Error('No authentication token found. Please login again.');
    }

    const response = await authenticatedFetch('http://localhost:8085/api/appointment/getDoctorAppointments', {
      method: 'GET',
    });

    // Log response status for debugging
    console.log('Doctor appointments response status:', response.status);
    console.log('Doctor appointments response headers:', {
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
    });

    const data = await safeJsonParse(response);

    console.log('Doctor appointments raw data:', data);
    console.log('Doctor appointments data type:', typeof data);
    console.log('Is array:', Array.isArray(data));

    if (!response.ok) {
      console.error('Doctor appointments fetch failed:', {
        status: response.status,
        data: data
      });
      throw new Error(data.message || `Failed to fetch doctor appointments (${response.status})`);
    }

    // Handle different response formats
    let appointmentsArray = [];
    
    if (Array.isArray(data)) {
      appointmentsArray = data;
      console.log(`✓ Received ${appointmentsArray.length} doctor appointments as array`);
    } else if (data && typeof data === 'object') {
      // Check if appointments are nested in the response
      if (data.appointments && Array.isArray(data.appointments)) {
        appointmentsArray = data.appointments;
        console.log(`✓ Found appointments nested in response: ${appointmentsArray.length} items`);
      } else if (data.data && Array.isArray(data.data)) {
        appointmentsArray = data.data;
        console.log(`✓ Found appointments in data field: ${appointmentsArray.length} items`);
      } else if (data.content && Array.isArray(data.content)) {
        appointmentsArray = data.content;
        console.log(`✓ Found appointments in content field: ${appointmentsArray.length} items`);
      } else {
        // If it's a single appointment object, wrap it in an array
        if (data.id || data.appointmentId || data.appointmentDate) {
          appointmentsArray = [data];
          console.log('✓ Wrapped single appointment in array');
        }
      }
    }

    console.log('Final doctor appointments to return:', appointmentsArray);
    return appointmentsArray;
  } catch (error) {
    console.error('Doctor appointments fetch error:', error.message);
    console.error('Full error:', error);
    throw new Error(error.message || 'Error fetching doctor appointments');
  }
};

/**
 * Approve an appointment
 */
export const approveAppointment = async (appointmentId) => {
  try {
    const response = await authenticatedFetch(`http://localhost:8085/api/appointment/${appointmentId}/approve`, {
      method: 'PUT',
    });

    const data = await safeJsonParse(response);

    if (!response.ok) {
      throw new Error(data.message || 'Failed to approve appointment');
    }

    return data;
  } catch (error) {
    console.error('Approve appointment error:', error);
    throw new Error(error.message || 'Error approving appointment');
  }
};

/**
 * Reject an appointment
 */
export const rejectAppointment = async (appointmentId) => {
  try {
    const response = await authenticatedFetch(`http://localhost:8085/api/appointment/${appointmentId}/reject`, {
      method: 'PUT',
    });

    const data = await safeJsonParse(response);

    if (!response.ok) {
      throw new Error(data.message || 'Failed to reject appointment');
    }

    return data;
  } catch (error) {
    console.error('Reject appointment error:', error);
    throw new Error(error.message || 'Error rejecting appointment');
  }
};

/**
 * Complete an appointment
 */
export const completeAppointment = async (appointmentId) => {
  try {
    const response = await authenticatedFetch(`http://localhost:8085/api/appointment/${appointmentId}/complete`, {
      method: 'PUT',
    });

    const data = await safeJsonParse(response);

    if (!response.ok) {
      throw new Error(data.message || 'Failed to complete appointment');
    }

    return data;
  } catch (error) {
    console.error('Complete appointment error:', error);
    throw new Error(error.message || 'Error completing appointment');
  }
};

/**
 * Get all doctors with their details (name and specialization)
 * This endpoint returns a list of doctors with full details for patients to book appointments
 * Endpoint: GET /api/doctors on port 8084 (Doctor Service)
 * Returns: List of doctor objects with id, name, specialization, available
 */
export const getAllDoctorsWithDetails = async () => {
  try {
    const jwtToken = getJwtToken();
    
    console.log('Fetching all doctors with details, token:', jwtToken ? 'Present' : 'Missing');
    
    if (!jwtToken) {
      throw new Error('No authentication token found. Please login again.');
    }

    // Use doctor service (port 8084) endpoint for doctors list with details
    const response = await authenticatedFetch('http://localhost:8084/api/doctors', {
      method: 'GET',
    });

    console.log('All doctors with details response status:', response.status);

    const data = await safeJsonParse(response);

    if (!response.ok) {
      console.error('Doctors fetch failed:', {
        status: response.status,
        data: data
      });
      throw new Error(data.message || `Failed to fetch doctors (${response.status})`);
    }

    // Handle different response formats
    let doctorsArray = [];
    
    if (Array.isArray(data)) {
      // Transform each doctor to include display name with specialization and availability
      doctorsArray = data.map((doctor) => {
        const specialization = doctor.specialization || doctor.specialty;
        const isAvailable = doctor.available === true || doctor.available === 'true';
        return {
          id: doctor.id || doctor.doctorId,
          name: doctor.name || doctor.doctorName || doctor.userName || 'Unknown',
          specialization: specialization || '',
          available: isAvailable,
          displayName: specialization ? `Dr. ${doctor.name || doctor.doctorName || doctor.userName || 'Unknown'} - ${specialization}` : `Dr. ${doctor.name || doctor.doctorName || doctor.userName || 'Unknown'}`,
          availabilityStatus: isAvailable ? 'Available' : 'Not Available'
        };
      });
      console.log(`✓ Received ${doctorsArray.length} doctors with details`);
    } else if (data && typeof data === 'object') {
      // Check if doctors are nested in the response
      if (data.doctors && Array.isArray(data.doctors)) {
        doctorsArray = data.doctors.map((doctor) => {
          const specialization = doctor.specialization || doctor.specialty;
          const isAvailable = doctor.available === true || doctor.available === 'true';
          return {
            id: doctor.id || doctor.doctorId,
            name: doctor.name || doctor.doctorName || doctor.userName || 'Unknown',
            specialization: specialization || '',
            available: isAvailable,
            displayName: specialization ? `Dr. ${doctor.name || doctor.doctorName || doctor.userName || 'Unknown'} - ${specialization}` : `Dr. ${doctor.name || doctor.doctorName || doctor.userName || 'Unknown'}`,
            availabilityStatus: isAvailable ? 'Available' : 'Not Available'
          };
        });
        console.log(`✓ Found doctors nested in response: ${doctorsArray.length} items`);
      } else if (data.data && Array.isArray(data.data)) {
        doctorsArray = data.data.map((doctor) => {
          const specialization = doctor.specialization || doctor.specialty;
          const isAvailable = doctor.available === true || doctor.available === 'true';
          return {
            id: doctor.id || doctor.doctorId,
            name: doctor.name || doctor.doctorName || doctor.userName || 'Unknown',
            specialization: specialization || '',
            available: isAvailable,
            displayName: specialization ? `Dr. ${doctor.name || doctor.doctorName || doctor.userName || 'Unknown'} - ${specialization}` : `Dr. ${doctor.name || doctor.doctorName || doctor.userName || 'Unknown'}`,
            availabilityStatus: isAvailable ? 'Available' : 'Not Available'
          };
        });
      }
    }

    console.log('Final doctors with details to return:', doctorsArray);
    return doctorsArray;
  } catch (error) {
    console.error('Doctors fetch error:', error.message);
    console.error('Full error:', error);
    throw new Error(error.message || 'Error fetching doctors');
  }
};

/**
 * Get all doctors for booking
 * This endpoint returns a list of doctor names from Doctor Service with specialization
 * Endpoint: GET /api/doctors/doctorName on port 8084 (Doctor Service)
 * Also fetches from /api/doctors to get specialization details
 * Returns: List of doctor objects with id, name, specialization, displayName, available
 */
export const getAllDoctors = async () => {
  try {
    const jwtToken = getJwtToken();
    
    console.log('Fetching all doctors with token:', jwtToken ? 'Present' : 'Missing');
    
    if (!jwtToken) {
      throw new Error('No authentication token found. Please login again.');
    }

    // First, get the list of doctor names
    const namesResponse = await authenticatedFetch('http://localhost:8084/api/doctors/doctorName', {
      method: 'GET',
    });

    console.log('Doctor names response status:', namesResponse.status);

    // Also fetch full doctor details to get specialization and availability
    const detailsResponse = await authenticatedFetch('http://localhost:8084/api/doctors', {
      method: 'GET',
    });

    console.log('Doctor details response status:', detailsResponse.status);

    const namesData = await safeJsonParse(namesResponse);
    const detailsData = await safeJsonParse(detailsResponse);

    if (!namesResponse.ok) {
      console.error('Doctor names fetch failed:', {
        status: namesResponse.status,
        data: namesData
      });
      throw new Error(namesData.message || `Failed to fetch doctors (${namesResponse.status})`);
    }

    // Create a map of doctor name to specialization and availability from details
    let doctorDetailsMap = {};
    if (detailsResponse.ok && detailsData) {
      const doctorsList = Array.isArray(detailsData) ? detailsData : 
        (detailsData.doctors || detailsData.data || []);
      
      doctorsList.forEach(doctor => {
        const name = doctor.name || doctor.doctorName || doctor.userName;
        if (name) {
          doctorDetailsMap[name] = {
            specialization: doctor.specialization || doctor.specialty || 'General',
            id: doctor.id || doctor.doctorId,
            available: doctor.available === true || doctor.available === 'true'
          };
        }
      });
      console.log('Doctor details map created:', doctorDetailsMap);
    }

    // Handle response - endpoint returns List<String>
    let doctorsArray = [];
    
    if (Array.isArray(namesData)) {
      // Backend returns List<String> of doctor names
      // Transform to objects with id, name, specialization, and availability
      doctorsArray = namesData.map((name, index) => {
        const details = doctorDetailsMap[name] || {};
        const specialization = details.specialization;
        const isAvailable = details.available;
        return {
          id: details.id || index + 1,
          name: name,
          doctorName: name,
          specialization: specialization || '',
          available: isAvailable || false,
          displayName: specialization ? `Dr. ${name} - ${specialization}` : `Dr. ${name}`,
          availabilityStatus: isAvailable ? 'Available' : 'Not Available'
        };
      });
      console.log(`✓ Received ${doctorsArray.length} doctor names with specialization and availability`);
    } else if (namesData && typeof namesData === 'object') {
      // Check if doctors are nested in the response
      if (namesData.doctors && Array.isArray(namesData.doctors)) {
        doctorsArray = namesData.doctors;
        console.log(`✓ Found doctors nested in response: ${doctorsArray.length} items`);
      }
    }

    console.log('Final doctors to return:', doctorsArray);
    return doctorsArray;
  } catch (error) {
    console.error('Doctors fetch error:', error.message);
    console.error('Full error:', error);
    throw new Error(error.message || 'Error fetching doctors');
  }
};

/**
 * Get doctor by ID
 * This endpoint returns a single doctor by their ID
 */
export const getDoctorById = async (doctorId) => {
  try {
    const jwtToken = getJwtToken();
    
    console.log(`Fetching doctor with ID: ${doctorId}, token:`, jwtToken ? 'Present' : 'Missing');
    
    if (!jwtToken) {
      throw new Error('No authentication token found. Please login again.');
    }

    const response = await authenticatedFetch(`http://localhost:8083/api/doctors/${doctorId}`, {
      method: 'GET',
    });

    console.log(`Doctor ${doctorId} response status:`, response.status);

    const data = await safeJsonParse(response);

    if (!response.ok) {
      console.error(`Doctor ${doctorId} fetch failed:`, {
        status: response.status,
        data: data
      });
      throw new Error(data.message || `Failed to fetch doctor (${response.status})`);
    }

    console.log(`Doctor ${doctorId} data:`, data);
    return data;
  } catch (error) {
    console.error(`Error fetching doctor ${doctorId}:`, error.message);
    throw new Error(error.message || `Error fetching doctor details`);
  }
};

/**
 * Get patient by ID
 * This endpoint returns a single patient by their ID
 */
export const getPatientById = async (patientId) => {
  try {
    const jwtToken = getJwtToken();
    
    console.log(`Fetching patient with ID: ${patientId}, token:`, jwtToken ? 'Present' : 'Missing');
    
    if (!jwtToken) {
      throw new Error('No authentication token found. Please login again.');
    }

    const response = await authenticatedFetch(`http://localhost:8083/api/patients/${patientId}`, {
      method: 'GET',
    });

    console.log(`Patient ${patientId} response status:`, response.status);

    const data = await safeJsonParse(response);

    if (!response.ok) {
      console.error(`Patient ${patientId} fetch failed:`, {
        status: response.status,
        data: data
      });
      throw new Error(data.message || `Failed to fetch patient (${response.status})`);
    }

    console.log(`Patient ${patientId} data:`, data);
    return data;
  } catch (error) {
    console.error(`Error fetching patient ${patientId}:`, error.message);
    throw new Error(error.message || `Error fetching patient details`);
  }
};
