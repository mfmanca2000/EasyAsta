import { useCallback, useEffect, useState, useRef } from "react";
import { Channel } from "pusher-js";
import { 
  getPusherInstance, 
  addConnectionListener, 
  removeConnectionListener, 
  getConnectionStatus,
  type PusherConnectionStatus 
} from "@/lib/pusher-client";
import { getAuctionChannel, PUSHER_EVENTS } from "@/lib/pusher-shared";
import { usePollingFallback } from "./usePollingFallback";
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

interface UseAuctionPusherProps {
  leagueId: string;
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

export function useAuctionPusher({
  leagueId,
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
}: UseAuctionPusherProps) {
  const [auctionState, setAuctionState] = useState<AuctionState | null>(initialState);
  const [connectedUsers, setConnectedUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<PusherConnectionStatus>(getConnectionStatus());

  const pusherRef = useRef(getPusherInstance());
  const channelRef = useRef<Channel | null>(null);

  // Polling fallback hook
  const pollingFallback = usePollingFallback({
    leagueId,
    initialState,
    enabled: connectionStatus.fallbackMode, // Use polling when fallback is needed
    onPlayerSelected,
    onAdminPlayerSelected,
    onRoundResolved,
    onAuctionStarted,
    onNextRoundStarted,
    onRoundReadyForResolution,
  });

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

  // Listen for connection status changes
  useEffect(() => {
    const handleConnectionStatusChange = (status: PusherConnectionStatus) => {
      console.log('[PUSHER] Connection status changed:', status);
      setConnectionStatus(status);
      
      // Show user-friendly notifications about fallback mode
      if (status.fallbackMode && !connectionStatus.fallbackMode) {
        if (status.isLimitReached) {
          console.warn('[FALLBACK] Switching to polling mode due to Pusher quota limits');
        } else {
          console.warn('[FALLBACK] Switching to polling mode due to connection issues');
        }
      } else if (!status.fallbackMode && connectionStatus.fallbackMode) {
        console.log('[FALLBACK] Reconnected to Pusher, switching back from polling mode');
      }
    };

    addConnectionListener(handleConnectionStatusChange);
    
    return () => {
      removeConnectionListener(handleConnectionStatusChange);
    };
  }, [connectionStatus.fallbackMode]);

  // Setup Pusher connection and event listeners (only when not in fallback mode)
  useEffect(() => {
    if (!leagueId || !pusherRef.current || connectionStatus.fallbackMode) return;

    const pusher = pusherRef.current;
    const channelName = getAuctionChannel(leagueId);
    const channel = pusher.subscribe(channelName);
    channelRef.current = channel;

    // Player selection event
    const handlePlayerSelected = (data: PlayerSelectedSocketEvent) => {
      if (process.env.NODE_ENV === 'development') {
        console.log("[PUSHER] Player selected:", data.selection.user.name);
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
          playerId: data.selection.player.id,
          isWinner: false,
          createdAt: new Date(),
          player: data.selection.player,
          user: {
            id: data.selection.user.id,
            name: data.selection.user.name,
            email: data.selection.user.name, // Fallback since we don't have email
          },
        },
        userId: data.selection.user.id,
        playerName: data.selection.player?.name || "Hidden Player",
        teamName: data.selection.user.name,
      };

      onPlayerSelected?.(playerSelectedEvent);
    };

    // Admin player selection event
    const handleAdminPlayerSelected = (data: AdminPlayerSocketData) => {
      console.log("[PUSHER] Admin player selected received:", data);
      refreshAuctionState();

      // Convert to AdminPlayerSelectedData format for callback
      const adminPlayerSelectedEvent: AdminPlayerSelectedData = {
        leagueId: data.leagueId,
        roundId: data.roundId,
        timestamp: new Date(),
        selection: {
          id: data.selection.id,
          roundId: data.roundId,
          userId: data.selection.user.id,
          playerId: data.selection.player.id,
          isWinner: false,
          createdAt: new Date(),
          player: data.selection.player,
          user: {
            id: data.selection.user.id,
            name: data.selection.user.name,
            email: data.selection.user.name,
          },
        },
        userId: data.selection.user.id,
        playerName: data.selection.player?.name || "Hidden Player",
        teamName: data.targetTeam.name,
        isAdminAction: data.isAdminAction,
        adminReason: data.adminReason,
        targetTeam: data.targetTeam,
      };

      onAdminPlayerSelected?.(adminPlayerSelectedEvent);
    };

    // Round ready for resolution
    const handleRoundReadyForResolution = (data: RoundReadyData) => {
      console.log("[PUSHER] Round ready for resolution:", data);
      refreshAuctionState();
      setTimeout(() => {
        refreshAuctionState();
      }, 50);
      onRoundReadyForResolution?.(data);
    };

    // Round resolved event
    const handleRoundResolved = (data: RoundResolvedSocketEvent) => {
      console.log("[PUSHER] Round resolved:", data);
      refreshAuctionState();

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
      console.log("[PUSHER] Conflict resolution:", data);
      refreshAuctionState();
      onConflictResolution?.(data);
    };

    // Round continues event
    const handleRoundContinues = (data: RoundContinuesData) => {
      console.log("[PUSHER] Round continues:", data);
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
      console.log("[PUSHER] Auction started:", data);
      refreshAuctionState();
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
      console.log("[PUSHER] Next round started:", data);
      refreshAuctionState();
      onNextRoundStarted?.(data);
    };

    // User events
    const handleUserJoined = (user: { id: string; name: string }) => {
      console.log("[PUSHER] User joined:", user);
      setConnectedUsers((prev) => [...prev.filter((u) => u.id !== user.id), user]);
      onUserJoined?.(user);
    };

    const handleUserLeft = (user: { id: string; name: string }) => {
      console.log("[PUSHER] User left:", user);
      setConnectedUsers((prev) => prev.filter((u) => u.id !== user.id));
      onUserLeft?.(user);
    };

    const handleUserDisconnected = (user: { id: string; name: string; reason: string }) => {
      console.log("[PUSHER] User disconnected:", user, "Reason:", user.reason);
      setConnectedUsers((prev) => prev.filter((u) => u.id !== user.id));
      onUserDisconnected?.(user);
    };

    const handleUserTimeout = (user: { id: string; name: string }) => {
      console.log("[PUSHER] User timed out:", user);
      setConnectedUsers((prev) => prev.filter((u) => u.id !== user.id));
      onUserTimeout?.(user);
    };

    const handleUsersOnline = (users: Array<{ id: string; name: string }>) => {
      console.log("[PUSHER] Users online:", users);
      setConnectedUsers(users);
    };

    // Admin override event
    const handleAdminOverride = (data: AdminOverrideData) => {
      console.log("[PUSHER] Admin override:", data);

      if (data.action === "reset-round") {
        setAuctionState(null);
        setTimeout(() => {
          refreshAuctionState();
        }, 500);
      } else {
        refreshAuctionState();
      }

      onAdminOverride?.(data);
    };

    // Bind event listeners
    channel.bind(PUSHER_EVENTS.PLAYER_SELECTED, handlePlayerSelected);
    channel.bind(PUSHER_EVENTS.ADMIN_PLAYER_SELECTED, handleAdminPlayerSelected);
    channel.bind(PUSHER_EVENTS.ROUND_READY_FOR_RESOLUTION, handleRoundReadyForResolution);
    channel.bind(PUSHER_EVENTS.ROUND_RESOLVED, handleRoundResolved);
    channel.bind(PUSHER_EVENTS.CONFLICT_RESOLUTION, handleConflictResolution);
    channel.bind(PUSHER_EVENTS.ROUND_CONTINUES, handleRoundContinues);
    channel.bind("auction-started", handleAuctionStarted);
    channel.bind(PUSHER_EVENTS.NEXT_ROUND_STARTED, handleNextRoundStarted);
    channel.bind(PUSHER_EVENTS.ADMIN_OVERRIDE, handleAdminOverride);
    channel.bind("user-joined", handleUserJoined);
    channel.bind(PUSHER_EVENTS.USER_LEFT, handleUserLeft);
    channel.bind(PUSHER_EVENTS.USER_DISCONNECTED, handleUserDisconnected);
    channel.bind(PUSHER_EVENTS.USER_TIMEOUT, handleUserTimeout);
    channel.bind(PUSHER_EVENTS.USERS_ONLINE, handleUsersOnline);

    // Cleanup function
    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
    };
  }, [
    leagueId,
    connectionStatus.fallbackMode,
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

  // Initialize state if not provided (only for Pusher mode)
  useEffect(() => {
    if (!initialState && leagueId && !auctionState && !connectionStatus.fallbackMode) {
      refreshAuctionState();
    }
  }, [leagueId, auctionState, initialState, refreshAuctionState, connectionStatus.fallbackMode]);

  // Sync when coming back online (page visibility change) - only for Pusher mode
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && connectionStatus.isConnected && !connectionStatus.fallbackMode) {
        console.log("[PUSHER] Page became visible, syncing auction state");
        refreshAuctionState();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [connectionStatus.isConnected, connectionStatus.fallbackMode, refreshAuctionState]);

  // Return data from the appropriate source based on connection mode
  if (connectionStatus.fallbackMode) {
    return {
      auctionState: pollingFallback.auctionState,
      connectedUsers: pollingFallback.connectedUsers,
      lastUpdated: pollingFallback.lastUpdated,
      isConnected: pollingFallback.isConnected,
      isSyncing: pollingFallback.isSyncing || isSyncing,
      refreshAuctionState: pollingFallback.refreshAuctionState,
      pusher: pollingFallback.pusher,
      // Additional fallback info
      fallbackMode: true,
      isPolling: pollingFallback.isPolling,
      connectionStatus,
    };
  }

  return {
    auctionState,
    connectedUsers,
    lastUpdated,
    isConnected: connectionStatus.isConnected,
    isSyncing,
    refreshAuctionState,
    pusher: pusherRef.current,
    // Additional connection info
    fallbackMode: false,
    isPolling: false,
    connectionStatus,
  };
}