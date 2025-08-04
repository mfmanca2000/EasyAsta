import { useState, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";

interface League {
  id: string;
  name: string;
  status: "SETUP" | "AUCTION" | "COMPLETED";
  admin: {
    id: string;
    name: string;
    email: string;
  };
}

interface UsePlayersAdminProps {
  leagueId: string;
}

export function usePlayersAdmin({ leagueId }: UsePlayersAdminProps) {
  const { data: session } = useSession();
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLeague = useCallback(async () => {
    try {
      const response = await fetch(`/api/leagues/${leagueId}`);
      const data = await response.json();

      if (response.ok && data.league) {
        setLeague(data.league);
      }
    } catch (error) {
      console.error('Error fetching league:', error);
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    if (leagueId) {
      fetchLeague();
    }
  }, [leagueId, fetchLeague]);

  const isAdmin = league?.admin.id === session?.user?.id;
  const canModifyPlayers = isAdmin && league?.status === "SETUP";

  return {
    league,
    loading,
    isAdmin,
    canModifyPlayers,
    refreshLeague: fetchLeague,
  };
}