"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useLeague } from "@/hooks/useLeague";
import { useSocketIO } from "@/hooks/useSocketIO";
import { TeamWithPlayers } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Users, Search, Filter, Trash2 } from "lucide-react";
import { TeamLogo } from "@/components/ui/team-logo";
import { Link } from "@/i18n/navigation";
import { redirect } from "@/i18n/navigation";
import { toast } from "sonner";

export default function RosterPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const leagueId = params.id as string;
  const locale = params.locale as string;
  const t = useTranslations();
  const { league, userTeam, loading, fetchLeague } = useLeague(leagueId);
  const { socket } = useSocketIO({ 
    leagueId,
    userId: session?.user?.email || undefined,
    userName: session?.user?.name || undefined,
    enabled: !!leagueId && status === "authenticated"
  });
  const [selectedTeam, setSelectedTeam] = useState<TeamWithPlayers | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState<"all" | "P" | "D" | "C" | "A">("all");
  const [deletingPlayerId, setDeletingPlayerId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect({ href: "/api/auth/signin", locale });
    }
    if (status === "authenticated" && leagueId) {
      fetchLeague();
    }
  }, [status, leagueId, fetchLeague, locale]);

  // Imposta la squadra dell'utente corrente come default quando la lega è caricata
  useEffect(() => {
    if (league && !selectedTeam) {
      if (userTeam) {
        setSelectedTeam(userTeam);
      } else if (league.teams.length > 0) {
        setSelectedTeam(league.teams[0]);
      }
    }
  }, [league, userTeam, selectedTeam]);

  // Aggiorna la squadra selezionata quando la lega cambia (dopo delete)
  useEffect(() => {
    if (league && selectedTeam) {
      const updatedTeam = league.teams.find((team) => team.id === selectedTeam.id);
      if (updatedTeam) {
        setSelectedTeam(updatedTeam);
      }
    }
  }, [league, selectedTeam]);

  // Socket.io listener per aggiornamenti real-time dell'asta
  useEffect(() => {
    if (!socket || !leagueId) return;

    const handlePlayerSelected = () => {
      // Aggiorna i dati della lega quando viene selezionato un calciatore
      fetchLeague();
    };

    const handleRoundResolved = () => {
      // Aggiorna i dati della lega quando viene risolto un turno
      fetchLeague();
    };

    const handleAuctionStateUpdate = () => {
      // Aggiorna i dati della lega per qualsiasi cambio di stato
      fetchLeague();
    };

    // Ascolta gli eventi Socket.io
    socket.on("player-selected", handlePlayerSelected);
    socket.on("round-resolved", handleRoundResolved);
    socket.on("auction-state-update", handleAuctionStateUpdate);

    return () => {
      socket.off("player-selected", handlePlayerSelected);
      socket.off("round-resolved", handleRoundResolved);
      socket.off("auction-state-update", handleAuctionStateUpdate);
    };
  }, [socket, leagueId, fetchLeague]);

  const isAdmin = league?.admin?.email === session?.user?.email;

  const handleDeletePlayer = async (playerId: string) => {
    if (!selectedTeam || !isAdmin) return;

    setDeletingPlayerId(playerId);

    try {
      const response = await fetch(`/api/teams/${selectedTeam.id}/players/${playerId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore durante la rimozione del calciatore");
      }

      const result = await response.json();

      toast.success(
        t("roster.deleteSuccessDescription", {
          playerName: result.player.name,
          teamName: selectedTeam.name,
        })
      );

      // Aggiorna la lega per riflettere le modifiche
      await fetchLeague();
    } catch (error) {
      console.error("Errore rimozione calciatore:", error);
      toast.error(error instanceof Error ? error.message : t("roster.deleteErrorDescription"));
    } finally {
      setDeletingPlayerId(null);
    }
  };

  const getPositionBadge = (position: "P" | "D" | "C" | "A") => {
    const colors = {
      P: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      D: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      C: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
      A: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    };

    return <Badge className={colors[position]}>{position}</Badge>;
  };

  const getRosterComposition = (team: TeamWithPlayers) => {
    const composition = { P: 0, D: 0, C: 0, A: 0 };
    let totalSpent = 0;
    team.teamPlayers.forEach((tp) => {
      composition[tp.player.position]++;
      totalSpent += tp.player.price;
    });
    return { ...composition, totalSpent };
  };

  const getFilteredPlayers = () => {
    if (!selectedTeam) return [];

    let players = selectedTeam.teamPlayers.map((tp) => tp.player);

    // Filtro per posizione
    if (positionFilter !== "all") {
      players = players.filter((player) => player.position === positionFilter);
    }

    // Filtro per nome
    if (searchTerm) {
      players = players.filter((player) => player.name.toLowerCase().includes(searchTerm.toLowerCase()) || player.realTeam.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    return players.sort((a, b) => {
      // Ordina per posizione, poi per nome
      if (a.position !== b.position) {
        const positions = ["P", "D", "C", "A"];
        return positions.indexOf(a.position) - positions.indexOf(b.position);
      }
      return a.name.localeCompare(b.name);
    });
  };

  if (status === "loading" || loading) {
    return <div className="flex justify-center items-center min-h-screen">{t("common.loading")}</div>;
  }

  if (!league) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-semibold mb-2">{t("roster.leagueNotFoundTitle")}</h3>
            <p className="text-muted-foreground">{t("roster.leagueNotFoundDescription")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredPlayers = getFilteredPlayers();
  const composition = selectedTeam ? getRosterComposition(selectedTeam) : { P: 0, D: 0, C: 0, A: 0, totalSpent: 0 };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/leagues/${leagueId}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("roster.backToLeague")}
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{t("roster.rosterTitle", { leagueName: league.name })}</h1>
          <p className="text-muted-foreground">{t("roster.rosterDescription")}</p>
        </div>
      </div>

      {/* Team Selector */}
      <div className="mb-6">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">{t("roster.selectTeam")}</label>
                <Select
                  value={selectedTeam?.id || ""}
                  onValueChange={(teamId) => {
                    const team = league.teams.find((team) => team.id === teamId);
                    if (team) setSelectedTeam(team);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("roster.selectTeamDescription")} />
                  </SelectTrigger>
                  <SelectContent>
                    {league.teams.map((team) => {
                      const totalPlayers = team.teamPlayers.length;
                      const isUserTeam = team.user.email === session?.user?.email;

                      return (
                        <SelectItem key={team.id} value={team.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{team.name}</span>
                            {isUserTeam && (
                              <Badge variant="secondary" className="text-xs">
                                {t("roster.yourTeam")}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground ml-auto">
                              ({totalPlayers}/25)
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contenuto Principale */}
      <div className="space-y-6">
        {selectedTeam ? (
          <>
            {/* Info Squadra */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      {selectedTeam.name}
                    </CardTitle>
                    <CardDescription>{t("roster.owner", { name: selectedTeam.user.name || selectedTeam.user.email })}</CardDescription>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">{t("roster.creditsSpent")}</div>
                      <div className="text-3xl font-bold text-red-600">{composition.totalSpent}M</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">{t("roster.creditsRemaining")}</div>
                      <div className="text-3xl font-bold text-green-600">{selectedTeam.remainingCredits}M</div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div className="space-y-2">
                    {getPositionBadge("P")}
                    <div className={`text-lg font-bold ${composition.P === 3 ? "text-green-600" : "text-orange-600"}`}>{composition.P}/3</div>
                    <div className="text-xs text-muted-foreground">{t("roster.positions.P")}</div>
                  </div>
                  <div className="space-y-2">
                    {getPositionBadge("D")}
                    <div className={`text-lg font-bold ${composition.D === 8 ? "text-green-600" : "text-orange-600"}`}>{composition.D}/8</div>
                    <div className="text-xs text-muted-foreground">{t("roster.positions.D")}</div>
                  </div>
                  <div className="space-y-2">
                    {getPositionBadge("C")}
                    <div className={`text-lg font-bold ${composition.C === 8 ? "text-green-600" : "text-orange-600"}`}>{composition.C}/8</div>
                    <div className="text-xs text-muted-foreground">{t("roster.positions.C")}</div>
                  </div>
                  <div className="space-y-2">
                    {getPositionBadge("A")}
                    <div className={`text-lg font-bold ${composition.A === 6 ? "text-green-600" : "text-orange-600"}`}>{composition.A}/6</div>
                    <div className="text-xs text-muted-foreground">{t("roster.positions.A")}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Filtri */}
            <Card>
              <CardContent className="py-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input placeholder={t("roster.searchPlaceholder")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                    </div>
                  </div>
                  <Select value={positionFilter} onValueChange={(value: "all" | "P" | "D" | "C" | "A") => setPositionFilter(value)}>
                    <SelectTrigger className="w-40">
                      <Filter className="mr-2 h-4 w-4" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("roster.allPositions")}</SelectItem>
                      <SelectItem value="P">{t("roster.positions.P")}</SelectItem>
                      <SelectItem value="D">{t("roster.positions.D")}</SelectItem>
                      <SelectItem value="C">{t("roster.positions.C")}</SelectItem>
                      <SelectItem value="A">{t("roster.positions.A")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Lista Calciatori */}
            <Card>
              <CardHeader>
                <CardTitle>{t("roster.rosterPlayers", { count: filteredPlayers.length })}</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredPlayers.length > 0 ? (
                  <div className="grid gap-2">
                    {filteredPlayers.map((player) => (
                      <div key={player.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                          {getPositionBadge(player.position)}
                          <div>
                            <div className="font-semibold">{player.name}</div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <TeamLogo teamName={player.realTeam} size={16} />
                              <span>{player.realTeam}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="font-semibold">{player.price}M</div>
                            <div className="text-xs text-muted-foreground">{t("common.price")}</div>
                          </div>
                          {isAdmin && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeletePlayer(player.id)}
                              disabled={deletingPlayerId === player.id}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">{searchTerm || positionFilter !== "all" ? t("roster.noPlayersFound") : t("roster.noPlayersInRoster")}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t("roster.selectTeamTitle")}</h3>
              <p className="text-muted-foreground">{t("roster.selectTeamText")}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
