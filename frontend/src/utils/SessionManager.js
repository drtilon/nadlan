// src/utils/SessionManager.js
import axios from 'axios';

class SessionManager {
    constructor() {
        // Session state
        this.isRefreshing = false;
        this.refreshPromise = null;
        this.refreshCallbacks = [];
        this.sessionCheckerInterval = null;

        // Session timer config
        this.tokenExpiryMinutes = 60; // Adjust based on your JWT expiry time
        this.warningThresholdMinutes = 5; // Show warning 5 minutes before expiry
        this.inactivityTimeoutMinutes = 65; // Logout after inactivity (should be slightly longer than token expiry)

        // Track user activity
        this.lastActivityTime = Date.now();
        this.isSessionExpired = false;

        // Event callbacks
        this.onSessionExpiredCallback = null;
        this.onSessionWarningCallback = null;
    }

    // Initialize the session manager
    initialize() {
        // Set up the activity listeners
        this.setupActivityTracking();

        // Check token validity and setup refresh timer
        this.setupSessionChecker();

        // Set initial timer based on token
        this.resetSessionTimers();

        return this;
    }

    // Setup activity tracking for the user
    setupActivityTracking() {
        // Update activity timestamp on user interactions
        const activityEvents = ['mousedown', 'keypress', 'scroll', 'touchstart'];

        const updateActivity = () => {
            this.lastActivityTime = Date.now();

            // If session was expired but user is active, try a refresh
            if (this.isSessionExpired) {
                this.checkAndRefreshSession(true);
            }
        };

        activityEvents.forEach(event => {
            window.addEventListener(event, updateActivity, { passive: true });
        });
    }

    // Set up periodic session checking
    setupSessionChecker() {
        // Clear any existing interval
        if (this.sessionCheckerInterval) {
            clearInterval(this.sessionCheckerInterval);
        }

        // Check session every minute
        this.sessionCheckerInterval = setInterval(() => {
            this.checkAndRefreshSession();
        }, 60000); // Check every minute
    }

    // Reset all session timers when a new token is set
    resetSessionTimers() {
        this.lastActivityTime = Date.now();
        this.isSessionExpired = false;

        // Re-initialize the session checker
        this.setupSessionChecker();
    }

    // Check session and refresh if needed
    async checkAndRefreshSession(forceCheck = false) {
        // Skip if already refreshing
        if (this.isRefreshing) return;

        // Get the token
        const token = localStorage.getItem('token');
        if (!token) {
            this.handleSessionExpired();
            return;
        }

        // Check for inactivity timeout
        const inactiveTime = (Date.now() - this.lastActivityTime) / (1000 * 60);
        if (inactiveTime >= this.inactivityTimeoutMinutes) {
            this.handleSessionExpired();
            return;
        }

        // Only do token validation if forced or not expired yet
        if (forceCheck || !this.isSessionExpired) {
            try {
                // Verify token with backend
                const result = await this.verifyToken();

                if (result) {
                    // Token is valid, reset the expired flag
                    this.isSessionExpired = false;
                } else {
                    // Token validation failed
                    this.handleSessionExpired();
                }
            } catch (error) {
                console.error('Session verification error:', error);
                // Consider the session expired on error
                this.handleSessionExpired();
            }
        }
    }

    // Verify token with the server
    async verifyToken() {
        try {
            const api = axios.create({
                baseURL: 'http://localhost:5001/api',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            await api.get('/auth/verify');
            return true;
        } catch (error) {
            // Token verification failed
            return false;
        }
    }

    // Handle session expiration
    handleSessionExpired() {
        this.isSessionExpired = true;

        // Clear tokens
        localStorage.removeItem('token');
        localStorage.removeItem('userData');

        // Remove Authorization header from axios
        delete axios.defaults.headers.common['Authorization'];

        // Call the registered callback if exists
        if (this.onSessionExpiredCallback) {
            this.onSessionExpiredCallback();
        } else {
            // Default behavior - redirect to login with expired message
            window.location.href = '/login?expired=true';
        }
    }

    // Register a custom session expired handler
    onSessionExpired(callback) {
        this.onSessionExpiredCallback = callback;
        return this;
    }

    // Register a session warning handler
    onSessionWarning(callback) {
        this.onSessionWarningCallback = callback;
        return this;
    }

    // Manual logout initiated by user
    logout() {
        // Clear any timers
        if (this.sessionCheckerInterval) {
            clearInterval(this.sessionCheckerInterval);
            this.sessionCheckerInterval = null;
        }

        // Clear tokens
        localStorage.removeItem('token');
        localStorage.removeItem('userData');

        // Redirect to login page
        window.location.href = '/login';
    }
}

// Create singleton instance
const sessionManager = new SessionManager();

export default sessionManager;
