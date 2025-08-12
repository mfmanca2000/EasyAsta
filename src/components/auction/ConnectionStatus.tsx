"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Card,
  CardContent,
  CardHeader,
  CardTitle 
} from "@/components/ui/card";
import { 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  RefreshCw, 
  Wifi, 
  WifiOff 
} from "lucide-react";
import { enableFallbackMode, attemptReconnection } from "@/lib/pusher-client";
import { useState } from "react";

interface ConnectionStatusProps {
  isConnected: boolean;
  fallbackMode: boolean;
  isPolling?: boolean;
  isSyncing?: boolean;
  connectionStatus?: any;
  onRefresh?: () => void;
}

export function ConnectionStatus({
  isConnected,
  fallbackMode,
  isPolling = false,
  isSyncing = false,
  connectionStatus,
  onRefresh,
}: ConnectionStatusProps) {
  const t = useTranslations("auction");
  const [isReconnecting, setIsReconnecting] = useState(false);

  const handleManualFallback = () => {
    console.log("[CONNECTION] Manually enabling fallback mode");
    enableFallbackMode();
  };

  const handleReconnectionAttempt = async () => {
    if (isReconnecting) return;
    
    setIsReconnecting(true);
    console.log("[CONNECTION] Attempting to reconnect...");
    
    try {
      const success = await attemptReconnection();
      if (success) {
        console.log("[CONNECTION] Reconnection successful");
      } else {
        console.log("[CONNECTION] Reconnection failed");
      }
    } catch (error) {
      console.error("[CONNECTION] Reconnection error:", error);
    } finally {
      setIsReconnecting(false);
    }
  };

  const getStatusInfo = () => {
    if (fallbackMode) {
      if (connectionStatus?.isLimitReached) {
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          text: t("connection.fallback.quota"),
          variant: "destructive" as const,
          description: t("connection.fallback.quotaDescription"),
        };
      } else {
        return {
          icon: <WifiOff className="h-4 w-4" />,
          text: t("connection.fallback.polling"),
          variant: "secondary" as const,
          description: t("connection.fallback.pollingDescription"),
        };
      }
    } else if (isConnected) {
      return {
        icon: <CheckCircle className="h-4 w-4" />,
        text: t("connection.realtime.connected"),
        variant: "default" as const,
        description: t("connection.realtime.connectedDescription"),
      };
    } else {
      return {
        icon: <Clock className="h-4 w-4" />,
        text: t("connection.realtime.connecting"),
        variant: "secondary" as const,
        description: t("connection.realtime.connectingDescription"),
      };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Wifi className="h-4 w-4" />
          {t("connection.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={statusInfo.variant} className="flex items-center gap-1">
              {statusInfo.icon}
              {statusInfo.text}
            </Badge>
            {isSyncing && (
              <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
            {isPolling && (
              <Badge variant="outline" className="text-xs">
                {t("connection.polling.active")}
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isSyncing}
            className="h-7 px-2"
          >
            <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
            {t("connection.refresh")}
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground">
          {statusInfo.description}
        </p>

        {/* Development/Testing Controls */}
        {process.env.NODE_ENV === 'development' && (
          <div className="pt-2 border-t border-dashed">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              {t("connection.testing.title")}
            </p>
            <div className="flex gap-2">
              {!fallbackMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualFallback}
                  className="h-7 text-xs"
                >
                  {t("connection.testing.enableFallback")}
                </Button>
              )}
              {fallbackMode && !connectionStatus?.isLimitReached && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReconnectionAttempt}
                  disabled={isReconnecting}
                  className="h-7 text-xs"
                >
                  {isReconnecting && <RefreshCw className="h-3 w-3 animate-spin mr-1" />}
                  {t("connection.testing.reconnect")}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Connection Stats */}
        {connectionStatus && process.env.NODE_ENV === 'development' && (
          <div className="pt-2 border-t border-dashed">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              {t("connection.stats.title")}
            </p>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>
                {t("connection.stats.attempts")}: {connectionStatus.reconnectAttempts}
              </div>
              {connectionStatus.lastError && (
                <div>
                  {t("connection.stats.lastError")}: {connectionStatus.lastError.message}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}