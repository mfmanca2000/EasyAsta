import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { TeamWithPlayers, League as BaseLeague } from "@/types";

export interface League extends Omit<BaseLeague, "adminId" | "createdAt" | "updatedAt"> {
  admin: {
    id: string;
    name: string;
    email: string;
  };
  teams: TeamWithPlayers[];
  _count: {
    teams: number;
    players: number;
  };
}

export function useLeague(leagueId: string) {
  const { data: session } = useSession();
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeague = useCallback(async () => {
    if (!leagueId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/leagues/${leagueId}`);

      if (response.ok) {
        const data = await response.json();
        setLeague(data.league);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Lega non trovata");
      }
    } catch (err) {
      console.error("Errore caricamento lega:", err);
      setError("Errore di connessione");
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  // Trova la squadra dell'utente corrente
  const userTeam = league?.teams.find((team) => team.user.email === session?.user?.email) || null;

  // Verifica se l'utente è admin
  const isAdmin = league?.admin.email === session?.user?.email;

  return {
    league,
    userTeam,
    isAdmin,
    loading,
    error,
    fetchLeague,
    refetch: fetchLeague,
  };
}
