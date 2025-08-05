"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { League, useLeague } from "@/hooks/useLeague";
import { TeamWithPlayers } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Trophy, Crown, UserCheck, FileText, Gavel, Bot } from "lucide-react";
import { Link, redirect } from "@/i18n/navigation";
import { LeagueDetailSkeleton } from "@/components/ui/league-detail-skeleton";
import BotManagementTab from "@/components/auction/BotManagementTab";

export default function LeagueDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const leagueId = params.id as string;
  const locale = params.locale as string;
  const t = useTranslations();
  const { league, userTeam, isAdmin, loading, fetchLeague } = useLeague(leagueId);

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect({ href: "/api/auth/signin", locale });
    }
    if (status === "authenticated" && leagueId) {
      fetchLeague();
    }
  }, [status, leagueId, fetchLeague, locale]);

  const getStatusBadge = (status: League["status"]) => {
    const variants = {
      SETUP: "default",
      AUCTION: "secondary",
      COMPLETED: "outline",
    } as const;

    const labels = {
      SETUP: t("leagues.status.setup"),
      AUCTION: t("leagues.status.auction"),
      COMPLETED: t("leagues.status.completed"),
    };

    return <Badge variant={variants[status]}>{labels[status]}</Badge>;
  };

  const getPositionBadge = (position: "P" | "D" | "C" | "A") => {
    const colors = {
      P: "bg-green-100 text-green-800",
      D: "bg-blue-100 text-blue-800",
      C: "bg-yellow-100 text-yellow-800",
      A: "bg-red-100 text-red-800",
    };

    return <Badge className={colors[position]}>{position}</Badge>;
  };

  const getRosterComposition = (team: TeamWithPlayers) => {
    const composition = { P: 0, D: 0, C: 0, A: 0 };
    team.teamPlayers.forEach((tp) => {
      composition[tp.player.position]++;
    });
    return composition;
  };

  const isRosterComplete = (composition: { P: number; D: number; C: number; A: number }) => {
    return composition.P === 3 && composition.D === 8 && composition.C === 8 && composition.A === 6;
  };

  if (status === "loading" || loading || !league) {
    return <LeagueDetailSkeleton />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header Lega */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">{league.name}</h1>
          <div className="flex items-center gap-4 text-muted-foreground">
            <span>
              {t("leagues.admin")}: {league.admin.name}
            </span>
            <span>•</span>
            <span>
              {league._count.teams}/8 {t("leagues.teams")}
            </span>
            <span>•</span>
            <span>
              {league.credits} {t("leagues.initialCredits")}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(league.status)}
          <Link href={`/leagues/${league.id}/players`}>
            <Button variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              {t("navigation.players")}
            </Button>
          </Link>
          <Link href={`/leagues/${league.id}/auction`}>
            <Button variant={league.status === "AUCTION" ? "default" : "outline"}>
              <Gavel className="mr-2 h-4 w-4" />
              {t("navigation.auction")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Info Utente */}
      {userTeam && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              {t("leagues.details.yourTeam", { teamName: userTeam.name })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{userTeam.remainingCredits}</div>
                <div className="text-sm text-muted-foreground">{t("leagues.details.creditsRemaining")}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{userTeam.teamPlayers.length}</div>
                <div className="text-sm text-muted-foreground">{t("leagues.details.playersTotal")}</div>
              </div>
              {(() => {
                const composition = getRosterComposition(userTeam);
                const isComplete = isRosterComplete(composition);
                return (
                  <>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{composition.P + composition.D + composition.C + composition.A}/25</div>
                      <div className="text-sm text-muted-foreground">{t("common.total")}</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${isComplete ? "text-green-600" : "text-orange-600"}`}>{isComplete ? "✓" : "○"}</div>
                      <div className="text-sm text-muted-foreground">{t("common.complete")}</div>
                    </div>
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configurazione Bot per Testing (solo admin e setup) */}
      {isAdmin && league.status === "SETUP" && (
        <Card className="mb-6 border-blue-200 bg-blue-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <Bot className="h-5 w-5" />
              {t("leagues.details.testingMode")}
            </CardTitle>
            <CardDescription>{t("leagues.details.testingModeDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <BotManagementTab leagueId={leagueId} />
          </CardContent>
        </Card>
      )}

      {/* Lista Squadre */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {league.teams.map((team) => {
          const composition = getRosterComposition(team);
          const isComplete = isRosterComplete(composition);
          const isCurrentUser = team.user.email === session?.user?.email;

          return (
            <Card key={team.id} className={`hover:shadow-lg transition-shadow ${isCurrentUser ? "ring-2 ring-primary" : ""}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {team.name}
                      {team.user.email === league.admin.email && <Crown className="h-4 w-4 text-yellow-500" />}
                      {isCurrentUser && <Badge variant="secondary">{t("roster.yourTeam")}</Badge>}
                    </CardTitle>
                    <CardDescription>{team.user.name}</CardDescription>
                  </div>
                  <Badge variant={isComplete ? "default" : "outline"}>{isComplete ? t("leagues.details.rosterComplete") : t("leagues.details.rosterInProgress")}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Crediti */}
                  <div className="flex justify-between">
                    <span>{t("leagues.details.creditsRemaining")}:</span>
                    <span className="font-semibold">{team.remainingCredits}</span>
                  </div>

                  {/* Composizione Rosa */}
                  <div>
                    <div className="text-sm font-medium mb-2">{t("leagues.details.rosterComposition")}</div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="space-y-1">
                        {getPositionBadge("P")}
                        <div className={`text-sm ${composition.P === 3 ? "text-green-600 font-semibold" : ""}`}>{composition.P}/3</div>
                      </div>
                      <div className="space-y-1">
                        {getPositionBadge("D")}
                        <div className={`text-sm ${composition.D === 8 ? "text-green-600 font-semibold" : ""}`}>{composition.D}/8</div>
                      </div>
                      <div className="space-y-1">
                        {getPositionBadge("C")}
                        <div className={`text-sm ${composition.C === 8 ? "text-green-600 font-semibold" : ""}`}>{composition.C}/8</div>
                      </div>
                      <div className="space-y-1">
                        {getPositionBadge("A")}
                        <div className={`text-sm ${composition.A === 6 ? "text-green-600 font-semibold" : ""}`}>{composition.A}/6</div>
                      </div>
                    </div>
                  </div>

                  {/* Totale Calciatori */}
                  <div className="flex justify-between text-sm">
                    <span>
                      {t("common.total")} {t("navigation.players")}:
                    </span>
                    <span>{team.teamPlayers.length}/25</span>
                  </div>
                </div>

                <div className="mt-4">
                  <Link href={`/leagues/${league.id}/roster`}>
                    <Button size="sm" variant="outline" className="w-full">
                      <Trophy className="mr-2 h-3 w-3" />
                      {t("leagues.details.viewRoster")}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Messaggio se nessuna squadra */}
      {league.teams.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t("leagues.details.noTeamsTitle")}</h3>
            <p className="text-muted-foreground">{t("leagues.details.noTeamsDescription")}</p>
          </CardContent>
        </Card>
      )}

      {/* ID Lega per condivisione */}
      <Card className="mt-6">
        <CardContent className="py-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium">{t("leagues.details.shareId")}</div>
              <div className="text-sm text-muted-foreground">{t("leagues.details.shareIdDescription")}</div>
            </div>
            <div className="font-mono text-lg bg-muted px-3 py-1 rounded">{league.id}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
