"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, Target, Calendar, AlertCircle, UserCheck, Settings, RotateCcw, Shield } from "lucide-react";
import { toast } from "sonner";

interface AuditLog {
  id: string;
  action: string;
  reason?: string;
  metadata?: any;
  createdAt: string;
  admin: {
    id: string;
    name?: string;
    email: string;
  };
  targetTeam?: {
    id: string;
    name: string;
    user: {
      name?: string;
      email: string;
    };
  };
  player?: {
    id: string;
    name: string;
    position: string;
    realTeam: string;
    price: number;
  };
  round?: {
    id: string;
    position: string;
    roundNumber: number;
  };
}

interface AuditTrailProps {
  leagueId: string;
}

export default function AuditTrail({ leagueId }: AuditTrailProps) {
  const t = useTranslations("auction");
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const fetchAuditLogs = useCallback(
    async (resetData = false) => {
      try {
        setRefreshing(true);
        const currentOffset = resetData ? 0 : offset;

        const response = await fetch(`/api/auction/audit?leagueId=${leagueId}&limit=${limit}&offset=${currentOffset}`);

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to fetch audit logs");
        }

        const data = await response.json();

        if (resetData) {
          setAuditLogs(data.auditLogs);
          setOffset(limit);
        } else {
          setAuditLogs((prev) => [...prev, ...data.auditLogs]);
          setOffset((prev) => prev + limit);
        }

        setTotalCount(data.totalCount);
        setHasMore(data.hasMore);
      } catch (error) {
        console.error("Failed to fetch audit logs:", error);
        toast.error(error instanceof Error ? error.message : "Failed to fetch audit logs");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [leagueId, offset]
  );

  useEffect(() => {
    fetchAuditLogs(true);
  }, [leagueId, fetchAuditLogs]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case "ADMIN_SELECT":
        return <UserCheck className="h-4 w-4 text-blue-600" />;
      case "CANCEL_SELECTION":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "FORCE_RESOLUTION":
        return <Target className="h-4 w-4 text-orange-600" />;
      case "RESET_ROUND":
        return <RotateCcw className="h-4 w-4 text-purple-600" />;
      case "TIMEOUT_CONFIG":
        return <Settings className="h-4 w-4 text-gray-600" />;
      case "EMERGENCY_PAUSE":
        return <Shield className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "ADMIN_SELECT":
        return <Badge variant="default">Selection</Badge>;
      case "CANCEL_SELECTION":
        return <Badge variant="destructive">Cancel</Badge>;
      case "FORCE_RESOLUTION":
        return <Badge variant="secondary">Force</Badge>;
      case "RESET_ROUND":
        return <Badge variant="outline">Reset</Badge>;
      case "TIMEOUT_CONFIG":
        return <Badge variant="default">Config</Badge>;
      case "EMERGENCY_PAUSE":
        return <Badge variant="secondary">Pause</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getActionDescription = (log: AuditLog) => {
    const adminName = log.admin.name || log.admin.email;
    const teamName = log.targetTeam?.name;
    const playerName = log.player?.name;
    const roundInfo = log.round ? `Round ${log.round.roundNumber} (${log.round.position})` : "";

    switch (log.action) {
      case "ADMIN_SELECT":
        return `${adminName} selected ${playerName} for team ${teamName} in ${roundInfo}`;
      case "CANCEL_SELECTION":
        return `${adminName} cancelled selection for team ${teamName} in ${roundInfo}`;
      case "FORCE_RESOLUTION":
        return `${adminName} forced resolution of ${roundInfo}`;
      case "RESET_ROUND":
        return `${adminName} reset ${roundInfo}`;
      case "TIMEOUT_CONFIG":
        return `${adminName} updated timeout configuration`;
      case "EMERGENCY_PAUSE":
        return `${adminName} triggered emergency pause`;
      default:
        return `${adminName} performed ${log.action}`;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <span>Loading audit trail...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t("admin.auditTrail")}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{totalCount} total actions logged</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchAuditLogs(true)} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {auditLogs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No admin actions recorded yet</p>
            <p className="text-sm mt-2">All admin actions will be logged here for transparency</p>
          </div>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="space-y-4">
              {auditLogs.map((log) => (
                <div key={log.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1">{getActionIcon(log.action)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {getActionBadge(log.action)}
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatTimestamp(log.createdAt)}
                          </div>
                        </div>
                        <p className="text-sm font-medium mb-1">{getActionDescription(log)}</p>
                        {log.reason && <p className="text-sm text-muted-foreground italic">Reason: {log.reason}</p>}
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <details className="mt-2">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Additional details</summary>
                            <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">{JSON.stringify(log.metadata, null, 2)}</pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {hasMore && (
                <div className="text-center py-4">
                  <Button variant="outline" onClick={() => fetchAuditLogs(false)} disabled={refreshing}>
                    {refreshing ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                    Load More
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
