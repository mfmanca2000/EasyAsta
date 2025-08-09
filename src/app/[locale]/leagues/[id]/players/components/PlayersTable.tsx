import { useTranslations } from "next-intl";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Edit, Trash2 } from "lucide-react";
import { TeamLogo } from "@/components/ui/team-logo";
import { Player, Pagination, PlayerSortField, PlayerSortOrder } from "@/types";

interface PlayersTableProps {
  players: Player[];
  loading: boolean;
  sorting: {
    field: PlayerSortField;
    direction: PlayerSortOrder;
  };
  pagination: Pagination;
  canModifyPlayers: boolean;
  onToggleSort: (field: PlayerSortField) => void;
  onPageChange: (page: number) => void;
  onNextPage: () => void;
  onPrevPage: () => void;
  onLimitChange: (limit: number) => void;
  onDeletePlayer: (playerId: string, playerName: string) => void;
}

export default function PlayersTable({
  players,
  loading,
  sorting,
  pagination,
  canModifyPlayers,
  onToggleSort,
  onPageChange,
  onNextPage,
  onPrevPage,
  onLimitChange,
  onDeletePlayer,
}: PlayersTableProps) {
  const t = useTranslations();

  const getSortIcon = (field: PlayerSortField) => {
    if (sorting.field !== field) return null;
    return sorting.direction === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  const SortableHeader = ({ field, children, className = "" }: { field: PlayerSortField; children: React.ReactNode; className?: string }) => (
    <TableHead className={`cursor-pointer hover:bg-muted/50 transition-colors ${className}`} onClick={() => onToggleSort(field)}>
      <div className="flex items-center gap-2">
        {children}
        {getSortIcon(field)}
      </div>
    </TableHead>
  );

  const getPositionColor = (position: string) => {
    switch (position) {
      case "P":
        return "bg-blue-100 text-blue-800";
      case "D":
        return "bg-green-100 text-green-800";
      case "C":
        return "bg-yellow-100 text-yellow-800";
      case "A":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("it-IT").format(price);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-10 bg-muted rounded mb-4"></div>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded mb-2"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader field="name" className="w-[250px]">
                {t("players.name")}
              </SortableHeader>
              <SortableHeader field="position" className="w-[100px]">
                {t("players.position")}
              </SortableHeader>
              <SortableHeader field="realTeam" className="w-[150px]">
                {t("players.team")}
              </SortableHeader>
              <SortableHeader field="price" className="w-[120px] text-right">
                {t("players.price")}
              </SortableHeader>
              <TableHead className="w-[100px]">{t("common.status")}</TableHead>
              {canModifyPlayers && <TableHead className="w-[100px]">{t("common.actions")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {players.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canModifyPlayers ? 6 : 5} className="text-center py-8 text-muted-foreground">
                  {t("players.noPlayersFound")}
                </TableCell>
              </TableRow>
            ) : (
              players.map((player) => (
                <TableRow key={player.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{player.name}</TableCell>
                  <TableCell>
                    <Badge className={getPositionColor(player.position)}>{player.position}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <TeamLogo teamName={player.realTeam} size={16} />
                      <span className="truncate">{player.realTeam}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatPrice(player.price)}</TableCell>
                  <TableCell>
                    <Badge variant={player.isAssigned ? "secondary" : "default"}>{player.isAssigned ? t("players.assigned") : t("players.available")}</Badge>
                  </TableCell>
                  {canModifyPlayers && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={player.isAssigned}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => onDeletePlayer(player.id, player.name)}
                          disabled={player.isAssigned}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {pagination.limit === -1 
              ? `${t("common.showing")} ${pagination.total} ${t("common.of")} ${pagination.total}` 
              : `${t("common.showing")} ${(pagination.page - 1) * pagination.limit + 1}-${Math.min(pagination.page * pagination.limit, pagination.total)} ${t("common.of")} ${pagination.total}`
            }
          </span>
          <select value={pagination.limit} onChange={(e) => onLimitChange(Number(e.target.value))} className="border rounded px-2 py-1 text-sm">
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={-1}>{t("common.all")}</option>
          </select>
          <span>{t("common.perPage")}</span>
        </div>

          {pagination.totalPages > 1 && pagination.limit !== -1 && (
            <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onPrevPage} disabled={pagination.page <= 1}>
              <ChevronLeft className="h-4 w-4" />
              {t("common.previous")}
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <Button key={pageNum} variant={pagination.page === pageNum ? "default" : "outline"} size="sm" onClick={() => onPageChange(pageNum)} className="w-8 h-8 p-0">
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button variant="outline" size="sm" onClick={onNextPage} disabled={pagination.page >= pagination.totalPages}>
              {t("common.next")}
              <ChevronRight className="h-4 w-4" />
            </Button>
            </div>
          )}
        </div>
    </div>
  );
}
