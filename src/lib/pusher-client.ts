// Client-side Pusher configuration
import Pusher from 'pusher-js';

let pusherInstance: Pusher | null = null;

// Connection status tracking
export interface PusherConnectionStatus {
  isConnected: boolean;
  isLimitReached: boolean;
  lastError: Error | null;
  reconnectAttempts: number;
  fallbackMode: boolean;
}

let connectionStatus: PusherConnectionStatus = {
  isConnected: false,
  isLimitReached: false,
  lastError: null,
  reconnectAttempts: 0,
  fallbackMode: false,
};

// Connection listeners
const connectionListeners: Array<(status: PusherConnectionStatus) => void> = [];

export const addConnectionListener = (listener: (status: PusherConnectionStatus) => void) => {
  connectionListeners.push(listener);
};

export const removeConnectionListener = (listener: (status: PusherConnectionStatus) => void) => {
  const index = connectionListeners.indexOf(listener);
  if (index > -1) {
    connectionListeners.splice(index, 1);
  }
};

const notifyListeners = () => {
  connectionListeners.forEach(listener => listener({ ...connectionStatus }));
};

// Error detection for quota limits
const isQuotaLimitError = (error: any): boolean => {
  if (!error) return false;
  
  const errorMessage = error.message || error.toString();
  const errorCode = error.code;
  
  // Check for common Pusher quota limit indicators
  return (
    errorCode === 4004 || // Connection limit exceeded
    errorCode === 4005 || // Path not found (can indicate quota issues)
    errorCode === 4100 || // Over capacity
    errorMessage.includes('quota') ||
    errorMessage.includes('limit') ||
    errorMessage.includes('capacity') ||
    errorMessage.includes('billing')
  );
};

export const getPusherInstance = (): Pusher | null => {
  // Guard against server-side execution
  if (typeof window === 'undefined') {
    console.warn('[PUSHER] Attempted to get Pusher instance on server side');
    return null;
  }

  if (!pusherInstance) {
    const appKey = process.env.NEXT_PUBLIC_PUSHER_APP_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!appKey || !cluster) {
      console.error('[PUSHER] Missing required environment variables');
      return null;
    }

    pusherInstance = new Pusher(appKey, {
      cluster,
      enabledTransports: ['ws', 'wss'],
      // Add retry configuration
      activityTimeout: 30000,
      pongTimeout: 6000,
      unavailableTimeout: 10000,
      // Enable stats for quota monitoring
      enableStats: true,
    });

    // Connection event handlers
    pusherInstance.connection.bind('connected', () => {
      console.log('[PUSHER] Connected successfully');
      connectionStatus.isConnected = true;
      connectionStatus.reconnectAttempts = 0;
      connectionStatus.fallbackMode = false;
      notifyListeners();
    });

    pusherInstance.connection.bind('disconnected', () => {
      console.log('[PUSHER] Disconnected');
      connectionStatus.isConnected = false;
      notifyListeners();
    });

    pusherInstance.connection.bind('error', (error: any) => {
      console.error('[PUSHER] Connection error:', error);
      connectionStatus.lastError = error;
      connectionStatus.isConnected = false;
      
      // Check if it's a quota limit error
      if (isQuotaLimitError(error)) {
        console.warn('[PUSHER] Quota limit detected, enabling fallback mode');
        connectionStatus.isLimitReached = true;
        connectionStatus.fallbackMode = true;
      }
      
      notifyListeners();
    });

    pusherInstance.connection.bind('unavailable', () => {
      console.warn('[PUSHER] Connection unavailable, enabling fallback mode');
      connectionStatus.isConnected = false;
      connectionStatus.fallbackMode = true;
      notifyListeners();
    });

    pusherInstance.connection.bind('failed', (error: any) => {
      console.error('[PUSHER] Connection failed:', error);
      connectionStatus.isConnected = false;
      connectionStatus.reconnectAttempts++;
      
      // After 3 failed attempts, enable fallback mode
      if (connectionStatus.reconnectAttempts >= 3) {
        console.warn('[PUSHER] Too many failed attempts, enabling fallback mode');
        connectionStatus.fallbackMode = true;
      }
      
      notifyListeners();
    });

    // Disable Pusher's built-in verbose logging
    Pusher.logToConsole = false;
  }

  return pusherInstance;
};

// Get current connection status
export const getConnectionStatus = (): PusherConnectionStatus => {
  return { ...connectionStatus };
};

// Force enable fallback mode (for testing)
export const enableFallbackMode = () => {
  connectionStatus.fallbackMode = true;
  connectionStatus.isConnected = false;
  notifyListeners();
};

// Try to reconnect (reset fallback if successful)
export const attemptReconnection = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!pusherInstance) {
      resolve(false);
      return;
    }

    const timeout = setTimeout(() => {
      resolve(false);
    }, 10000); // 10 second timeout

    const onConnect = () => {
      clearTimeout(timeout);
      pusherInstance!.connection.unbind('connected', onConnect);
      pusherInstance!.connection.unbind('error', onError);
      
      // Reset fallback mode on successful reconnection
      connectionStatus.fallbackMode = false;
      connectionStatus.isLimitReached = false;
      connectionStatus.reconnectAttempts = 0;
      resolve(true);
    };

    const onError = () => {
      clearTimeout(timeout);
      pusherInstance!.connection.unbind('connected', onConnect);
      pusherInstance!.connection.unbind('error', onError);
      resolve(false);
    };

    pusherInstance.connection.bind('connected', onConnect);
    pusherInstance.connection.bind('error', onError);
    
    // Attempt reconnection
    pusherInstance.disconnect();
    pusherInstance.connect();
  });
};

// Cleanup function
export const disconnectPusher = () => {
  if (pusherInstance) {
    pusherInstance.disconnect();
    pusherInstance = null;
  }
  
  // Reset connection status
  connectionStatus = {
    isConnected: false,
    isLimitReached: false,
    lastError: null,
    reconnectAttempts: 0,
    fallbackMode: false,
  };
};