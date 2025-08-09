import { useCallback, useEffect, useState, useRef } from "react";
import { useSocketIO } from "./useSocketIO";
import {
  AuctionRound,
  Player,
  PlayerSelection,
  TeamWithUser,
  AuctionConfig,
  PlayerSelectedEvent,
  RoundResolvedEvent,
  AuctionStateUpdateEvent,
  NextRoundStartedEvent,
  SOCKET_EVENTS,
  PlayerSelectedSocketEvent,
  RoundResolvedSocketEvent,
  AdminPlayerSocketData,
  AdminPlayerSelectedData,
  RoundReadyData,
  ConflictResolutionData,
  RoundContinuesData,
  AdminOverrideData,
} from "@/types";

interface AuctionState {
  currentRound?: AuctionRound & {
    selections: PlayerSelection[];
  };
  availablePlayers: Player[];
  userSelection?: PlayerSelection;
  teams?: TeamWithUser[];
  config?: AuctionConfig & {
    pauseOnDisconnect?: boolean;
  };
  hasActiveRound: boolean;
}

// All socket event interfaces are now centralized in @/types

interface UseAuctionRealtimeProps {
  leagueId: string;
  userId?: string;
  userName?: string;
  initialState?: AuctionState | null;
  onPlayerSelected?: (data: PlayerSelectedEvent) => void;
  onAdminPlayerSelected?: (data: AdminPlayerSelectedData) => void;
  onRoundResolved?: (data: RoundResolvedEvent) => void;
  onAuctionStarted?: (data: AuctionStateUpdateEvent) => void;
  onNextRoundStarted?: (data: NextRoundStartedEvent) => void;
  onRoundReadyForResolution?: (data: RoundReadyData) => void;
  onConflictResolution?: (data: ConflictResolutionData) => void;
  onRoundContinues?: (data: RoundContinuesData) => void;
  onAdminOverride?: (data: AdminOverrideData) => void;
  onUserJoined?: (user: { id: string; name: string }) => void;
  onUserLeft?: (user: { id: string; name: string }) => void;
  onUserDisconnected?: (user: { id: string; name: string; reason: string }) => void;
  onUserTimeout?: (user: { id: string; name: string }) => void;
}

export function useAuctionRealtime({
  leagueId,
  userId,
  userName,
  initialState = null,
  onPlayerSelected,
  onAdminPlayerSelected,
  onRoundResolved,
  onAuctionStarted,
  onNextRoundStarted,
  onRoundReadyForResolution,
  onConflictResolution,
  onRoundContinues,
  onAdminOverride,
  onUserJoined,
  onUserLeft,
  onUserDisconnected,
  onUserTimeout,
}: UseAuctionRealtimeProps) {
  const [auctionState, setAuctionState] = useState<AuctionState | null>(initialState);
  const [connectedUsers, setConnectedUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isSyncing, setIsSyncing] = useState(false);

  const { socket, isConnected, on, off } = useSocketIO({ leagueId, userId, userName, enabled: !!leagueId });

  // Debounced state refresh to prevent excessive API calls
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const refreshAuctionState = useCallback(async (immediate = false) => {
    if (isSyncing || !leagueId) return;

    // Clear existing timeout if immediate refresh requested
    if (immediate && refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }

    // If not immediate, debounce the refresh
    if (!immediate) {
      if (refreshTimeoutRef.current) return; // Already scheduled
      
      refreshTimeoutRef.current = setTimeout(() => {
        refreshTimeoutRef.current = null;
        refreshAuctionState(true);
      }, 150); // 150ms debounce
      return;
    }

    try {
      setIsSyncing(true);
      
      // Use AbortController for request cancellation
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(`/api/auction?leagueId=${leagueId}`, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setAuctionState(data);
        setLastUpdated(new Date());
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error("Error refreshing auction state:", error);
      }
    } finally {
      setIsSyncing(false);
    }
  }, [leagueId, isSyncing]);

  // Socket event handlers
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Player selection event
    const handlePlayerSelected = (data: PlayerSelectedSocketEvent) => {
      if (process.env.NODE_ENV === 'development') {
        console.log("[CLIENT] Player selected:", data.selection.user.name);
      }
      refreshAuctionState();

      // Convert to PlayerSelectedEvent format for callback
      const playerSelectedEvent: PlayerSelectedEvent = {
        leagueId: data.leagueId,
        roundId: data.roundId,
        timestamp: new Date(),
        selection: {
          id: data.selection.id,
          roundId: data.roundId,
          userId: data.selection.user.id,
          playerId: data.selection.player.id, // Use player.id from the nested player object
          isWinner: false,
          createdAt: new Date(),
          player: data.selection.player, // This might be null for privacy
          user: {
            id: data.selection.user.id,
            name: data.selection.user.name,
            email: data.selection.user.name, // Fallback since we don't have email
          },
        },
        userId: data.selection.user.id,
        playerName: data.selection.player?.name || "Hidden Player", // Handle null player
        teamName: data.selection.user.name,
      };

      onPlayerSelected?.(playerSelectedEvent);
    };

    // Admin player selection event
    const handleAdminPlayerSelected = (data: AdminPlayerSocketData) => {
      console.log("[CLIENT] Admin player selected received:", data);
      console.log("[CLIENT] Calling refreshAuctionState...");
      refreshAuctionState();
      console.log("[CLIENT] Calling onAdminPlayerSelected callback...");

      // Convert to AdminPlayerSelectedData format for callback
      const adminPlayerSelectedEvent: AdminPlayerSelectedData = {
        leagueId: data.leagueId,
        roundId: data.roundId,
        timestamp: new Date(),
        selection: {
          id: data.selection.id,
          roundId: data.roundId,
          userId: data.selection.user.id,
          playerId: data.selection.player.id, // Use player.id from the nested player object
          isWinner: false,
          createdAt: new Date(),
          player: data.selection.player, // This might be null for privacy
          user: {
            id: data.selection.user.id,
            name: data.selection.user.name,
            email: data.selection.user.name, // Fallback since we don't have email
          },
        },
        userId: data.selection.user.id,
        playerName: data.selection.player?.name || "Hidden Player", // Handle null player
        teamName: data.targetTeam.name,
        isAdminAction: data.isAdminAction,
        adminReason: data.adminReason,
        targetTeam: data.targetTeam,
      };

      onAdminPlayerSelected?.(adminPlayerSelectedEvent);
    };

    // Round ready for resolution
    const handleRoundReadyForResolution = (data: RoundReadyData) => {
      console.log("Round ready for resolution:", data);
      // Force immediate refresh
      refreshAuctionState();
      // Also force a second refresh with small delay to ensure state sync
      setTimeout(() => {
        refreshAuctionState();
      }, 50);
      onRoundReadyForResolution?.(data);
    };

    // Round resolved event
    const handleRoundResolved = (data: RoundResolvedSocketEvent) => {
      console.log("Round resolved:", data);
      refreshAuctionState();

      // Convert to app-level RoundResolvedEvent format if callback exists
      if (onRoundResolved) {
        const roundResolvedEvent: RoundResolvedEvent = {
          leagueId: data.leagueId,
          roundId: data.roundId,
          timestamp: new Date(),
          assignments: data.assignments || [],
          canContinue: data.canContinue,
        };
        onRoundResolved(roundResolvedEvent);
      }
    };

    // Conflict resolution event
    const handleConflictResolution = (data: ConflictResolutionData) => {
      console.log("Conflict resolution:", data);
      refreshAuctionState();
      onConflictResolution?.(data);
    };

    // Round continues event
    const handleRoundContinues = (data: RoundContinuesData) => {
      console.log("Round continues:", data);
      refreshAuctionState();
      onRoundContinues?.(data);
    };

    // Auction started event
    const handleAuctionStarted = (data: {
      leagueId: string;
      currentRound: {
        id: string;
        position: "P" | "D" | "C" | "A";
        roundNumber: number;
        status: "SELECTION" | "RESOLUTION" | "COMPLETED";
      };
      league: {
        id: string;
        name: string;
      };
    }) => {
      console.log("Auction started:", data);
      refreshAuctionState();
      // Convert to AuctionStateUpdateEvent format for callback
      const auctionStateEvent: AuctionStateUpdateEvent = {
        leagueId: data.leagueId,
        roundId: data.currentRound?.id,
        timestamp: new Date(),
        status: "AUCTION",
        currentRound: data.currentRound,
      };
      onAuctionStarted?.(auctionStateEvent);
    };

    // Next round started event
    const handleNextRoundStarted = (data: NextRoundStartedEvent) => {
      console.log("Next round started:", data);
      refreshAuctionState();
      onNextRoundStarted?.(data);
    };

    // User joined/left events
    const handleUserJoined = (user: { id: string; name: string }) => {
      console.log("User joined:", user);
      setConnectedUsers((prev) => [...prev.filter((u) => u.id !== user.id), user]);
      onUserJoined?.(user);
    };

    const handleUserLeft = (user: { id: string; name: string }) => {
      console.log("User left:", user);
      setConnectedUsers((prev) => prev.filter((u) => u.id !== user.id));
      onUserLeft?.(user);
    };

    const handleUserDisconnected = (user: { id: string; name: string; reason: string }) => {
      console.log("User disconnected:", user, "Reason:", user.reason);
      setConnectedUsers((prev) => prev.filter((u) => u.id !== user.id));
      onUserDisconnected?.(user);
    };

    const handleUserTimeout = (user: { id: string; name: string }) => {
      console.log("User timed out:", user);
      setConnectedUsers((prev) => prev.filter((u) => u.id !== user.id));
      onUserTimeout?.(user);
    };

    const handleUsersOnline = (users: Array<{ id: string; name: string }>) => {
      console.log("Users online:", users);
      setConnectedUsers(users);
    };

    // Admin override event - special handling for round-reset
    const handleAdminOverride = (data: AdminOverrideData) => {
      console.log("Admin override:", data);

      // For round-reset, we need to refresh state completely since the round might be deleted
      if (data.action === "reset-round") {
        // Clear current state and refresh
        setAuctionState(null);
        // Refresh after a small delay to ensure database transaction is complete
        setTimeout(() => {
          refreshAuctionState();
        }, 500);
      } else {
        // For other actions, just refresh normally
        refreshAuctionState();
      }

      onAdminOverride?.(data);
    };

    // Register event listeners using centralized constants
    on(SOCKET_EVENTS.PLAYER_SELECTED, handlePlayerSelected);
    on(SOCKET_EVENTS.ADMIN_PLAYER_SELECTED, handleAdminPlayerSelected);
    on(SOCKET_EVENTS.ROUND_READY_FOR_RESOLUTION, handleRoundReadyForResolution);
    on(SOCKET_EVENTS.ROUND_RESOLVED, handleRoundResolved);
    on(SOCKET_EVENTS.CONFLICT_RESOLUTION, handleConflictResolution);
    on(SOCKET_EVENTS.ROUND_CONTINUES, handleRoundContinues);
    on("auction-started", handleAuctionStarted);
    on(SOCKET_EVENTS.NEXT_ROUND_STARTED, handleNextRoundStarted);
    on(SOCKET_EVENTS.ADMIN_OVERRIDE, handleAdminOverride);
    on("user-joined", handleUserJoined);
    on(SOCKET_EVENTS.USER_LEFT, handleUserLeft);
    on(SOCKET_EVENTS.USER_DISCONNECTED, handleUserDisconnected);
    on(SOCKET_EVENTS.USER_TIMEOUT, handleUserTimeout);
    on(SOCKET_EVENTS.USERS_ONLINE, handleUsersOnline);

    // Cleanup event listeners on unmount
    return () => {
      off(SOCKET_EVENTS.PLAYER_SELECTED, handlePlayerSelected);
      off(SOCKET_EVENTS.ADMIN_PLAYER_SELECTED, handleAdminPlayerSelected);
      off(SOCKET_EVENTS.ROUND_READY_FOR_RESOLUTION, handleRoundReadyForResolution);
      off(SOCKET_EVENTS.ROUND_RESOLVED, handleRoundResolved);
      off(SOCKET_EVENTS.CONFLICT_RESOLUTION, handleConflictResolution);
      off(SOCKET_EVENTS.ROUND_CONTINUES, handleRoundContinues);
      off("auction-started", handleAuctionStarted);
      off(SOCKET_EVENTS.NEXT_ROUND_STARTED, handleNextRoundStarted);
      off(SOCKET_EVENTS.ADMIN_OVERRIDE, handleAdminOverride);
      off("user-joined", handleUserJoined);
      off(SOCKET_EVENTS.USER_LEFT, handleUserLeft);
      off(SOCKET_EVENTS.USER_DISCONNECTED, handleUserDisconnected);
      off(SOCKET_EVENTS.USER_TIMEOUT, handleUserTimeout);
      off(SOCKET_EVENTS.USERS_ONLINE, handleUsersOnline);
    };
  }, [
    socket,
    isConnected,
    on,
    off,
    refreshAuctionState,
    onPlayerSelected,
    onAdminPlayerSelected,
    onRoundResolved,
    onAuctionStarted,
    onNextRoundStarted,
    onRoundReadyForResolution,
    onConflictResolution,
    onRoundContinues,
    onAdminOverride,
    onUserJoined,
    onUserLeft,
    onUserDisconnected,
    onUserTimeout,
  ]);

  // Initialize state if not provided - only once
  useEffect(() => {
    if (!initialState && leagueId && !auctionState) {
      refreshAuctionState();
    }
  }, [leagueId, auctionState, initialState, refreshAuctionState]); // Only depend on leagueId and run once per league

  // Heartbeat and periodic sync when Socket.io is disconnected
  useEffect(() => {
    if (!leagueId) return;

    let heartbeatInterval: NodeJS.Timeout;

    if (!isConnected) {
      // Fallback polling when Socket.io is disconnected
      console.log("Socket.io disconnected, falling back to polling");
      heartbeatInterval = setInterval(() => {
        refreshAuctionState();
      }, 5000); // Poll every 5 seconds when disconnected
    }
    // Remove the else block - when connected, rely only on Socket.io events

    return () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
    };
  }, [isConnected, leagueId, refreshAuctionState]); // Remove refreshAuctionState and isSyncing dependencies

  // Sync when coming back online (page visibility change)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isConnected) {
        console.log("Page became visible, syncing auction state");
        refreshAuctionState();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isConnected, refreshAuctionState]); // Remove refreshAuctionState and isSyncing dependencies

  return {
    auctionState,
    connectedUsers,
    lastUpdated,
    isConnected,
    isSyncing,
    refreshAuctionState,
    socket,
  };
}
