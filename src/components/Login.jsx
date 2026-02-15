import { useState, useEffect } from 'react';
import { loginUser, getJwtToken, initializeSession, getUserRole, decodeJWT, checkPatientProfileExists, checkDoctorProfileExists } from '../services/api';

export default function Login({ onLoginSuccess, onSwitchToSignup, onNeedsProfileCreation, signupSuccess, onClearSignupSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [checkingProfile, setCheckingProfile] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Check for existing session with role on mount
  useEffect(() => {
    const token = getJwtToken();
    if (token) {
      const role = getUserRole();
      setUserRole(role);
      console.log('Existing session found - Role:', role);
    }
  }, []);

  // Show success message when redirected from signup
  useEffect(() => {
    if (signupSuccess) {
      setSuccessMessage('Signup successful! Please login with your credentials.');
      // Auto-clear the success message after 5 seconds
      const timer = setTimeout(() => {
        setSuccessMessage('');
        if (onClearSignupSuccess) {
          onClearSignupSuccess();
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [signupSuccess, onClearSignupSuccess]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await loginUser(email, password);
      
      // Verify token was stored
      const storedToken = getJwtToken();
      console.log('Login response:', response);
      console.log('Token stored in localStorage:', storedToken ? 'Yes' : 'No');
      
      if (!storedToken) {
        throw new Error('Token was not stored. Please check server response.');
      }
      
      // Initialize session on login
      initializeSession();
      
      // Store user data in localStorage for session restoration on refresh
      const userData = response.user || response;
      localStorage.setItem('user', JSON.stringify(userData));
      console.log('User data saved to localStorage');
      
      // Extract role from token and store it
      const token = getJwtToken();
      const decoded = decodeJWT(token);
      const role = decoded?.role || decoded?.userType || response.role || 'PATIENT';
      localStorage.setItem('userRole', role);
      setUserRole(role);
      console.log('User role extracted and stored:', role);
      
      // Check if user is a doctor and needs to create profile
      if (role && (role.toUpperCase() === 'DOCTOR' || role.toUpperCase() === 'ROLE_DOCTOR')) {
        setCheckingProfile(true);
        console.log('Checking if doctor profile exists...');
        
        // First check localStorage for cached profile
        const cachedDoctorProfile = localStorage.getItem('doctorProfile');
        const profileCreated = localStorage.getItem('profileCreated');
        
        if (cachedDoctorProfile && profileCreated === 'true') {
          try {
            const parsedProfile = JSON.parse(cachedDoctorProfile);
            // Verify the profile belongs to this user (check by email)
            if (parsedProfile.email && parsedProfile.email === (userData.email || decoded?.sub)) {
              console.log('Using cached doctor profile from localStorage');
              setCheckingProfile(false);
              onLoginSuccess(userData, role);
              return;
            }
          } catch (e) {
            console.log('Error parsing cached doctor profile:', e);
          }
        }
        
        // Try API call to check if profile exists
        try {
          const profileCheck = await checkDoctorProfileExists();
          console.log('Doctor profile check result:', profileCheck);
          
          if (!profileCheck.exists) {
            // Profile doesn't exist - redirect to profile creation
            console.log('Doctor profile does not exist - redirecting to profile creation');
            setLoading(false);
            if (onNeedsProfileCreation) {
              onNeedsProfileCreation();
            }
            return;
          } else {
            console.log('Doctor profile exists');
            // Cache the profile data from API
            if (profileCheck.profile) {
              localStorage.setItem('doctorProfile', JSON.stringify(profileCheck.profile));
              localStorage.setItem('profileCreated', 'true');
            }
          }
        } catch (profileError) {
          console.error('Error checking doctor profile:', profileError);
          // If API fails but we have cached profile and profileCreated flag, use it
          if (cachedDoctorProfile && profileCreated === 'true') {
            console.log('Using cached doctor profile despite API error');
            setCheckingProfile(false);
            onLoginSuccess(userData, role);
            return;
          }
          // Otherwise redirect to create profile
          setLoading(false);
          if (onNeedsProfileCreation) {
            onNeedsProfileCreation();
          }
          return;
        }
        setCheckingProfile(false);
      }
      // Check if user is a patient and needs to create profile
      else if (role && (role.toUpperCase() === 'PATIENT' || role.toUpperCase() === 'ROLE_PATIENT')) {
        setCheckingProfile(true);
        console.log('Checking if patient profile exists...');
        
        // First check localStorage for cached profile
        const cachedPatientProfile = localStorage.getItem('patientProfile');
        const profileCreated = localStorage.getItem('profileCreated');
        
        if (cachedPatientProfile && profileCreated === 'true') {
          try {
            const parsedProfile = JSON.parse(cachedPatientProfile);
            // Verify the profile belongs to this user (check by email)
            if (parsedProfile.email && parsedProfile.email === (userData.email || decoded?.sub)) {
              console.log('Using cached patient profile from localStorage');
              setCheckingProfile(false);
              onLoginSuccess(userData, role);
              return;
            }
          } catch (e) {
            console.log('Error parsing cached patient profile:', e);
          }
        }
        
        // Try API call to check if profile exists
        try {
          const profileCheck = await checkPatientProfileExists();
          console.log('Profile check result:', profileCheck);
          
          if (!profileCheck.exists) {
            // Profile doesn't exist - redirect to profile creation
            console.log('Patient profile does not exist - redirecting to profile creation');
            setLoading(false);
            if (onNeedsProfileCreation) {
              onNeedsProfileCreation();
            }
            return;
          } else {
            console.log('Patient profile exists');
            // Cache the profile data from API
            if (profileCheck.profile) {
              localStorage.setItem('patientProfile', JSON.stringify(profileCheck.profile));
              localStorage.setItem('profileCreated', 'true');
            }
          }
        } catch (profileError) {
          console.error('Error checking profile:', profileError);
          // If API fails but we have cached profile and profileCreated flag, use it
          if (cachedPatientProfile && profileCreated === 'true') {
            console.log('Using cached patient profile despite API error');
            setCheckingProfile(false);
            onLoginSuccess(userData, role);
            return;
          }
          // Otherwise redirect to create profile
          setLoading(false);
          if (onNeedsProfileCreation) {
            onNeedsProfileCreation();
          }
          return;
        }
        setCheckingProfile(false);
      }
      
      // If we get here, user has a profile - proceed to dashboard
      onLoginSuccess(userData, role);
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const dismissSuccessMessage = () => {
    setSuccessMessage('');
    if (onClearSignupSuccess) {
      onClearSignupSuccess();
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Skinora Login</h2>
        
        {/* Success Popup */}
        {successMessage && (
          <div className="success-popup">
            <span className="success-icon">✓</span>
            <span className="success-text">{successMessage}</span>
            <button className="dismiss-btn" onClick={dismissSuccessMessage}>×</button>
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              disabled={loading}
            />
          </div>

          {error && <p className="error-message">{error}</p>}

          <button type="submit" className="submit-btn" disabled={loading || checkingProfile}>
            {loading || checkingProfile ? 'Checking profile...' : 'Login'}
          </button>
        </form>

        <p className="switch-text">
          Don't have an account?{' '}
          <button 
            type="button" 
            className="switch-btn"
            onClick={onSwitchToSignup}
            disabled={loading}
          >
            Sign up here
          </button>
        </p>
      </div>
    </div>
  );
}

