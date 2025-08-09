"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Settings, Trash2 } from "lucide-react";

interface BotConfig {
  isEnabled: boolean;
  selectionDelayMin: number;
  selectionDelayMax: number;
  intelligence: "LOW" | "MEDIUM" | "HIGH";
}

interface BotConfigPanelProps {
  config: BotConfig;
  setConfig: React.Dispatch<React.SetStateAction<BotConfig>>;
  botCount: number;
  setBotCount: React.Dispatch<React.SetStateAction<number>>;
  loading: boolean;
  initialLoading?: boolean;
  onUpdateConfig: (newConfig: Partial<BotConfig>) => Promise<void>;
  onRemoveBots: () => Promise<void>;
}

export default function BotConfigPanel({
  config,
  setConfig,
  botCount,
  setBotCount,
  loading,
  initialLoading = false,
  onUpdateConfig,
  onRemoveBots,
}: BotConfigPanelProps) {
  const t = useTranslations("auction");

  return (
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
          {initialLoading ? (
            <Skeleton className="h-6 w-12" />
          ) : (
            <Switch 
              checked={config.isEnabled} 
              onCheckedChange={(enabled) => onUpdateConfig({ isEnabled: enabled })} 
              disabled={loading} 
            />
          )}
        </div>

        {/* Configurazioni Bot */}
        {config.isEnabled && !initialLoading && (
          <>
            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Numero Bot */}
              <div className="space-y-2">
                <Label>{t("admin.botCount")}</Label>
                <Input 
                  type="number" 
                  min="1" 
                  max="7" 
                  value={botCount} 
                  onChange={(e) => setBotCount(parseInt(e.target.value) || 3)} 
                  disabled={loading} 
                />
              </div>

              {/* Intelligenza Bot */}
              <div className="space-y-2">
                <Label>{t("admin.botIntelligence")}</Label>
                <Select 
                  value={config.intelligence} 
                  onValueChange={(value: "LOW" | "MEDIUM" | "HIGH") => onUpdateConfig({ intelligence: value })} 
                  disabled={loading}
                >
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
              <Button onClick={() => onUpdateConfig(config)} disabled={loading} size="sm">
                <Settings className="h-4 w-4 mr-2" />
                {t("admin.updateConfig")}
              </Button>

              <Button onClick={onRemoveBots} disabled={loading} variant="outline" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                {t("admin.removeBots")}
              </Button>
            </div>
          </>
        )}

        {/* Loading skeleton quando la modalità test è attiva ma stiamo ancora caricando */}
        {initialLoading && config.isEnabled && (
          <>
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-9 w-28" />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}