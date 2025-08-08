import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

interface SimpleSocketEvents {
  'team-joined': (data: { leagueId: string; teamName: string; userName: string; teamCount: number }) => void;
  'league-updated': (data: { leagueId: string; teamCount: number }) => void;
  'league-created': (data: { leagueId: string; leagueName: string; adminName: string; teamCount: number }) => void;
}

export interface SimpleSocketHook {
  socket: Socket | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  emit: (event: string, data?: unknown) => void;
  on: <K extends keyof SimpleSocketEvents>(event: K, callback: SimpleSocketEvents[K]) => void;
  off: <K extends keyof SimpleSocketEvents>(event: K, callback?: SimpleSocketEvents[K]) => void;
}

export function useSimpleSocket(enabled: boolean = true): SimpleSocketHook {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const connect = useCallback(() => {
    if (!enabled || socketRef.current) return;

    console.log("Connecting to Socket.io (simple)...");

    const socket = io({
      path: "/api/socket",
      addTrailingSlash: false,
    });

    socket.on("connect", () => {
      console.log("Socket.io connected (simple):", socket.id);
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("Socket.io disconnected (simple)");
      setIsConnected(false);
    });

    socket.on("connect_error", (error) => {
      console.error("Socket.io connection error (simple):", error);
      setIsConnected(false);
    });

    socketRef.current = socket;
  }, [enabled]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log("Disconnecting from Socket.io (simple)...");
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const emit = useCallback(
    (event: string, data?: unknown) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit(event, data);
      }
    },
    [isConnected]
  );

  const on = useCallback(<K extends keyof SimpleSocketEvents>(event: K, callback: SimpleSocketEvents[K]) => {
    if (socketRef.current) {
      socketRef.current.on(event as string, callback as (...args: unknown[]) => void);
    }
  }, []);

  const off = useCallback(<K extends keyof SimpleSocketEvents>(event: K, callback?: SimpleSocketEvents[K]) => {
    if (socketRef.current) {
      if (callback) {
        socketRef.current.off(event as string, callback as (...args: unknown[]) => void);
      } else {
        socketRef.current.off(event as string);
      }
    }
  }, []);

  // Connect on mount if enabled
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    socket: socketRef.current,
    isConnected,
    connect,
    disconnect,
    emit,
    on,
    off,
  };
}