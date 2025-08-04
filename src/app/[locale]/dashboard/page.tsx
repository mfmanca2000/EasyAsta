"use client";

import { useSession } from "next-auth/react";
import { redirect } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import { Users, Trophy, Clock, TrendingUp } from "lucide-react";

interface DashboardData {
  leagues: Array<{
    id: string;
    name: string;
    status: string;
    isAdmin: boolean;
    teamName?: string;
    remainingCredits?: number;
    playersCount: number;
    totalTeams: number;
    hasActiveRound: boolean;
  }>;
  activeAuctions: Array<{
    id: string;
    name: string;
    status: string;
    hasActiveRound: boolean;
  }>;
  stats: {
    totalLeagues: number;
    totalTeams: number;
    activeAuctions: number;
  };
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const locale = useLocale();
  const t = useTranslations();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) {
      fetchDashboardData();
    }
  }, [session]);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch("/api/dashboard");
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      }
    } catch (error) {
      console.error("Errore nel caricamento dati dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return <div className="text-center">{t("common.loading")}</div>;
  }

  if (!session) {
    redirect({ href: "/", locale });
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SETUP":
        return <Badge variant="secondary">{t("leagues.status.setup")}</Badge>;
      case "AUCTION":
        return (
          <Badge variant="default" className="bg-orange-500">
            {t("leagues.status.auction")}
          </Badge>
        );
      case "COMPLETED":
        return <Badge variant="outline">{t("leagues.status.completed")}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground">{t("dashboard.welcome", { name: session?.user?.name as string })}</p>
      </div>

      {/* Stats Cards */}
      {dashboardData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="flex items-center p-6">
              <Trophy className="h-8 w-8 text-yellow-500 mr-3" />
              <div>
                <p className="text-2xl font-bold">{dashboardData.stats.totalLeagues}</p>
                <p className="text-sm text-muted-foreground">{t("dashboard.totalLeagues")}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center p-6">
              <Users className="h-8 w-8 text-blue-500 mr-3" />
              <div>
                <p className="text-2xl font-bold">{dashboardData.stats.totalTeams}</p>
                <p className="text-sm text-muted-foreground">{t("dashboard.totalTeams")}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center p-6">
              <Clock className="h-8 w-8 text-green-500 mr-3" />
              <div>
                <p className="text-2xl font-bold">{dashboardData.stats.activeAuctions}</p>
                <p className="text-sm text-muted-foreground">{t("dashboard.activeAuctions")}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* My Leagues */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Trophy className="h-5 w-5 mr-2" />
              {t("dashboard.myLeagues")}
            </CardTitle>
            <CardDescription>{t("dashboard.leaguesDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {!dashboardData || dashboardData.leagues.length === 0 ? (
              <>
                <p className="text-sm text-muted-foreground mb-4">{t("dashboard.noLeagueFound")}</p>
                <Link href="/leagues">
                  <Button variant="outline" className="w-full">
                    {t("dashboard.joinLeague")}
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <div className="space-y-3 mb-4">
                  {dashboardData.leagues.slice(0, 3).map((league) => (
                    <div key={league.id} className="flex items-center justify-between p-2 rounded-lg border">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{league.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          {getStatusBadge(league.status)}
                          {league.isAdmin && (
                            <Badge variant="outline" className="text-xs">
                              Admin
                            </Badge>
                          )}
                        </div>
                        {league.teamName && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {league.teamName} • {league.remainingCredits}€ • {league.playersCount}/25
                          </p>
                        )}
                      </div>
                      <Link href={`/leagues/${league.id}`}>
                        <Button size="sm" className="bg-orange-500 hover:bg-orange-600">
                          {t("common.view")}
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
                <Link href="/leagues">
                  <Button variant="outline" className="w-full">
                    {t("dashboard.viewAllLeagues")}
                  </Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>

        {/* Active Auctions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              {t("dashboard.activeAuctions")}
            </CardTitle>
            <CardDescription>{t("dashboard.auctionsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {!dashboardData || dashboardData.activeAuctions.length === 0 ? (
              <>
                <p className="text-sm text-muted-foreground mb-4">{t("dashboard.noActiveAuction")}</p>
                <Link href="/leagues">
                  <Button variant="outline" className="w-full">
                    {t("dashboard.searchAuctions")}
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <div className="space-y-3 mb-4">
                  {dashboardData.activeAuctions.slice(0, 3).map((auction) => (
                    <div key={auction.id} className="flex items-center justify-between p-2 rounded-lg border">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{auction.name}</h4>
                        <Badge variant="default" className="bg-orange-500 mt-1">
                          {t("auction.status.active")}
                        </Badge>
                      </div>
                      <Link href={`/leagues/${auction.id}/auction`}>
                        <Button size="sm" className="bg-orange-500 hover:bg-orange-600">
                          {t("dashboard.joinAuction")}
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
                <Link href="/leagues">
                  <Button variant="outline" className="w-full">
                    {t("dashboard.viewAllAuctions")}
                  </Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              {t("dashboard.quickActions")}
            </CardTitle>
            <CardDescription>{t("dashboard.quickActionsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Link href="/leagues">
                <Button variant="outline" className="w-full justify-start">
                  <Trophy className="h-4 w-4 mr-2" />
                  {t("dashboard.browseLeagues")}
                </Button>
              </Link>
              <Link href="/leagues">
                <Button variant="outline" className="w-full justify-start">
                  <Users className="h-4 w-4 mr-2" />
                  {t("dashboard.createLeague")}
                </Button>
              </Link>
              {dashboardData && dashboardData.leagues.some((l) => l.isAdmin) && (
                <Link href="/leagues">
                  <Button variant="outline" className="w-full justify-start">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    {t("dashboard.manageLeagues")}
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
