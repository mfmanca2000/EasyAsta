"use client";

import { useBotManagement } from "@/hooks/useBotManagement";
import BotConfigPanel from "./BotConfigPanel";
import BotStatusDisplay from "./BotStatusDisplay";
import BotInfoCard from "./BotInfoCard";

interface BotManagementTabProps {
  leagueId: string;
  currentRound?: {
    id: string;
    position: string;
    status: string;
    roundNumber: number;
  };
}

export default function BotManagementTab({ leagueId, currentRound }: BotManagementTabProps) {
  const {
    loading,
    initialLoading,
    config,
    setConfig,
    activeBots,
    botStatus,
    botCount,
    setBotCount,
    updateBotConfig,
    triggerBotSelections,
    removeBots,
  } = useBotManagement(leagueId, currentRound);

  return (
    <div className="space-y-6">
      {/* Configurazione Bot */}
      <BotConfigPanel
        config={config}
        setConfig={setConfig}
        botCount={botCount}
        setBotCount={setBotCount}
        loading={loading || initialLoading}
        initialLoading={initialLoading}
        onUpdateConfig={updateBotConfig}
        onRemoveBots={removeBots}
      />

      {/* Stato Bot Attivi */}
      {config.isEnabled && (
        <BotStatusDisplay
          activeBots={activeBots}
          botStatus={botStatus}
          currentRound={currentRound}
          loading={loading}
          onTriggerBotSelections={triggerBotSelections}
        />
      )}

      {/* Info Modalità Test */}
      <BotInfoCard />
    </div>
  );
}
