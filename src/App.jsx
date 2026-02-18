import { useState, useEffect } from 'react'
import './App.css'
import LandingPage from './components/LandingPage'
import Login from './components/Login'
import Signup from './components/Signup'
import PatientDashboard from './components/PatientDashboard'
import DoctorDashboard from './components/DoctorDashboard'
import CreateProfile from './components/CreateProfile'
import { getJwtToken, isSessionExpired, refreshSession, logoutUser, getUserRole, isDoctor, isPatient } from './services/api'

function App() {
  const [showLanding, setShowLanding] = useState(true)
  const [isLogin, setIsLogin] = useState(true)
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showCreateProfile, setShowCreateProfile] = useState(false)
  const [initialSection, setInitialSection] = useState('overview')
  const [signupSuccess, setSignupSuccess] = useState(false)

  // Handle navigation to login
  const handleLoginClick = () => {
    setShowLanding(false);
    setIsLogin(true);
  };

  // Handle navigation to signup
  const handleSignupClick = () => {
    setShowLanding(false);
    setIsLogin(false);
  };

  // Handle booking button click - navigate to appointment booking
  const handleBookingClick = () => {
    setShowLanding(false);
    setIsLogin(true);
  };

  // ===== SESSION MANAGEMENT =====
  // Check if there's an active session on app load
  useEffect(() => {
    const initializeAuth = async () => {
      const token = getJwtToken();
      
      if (token && !isSessionExpired()) {
        // Session is still valid - restore user from localStorage
        const storedUser = localStorage.getItem('user');
        const storedRole = localStorage.getItem('userRole') || getUserRole();
        
        if (storedUser) {
          setUser(JSON.parse(storedUser));
          setUserRole(storedRole);
          console.log('✓ User session restored from localStorage');
          console.log('✓ User role restored:', storedRole);
        }
      } else if (token && isSessionExpired()) {
        // Session expired - logout user
        console.log('⏱️ Session expired - logging out user');
        logoutUser();
        setUser(null);
        setUserRole(null);
        setIsLogin(true);
      }
      
      setLoading(false);
    };

    initializeAuth();
  }, []);

  // ===== ACTIVITY LISTENER =====
  // Refresh session on user activity (clicks, keyboard)
  useEffect(() => {
    const handleUserActivity = () => {
      // Check if user is logged in
      const token = getJwtToken();
      if (token && user) {
        // Refresh session timestamp on any user activity
        refreshSession();
        console.log('Activity detected - session refreshed');
      }
    };

    // Add event listeners for user activity
    window.addEventListener('click', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('mousemove', handleUserActivity);

    // Cleanup event listeners on unmount
    return () => {
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('mousemove', handleUserActivity);
    };
  }, [user]);

  // ===== SESSION EXPIRY CHECK =====
  // Periodically check if session has expired (every 60 seconds)
  useEffect(() => {
    const sessionCheckInterval = setInterval(() => {
      if (user && isSessionExpired()) {
        console.log('⏱️ Session expired during activity check - logging out');
        logoutUser();
        setUser(null);
        setUserRole(null);
        setIsLogin(true);
        setShowCreateProfile(false);
      }
    }, 60000); // Check every 60 seconds

    return () => clearInterval(sessionCheckInterval);
  }, [user]);

  const handleLoginSuccess = (userData, role) => {
    // Store role in localStorage and state
    const userRole = role || localStorage.getItem('userRole') || getUserRole() || 'PATIENT';
    localStorage.setItem('userRole', userRole);
    setUserRole(userRole);
    setUser(userData);
    setInitialSection('overview');
    console.log('✓ Login successful - Role:', userRole);
  }

const handleSwitchToSignup = () => {
    setIsLogin(false)
    setSignupSuccess(false)
  }

const handleSignupSuccess = () => {
    setIsLogin(true)
    // Set a flag in sessionStorage to show success message temporarily
    sessionStorage.setItem('showSignupSuccess', 'true');
  }

  const handleSwitchToLogin = () => {
    setIsLogin(true)
    // Check if we should show signup success message
    const shouldShowSuccess = sessionStorage.getItem('showSignupSuccess');
    if (shouldShowSuccess === 'true') {
      setSignupSuccess(true);
      sessionStorage.removeItem('showSignupSuccess');
    }
  }

const handleLogout = () => {
    // Clear only authentication data from localStorage
    // IMPORTANT: Keep doctorProfile and patientProfile so profiles persist after logout
    localStorage.removeItem('jwtToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('userRole');
    // Don't remove profileCreated - it will be checked from the actual profile data
    setUserRole(null);
    setUser(null);
    setIsLogin(true);
    setShowCreateProfile(false);
    console.log('✓ User logged out successfully');
  }

  const handleNeedsProfileCreation = () => {
    console.log('User needs to create profile - showing CreateProfile page');
    setShowCreateProfile(true);
  }

  const handleProfileCreated = (profileData) => {
    console.log('Profile created successfully:', profileData);
    localStorage.setItem('profileCreated', 'true');
    setShowCreateProfile(false);
    // Set user state and redirect to profile section
    setUser((prev) => ({ ...prev, hasProfile: true, ...profileData }));
    setInitialSection('profile');
  }

  // Show loading while checking session
  if (loading) {
    return (
      <div className="app-container">
        <div className="loading-container">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Render landing page for unauthenticated users
  if (showLanding) {
    return (
      <LandingPage 
        onLoginClick={handleLoginClick}
        onSignupClick={handleSignupClick}
        onBookingClick={handleBookingClick}
      />
    );
  }

  // Render CreateProfile page when user needs to create profile
  if (showCreateProfile) {
    return (
      <CreateProfile 
        onProfileCreated={handleProfileCreated}
      />
    );
  }

  // Render dashboard based on user role
  if (user) {
    // Check if user is a doctor - redirect to DoctorDashboard
    if (isDoctor() || userRole?.toUpperCase() === 'DOCTOR' || userRole?.toUpperCase() === 'ROLE_DOCTOR') {
      console.log('Rendering DoctorDashboard for user role:', userRole);
      return (
        <DoctorDashboard 
          user={user} 
          onLogout={handleLogout}
          initialSection={initialSection}
        />
      );
    }
    
    // Default to PatientDashboard with initial section
    console.log('Rendering PatientDashboard for user role:', userRole, 'Initial section:', initialSection);
    return (
      <PatientDashboard 
        user={user} 
        onLogout={handleLogout}
        initialSection={initialSection}
      />
    );
  }

return (
    <div className="app-container">
      {isLogin ? (
        <Login 
          onLoginSuccess={handleLoginSuccess}
          onSwitchToSignup={handleSwitchToSignup}
          onNeedsProfileCreation={handleNeedsProfileCreation}
          signupSuccess={signupSuccess}
          onClearSignupSuccess={() => setSignupSuccess(false)}
        />
      ) : (
        <Signup 
          onSwitchToLogin={handleSignupSuccess}
        />
      )}
    </div>
  )
}

export default App

