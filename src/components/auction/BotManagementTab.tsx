"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Bot, Users, Zap, Settings, Play, Trash2 } from "lucide-react";

interface BotManagementTabProps {
  leagueId: string;
  currentRound?: {
    id: string;
    position: string;
    status: string;
    roundNumber: number;
  };
}

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

export default function BotManagementTab({ leagueId, currentRound }: BotManagementTabProps) {
  const t = useTranslations("auction");
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

  // Carica configurazione bot
  useEffect(() => {
    loadBotConfig();
  }, [leagueId, loadBotConfig]);

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

  // Carica stato bot per il turno corrente
  useEffect(() => {
    if (currentRound?.id && config.isEnabled) {
      loadBotStatus();
    }
  }, [currentRound?.id, config.isEnabled, loadBotStatus]);

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

  return (
    <div className="space-y-6">
      {/* Configurazione Bot */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            {t("admin.botConfig")}
          </CardTitle>
          <CardDescription>{t("admin.botConfigDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Abilitazione Bot */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>{t("admin.enableTestMode")}</Label>
              <p className="text-sm text-muted-foreground">{t("admin.testModeDesc")}</p>
            </div>
            <Switch checked={config.isEnabled} onCheckedChange={(enabled) => updateBotConfig({ isEnabled: enabled })} disabled={loading} />
          </div>

          {/* Configurazioni Bot */}
          {config.isEnabled && (
            <>
              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Numero Bot */}
                <div className="space-y-2">
                  <Label>{t("admin.botCount")}</Label>
                  <Input type="number" min="1" max="7" value={botCount} onChange={(e) => setBotCount(parseInt(e.target.value) || 3)} disabled={loading} />
                </div>

                {/* Intelligenza Bot */}
                <div className="space-y-2">
                  <Label>{t("admin.botIntelligence")}</Label>
                  <Select value={config.intelligence} onValueChange={(value: "LOW" | "MEDIUM" | "HIGH") => updateBotConfig({ intelligence: value })} disabled={loading}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">{t("admin.intelligenceLow")}</SelectItem>
                      <SelectItem value="MEDIUM">{t("admin.intelligenceMedium")}</SelectItem>
                      <SelectItem value="HIGH">{t("admin.intelligenceHigh")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Delay Selezione */}
                <div className="space-y-2">
                  <Label>{t("admin.selectionDelayMin")}</Label>
                  <Input
                    type="number"
                    min="1"
                    max="30"
                    value={config.selectionDelayMin}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        selectionDelayMin: parseInt(e.target.value) || 2,
                      }))
                    }
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("admin.selectionDelayMax")}</Label>
                  <Input
                    type="number"
                    min="1"
                    max="30"
                    value={config.selectionDelayMax}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        selectionDelayMax: parseInt(e.target.value) || 8,
                      }))
                    }
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={() => updateBotConfig(config)} disabled={loading} size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  {t("admin.updateConfig")}
                </Button>

                <Button onClick={removeBots} disabled={loading} variant="outline" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("admin.removeBots")}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Stato Bot Attivi */}
      {config.isEnabled && activeBots > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t("admin.activeBots")} ({activeBots})
            </CardTitle>
            <CardDescription>{t("admin.activeBotsDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {currentRound?.status === "SELECTION" && (
              <div className="flex gap-2 mb-4">
                <Button onClick={triggerBotSelections} disabled={loading} size="sm">
                  <Play className="h-4 w-4 mr-2" />
                  {t("admin.triggerBotSelections")}
                </Button>
              </div>
            )}

            {/* Stato Selezioni Bot */}
            {botStatus.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">{t("admin.botSelectionsStatus")}</h4>
                <div className="grid gap-2">
                  {botStatus.map((bot) => (
                    <div key={bot.botId} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Bot className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{bot.botName}</span>
                        <Badge variant={bot.hasSelected ? "default" : "secondary"}>{bot.hasSelected ? t("admin.selected") : t("admin.pending")}</Badge>
                      </div>

                      {bot.hasSelected && bot.selectedPlayer && (
                        <div className="text-right text-sm">
                          <div className="font-medium">{bot.selectedPlayer.name}</div>
                          <div className="text-muted-foreground">€{bot.selectedPlayer.price}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info Modalità Test */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-700">
            <Zap className="h-5 w-5" />
            {t("admin.testModeInfo")}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-600 space-y-2">
          <p>• {t("admin.testModeInfoLine1")}</p>
          <p>• {t("admin.testModeInfoLine2")}</p>
          <p>• {t("admin.testModeInfoLine3")}</p>
          <p>• {t("admin.testModeInfoLine4")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
