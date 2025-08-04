import { useState } from "react";
import { useTranslations } from "next-intl";

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

interface UseNextRoundModalProps {
  leagueId: string;
}

export function useNextRoundModal({ leagueId }: UseNextRoundModalProps) {
  const t = useTranslations();
  const [showNextRoundModal, setShowNextRoundModal] = useState(false);
  const [nextRoundStats, setNextRoundStats] = useState<NextRoundStats | null>(null);

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

  const openNextRoundModal = async () => {
    await fetchNextRoundStats();
    setShowNextRoundModal(true);
  };

  const closeNextRoundModal = () => {
    setShowNextRoundModal(false);
    setNextRoundStats(null);
  };

  return {
    showNextRoundModal,
    nextRoundStats,
    openNextRoundModal,
    closeNextRoundModal,
    fetchNextRoundStats,
  };
}