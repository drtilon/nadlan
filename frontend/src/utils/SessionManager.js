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
        
        // Track if we've already handled session expiration
        this.hasHandledExpiration = false;

        // Event callbacks
        this.onSessionExpiredCallback = null;
        this.onSessionWarningCallback = null;
    }

    // Initialize the session manager
    initialize() {
        // Only initialize if not already initialized
        if (this.sessionCheckerInterval) {
            return this;
        }
        
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
            if (this.isSessionExpired && !this.hasHandledExpiration) {
                this.checkAndRefreshSession(true);
            }
        };

        // Remove any existing event listeners before adding new ones
        activityEvents.forEach(event => {
            window.removeEventListener(event, updateActivity);
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
        this.hasHandledExpiration = false;

        // Re-initialize the session checker
        this.setupSessionChecker();
    }

    // Check session and refresh if needed
    async checkAndRefreshSession(forceCheck = false) {
        // Skip if already refreshing or if we've already handled expiration
        if (this.isRefreshing || this.hasHandledExpiration) return;

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

        // Calculate time to token expiry (if we can determine it)
        try {
            const expiryTime = this.calculateTokenExpiry(token);
            const timeToExpiry = (expiryTime - Date.now()) / (1000 * 60);
            
            // Check if it's time to show warning
            if (timeToExpiry <= this.warningThresholdMinutes && !this.isSessionExpired && this.onSessionWarningCallback) {
                this.onSessionWarningCallback(timeToExpiry);
            }
            
            // Check if token is already expired
            if (timeToExpiry <= 0) {
                this.handleSessionExpired();
                return;
            }
        } catch (e) {
            // If we can't parse the token, fall back to verification
        }

        // Only do token validation if forced or not expired yet
        if (forceCheck || !this.isSessionExpired) {
            try {
                this.isRefreshing = true;
                // Verify token with backend
                const result = await this.verifyToken();
                this.isRefreshing = false;

                if (result) {
                    // Token is valid, reset the expired flag
                    this.isSessionExpired = false;
                    this.hasHandledExpiration = false;
                } else {
                    // Token validation failed
                    this.handleSessionExpired();
                }
            } catch (error) {
                this.isRefreshing = false;
                console.error('Session verification error:', error);
                // Consider the session expired on error
                this.handleSessionExpired();
            }
        }
    }

    // Try to calculate token expiry from JWT
    calculateTokenExpiry(token) {
        try {
            // Decode JWT payload (middle part between dots)
            const parts = token.split('.');
            if (parts.length !== 3) throw new Error('Invalid token format');
            
            const payload = JSON.parse(atob(parts[1]));
            if (!payload.exp) throw new Error('No expiry in token');
            
            // exp is in seconds, convert to milliseconds
            return payload.exp * 1000;
        } catch (e) {
            // If there's any error in parsing, we'll treat this as indeterminate
            throw new Error('Could not parse token expiry');
        }
    }

    // Verify token with the server
    async verifyToken() {
        try {
            // Use a new instance to avoid interference with interceptors
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
        // Prevent duplicate handling
        if (this.hasHandledExpiration) return;
        
        this.isSessionExpired = true;
        this.hasHandledExpiration = true;

        // Clear tokens and intervals
        this.cleanup();

        // Call the registered callback if exists
        if (this.onSessionExpiredCallback) {
            this.onSessionExpiredCallback();
        } else {
            // Use history API directly instead of window.location to avoid refresh
            // which can cause too many redirects in some cases
            if (window.history && typeof window.history.pushState === 'function') {
                window.history.pushState({}, '', '/login?expired=true');
                // Dispatch a popstate event to trigger route change in React router
                window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
            } else {
                // Fallback if history API not available
                window.location.href = '/login?expired=true';
            }
        }
    }

    // Clean up resources
    cleanup() {
        // Clear any timers
        if (this.sessionCheckerInterval) {
            clearInterval(this.sessionCheckerInterval);
            this.sessionCheckerInterval = null;
        }
        
        // Clear tokens
        localStorage.removeItem('token');
        localStorage.removeItem('userData');

        // Remove Authorization header from axios
        if (axios.defaults.headers.common['Authorization']) {
            delete axios.defaults.headers.common['Authorization'];
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
        this.cleanup();
        // Use direct navigation for explicit logout
        window.location.href = '/login';
    }
}

// Create singleton instance
const sessionManager = new SessionManager();

export default sessionManager;
