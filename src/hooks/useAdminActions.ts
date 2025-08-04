import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

interface AdminAction {
  type: "admin-select" | "cancel-selection" | "force-resolution" | "reset-round" | "timeout-config";
  data: {
    roundId?: string;
    playerId?: string;
    targetTeamId?: string;
    reason?: string;
    timeoutSeconds?: number;
    autoSelectOnTimeout?: boolean;
    pauseOnDisconnect?: boolean;
    leagueId?: string;
  };
}

interface UseAdminActionsReturn {
  loading: boolean;
  executeAdminAction: (action: AdminAction) => Promise<void>;
  resetAuction: (leagueId: string) => Promise<void>;
}

export function useAdminActions(): UseAdminActionsReturn {
  const t = useTranslations("auction");
  const [loading, setLoading] = useState(false);

  const executeAdminAction = async (action: AdminAction) => {
    setLoading(true);
    try {
      let response: Response;

      switch (action.type) {
        case "admin-select":
          response = await fetch("/api/auction/admin-select", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(action.data),
          });
          break;

        case "cancel-selection":
        case "force-resolution":
        case "reset-round":
          response = await fetch("/api/auction/admin-override", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roundId: action.data.roundId,
              action: action.type.replace("-", "-"),
              ...action.data,
            }),
          });
          break;

        case "timeout-config":
          response = await fetch("/api/auction/timeout-config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              leagueId: action.data.leagueId,
              timeoutSeconds: action.data.timeoutSeconds,
              autoSelectOnTimeout: action.data.autoSelectOnTimeout,
              pauseOnDisconnect: action.data.pauseOnDisconnect,
            }),
          });
          break;

        default:
          throw new Error("Unknown action type");
      }

      if (!response?.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      const result = await response.json();
      toast.success(result.message || t("admin.actionSuccess"));
    } catch (error: unknown) {
      console.error("Admin action error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(errorMessage || t("admin.actionError"));
    } finally {
      setLoading(false);
    }
  };

  const resetAuction = async (leagueId: string) => {
    if (!confirm(t("admin.confirmResetAuction"))) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auction/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId }),
      });

      if (response.ok) {
        toast.success(t("admin.resetSuccess"));
        window.location.reload();
      } else {
        const data = await response.json();
        toast.error(t("admin.resetError") + ": " + data.error);
      }
    } catch (error) {
      toast.error(t("admin.resetError") + ": " + error);
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    executeAdminAction,
    resetAuction,
  };
}