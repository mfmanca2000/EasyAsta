import { useState, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

interface UseAuctionAdminProps {
  leagueId: string;
}

export function useAuctionAdmin({ leagueId }: UseAuctionAdminProps) {
  const { data: session } = useSession();
  const t = useTranslations();
  const [isAdmin, setIsAdmin] = useState(false);
  const [teamCount, setTeamCount] = useState(0);

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
      checkIfAdmin();
    }
  }, [session, leagueId, checkIfAdmin]);

  return {
    isAdmin,
    teamCount,
    refreshAdminStatus: checkIfAdmin,
  };
}