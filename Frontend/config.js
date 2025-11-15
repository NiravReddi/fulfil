// API Configuration
// Automatically detect API URL based on environment
// In production (deployed), use the current origin
// In development, use localhost:5000
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:5000'
    : window.location.origin;

