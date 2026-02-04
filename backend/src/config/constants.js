// Application Constants

// Server Configuration
export const PORT = 3000;
export const MAX_STATUS_UPDATES = 100;

// Dummy Data for Testing
export const DEPARTMENTS = ["Sales", "IT", "Marketing", "HR", "Finance"];
export const ACTIONS = ["submitted", "approved", "rejected", "flagged"];
export const USERS = ["Pranav", "Sneha", "Amit", "Riya", "Karan", "Anjali"];
export const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "INR", "CAD"];

// Polling Configuration
export const LONG_POLL_TIMEOUT = 30000; // 30 seconds
export const LONG_POLL_CHECK_INTERVAL = 500; // 500ms
export const SSE_UPDATE_INTERVAL = 5000; // 5 seconds

// WebSocket Configuration
export const WS_AUDIT_MIN_INTERVAL = 4000; // 4 seconds
export const WS_AUDIT_MAX_INTERVAL = 8000; // 8 seconds
