# TODO - Auto-Confirm Appointments

## Task Completed
When a patient books an appointment and the slot is not already booked, the appointment should automatically get confirmed (status goes from PENDING to CONFIRMED).

## Changes Made

### 1. Updated `src/services/api.js`
- **Added `confirmAppointment` function**: New API function to confirm appointments via endpoint `/api/appointment/{id}/confirm`
- **Modified `bookAppointment` function**: 
  - Added auto-confirm logic after successful booking
  - Checks for both `id` and `appointmentId` field names
  - Added fallback mechanism: if appointment ID is not directly returned, fetches appointments and finds matching one by date/time, then confirms it
  - Stores confirmed status in localStorage
  - Uses status "CONFIRMED" instead of "APPROVED"

### 2. Updated `src/components/PatientDashboard.jsx`
- Updated overview card to show "Booked Appointments" 
- Counts only upcoming appointments (future date AND time)
- Time slot is parsed to check exact appointment time
- Past appointments (date/time passed) are NOT counted
- Added CSS styling for `.booked` class

### 3. Updated `src/components/DoctorDashboard.jsx`
- Changed import from `approveAppointment` to `confirmAppointment`
- Updated overview card to show "Booked Appointments"
- Counts only upcoming appointments (future date AND time)
- Time slot is parsed to check exact appointment time
- Past appointments (date/time passed) are NOT counted
- Updated action buttons:
  - Pending appointments: Show Confirm/Reject buttons
  - Confirmed appointments: Show "Mark Complete" button
- Added CSS styling for `.booked` class

## How It Works
1. Patient books an appointment via Patient Dashboard
2. Backend creates the appointment (initially as PENDING)
3. Frontend automatically calls the confirm endpoint
4. Appointment status changes to CONFIRMED
5. "Booked Appointments" count shows only upcoming appointments (not past)
6. Doctor can still "Mark Complete" on confirmed appointments

## Filter Logic for Upcoming Appointments
- Parses appointment date and timeSlot
- Gets the start time from timeSlot (e.g., "09:00" from "09:00-09:30")
- Compares against current date/time
- Only counts appointments where appointment datetime > current datetime
- Past appointments are excluded from the count

