"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Trophy } from "lucide-react";
import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { LeaguesPageSkeleton } from "@/components/ui/league-skeleton";

interface League {
  id: string;
  name: string;
  credits: number;
  status: "SETUP" | "AUCTION" | "COMPLETED";
  admin: {
    id: string;
    name: string;
    email: string;
  };
  teams: Array<{
    id: string;
    name: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
  }>;
  _count: {
    teams: number;
    players: number;
  };
}

interface CreateLeagueFormData {
  name: string;
  credits: number;
}

interface JoinLeagueFormData {
  leagueId: string;
  teamName: string;
}

export default function LeaguesPage() {
  const { data: session, status } = useSession();
  const t = useTranslations();
  const locale = useLocale();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [createFormData, setCreateFormData] = useState<CreateLeagueFormData>({
    name: "",
    credits: 500,
  });
  const [joinFormData, setJoinFormData] = useState<JoinLeagueFormData>({
    leagueId: "",
    teamName: "",
  });

  const fetchLeagues = useCallback(async () => {
    try {
      const response = await fetch("/api/leagues");
      if (response.ok) {
        const data = await response.json();
        setLeagues(data.leagues);
      }
    } catch (error) {
      console.error(t("errors.loadingLeagues"), error);
    } finally {
      setInitialLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect({ href: "/api/auth/signin", locale });
    }
    if (status === "authenticated") {
      fetchLeagues();
    }
  }, [status, locale, fetchLeagues]);

  const handleCreateLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/leagues", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createFormData),
      });

      if (response.ok) {
        setShowCreateForm(false);
        setCreateFormData({ name: "", credits: 500 });
        fetchLeagues();
      } else {
        const error = await response.json();
        alert(error.error || t("errors.creatingLeague"));
      }
    } catch (error) {
      console.error(t("errors.creatingLeague"), error);
      alert(t("errors.creatingLeague"));
    } finally {
      setLoading(false);
    }
  };

  const handleJoinLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/leagues/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(joinFormData),
      });

      if (response.ok) {
        setShowJoinForm(false);
        setJoinFormData({ leagueId: "", teamName: "" });
        fetchLeagues();
      } else {
        const error = await response.json();
        alert(error.error || t("errors.joiningLeague"));
      }
    } catch (error) {
      console.error(t("errors.joiningLeague"), error);
      alert(t("errors.joiningLeague"));
    } finally {
      setLoading(false);
    }
  };

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

  if (status === "loading" || initialLoading) {
    return <LeaguesPageSkeleton />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">{t("leagues.title")}</h1>
        <div className="flex gap-2">
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("leagues.createLeague")}
          </Button>
          <Button variant="outline" onClick={() => setShowJoinForm(true)}>
            <Users className="mr-2 h-4 w-4" />
            {t("leagues.joinLeague")}
          </Button>
        </div>
      </div>

      {/* Form Creazione Lega */}
      {showCreateForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("leagues.createNewLeague")}</CardTitle>
            <CardDescription>{t("leagues.createNewLeagueDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateLeague} className="space-y-4">
              <div>
                <Label htmlFor="name">{t("leagues.leagueName")}</Label>
                <Input
                  id="name"
                  value={createFormData.name}
                  onChange={(e) => setCreateFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder={t("leagues.leagueNamePlaceholder")}
                  required
                />
              </div>
              <div>
                <Label htmlFor="credits">{t("leagues.initialCredits")}</Label>
                <Input
                  id="credits"
                  type="number"
                  min={100}
                  max={1000}
                  value={createFormData.credits}
                  onChange={(e) => setCreateFormData((prev) => ({ ...prev, credits: parseInt(e.target.value) }))}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? t("leagues.creating") : t("leagues.createLeagueButton")}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                  {t("common.cancel")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Form Partecipazione Lega */}
      {showJoinForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("leagues.joinExistingLeague")}</CardTitle>
            <CardDescription>{t("leagues.joinExistingLeagueDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoinLeague} className="space-y-4">
              <div>
                <Label htmlFor="leagueId">{t("leagues.leagueId")}</Label>
                <Input
                  id="leagueId"
                  value={joinFormData.leagueId}
                  onChange={(e) => setJoinFormData((prev) => ({ ...prev, leagueId: e.target.value }))}
                  placeholder={t("leagues.leagueIdPlaceholder")}
                  required
                />
              </div>
              <div>
                <Label htmlFor="teamName">{t("leagues.teamName")}</Label>
                <Input
                  id="teamName"
                  value={joinFormData.teamName}
                  onChange={(e) => setJoinFormData((prev) => ({ ...prev, teamName: e.target.value }))}
                  placeholder={t("leagues.teamNamePlaceholder")}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? t("leagues.joining") : t("leagues.joinLeagueButton")}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowJoinForm(false)}>
                  {t("common.cancel")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Lista Leghe */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {leagues.map((league) => {
          const isAdmin = league.admin.id === session?.user?.id;
          const userTeam = league.teams.find((team) => team.user.email === session?.user?.email);

          return (
            <Card key={league.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{league.name}</CardTitle>
                    <CardDescription>{isAdmin ? t("leagues.admin") : userTeam ? t("leagues.team") + `: ${userTeam.name}` : t("leagues.participant")}</CardDescription>
                  </div>
                  {getStatusBadge(league.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>{t("leagues.teams")}:</span>
                    <span>{league._count.teams}/8</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("leagues.playersCount")}:</span>
                    <span>{league._count.players}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("common.credits")}:</span>
                    <span>{league.credits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("leagues.admin")}:</span>
                    <span>{league.admin.name}</span>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <Link href={`/leagues/${league.id}`}>
                    <Button size="sm">
                      <Trophy className="mr-2 h-3 w-3" />
                      {isAdmin ? t("common.manage") : t("common.view")}
                    </Button>
                  </Link>
                </div>

                <div className="mt-3 text-xs text-muted-foreground">ID: {league.id}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {leagues.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t("leagues.noLeagueFoundTitle")}</h3>
            <p className="text-muted-foreground mb-4">{t("leagues.noLeagueFoundDescription")}</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t("leagues.createLeagueButton")}
              </Button>
              <Button variant="outline" onClick={() => setShowJoinForm(true)}>
                <Users className="mr-2 h-4 w-4" />
                {t("leagues.joinLeague")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
