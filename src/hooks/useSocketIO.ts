import { Player } from "@/types";
import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

interface UseSocketIOProps {
  leagueId: string;
  userId?: string;
  userName?: string;
  enabled?: boolean;
}

// interface Player {
//   id: string
//   name: string
//   position: 'P' | 'D' | 'C' | 'A'
//   realTeam: string
//   price: number
// }

interface AuctionRound {
  id: string;
  position: "P" | "D" | "C" | "A";
  roundNumber: number;
  status: "SELECTION" | "RESOLUTION" | "COMPLETED";
}

interface League {
  id: string;
  name: string;
  status: string;
}

interface Assignment {
  teamId: string;
  playerId: string;
  playerName: string;
  teamName: string;
  price: number;
}

interface AuctionResult {
  assignments: Assignment[];
  canContinue: boolean;
}

interface AuctionEvents {
  "auction-state-changed": (auctionState: unknown) => void;
  "player-selected": (data: {
    selection: {
      id: string;
      user: { id: string; name: string };
      player: Player;
    };
    leagueId: string;
    roundId: string;
  }) => void;
  "admin-player-selected": (data: {
    selection: {
      id: string;
      user: { id: string; name: string };
      player: Player;
    };
    leagueId: string;
    roundId: string;
    isAdminAction: boolean;
    adminReason: string;
    targetTeam: {
      id: string;
      name: string;
      userName: string;
    };
  }) => void;
  "admin-override": (data: {
    leagueId: string;
    roundId: string;
    action: "cancel-selection" | "force-resolution" | "reset-round";
    result: {
      action: string;
      message: string;
      cancelledPlayer?: string;
    };
    reason: string;
    adminName: string;
  }) => void;
  "round-ready-for-resolution": (data: { leagueId: string; roundId: string; message: string }) => void;
  "round-resolved": (data: { leagueId: string; roundId: string; result: AuctionResult; assignments: Assignment[]; canContinue: boolean }) => void;
  "auction-started": (data: { leagueId: string; currentRound: AuctionRound; league: League }) => void;
  "next-round-started": (data: { leagueId: string; round: AuctionRound; position: string; message: string }) => void;
  "user-joined": (user: { id: string; name: string; socketId: string }) => void;
  "user-left": (user: { id: string; name: string; socketId: string }) => void;
  "user-disconnected": (user: { id: string; name: string; socketId: string; reason: string }) => void;
  "user-timeout": (user: { id: string; name: string; socketId: string }) => void;
  "users-online": (users: Array<{ id: string; name: string }>) => void;
  "conflict-resolution": (data: {
    leagueId: string;
    roundId: string;
    conflicts: Array<{
      playerId: string;
      playerName: string;
      price: number;
      conflicts: Array<{
        teamId: string;
        teamName: string;
        userName: string;
        randomNumber: number;
        isWinner: boolean;
      }>;
    }>;
    roundContinues: boolean;
    assignments: Array<{
      playerId: string;
      winnerId: string;
      winnerName: string;
      playerName: string;
      price: number;
      randomNumber?: number;
    }>;
  }) => void;
  "round-continues": (data: {
    leagueId: string;
    roundId: string;
    teamsWithoutAssignments: Array<{
      id: string;
      name: string;
    }>;
    message: string;
  }) => void;
  error: (error: Error) => void;
}

export interface SocketIOHook {
  socket: Socket | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  emit: (event: string, data?: unknown) => void;
  on: <K extends keyof AuctionEvents>(event: K, callback: AuctionEvents[K]) => void;
  off: <K extends keyof AuctionEvents>(event: K, callback?: AuctionEvents[K]) => void;
}

export function useSocketIO({ leagueId, userId, userName, enabled = true }: UseSocketIOProps): SocketIOHook {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!enabled || socketRef.current) return;

    console.log("Connecting to Socket.io...");

    const socket = io({
      path: "/api/socket",
      addTrailingSlash: false,
    });

    socket.on("connect", () => {
      console.log("Socket.io connected:", socket.id);
      setIsConnected(true);

      // Join auction room immediately after connection
      if (leagueId) {
        socket.emit("join-auction", {
          leagueId,
          userId,
          userName,
        });
        console.log(`[SOCKET] Joined auction room: auction-${leagueId}`);
        console.log(`[SOCKET] User: ${userName} (${userId})`);
      }

      // Start heartbeat
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      heartbeatRef.current = setInterval(() => {
        if (socket.connected) {
          socket.emit("heartbeat");
        }
      }, 30000); // Send heartbeat every 30 seconds
    });

    socket.on("disconnect", () => {
      console.log("Socket.io disconnected");
      setIsConnected(false);

      // Clear heartbeat
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    });

    socket.on("connect_error", (error) => {
      console.error("Socket.io connection error:", error);
      setIsConnected(false);
    });

    socketRef.current = socket;
  }, [enabled, leagueId, userId, userName]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log("Disconnecting from Socket.io...");

      // Clear heartbeat
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }

      if (leagueId) {
        socketRef.current.emit("leave-auction", leagueId);
      }

      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, [leagueId]);

  const emit = useCallback(
    (event: string, data?: unknown) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit(event, data);
      }
    },
    [isConnected]
  );

  const on = useCallback(<K extends keyof AuctionEvents>(event: K, callback: AuctionEvents[K]) => {
    if (socketRef.current) {
      socketRef.current.on(event as string, callback as (...args: unknown[]) => void);
    }
  }, []);

  const off = useCallback(<K extends keyof AuctionEvents>(event: K, callback?: AuctionEvents[K]) => {
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

  // Reconnect if leagueId changes
  useEffect(() => {
    if (socketRef.current && isConnected && leagueId) {
      socketRef.current.emit("join-auction", {
        leagueId,
        userId,
        userName,
      });
      console.log(`Switched to auction room: auction-${leagueId}`);
    }
  }, [leagueId, userId, userName, isConnected]);

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
