"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Coins, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Player } from "@/types";

interface PlayerSelectionTableProps {
  players: Player[];
  selectedPlayerId: string | null;
  onPlayerSelect: (playerId: string | null) => void;
  onPlayerConfirm: (playerId: string) => void;
  isSelecting: boolean;
  disabled?: boolean;
}

type SortField = "name" | "realTeam" | "price";
type SortOrder = "asc" | "desc";

export default function PlayerSelectionTable({ players, selectedPlayerId, onPlayerSelect, onPlayerConfirm, isSelecting, disabled = false }: PlayerSelectionTableProps) {
  const t = useTranslations();
  const [searchTerm, setSearchTerm] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Get unique teams for filter
  const uniqueTeams = useMemo(() => {
    const teams = Array.from(new Set(players.map((p) => p.realTeam))).sort();
    return teams;
  }, [players]);

  // Filter and sort players
  const filteredAndSortedPlayers = useMemo(() => {
    const filtered = players.filter((player) => {
      const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase()) || player.realTeam.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTeam = teamFilter === "all" || player.realTeam === teamFilter;
      return matchesSearch && matchesTeam;
    });

    // Sort players
    filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case "name":
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case "realTeam":
          aValue = a.realTeam.toLowerCase();
          bValue = b.realTeam.toLowerCase();
          break;
        case "price":
          aValue = a.price;
          bValue = b.price;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [players, searchTerm, teamFilter, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 ml-1 text-gray-400" />;
    }
    return sortOrder === "asc" ? <ArrowUp className="w-4 h-4 ml-1 text-blue-600" /> : <ArrowDown className="w-4 h-4 ml-1 text-blue-600" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auction.selectPlayer")}</CardTitle>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input placeholder={t("auction.searchPlayers")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" disabled={disabled} />
          </div>

          <Select value={teamFilter} onValueChange={setTeamFilter} disabled={disabled}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder={t("auction.filterByTeam")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("auction.allTeams")}</SelectItem>
              {uniqueTeams.map((team) => (
                <SelectItem key={team} value={team}>
                  {team}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="text-sm text-muted-foreground">{t("auction.playersFound", { count: filteredAndSortedPlayers.length })}</div>
      </CardHeader>

      <CardContent>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer hover:bg-gray-50 select-none" onClick={() => handleSort("name")}>
                  <div className="flex items-center">
                    {t("auction.playerName")}
                    {getSortIcon("name")}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-gray-50 select-none" onClick={() => handleSort("realTeam")}>
                  <div className="flex items-center">
                    {t("auction.team")}
                    {getSortIcon("realTeam")}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-gray-50 select-none text-right" onClick={() => handleSort("price")}>
                  <div className="flex items-center justify-end">
                    {t("auction.price")}
                    {getSortIcon("price")}
                  </div>
                </TableHead>
                <TableHead className="w-24">{t("auction.position")}</TableHead>
                <TableHead className="w-32 text-center">{t("auction.action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedPlayers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {t("auction.noPlayersFound")}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedPlayers.map((player) => (
                  <TableRow
                    key={player.id}
                    className={`cursor-pointer transition-colors ${selectedPlayerId === player.id ? "bg-blue-50 hover:bg-blue-100 border-l-4 border-l-blue-500" : "hover:bg-gray-50"}`}
                    onClick={() => !disabled && onPlayerSelect(selectedPlayerId === player.id ? null : player.id)}
                  >
                    <TableCell className="font-medium">{player.name}</TableCell>
                    <TableCell className="text-muted-foreground">{player.realTeam}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Coins className="w-3 h-3" />
                        <span className="font-medium">{player.price}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {player.position}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {selectedPlayerId === player.id ? (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPlayerConfirm(player.id);
                          }}
                          disabled={isSelecting || disabled}
                          className="min-w-20"
                        >
                          {isSelecting && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                          {t("auction.selectButton")}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPlayerSelect(player.id);
                          }}
                          disabled={disabled}
                          className="min-w-20"
                        >
                          {t("auction.choose")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile-friendly selection info */}
        {selectedPlayerId && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md sm:hidden">
            {(() => {
              const selectedPlayer = players.find((p) => p.id === selectedPlayerId);
              return selectedPlayer ? (
                <div className="space-y-2">
                  <div className="font-medium text-blue-900">{t("auction.selectedPlayerMobile", { name: selectedPlayer.name })}</div>
                  <div className="text-sm text-blue-700">
                    {selectedPlayer.realTeam} • {selectedPlayer.price} crediti
                  </div>
                  <Button size="sm" onClick={() => onPlayerConfirm(selectedPlayer.id)} disabled={isSelecting || disabled} className="w-full">
                    {isSelecting && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                    {t("auction.confirmSelection")}
                  </Button>
                </div>
              ) : null;
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
