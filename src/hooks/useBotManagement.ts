import { useState, useEffect, useCallback } from "react";
//import { useTranslations } from "next-intl";
import { toast } from "sonner";

interface BotConfig {
  isEnabled: boolean;
  selectionDelayMin: number;
  selectionDelayMax: number;
  intelligence: "LOW" | "MEDIUM" | "HIGH";
}

interface BotStatus {
  botId: string;
  botName: string;
  hasSelected: boolean;
  selectedPlayer?: {
    id: string;
    name: string;
    price: number;
    reason?: string;
  };
}

interface UseBotManagementReturn {
  loading: boolean;
  config: BotConfig;
  setConfig: React.Dispatch<React.SetStateAction<BotConfig>>;
  activeBots: number;
  botStatus: BotStatus[];
  botCount: number;
  setBotCount: React.Dispatch<React.SetStateAction<number>>;
  loadBotConfig: () => Promise<void>;
  loadBotStatus: () => Promise<void>;
  updateBotConfig: (newConfig: Partial<BotConfig>) => Promise<void>;
  triggerBotSelections: () => Promise<void>;
  removeBots: () => Promise<void>;
}

export function useBotManagement(
  leagueId: string,
  currentRound?: {
    id: string;
    position: string;
    status: string;
    roundNumber: number;
  }
): UseBotManagementReturn {
  //const t = useTranslations("auction");
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<BotConfig>({
    isEnabled: false,
    selectionDelayMin: 2,
    selectionDelayMax: 8,
    intelligence: "MEDIUM",
  });
  const [activeBots, setActiveBots] = useState(0);
  const [botStatus, setBotStatus] = useState<BotStatus[]>([]);
  const [botCount, setBotCount] = useState(3);

  const loadBotConfig = useCallback(async () => {
    try {
      const response = await fetch(`/api/auction/bot-config?leagueId=${leagueId}`);
      if (response.ok) {
        const data = await response.json();
        setConfig(data.config);
        setActiveBots(data.activeBots);
      }
    } catch {
      console.error("Errore caricamento config bot");
    }
  }, [leagueId]);

  const loadBotStatus = useCallback(async () => {
    if (!currentRound?.id) return;

    try {
      const response = await fetch(`/api/auction/bot-select?leagueId=${leagueId}&roundId=${currentRound.id}`);
      if (response.ok) {
        const data = await response.json();
        setBotStatus(data.botStatus || []);
      }
    } catch {
      console.error("Errore caricamento stato bot");
    }
  }, [leagueId, currentRound?.id]);

  const updateBotConfig = async (newConfig: Partial<BotConfig>) => {
    setLoading(true);
    try {
      const response = await fetch("/api/auction/bot-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId,
          ...config,
          ...newConfig,
          botCount: newConfig.isEnabled ? botCount : 0,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setConfig((prev) => ({ ...prev, ...newConfig }));
        setActiveBots(data.activeBots);
        toast.success(data.message);
      } else {
        const error = await response.json();
        toast.error(error.error);
      }
    } catch {
      toast.error("Errore aggiornamento configurazione bot");
    } finally {
      setLoading(false);
    }
  };

  const triggerBotSelections = async () => {
    if (!currentRound?.id) return;

    setLoading(true);
    try {
      const response = await fetch("/api/auction/bot-select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId,
          roundId: currentRound.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        await loadBotStatus(); // Ricarica stato
      } else {
        const error = await response.json();
        toast.error(error.error);
      }
    } catch {
      toast.error("Errore selezione bot");
    } finally {
      setLoading(false);
    }
  };

  const removeBots = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/auction/bot-config?leagueId=${leagueId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        const data = await response.json();
        setConfig((prev) => ({ ...prev, isEnabled: false }));
        setActiveBots(0);
        setBotStatus([]);
        toast.success(data.message);
      } else {
        const error = await response.json();
        toast.error(error.error);
      }
    } catch {
      toast.error("Errore rimozione bot");
    } finally {
      setLoading(false);
    }
  };

  // Carica configurazione bot
  useEffect(() => {
    loadBotConfig();
  }, [leagueId, loadBotConfig]);

  // Carica stato bot per il turno corrente
  useEffect(() => {
    if (currentRound?.id && config.isEnabled) {
      loadBotStatus();
    }
  }, [currentRound?.id, config.isEnabled, loadBotStatus]);

  return {
    loading,
    config,
    setConfig,
    activeBots,
    botStatus,
    botCount,
    setBotCount,
    loadBotConfig,
    loadBotStatus,
    updateBotConfig,
    triggerBotSelections,
    removeBots,
  };
}
