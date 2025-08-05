"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Clock, AlertTriangle } from "lucide-react";
import { useAdminActions } from "@/hooks/useAdminActions";
import { useAdminConfig } from "@/hooks/useAdminConfig";
import { AuctionConfig } from "@/types";

interface AdminConfigTabProps {
  leagueId: string;
  initialConfig?: AuctionConfig & {
    pauseOnDisconnect?: boolean;
  };
}

export default function AdminConfigTab({ leagueId, initialConfig }: AdminConfigTabProps) {
  const t = useTranslations("auction");
  const { loading, executeAdminAction, resetAuction } = useAdminActions();
  const { config, updateConfig } = useAdminConfig(initialConfig);

  const handleConfigUpdate = () => {
    executeAdminAction({
      type: "timeout-config",
      data: {
        leagueId,
        ...config,
      },
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t("admin.timeoutConfig")}
          </CardTitle>
          <CardDescription>{t("admin.timeoutConfigDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t("admin.timeoutSeconds")}</Label>
            <Input 
              type="number" 
              min="10" 
              max="300" 
              value={config.timeoutSeconds} 
              onChange={(e) => updateConfig("timeoutSeconds", parseInt(e.target.value))} 
            />
            <p className="text-sm text-muted-foreground mt-1">{t("admin.timeoutRange")}</p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>{t("admin.autoSelectOnTimeout")}</Label>
              <p className="text-sm text-muted-foreground">{t("admin.autoSelectOnTimeoutDesc")}</p>
            </div>
            <Switch 
              checked={config.autoSelectOnTimeout} 
              onCheckedChange={(checked) => updateConfig("autoSelectOnTimeout", checked)} 
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>{t("admin.pauseOnDisconnect")}</Label>
              <p className="text-sm text-muted-foreground">{t("admin.pauseOnDisconnectDesc")}</p>
            </div>
            <Switch 
              checked={config.pauseOnDisconnect} 
              onCheckedChange={(checked) => updateConfig("pauseOnDisconnect", checked)} 
            />
          </div>

          <Button onClick={handleConfigUpdate} disabled={loading} className="w-full">
            {loading ? t("loading") : t("admin.updateConfig")}
          </Button>
        </CardContent>
      </Card>

      {/* Emergency Controls Card */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            {t("admin.emergencyControls")}
          </CardTitle>
          <CardDescription>{t("admin.emergencyControlsDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="destructive"
            onClick={() => resetAuction(leagueId)}
            disabled={loading}
            className="w-full"
          >
            🗑️ {t("admin.resetAuctionComplete")}
          </Button>
          <p className="text-sm text-muted-foreground text-center">{t("admin.resetWarning")}</p>
        </CardContent>
      </Card>
    </>
  );
}