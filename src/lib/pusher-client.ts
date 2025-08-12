import Pusher from "pusher-js";

// Client-side Pusher configuration
let pusherInstance: Pusher | null = null;

export const getPusherInstance = (): Pusher => {
  if (!pusherInstance) {
    pusherInstance = new Pusher(process.env.NEXT_PUBLIC_PUSHER_APP_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      enabledTransports: ['ws', 'wss'],
    });

    // Enable Pusher logging in development
    if (process.env.NODE_ENV === 'development') {
      Pusher.logToConsole = true;
    }
  }

  return pusherInstance;
};

// Cleanup function
export const disconnectPusher = () => {
  if (pusherInstance) {
    pusherInstance.disconnect();
    pusherInstance = null;
  }
};