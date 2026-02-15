# Appointments Session Expiration Fix - Debugging Guide

## Problems Fixed

### 1. **Poor Error Handling in `authenticatedFetch`**
- **Before**: Generic "Session expired. Please login again." error for all 401 responses
- **After**: Distinguishes between real authentication failures and token refresh failures with specific error messages

### 2. **Inadequate Token Refresh Error Recovery**
- **Before**: If token refresh endpoint returned non-JSON, it would crash
- **After**: Properly handles both JSON and plain text responses from refresh endpoint

### 3. **Missing Session Refresh After Token Renewal**
- **Before**: Token was refreshed but session timeout wasn't updated
- **After**: `refreshSession()` is called after successful token refresh to extend user session

### 4. **No Auto-Logout on Real Auth Failures**
- **Before**: Component would show error but not automatically redirect to login
- **After**: Real authentication failures trigger automatic logout

---

## How to Debug Appointment Loading Issues

### Step 1: Check Browser Console
Open DevTools (F12 or Cmd+Option+I) and look for these log messages:

**Successful flow:**
```
✓ Fetching appointments...
✓ Token present
Attempts to refresh token with refresh token endpoint...
✓ Token refreshed successfully, retrying original request
Appointments response status: 200
✓ Received X appointments as array
Final appointments to return: [...]
✓ Appointments fetched successfully
```

**Problem flow (token refresh fails):**
```
Token expired (401), attempting to refresh...
Attempting to refresh token with refresh token endpoint...
❌ Refresh endpoint returned error or is unreachable
Authentication token refresh failed. Please try again or login again.
```

### Step 2: Verify Services Are Running

Check that all required backend services are running:

```bash
# Port 8082 - Authentication Service
curl -X POST http://localhost:8082/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Port 8083 - Patient Service
curl -X GET http://localhost:8083/api/patients/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Port 8085 - Appointment Service
curl -X GET http://localhost:8085/api/appointment/getPatientAppointment \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Step 3: Check Token Validity

In browser console, run:
```javascript
// Check if token exists
const token = localStorage.getItem('jwtToken');
console.log('Token exists:', !!token);
console.log('Token length:', token?.length);

// Decode token to see expiration
function decodeToken(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    console.log('Token payload:', payload);
    console.log('Expires at:', new Date(payload.exp * 1000));
    console.log('Token expired:', Date.now() > payload.exp * 1000);
    return payload;
  } catch (e) {
    console.error('Failed to decode token:', e);
  }
}

const payload = decodeToken(token);
```

### Step 4: Check CORS Configuration

If you see CORS errors in the console:
```
Access to XMLHttpRequest at 'http://localhost:8085/...' from origin 'http://localhost:5173' 
has been blocked by CORS policy
```

**Fix in backend (assuming Java/Spring):**
```java
@Configuration
@EnableWebMvc
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins("http://localhost:5173", "http://localhost:3000")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
```

Or in Spring Boot:
```java
@Bean
public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration configuration = new CorsConfiguration();
    configuration.setAllowedOrigins(Arrays.asList("http://localhost:5173", "http://localhost:3000"));
    configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
    configuration.setAllowedHeaders(Arrays.asList("*"));
    configuration.setAllowCredentials(true);
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/api/**", configuration);
    return source;
}
```

---

## Common Error Messages & Solutions

### ❌ "Authentication failed. Please login again."
- **Cause**: No valid JWT token found and no refresh token available
- **Solution**: User needs to log in again

### ❌ "Authentication token refresh failed. Please try again or login again."
- **Cause**: Token refresh endpoint returned an error or is unreachable
- **Solutions**:
  1. Check if auth service (port 8082) is running
  2. Verify refresh endpoint responds to POST requests
  3. Check if refresh token is valid
  4. Look at auth service logs for errors

### ❌ "Failed to fetch appointments (500/503)"
- **Cause**: Appointment service (port 8085) is down or returning errors
- **Solutions**:
  1. Check if appointment service is running: `curl http://localhost:8085/health`
  2. Check service logs for errors
  3. Verify database connection
  4. Ensure patient exists in system

### ❌ CORS Error
- **Cause**: Backend CORS configuration doesn't allow requests from frontend
- **Solution**: Add frontend URL to CORS allowed origins in backend

---

## Testing the Fix

### Quick Test Flow:
1. Open browser console (F12)
2. Log in with valid credentials
3. Navigate to Appointments tab
4. Watch console logs for the flow
5. If errors occur, check the specific error message and follow solutions above

### Extended Test:
```javascript
// Simulate expired token
localStorage.removeItem('jwtToken');

// Try to fetch appointments - should auto-logout
// OR check if refresh token works to get new token
```

---

## Key Code Changes

### `api.js` - `authenticatedFetch` function
- ✅ Better 401 error handling
- ✅ Proper error messages distinguishing auth failures from server issues
- ✅ Refreshes session after successful token refresh
- ✅ Handles non-JSON responses from refresh endpoint

### `api.js` - `refreshToken` function
- ✅ Logs detailed error information
- ✅ Handles both JSON and plain text responses
- ✅ Provides clear error messages about what went wrong

### `PatientDashboard.jsx` - `fetchAppointments` function
- ✅ Checks for real auth failures vs server issues
- ✅ Auto-logs out on real authentication failures
- ✅ Preserves detailed error messages for debugging

---

## Prevention Tips

1. **Ensure all services are started before using app**
   ```bash
   # Terminal 1: Auth Service
   java -jar auth-service.jar
   
   # Terminal 2: Patient Service
   java -jar patient-service.jar
   
   # Terminal 3: Appointment Service
   java -jar appointment-service.jar
   
   # Terminal 4: Frontend
   npm run dev
   ```

2. **Monitor logs in real-time**
   - Keep backend service logs visible
   - Watch browser console for API errors

3. **Check token expiration time**
   - Verify token has sufficient expiration time (at least 30 minutes)
   - Ensure refresh token mechanism is working

4. **Test refresh token flow**
   - Manually test refresh endpoint after normal login
   - Verify it returns a valid new token

