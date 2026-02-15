import { useState, useEffect } from 'react';
import { signupUser } from '../services/api';

export default function Signup({ onSwitchToLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('PATIENT');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Check for existing session with role on mount
  useEffect(() => {
    const token = localStorage.getItem('jwtToken');
    if (token) {
      const storedRole = localStorage.getItem('userRole');
      console.log('Existing session found during signup - Role:', storedRole);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await signupUser(email, password, role);
      
      // Log the full response for debugging
      console.log('Full signup response:', response);
      
      // Check if signup was successful - API returns { success: true, message: "User saved successfully" }
      if (response && response.success) {
        setSuccess(true);
        // Clear form
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        
        // Redirect to login after a short delay
        setTimeout(() => {
          onSwitchToLogin();
        }, 2000);
      } else {
        throw new Error('Signup failed. Please try again.');
      }
    } catch (err) {
      console.error('Signup error:', err);
      // Clear any previous error and set the new error message
      const errorMessage = err.message || 'Signup failed. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

if (success) {
    return (
      <div className="auth-container">
        <div className="auth-card success-card">
          <div className="success-icon">✓</div>
          <h2>Signup successful!</h2>
          <p>Your {role.toLowerCase() === 'doctor' ? 'Doctor' : 'Patient'} account has been created.</p>
          <p style={{ marginTop: '10px', fontSize: '0.9em' }}>Please login with your credentials.</p>
          <p style={{ marginTop: '15px', fontSize: '0.8em', color: '#666' }}>Redirecting to login page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Sign Up</h2>
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

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password:</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">I am a:</label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={loading}
            >
              <option value="PATIENT">Patient</option>
              <option value="DOCTOR">Doctor</option>
            </select>
          </div>

          {error && <p className="error-message">{error}</p>}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Signing up...' : 'Sign Up'}
          </button>
        </form>

        <p className="switch-text">
          Already have an account?{' '}
          <button 
            type="button" 
            className="switch-btn"
            onClick={onSwitchToLogin}
            disabled={loading}
          >
            Login here
          </button>
        </p>
      </div>
    </div>
  );
}

