import { useCallback, useEffect, useRef, useState } from "react";
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
  AdminPlayerSelectedData,
  RoundReadyData,
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

interface UsePollingFallbackProps {
  leagueId: string;
  initialState?: AuctionState | null;
  enabled: boolean; // Only poll when fallback is needed
  onPlayerSelected?: (data: PlayerSelectedEvent) => void;
  onAdminPlayerSelected?: (data: AdminPlayerSelectedData) => void;
  onRoundResolved?: (data: RoundResolvedEvent) => void;
  onAuctionStarted?: (data: AuctionStateUpdateEvent) => void;
  onNextRoundStarted?: (data: NextRoundStartedEvent) => void;
  onRoundReadyForResolution?: (data: RoundReadyData) => void;
  // Note: Advanced events (conflicts, continues, admin overrides) not supported in polling mode
  // Note: User events not supported in polling mode
}

export function usePollingFallback({
  leagueId,
  initialState = null,
  enabled,
  onPlayerSelected,
  onAdminPlayerSelected,
  onRoundResolved,
  onAuctionStarted,
  onNextRoundStarted,
  onRoundReadyForResolution,
}: UsePollingFallbackProps) {
  const [auctionState, setAuctionState] = useState<AuctionState | null>(initialState);
  const [connectedUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  // Previous state for change detection
  const prevStateRef = useRef<AuctionState | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Il chiamante (page.tsx) passa le callback come funzioni inline, quindi
  // cambiano identita' ad ogni render. Tenerle in un ref evita che quel
  // cambiamento si propaghi a useCallback/useEffect a valle: senza questo,
  // ogni render ricreava pollAuctionState, che ricreava l'effetto di
  // avvio/stop del polling, che rieseguiva subito un fetch -> nuovo render
  // -> loop che chiamava l'API decine di volte al secondo invece che ogni 2s.
  const callbacksRef = useRef({
    onPlayerSelected,
    onAdminPlayerSelected,
    onRoundResolved,
    onAuctionStarted,
    onNextRoundStarted,
    onRoundReadyForResolution,
  });
  callbacksRef.current = {
    onPlayerSelected,
    onAdminPlayerSelected,
    onRoundResolved,
    onAuctionStarted,
    onNextRoundStarted,
    onRoundReadyForResolution,
  };

  // isSyncing/lastUpdated in un ref: usati per la guardia "richiesta gia' in
  // corso" e per l'header condizionale senza rientrare nelle dipendenze di
  // fetchAuctionState/pollAuctionState (altrimenti la loro identita' cambia
  // ad ogni poll, riproducendo lo stesso loop descritto sopra).
  const isSyncingRef = useRef(false);
  const lastUpdatedRef = useRef<Date>(lastUpdated);

  // Detect changes and trigger appropriate callbacks
  const detectAndTriggerChanges = useCallback(
    (newState: AuctionState | null, prevState: AuctionState | null) => {
      if (!newState || !prevState) return;

      const { onPlayerSelected, onAdminPlayerSelected, onRoundResolved, onAuctionStarted, onNextRoundStarted, onRoundReadyForResolution } = callbacksRef.current;

      const newRound = newState.currentRound;
      const prevRound = prevState.currentRound;

      // Check for new round
      if (newRound && (!prevRound || newRound.id !== prevRound.id)) {
        console.log("[POLLING] New round detected:", newRound.id);

        if (prevRound) {
          // Next round started
          onNextRoundStarted?.({
            leagueId,
            round: newRound,
            position: newRound.position,
            message: `New round started: ${newRound.position} (Round ${newRound.roundNumber})`,
          });
        } else {
          // Auction started
          onAuctionStarted?.({
            leagueId,
            roundId: newRound.id,
            timestamp: new Date(),
            status: "AUCTION",
            currentRound: newRound,
          });
        }
      }

      // Check for new selections
      if (newRound && prevRound && newRound.id === prevRound.id) {
        const newSelections = newRound.selections || [];
        const prevSelections = prevRound.selections || [];

        if (newSelections.length > prevSelections.length) {
          // Find new selections
          const newPlayerSelections = newSelections.filter((sel) => !prevSelections.some((prev) => prev.id === sel.id));

          newPlayerSelections.forEach((selection) => {
            console.log("[POLLING] New selection detected:", selection.id);

            // Determine if it's an admin selection
            if (selection.isAdminSelection) {
              onAdminPlayerSelected?.({
                leagueId,
                roundId: newRound.id,
                timestamp: new Date(),
                selection: {
                  ...selection,
                  player: newState.availablePlayers.find((p) => p.id === selection.playerId) || selection.player,
                  user: { id: selection.userId, name: selection.user?.name || "Unknown", email: "" },
                },
                userId: selection.userId,
                playerName: selection.player?.name || "Unknown Player",
                teamName: selection.user?.name || "Unknown Team",
                isAdminAction: true,
                adminReason: selection.adminReason || "",
                targetTeam: { id: selection.userId, name: selection.user?.name || "Unknown Team" } as any,
              });
            } else {
              onPlayerSelected?.({
                leagueId,
                roundId: newRound.id,
                timestamp: new Date(),
                selection: {
                  ...selection,
                  player: newState.availablePlayers.find((p) => p.id === selection.playerId) || selection.player,
                  user: { id: selection.userId, name: selection.user?.name || "Unknown", email: "" },
                },
                userId: selection.userId,
                playerName: selection.player?.name || "Unknown Player",
                teamName: selection.user?.name || "Unknown Team",
              });
            }
          });

          // Check if round is ready for resolution
          const totalTeams = newState.teams?.length || 0;
          if (newSelections.length === totalTeams) {
            onRoundReadyForResolution?.({
              leagueId,
              roundId: newRound.id,
              message: `Round ready for resolution: ${newSelections.length}/${totalTeams} selections complete`,
            });
          }
        }

        // Check for round status changes
        if (newRound.status !== prevRound.status) {
          console.log("[POLLING] Round status changed:", prevRound.status, "->", newRound.status);

          if (newRound.status === "COMPLETED") {
            // Round resolved - we need to get assignment information
            // This would typically come from the API response
            onRoundResolved?.({
              leagueId,
              roundId: newRound.id,
              timestamp: new Date(),
              assignments: [], // Would need to be populated from API
              canContinue: true,
            });
          }
        }
      }

      // Check for league status changes (auction completion)
      // This would be detected through the API response structure
    },
    [leagueId]
  );

  // Fetch auction state
  const fetchAuctionState = useCallback(async (): Promise<AuctionState | null> => {
    // Nota: la guardia "e' gia' in corso una richiesta" vive solo in pollAuctionState
    // (l'unico chiamante), che imposta isSyncingRef.current PRIMA di invocare questa
    // funzione: ripeterla qui farebbe fallire ogni chiamata perche' il ref e' gia' true.
    if (!leagueId) return null;

    try {
      // Cancel previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await fetch(`/api/auction?leagueId=${leagueId}`, {
        signal: controller.signal,
        headers: {
          "Cache-Control": "no-cache",
          "If-Modified-Since": lastUpdatedRef.current.toUTCString(), // Conditional request
        },
      });

      if (response.status === 304) {
        // Not modified, no changes
        return prevStateRef.current;
      }

      if (response.ok) {
        const data = await response.json();
        return data;
      }

      return null;
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        console.error("[POLLING] Error fetching auction state:", error);
      }
      return null;
    }
  }, [leagueId]);

  // Poll auction state
  const pollAuctionState = useCallback(async () => {
    if (!enabled || isSyncingRef.current) return;

    isSyncingRef.current = true;
    setIsSyncing(true);

    try {
      const newState = await fetchAuctionState();

      if (newState) {
        const prevState = prevStateRef.current;

        // Detect and trigger changes
        detectAndTriggerChanges(newState, prevState);

        // Update state
        setAuctionState(newState);
        lastUpdatedRef.current = new Date();
        setLastUpdated(lastUpdatedRef.current);
        prevStateRef.current = newState;
      }
    } catch (error) {
      console.error("[POLLING] Error during polling:", error);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [enabled, fetchAuctionState, detectAndTriggerChanges]);

  // Riferimento sempre aggiornato alla poll corrente, cosi' l'effetto di
  // avvio/stop sotto puo' dipendere solo da [enabled, leagueId] e non deve
  // essere ricreato (e quindi rieseguito) ad ogni render.
  const pollRef = useRef(pollAuctionState);
  pollRef.current = pollAuctionState;

  // Start/stop polling based on enabled state
  useEffect(() => {
    if (!leagueId) return;

    if (enabled) {
      console.log("[POLLING] Starting fallback polling mode");
      setIsPolling(true);

      // Initial fetch
      pollRef.current();

      // Set up polling interval
      pollIntervalRef.current = setInterval(() => {
        pollRef.current();
      }, 2000); // Poll every 2 seconds for real-time feel
    } else {
      console.log("[POLLING] Stopping fallback polling mode");
      setIsPolling(false);

      // Clear polling interval
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }

      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [enabled, leagueId]);

  // Initialize state if not provided
  useEffect(() => {
    if (!initialState && leagueId && !auctionState && enabled) {
      pollRef.current();
    }
  }, [leagueId, auctionState, initialState, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Manual refresh function
  const refreshAuctionState = useCallback(
    async (immediate = false) => {
      if (immediate || !isSyncingRef.current) {
        await pollAuctionState();
      }
    },
    [pollAuctionState]
  );

  return {
    auctionState,
    connectedUsers, // Empty in polling mode, users are not tracked
    lastUpdated,
    isConnected: enabled, // Always "connected" when polling is enabled
    isSyncing,
    isPolling,
    refreshAuctionState,
    pusher: null, // No pusher instance in polling mode
  };
}
