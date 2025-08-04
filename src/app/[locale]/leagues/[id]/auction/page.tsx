"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useAuctionRealtime } from "@/hooks/useAuctionRealtime";
import { useToast } from "@/components/ui/toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// Import custom hooks
import { useAuctionAdmin } from "./hooks/useAuctionAdmin";
import { useAuctionActions } from "./hooks/useAuctionActions";
import { useNextRoundModal } from "./hooks/useNextRoundModal";
import { useConflictResolution } from "./hooks/useConflictResolution";

// Import components
import AuctionHeader from "./components/AuctionHeader";
import AuctionStatusCard from "./components/AuctionStatusCard";
import CurrentSelectionsCard from "./components/CurrentSelectionsCard";
import AdminControlsCard from "./components/AdminControlsCard";
import NoActiveRoundView from "./components/NoActiveRoundView";
import NextRoundModal from "./components/NextRoundModal";

// Import existing components
import AdminControlPanel from "@/components/auction/AdminControlPanel";
import ConflictResolutionModal from "@/components/auction/ConflictResolutionModal";
import PlayerSelectionTable from "@/components/auction/PlayerSelectionTable";

export default function AuctionPage() {
  const params = useParams();
  const { data: session } = useSession();
  const t = useTranslations();
  // Loading state - will be updated after hooks are initialized
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const leagueId = params.id as string;
  const { addToast } = useToast();

  // Custom hooks
  const { isAdmin, teamCount } = useAuctionAdmin({ leagueId });
  const { showConflictResolution, closeConflictModal, showConflictModal, conflictData } = useConflictResolution();
  const { showNextRoundModal, nextRoundStats, openNextRoundModal, closeNextRoundModal } = useNextRoundModal({ leagueId });

  // Auction actions hook
  const {
    selectPlayer: doSelectPlayer,
    resolveRound: doResolveRound,
    startNextRound: doStartNextRound,
    resetAuction,
    isSelecting,
    loading: actionsLoading,
    error: actionsError,
  } = useAuctionActions({ leagueId, refreshAuctionState: async () => {} });

  // Use real-time auction hook instead of polling
  const { auctionState, connectedUsers, isConnected, isSyncing, refreshAuctionState } = useAuctionRealtime({
    leagueId,
    userId: session?.user?.id || undefined,
    userName: session?.user?.name || session?.user?.email || undefined,
    onPlayerSelected: (data) => {
      const { selection } = data;
      addToast({
        type: "info",
        title: t("auction.playerSelectedToast"),
        description: `${selection.user.name} → ${selection.player.name}`,
        duration: 3000,
      });
    },
    onAdminPlayerSelected: (data) => {
      const { selection, targetTeam } = data;
      addToast({
        type: "info",
        title: t("auction.adminPlayerSelectedToast"),
        description: `Admin → ${selection.player.name} per ${targetTeam.name}`,
        duration: 4000,
      });
    },
    onRoundResolved: (data) => {
      addToast({
        type: "success",
        title: t("auction.roundResolvedToast"),
        description: t("auction.roundResolvedDescription"),
        duration: 4000,
      });
      if (data.canContinue) {
        openNextRoundModal();
      }
    },
    onAuctionStarted: () => {
      addToast({
        type: "success",
        title: t("auction.auctionStartedToast"),
        description: t("auction.auctionStartedDescription"),
        duration: 5000,
      });
    },
    onNextRoundStarted: (data) => {
      addToast({
        type: "info",
        title: t("auction.nextRoundStartedToast"),
        description: `${data.message}`,
        duration: 4000,
      });
      closeNextRoundModal();
    },
    onRoundReadyForResolution: () => {
      addToast({
        type: "warning",
        title: t("auction.roundReadyToast"),
        description: t("auction.roundReadyDescription"),
        duration: 6000,
      });
    },
    onUserDisconnected: (user) => {
      addToast({
        type: "info",
        title: "Utente Disconnesso",
        description: `${user.name} si è disconnesso`,
        duration: 3000,
      });
    },
    onUserTimeout: (user) => {
      addToast({
        type: "warning",
        title: "Utente Inattivo",
        description: `${user.name} è stato disconnesso per inattività`,
        duration: 4000,
      });
    },
    onConflictResolution: (data) => {
      showConflictResolution(data);
    },
    onRoundContinues: (data) => {
      addToast({
        type: "info",
        title: t("auction.roundContinues"),
        description: data.message,
        duration: 4000,
      });
    },
  });

  // Loading state based on auctionState and actions
  const loading = !auctionState && !actionsError;

  // Player selection handler
  const selectPlayer = async (playerId: string) => {
    if (!auctionState?.currentRound) return;
    await doSelectPlayer(playerId, auctionState.currentRound.id);
    await refreshAuctionState();
    setSelectedPlayer(null);
  };

  // Round resolution handler
  const handleResolveRound = async () => {
    if (!auctionState?.currentRound) return;
    try {
      const data = await doResolveRound(auctionState.currentRound.id);
      await refreshAuctionState();
      if (data.canContinue) {
        await openNextRoundModal();
      }
    } catch {
      // Error handled in hook
    }
  };

  // Next round handler
  const handleStartNextRound = async (position: "P" | "D" | "C" | "A") => {
    try {
      await doStartNextRound(position);
      await refreshAuctionState();
      closeNextRoundModal();
    } catch {
      // Error handled in hook
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (actionsError) {
    return (
      <div className="container mx-auto p-6">
        <Alert className="mb-6">
          <AlertDescription>{actionsError}</AlertDescription>
        </Alert>
        <Button onClick={() => window.location.reload()}>{t("auction.reloadPage")}</Button>
      </div>
    );
  }

  if (!auctionState?.hasActiveRound) {
    return (
      <>
        <NoActiveRoundView isAdmin={isAdmin} teamCount={teamCount} loading={actionsLoading} onOpenNextRoundModal={openNextRoundModal} onResetAuction={resetAuction} />

        <NextRoundModal open={showNextRoundModal} onOpenChange={closeNextRoundModal} nextRoundStats={nextRoundStats} onStartNextRound={handleStartNextRound} loading={actionsLoading} />
      </>
    );
  }

  const { currentRound, availablePlayers, userSelection } = auctionState;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Asta */}
      <AuctionHeader currentRound={currentRound!} isConnected={isConnected} isSyncing={isSyncing} connectedUsers={connectedUsers} />

      {/* Stato Utente */}
      <AuctionStatusCard userSelection={userSelection} />

      {/* Player Selection Table - Only show when in SELECTION mode and no user selection */}
      {!userSelection && currentRound!.status === "SELECTION" && (
        <PlayerSelectionTable players={availablePlayers} selectedPlayerId={selectedPlayer} onPlayerSelect={setSelectedPlayer} onPlayerConfirm={selectPlayer} isSelecting={isSelecting} />
      )}

      {/* Selezioni Attuali */}
      <CurrentSelectionsCard selections={currentRound!.selections} />

      {/* Controlli Admin */}
      {isAdmin && currentRound!.status === "RESOLUTION" && <AdminControlsCard onResolveRound={handleResolveRound} loading={actionsLoading} />}

      {/* Pannello Controllo Admin Avanzato */}
      {isAdmin && auctionState && (
        <AdminControlPanel
          leagueId={leagueId}
          currentRound={currentRound || undefined}
          teams={auctionState.teams || []}
          availablePlayers={availablePlayers}
          selections={currentRound?.selections || []}
          config={auctionState.config}
        />
      )}

      {/* Modal Risoluzione Conflitti */}
      <ConflictResolutionModal
        open={showConflictModal}
        onOpenChange={(open) => {
          if (open) return;
          closeConflictModal();
          refreshAuctionState();
        }}
        conflicts={conflictData?.conflicts || []}
        roundContinues={conflictData?.roundContinues || false}
      />
    </div>
  );
}
