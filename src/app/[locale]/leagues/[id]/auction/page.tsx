"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useAuctionRealtime } from "@/hooks/useAuctionRealtime";
import { useToast } from "@/components/ui/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Users, Clock, Trophy, Coins } from "lucide-react";
import AdminControlPanel from "@/components/auction/AdminControlPanel";
import ConflictResolutionModal from "@/components/auction/ConflictResolutionModal";
import PlayerSelectionTable from "@/components/auction/PlayerSelectionTable";

interface NextRoundStats {
  teamStats: Array<{
    teamName: string;
    userName: string;
    composition: { P: number; D: number; C: number; A: number };
    needs: { P: number; D: number; C: number; A: number };
  }>;
  globalNeeds: { P: number; D: number; C: number; A: number };
  availableByPosition: { P: number; D: number; C: number; A: number };
  recommendations: { P: boolean; D: boolean; C: boolean; A: boolean };
}

interface ConflictData {
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
}

// Position names will be handled by translations

export default function AuctionPage() {
  const params = useParams();
  const { data: session } = useSession();
  const t = useTranslations();
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [nextRoundStats, setNextRoundStats] = useState<NextRoundStats | null>(null);
  const [showNextRoundModal, setShowNextRoundModal] = useState(false);
  const [teamCount, setTeamCount] = useState(0);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictData, setConflictData] = useState<ConflictData | null>(null);

  const leagueId = params.id as string;
  const { addToast } = useToast();

  // Use real-time auction hook instead of polling
  const { auctionState, connectedUsers, isConnected, isSyncing, refreshAuctionState } = useAuctionRealtime({
    leagueId,
    userId: session?.user?.id || undefined,
    userName: session?.user?.name || session?.user?.email || undefined,
    onPlayerSelected: (data) => {
      console.log("Player selected in real-time:", data);
      const { selection } = data;
      addToast({
        type: "info",
        title: t("auction.playerSelectedToast"),
        description: `${selection.user.name} → ${selection.player.name}`,
        duration: 3000,
      });
    },
    onAdminPlayerSelected: (data) => {
      console.log("Admin player selected in real-time:", data);
      const { selection, targetTeam } = data;
      addToast({
        type: "info",
        title: t("auction.adminPlayerSelectedToast"),
        description: `Admin → ${selection.player.name} per ${targetTeam.name}`,
        duration: 4000,
      });
    },
    onRoundResolved: (data) => {
      console.log("Round resolved in real-time:", data);
      addToast({
        type: "success",
        title: t("auction.roundResolvedToast"),
        description: t("auction.roundResolvedDescription"),
        duration: 4000,
      });
      if (data.canContinue) {
        fetchNextRoundStats().then(() => {
          setShowNextRoundModal(true);
        });
      }
    },
    onAuctionStarted: (data) => {
      console.log("Auction started in real-time:", data);
      addToast({
        type: "success",
        title: t("auction.auctionStartedToast"),
        description: t("auction.auctionStartedDescription"),
        duration: 5000,
      });
    },
    onNextRoundStarted: (data) => {
      console.log("Next round started in real-time:", data);
      addToast({
        type: "info",
        title: t("auction.nextRoundStartedToast"),
        description: `${data.message}`,
        duration: 4000,
      });
      setShowNextRoundModal(false);
    },
    onRoundReadyForResolution: (data) => {
      console.log("Round ready for resolution:", data);
      addToast({
        type: "warning",
        title: t("auction.roundReadyToast"),
        description: t("auction.roundReadyDescription"),
        duration: 6000, // Auto close after 6 seconds
      });
    },
    onUserJoined: (user) => {
      console.log("User joined:", user);
      // Optional: Show toast for user joined
    },
    onUserLeft: (user) => {
      console.log("User left:", user);
      // Optional: Show toast for user left
    },
    onUserDisconnected: (user) => {
      console.log("User disconnected:", user);
      addToast({
        type: "info",
        title: "Utente Disconnesso",
        description: `${user.name} si è disconnesso`,
        duration: 3000,
      });
    },
    onUserTimeout: (user) => {
      console.log("User timed out:", user);
      addToast({
        type: "warning",
        title: "Utente Inattivo",
        description: `${user.name} è stato disconnesso per inattività`,
        duration: 4000,
      });
    },
    onConflictResolution: (data) => {
      console.log("Conflict resolution:", data);
      setConflictData(data);
      setShowConflictModal(true);
    },
    onRoundContinues: (data) => {
      console.log("Round continues:", data);
      addToast({
        type: "info",
        title: t("auction.roundContinues"),
        description: data.message,
        duration: 4000,
      });
    },
  });

  const checkIfAdmin = useCallback(async () => {
    try {
      const response = await fetch(`/api/leagues/${leagueId}`);
      const data = await response.json();

      if (response.ok && data.league) {
        const adminCheck = data.league.admin.id === session?.user?.id;
        const teamsCount = data.league.teams?.length || 0;
        setIsAdmin(adminCheck);
        setTeamCount(teamsCount);
      }
    } catch (error) {
      console.error(t("errors.verifyAdmin"), error);
    }
  }, [leagueId, session?.user?.id, t]);

  useEffect(() => {
    if (session && leagueId) {
      checkIfAdmin().finally(() => setLoading(false));
    }
  }, [session, leagueId, checkIfAdmin]);

  const selectPlayer = async (playerId: string) => {
    if (!auctionState?.currentRound || isSelecting) return;

    try {
      setIsSelecting(true);
      const response = await fetch("/api/auction/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundId: auctionState.currentRound.id,
          playerId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t("errors.selectPlayerError"));
      }

      await refreshAuctionState();
      setSelectedPlayer(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : t("errors.selectPlayerError"));
    } finally {
      setIsSelecting(false);
    }
  };

  const resolveRound = async () => {
    if (!auctionState?.currentRound) return;

    try {
      setLoading(true);
      const response = await fetch("/api/auction/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundId: auctionState.currentRound.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t("errors.resolveRoundError"));
      }

      await refreshAuctionState();

      // Se l'asta può continuare, mostra il modal per scegliere il prossimo ruolo
      if (data.canContinue) {
        await fetchNextRoundStats();
        setShowNextRoundModal(true);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : t("errors.resolveRoundError"));
    } finally {
      setLoading(false);
    }
  };

  const fetchNextRoundStats = async () => {
    try {
      const response = await fetch(`/api/auction/next-round?leagueId=${leagueId}`);
      const data = await response.json();

      if (response.ok) {
        setNextRoundStats(data);
      }
    } catch (error) {
      console.error(t("errors.loadingStats"), error);
    }
  };

  const startNextRound = async (position: "P" | "D" | "C" | "A") => {
    try {
      setLoading(true);

      // First, check if we need to start the auction (if league is still in SETUP)
      // We need to check the current league status
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

      setShowNextRoundModal(false);
      await refreshAuctionState();
    } catch (error) {
      setError(error instanceof Error ? error.message : t("errors.nextRoundError"));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => window.location.reload()}>{t("auction.reloadPage")}</Button>
      </div>
    );
  }

  if (!auctionState?.hasActiveRound) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              {t("auction.title")}
            </CardTitle>
            <CardDescription>{t("auction.noActiveRound")}</CardDescription>
          </CardHeader>
          <CardContent>
            {isAdmin ? (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-bold text-sm">+</span>
                    </div>
                    <h3 className="font-semibold text-lg">{t("auction.continueAuction")}</h3>
                  </div>

                  {teamCount < 4 && (
                    <Alert>
                      <AlertDescription>{t("auction.insufficientTeams", { count: teamCount })}</AlertDescription>
                    </Alert>
                  )}

                  <p className="text-muted-foreground text-sm">{t("auction.chooseNextRoleTooltip")}</p>

                  <Button
                    onClick={async () => {
                      try {
                        await fetchNextRoundStats();
                        setShowNextRoundModal(true);
                      } catch (error) {
                        console.error("Error in next round flow:", error);
                      }
                    }}
                    disabled={loading || teamCount < 4}
                    size="lg"
                    className="w-full"
                  >
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <Trophy className="w-4 h-4 mr-2" />
                    {t("auction.startNextRound")}
                  </Button>
                </div>

                {/* Sezione Reset - Solo se asta già iniziata */}
                {
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                        <span className="text-red-600 font-bold text-xs">!</span>
                      </div>
                      <h4 className="font-medium text-sm text-red-700">{t("auction.dangerZone")}</h4>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={async () => {
                        if (confirm(t("auction.resetConfirmation"))) {
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
                        }
                      }}
                      disabled={loading}
                      className="w-full"
                    >
                      🗑️ {t("auction.resetComplete")}
                    </Button>
                  </div>
                }
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-muted-foreground">
                  {t("auction.waitForAdmin", {
                    action: t("auction.startNextRoundAction"),
                  })}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal Scelta Prossimo Ruolo */}
        <Dialog open={showNextRoundModal} onOpenChange={setShowNextRoundModal}>
          <DialogContent className="w-full max-w-none md:max-w-[800px] max-h-[95vh] overflow-y-auto p-6">
            <DialogHeader>
              <DialogTitle>{t("auction.chooseNextRole")}</DialogTitle>
              <DialogDescription>{t("auction.chooseNextRoleDescription")}</DialogDescription>
            </DialogHeader>

            {nextRoundStats && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                  {(["P", "D", "C", "A"] as const).map((position) => {
                    const positionName = t(`auction.positions.${position}`);
                    const isRecommended = nextRoundStats.recommendations[position];

                    return (
                      <Card key={position} className={`cursor-pointer transition-colors ${isRecommended ? "ring-2 ring-green-500" : ""}`}>
                        <CardContent className="p-8 text-center">
                          <div className="space-y-4">
                            <Badge variant={isRecommended ? "default" : "outline"} className="text-lg px-4 py-1.5">
                              {position}
                            </Badge>
                            <h3 className="font-medium text-lg">{positionName}</h3>
                            <div className="text-sm text-muted-foreground space-y-1.5">
                              <div>{t("auction.needed", { count: nextRoundStats.globalNeeds[position] })}</div>
                              <div>{t("auction.availableCount", { count: nextRoundStats.availableByPosition[position] })}</div>
                            </div>
                            <Button
                              size="default"
                              variant={isRecommended ? "default" : "outline"}
                              disabled={!isRecommended || loading}
                              onClick={() => startNextRound(position)}
                              className="w-full h-auto py-3 px-4 text-sm whitespace-normal"
                            >
                              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                              {t("auction.startRound")}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Team details */}
                <div className="mt-8">
                  <h4 className="font-medium mb-4 text-lg">{t("auction.teamsSituation")}</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {nextRoundStats.teamStats.map((team, index: number) => (
                      <div key={index} className="flex items-center justify-between text-sm p-3 border rounded">
                        <span className="font-medium">{team.teamName}</span>
                        <div className="flex gap-3 text-xs">
                          {(["P", "D", "C", "A"] as const).map((pos) => (
                            <span key={pos} className={team.needs[pos] > 0 ? "text-orange-600 font-medium" : "text-green-600"}>
                              {pos}: {team.composition[pos]}/{pos === "P" ? 3 : pos === "A" ? 6 : 8}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const { currentRound, availablePlayers, userSelection } = auctionState;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Asta */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              {t("auction.title")} - {t(`auction.positions.${currentRound!.position}`)}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={currentRound!.status === "SELECTION" ? "default" : "secondary"}>{currentRound!.status === "SELECTION" ? t("auction.selection") : t("auction.resolution")}</Badge>
              <Badge variant={isConnected ? "default" : "destructive"} className="text-xs">
                {isSyncing ? "🔄 Syncing..." : isConnected ? "🟢 Live" : "🔴 Offline"}
              </Badge>
            </div>
          </CardTitle>
          <CardDescription className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {t("auction.round", { number: currentRound!.roundNumber })}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {t("auction.selections", { count: currentRound!.selections.length })}
            </span>
            {connectedUsers.length > 0 && (
              <span className="flex items-center gap-1 text-green-600">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                {connectedUsers.length} online
              </span>
            )}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Stato Utente */}
      {userSelection ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-green-600">{t("auction.selectedPlayer", { playerName: userSelection.player.name })}</CardTitle>
            <CardDescription>
              {userSelection.randomNumber ? t("auction.randomNumber", { number: userSelection.randomNumber, winner: userSelection.isWinner ? "🏆" : "" }) : t("auction.waitingForOthers")}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : currentRound!.status === "SELECTION" ? (
        <PlayerSelectionTable players={availablePlayers} selectedPlayerId={selectedPlayer} onPlayerSelect={setSelectedPlayer} onPlayerConfirm={selectPlayer} isSelecting={isSelecting} />
      ) : null}

      {/* Selezioni Attuali */}
      {currentRound!.selections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("auction.roundSelections")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {currentRound!.selections.map((selection) => (
                <div key={selection.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <span className="font-medium">{selection.user.name}</span>
                    <span className="mx-2">→</span>
                    <span>{selection.player.name}</span>
                    <span className="text-muted-foreground ml-2">({selection.player.realTeam})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <Coins className="w-3 h-3" />
                      {selection.player.price}
                    </span>
                    {selection.randomNumber && (
                      <Badge variant={selection.isWinner ? "default" : "secondary"}>
                        {selection.randomNumber} {selection.isWinner && "🏆"}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controlli Admin */}
      {isAdmin && currentRound!.status === "RESOLUTION" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("auction.adminControls")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={resolveRound} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("auction.resolveRound")}
            </Button>
          </CardContent>
        </Card>
      )}

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
          setShowConflictModal(open);
          // Refresh auction state when modal closes
          if (!open) {
            refreshAuctionState();
          }
        }}
        conflicts={conflictData?.conflicts || []}
        roundContinues={conflictData?.roundContinues || false}
      />
    </div>
  );
}
