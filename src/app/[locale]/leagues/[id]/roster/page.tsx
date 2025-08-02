"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { useLeague, Team } from "@/hooks/useLeague";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Users, Search, Filter } from "lucide-react";
import { TeamLogo } from "@/components/ui/team-logo";
import { Link } from "@/i18n/navigation";
import { redirect } from "@/i18n/navigation";

export default function RosterPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const leagueId = params.id as string;
  const locale = params.locale as string;
  const { league, userTeam, loading, fetchLeague } = useLeague(leagueId);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState<"all" | "P" | "D" | "C" | "A">("all");

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect({ href: "/api/auth/signin", locale });
    }
    if (status === "authenticated" && leagueId) {
      fetchLeague();
    }
  }, [status, leagueId, fetchLeague]);

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

  const getPositionBadge = (position: "P" | "D" | "C" | "A") => {
    const colors = {
      P: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      D: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      C: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
      A: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    };

    return <Badge className={colors[position]}>{position}</Badge>;
  };

  const getRosterComposition = (team: Team) => {
    const composition = { P: 0, D: 0, C: 0, A: 0 };
    team.teamPlayers.forEach((tp) => {
      composition[tp.player.position]++;
    });
    return composition;
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
    return <div className="flex justify-center items-center min-h-screen">Caricamento...</div>;
  }

  if (!league) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-semibold mb-2">Lega Non Trovata</h3>
            <p className="text-muted-foreground">La lega richiesta non esiste o non hai i permessi per visualizzarla.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredPlayers = getFilteredPlayers();
  const composition = selectedTeam ? getRosterComposition(selectedTeam) : { P: 0, D: 0, C: 0, A: 0 };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/leagues/${leagueId}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Torna alla Lega
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{league.name} - Rose</h1>
          <p className="text-muted-foreground">Visualizza e gestisci le rose delle squadre</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Sidebar Squadre */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Squadre</CardTitle>
              <CardDescription>Seleziona una squadra per visualizzare la rosa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {league.teams.map((team) => {
                const teamComposition = getRosterComposition(team);
                const totalPlayers = team.teamPlayers.length;
                const isSelected = selectedTeam?.id === team.id;
                const isUserTeam = team.user.email === session?.user?.email;

                return (
                  <Button key={team.id} variant={isSelected ? "default" : "outline"} className="w-full justify-start h-auto p-3" onClick={() => setSelectedTeam(team)}>
                    <div className="text-left w-full">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold">{team.name}</span>
                        {isUserTeam && <Badge variant="secondary">Tu</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">{team.user.name}</div>
                      <div className="text-xs mt-1">{totalPlayers}/25 calciatori</div>
                      <div className="flex gap-1 mt-1">
                        <span className="text-xs">P:{teamComposition.P}</span>
                        <span className="text-xs">D:{teamComposition.D}</span>
                        <span className="text-xs">C:{teamComposition.C}</span>
                        <span className="text-xs">A:{teamComposition.A}</span>
                      </div>
                    </div>
                  </Button>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Contenuto Principale */}
        <div className="lg:col-span-3 space-y-6">
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
                      <CardDescription>
                        Proprietario: {selectedTeam.user.name} | Crediti rimasti: {selectedTeam.remainingCredits}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div className="space-y-2">
                      {getPositionBadge("P")}
                      <div className={`text-lg font-bold ${composition.P === 3 ? "text-green-600" : "text-orange-600"}`}>{composition.P}/3</div>
                      <div className="text-xs text-muted-foreground">Portieri</div>
                    </div>
                    <div className="space-y-2">
                      {getPositionBadge("D")}
                      <div className={`text-lg font-bold ${composition.D === 8 ? "text-green-600" : "text-orange-600"}`}>{composition.D}/8</div>
                      <div className="text-xs text-muted-foreground">Difensori</div>
                    </div>
                    <div className="space-y-2">
                      {getPositionBadge("C")}
                      <div className={`text-lg font-bold ${composition.C === 8 ? "text-green-600" : "text-orange-600"}`}>{composition.C}/8</div>
                      <div className="text-xs text-muted-foreground">Centrocampisti</div>
                    </div>
                    <div className="space-y-2">
                      {getPositionBadge("A")}
                      <div className={`text-lg font-bold ${composition.A === 6 ? "text-green-600" : "text-orange-600"}`}>{composition.A}/6</div>
                      <div className="text-xs text-muted-foreground">Attaccanti</div>
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
                        <Input placeholder="Cerca per nome o squadra..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                      </div>
                    </div>
                    <Select value={positionFilter} onValueChange={(value: "all" | "P" | "D" | "C" | "A") => setPositionFilter(value)}>
                      <SelectTrigger className="w-40">
                        <Filter className="mr-2 h-4 w-4" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutte le posizioni</SelectItem>
                        <SelectItem value="P">Portieri</SelectItem>
                        <SelectItem value="D">Difensori</SelectItem>
                        <SelectItem value="C">Centrocampisti</SelectItem>
                        <SelectItem value="A">Attaccanti</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Lista Calciatori */}
              <Card>
                <CardHeader>
                  <CardTitle>Rosa - {filteredPlayers.length} calciatori</CardTitle>
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
                          <div className="text-right">
                            <div className="font-semibold">{player.price}M</div>
                            <div className="text-xs text-muted-foreground">Prezzo</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">{searchTerm || positionFilter !== "all" ? "Nessun calciatore trovato con i filtri selezionati" : "Nessun calciatore in rosa"}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Seleziona una Squadra</h3>
                <p className="text-muted-foreground">Scegli una squadra dalla lista a sinistra per visualizzare la sua rosa.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
