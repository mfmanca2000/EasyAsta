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
        duration: 0, // Keep until manually dismissed
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
  });

  const checkIfAdmin = useCallback(async () => {
    try {
      const response = await fetch(`/api/leagues/${leagueId}`);
      const data = await response.json();

      if (response.ok && data.league) {
        setIsAdmin(data.league.admin.email === session?.user?.email);
        setTeamCount(data.league.teams?.length || 0);
      }
    } catch (error) {
      console.error(t("errors.verifyAdmin"), error);
    }
  }, [leagueId, session?.user?.email, t]);

  useEffect(() => {
    if (session && leagueId) {
      checkIfAdmin().finally(() => setLoading(false));
    }
  }, [session, leagueId, checkIfAdmin]);

  const startAuction = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/auction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t("errors.startAuctionError"));
      }

      await refreshAuctionState();
    } catch (error) {
      setError(error instanceof Error ? error.message : t("errors.startAuctionError"));
    } finally {
      setLoading(false);
    }
  };

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
            <CardDescription>{auctionState ? t("auction.noActiveRound") : t("auction.notStarted")}</CardDescription>
          </CardHeader>
          <CardContent>
            {isAdmin ? (
              <div className="space-y-4">
                {!auctionState ? (
                  <>
                    {teamCount < 4 && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800">{t("auction.insufficientTeams", { count: teamCount })}</p>
                      </div>
                    )}
                    <Button onClick={startAuction} disabled={loading || teamCount < 4}>
                      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      {t("auction.startAuction")}
                    </Button>
                  </>
                ) : (
                  <>
                    {teamCount < 4 && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800">{t("auction.insufficientTeamsContinue", { count: teamCount })}</p>
                      </div>
                    )}
                    <p className="text-muted-foreground mb-4">{t("auction.roundCompleted")}</p>
                    <Button
                      onClick={async () => {
                        await fetchNextRoundStats();
                        setShowNextRoundModal(true);
                      }}
                      disabled={loading || teamCount < 4}
                    >
                      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      {t("auction.startNextRound")}
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">{t("auction.waitForAdmin", { action: auctionState ? t("auction.startNextRoundAction") : t("auction.startAuctionAction") })}</p>
            )}
          </CardContent>
        </Card>
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
        <Card>
          <CardHeader>
            <CardTitle>{t("auction.selectPlayer")}</CardTitle>
            <CardDescription>{t("auction.selectPlayerDescription", { position: t(`auction.positionsSingular.${currentRound!.position}`) })}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availablePlayers.map((player) => (
                <Card
                  key={player.id}
                  className={`cursor-pointer transition-colors ${selectedPlayer === player.id ? "ring-2 ring-blue-500" : "hover:bg-gray-50"}`}
                  onClick={() => setSelectedPlayer(player.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold">{player.name}</h3>
                      <Badge variant="outline">{player.position}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{player.realTeam}</p>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-sm font-medium">
                        <Coins className="w-3 h-3" />
                        {player.price}
                      </span>
                      {selectedPlayer === player.id && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectPlayer(player.id);
                          }}
                          disabled={isSelecting}
                        >
                          {isSelecting && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                          {t("auction.selectButton")}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
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

      {/* Modal Scelta Prossimo Ruolo */}
      <Dialog open={showNextRoundModal} onOpenChange={setShowNextRoundModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("auction.chooseNextRole")}</DialogTitle>
            <DialogDescription>{t("auction.chooseNextRoleDescription")}</DialogDescription>
          </DialogHeader>

          {nextRoundStats && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                {(["P", "D", "C", "A"] as const).map((position) => {
                  const positionName = t(`auction.positions.${position}`);
                  const isRecommended = nextRoundStats.recommendations[position];

                  return (
                    <Card key={position} className={`cursor-pointer transition-colors ${isRecommended ? "ring-2 ring-green-500" : ""}`}>
                      <CardContent className="p-4 text-center">
                        <div className="space-y-2">
                          <Badge variant={isRecommended ? "default" : "outline"}>{position}</Badge>
                          <h3 className="font-medium text-sm">{positionName}</h3>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div>{t("auction.needed", { count: nextRoundStats.globalNeeds[position] })}</div>
                            <div>{t("auction.availableCount", { count: nextRoundStats.availableByPosition[position] })}</div>
                          </div>
                          <Button size="sm" variant={isRecommended ? "default" : "outline"} disabled={!isRecommended || loading} onClick={() => startNextRound(position)} className="w-full">
                            {loading && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                            {t("auction.startRound")}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Dettaglio squadre */}
              <div className="mt-6">
                <h4 className="font-medium mb-3">{t("auction.teamsSituation")}</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {nextRoundStats.teamStats.map((team, index: number) => (
                    <div key={index} className="flex items-center justify-between text-sm p-2 border rounded">
                      <span className="font-medium">{team.teamName}</span>
                      <div className="flex gap-2 text-xs">
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
