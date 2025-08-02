"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Trophy, Settings } from "lucide-react";
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

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect({ href: "/api/auth/signin", locale });
    }
    if (status === "authenticated") {
      fetchLeagues();
    }
  }, [status]);

  const fetchLeagues = async () => {
    try {
      const response = await fetch("/api/leagues");
      if (response.ok) {
        const data = await response.json();
        setLeagues(data.leagues);
      }
    } catch (error) {
      console.error("Errore caricamento leghe:", error);
    } finally {
      setInitialLoading(false);
    }
  };

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
        alert(error.error || "Errore nella creazione della lega");
      }
    } catch (error) {
      console.error("Errore creazione lega:", error);
      alert("Errore nella creazione della lega");
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
        alert(error.error || "Errore nella partecipazione alla lega");
      }
    } catch (error) {
      console.error("Errore partecipazione lega:", error);
      alert("Errore nella partecipazione alla lega");
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
      SETUP: "Setup",
      AUCTION: "Asta in corso",
      COMPLETED: "Completata",
    };

    return <Badge variant={variants[status]}>{labels[status]}</Badge>;
  };

  if (status === "loading" || initialLoading) {
    return <LeaguesPageSkeleton />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Le Mie Leghe</h1>
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
            <CardTitle>Crea Nuova Lega</CardTitle>
            <CardDescription>Crea una nuova lega fantacalcio e invita i tuoi amici</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateLeague} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome Lega</Label>
                <Input id="name" value={createFormData.name} onChange={(e) => setCreateFormData((prev) => ({ ...prev, name: e.target.value }))} placeholder="Es. Lega degli Amici" required />
              </div>
              <div>
                <Label htmlFor="credits">Crediti Iniziali</Label>
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
                  {loading ? "Creazione..." : "Crea Lega"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                  Annulla
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
            <CardTitle>Partecipa a Lega</CardTitle>
            <CardDescription>Inserisci l&apos;ID della lega e il nome della tua squadra</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoinLeague} className="space-y-4">
              <div>
                <Label htmlFor="leagueId">ID Lega</Label>
                <Input
                  id="leagueId"
                  value={joinFormData.leagueId}
                  onChange={(e) => setJoinFormData((prev) => ({ ...prev, leagueId: e.target.value }))}
                  placeholder="Inserisci l'ID della lega"
                  required
                />
              </div>
              <div>
                <Label htmlFor="teamName">Nome Squadra</Label>
                <Input id="teamName" value={joinFormData.teamName} onChange={(e) => setJoinFormData((prev) => ({ ...prev, teamName: e.target.value }))} placeholder="Es. I Campioni" required />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? "Partecipazione..." : "Partecipa"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowJoinForm(false)}>
                  Annulla
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Lista Leghe */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {leagues.map((league) => {
          const isAdmin = league.admin.email === session?.user?.email;
          const userTeam = league.teams.find((team) => team.user.email === session?.user?.email);

          return (
            <Card key={league.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{league.name}</CardTitle>
                    <CardDescription>{isAdmin ? "Admin" : userTeam ? `Squadra: ${userTeam.name}` : "Partecipante"}</CardDescription>
                  </div>
                  {getStatusBadge(league.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Squadre:</span>
                    <span>{league._count.teams}/8</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Calciatori:</span>
                    <span>{league._count.players}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Crediti:</span>
                    <span>{league.credits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Admin:</span>
                    <span>{league.admin.name}</span>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  {isAdmin && (
                    <Link href={`/leagues/${league.id}`}>
                      <Button size="sm" variant="outline">
                        <Settings className="mr-2 h-3 w-3" />
                        Gestisci
                      </Button>
                    </Link>
                  )}
                  <Link href={`/leagues/${league.id}`}>
                    <Button size="sm">
                      <Trophy className="mr-2 h-3 w-3" />
                      Visualizza
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
            <h3 className="text-lg font-semibold mb-2">Nessuna Lega Trovata</h3>
            <p className="text-muted-foreground mb-4">Non partecipi ancora a nessuna lega. Crea la tua prima lega o partecipa a una esistente!</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Crea Lega
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
