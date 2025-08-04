"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Play, Bot } from "lucide-react";

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

interface BotStatusDisplayProps {
  activeBots: number;
  botStatus: BotStatus[];
  currentRound?: {
    id: string;
    position: string;
    status: string;
    roundNumber: number;
  };
  loading: boolean;
  onTriggerBotSelections: () => Promise<void>;
}

export default function BotStatusDisplay({
  activeBots,
  botStatus,
  currentRound,
  loading,
  onTriggerBotSelections,
}: BotStatusDisplayProps) {
  const t = useTranslations("auction");

  if (activeBots === 0) {
    return null;
  }

  return (
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
            <Button onClick={onTriggerBotSelections} disabled={loading} size="sm">
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
                    <Badge variant={bot.hasSelected ? "default" : "secondary"}>
                      {bot.hasSelected ? t("admin.selected") : t("admin.pending")}
                    </Badge>
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
  );
}