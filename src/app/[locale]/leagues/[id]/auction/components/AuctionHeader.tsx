import { useTranslations } from "next-intl";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Clock, Users } from "lucide-react";

interface Selection {
  id: string;
  user: { name: string };
  player: { name: string };
}

interface ConnectedUser {
  id: string;
  name: string;
}

interface AuctionHeaderProps {
  currentRound: {
    position: "P" | "D" | "C" | "A";
    status: "SELECTION" | "RESOLUTION" | "COMPLETED";
    roundNumber: number;
    selections: Selection[];
  };
  isConnected: boolean;
  isSyncing: boolean;
  connectedUsers: ConnectedUser[];
}

export default function AuctionHeader({ 
  currentRound, 
  isConnected, 
  isSyncing, 
  connectedUsers 
}: AuctionHeaderProps) {
  const t = useTranslations();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            {t("auction.title")} - {t(`auction.positions.${currentRound.position}`)}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={currentRound.status === "SELECTION" ? "default" : "secondary"}>
              {currentRound.status === "SELECTION" ? t("auction.selection") : t("auction.resolution")}
            </Badge>
            <Badge variant={isConnected ? "default" : "destructive"} className="text-xs">
              {isSyncing ? "🔄 Syncing..." : isConnected ? "🟢 Live" : "🔴 Offline"}
            </Badge>
          </div>
        </CardTitle>
        <CardDescription className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {t("auction.round", { number: currentRound.roundNumber })}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            {t("auction.selections", { count: currentRound.selections.length })}
          </span>
          {connectedUsers.length > 0 && (
            <span className="flex items-center gap-1 text-green-600">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              {connectedUsers.length} online
            </span>
          )}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}