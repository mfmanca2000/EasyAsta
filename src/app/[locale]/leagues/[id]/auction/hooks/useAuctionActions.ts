import { useState } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/toast";

interface UseAuctionActionsProps {
  leagueId: string;
  refreshAuctionState: () => Promise<void>;
}

export function useAuctionActions({ leagueId, refreshAuctionState }: UseAuctionActionsProps) {
  const t = useTranslations();
  const { addToast } = useToast();
  const [isSelecting, setIsSelecting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectPlayer = async (playerId: string, roundId: string) => {
    if (isSelecting) return;

    try {
      setIsSelecting(true);
      const response = await fetch("/api/auction/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundId,
          playerId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t("errors.selectPlayerError"));
      }

      await refreshAuctionState();
    } catch (error) {
      setError(error instanceof Error ? error.message : t("errors.selectPlayerError"));
    } finally {
      setIsSelecting(false);
    }
  };

  const resolveRound = async (roundId: string) => {
    try {
      setLoading(true);
      const response = await fetch("/api/auction/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t("errors.resolveRoundError"));
      }

      await refreshAuctionState();
      return data;
    } catch (error) {
      setError(error instanceof Error ? error.message : t("errors.resolveRoundError"));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const startNextRound = async (position: "P" | "D" | "C" | "A") => {
    try {
      setLoading(true);

      // First, check if we need to start the auction (if league is still in SETUP)
      const leagueResponse = await fetch(`/api/leagues/${leagueId}`);
      const leagueData = await leagueResponse.json();

      if (!leagueResponse.ok) {
        throw new Error(leagueData.error || t("errors.loadLeagueError"));
      }

      // If league is in SETUP, we need to start the auction first
      if (leagueData.league.status === "SETUP") {
        const startResponse = await fetch("/api/auction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leagueId }),
        });

        const startData = await startResponse.json();

        if (!startResponse.ok) {
          throw new Error(startData.error || t("errors.startAuctionError"));
        }
      }

      // Now create the round
      const response = await fetch("/api/auction/next-round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId,
          position,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t("errors.nextRoundError"));
      }

      await refreshAuctionState();
      return data;
    } catch (error) {
      setError(error instanceof Error ? error.message : t("errors.nextRoundError"));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const resetAuction = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/auction/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId }),
      });

      if (response.ok) {
        addToast({
          type: "success",
          title: t("auction.resetSuccess"),
          description: t("auction.reloadingPage"),
          duration: 2000,
        });
        setTimeout(() => window.location.reload(), 2000);
      } else {
        const data = await response.json();
        addToast({
          type: "error",
          title: t("errors.resetError"),
          description: data.error,
          duration: 5000,
        });
      }
    } catch (error) {
      addToast({
        type: "error",
        title: t("errors.resetError"),
        description: error instanceof Error ? error.message : t("errors.genericError"),
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setError(null);

  return {
    selectPlayer,
    resolveRound,
    startNextRound,
    resetAuction,
    isSelecting,
    loading,
    error,
    clearError,
  };
}