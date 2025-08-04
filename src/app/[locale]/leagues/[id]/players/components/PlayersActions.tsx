import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Upload, Plus, RotateCcw } from "lucide-react";

interface PlayersActionsProps {
  canModifyPlayers: boolean;
  onImportPlayers: () => void;
  onAddPlayer?: () => void;
  onRefreshPlayers: () => void;
  loading?: boolean;
}

export default function PlayersActions({
  canModifyPlayers,
  onImportPlayers,
  onAddPlayer,
  onRefreshPlayers,
  loading = false,
}: PlayersActionsProps) {
  const t = useTranslations();

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      {/* Import Players - Only for admins in SETUP */}
      {canModifyPlayers && (
        <Button onClick={onImportPlayers} disabled={loading}>
          <Upload className="h-4 w-4 mr-2" />
          {t('players.importPlayers')}
        </Button>
      )}

      {/* Add Single Player - Only for admins in SETUP */}
      {canModifyPlayers && onAddPlayer && (
        <Button variant="outline" onClick={onAddPlayer} disabled={loading}>
          <Plus className="h-4 w-4 mr-2" />
          {t('players.addPlayer')}
        </Button>
      )}

      {/* Refresh Players - Always available */}
      <Button variant="outline" onClick={onRefreshPlayers} disabled={loading}>
        <RotateCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
        {t('common.refresh')}
      </Button>
    </div>
  );
}