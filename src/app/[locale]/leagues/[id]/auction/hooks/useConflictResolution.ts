import { useState } from "react";
import { ConflictResolution } from "@/types";

interface ConflictData {
  leagueId: string;
  roundId: string;
  conflicts: ConflictResolution[];
  roundContinues: boolean;
  assignments: Array<{
    playerId: string;
    winnerId: string;
    winnerName: string;
    playerName: string;
    price: number;
    randomNumber?: number;
  }>;
}

export function useConflictResolution() {
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictData, setConflictData] = useState<ConflictData | null>(null);

  const showConflictResolution = (data: ConflictData) => {
    setConflictData(data);
    setShowConflictModal(true);
  };

  const closeConflictModal = () => {
    setShowConflictModal(false);
    setConflictData(null);
  };

  return {
    showConflictModal,
    conflictData,
    showConflictResolution,
    closeConflictModal,
  };
}