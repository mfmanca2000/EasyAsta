"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { redirect } from "@/i18n/navigation";
import { usePlayers, Player } from "@/hooks/usePlayers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Search, Filter, Trash2, Edit, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { TeamLogo } from "@/components/ui/team-logo";
import { PlayersPageSkeleton, PlayersTableSkeleton } from "@/components/ui/players-skeleton";

interface League {
  id: string;
  name: string;
  status: "SETUP" | "AUCTION" | "COMPLETED";
  admin: {
    id: string;
    name: string;
    email: string;
  };
}

export default function PlayersPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const leagueId = params.id as string;
  const locale = params.locale as string;
  const t = useTranslations();

  const [league, setLeague] = useState<League | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);

  // Filtri
  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [availableFilter, setAvailableFilter] = useState<string>("all");

  // Hook per gestire calciatori
  const { players, stats, loading, pagination, sorting, fetchPlayers, importPlayers, deletePlayer, goToPage, nextPage, prevPage, toggleSort, setLimit } = usePlayers(leagueId);

  const fetchLeague = useCallback(async () => {
    try {
      const response = await fetch(`/api/leagues/${leagueId}`);
      if (response.ok) {
        const data = await response.json();
        setLeague(data.league);
      }
    } catch (error) {
      console.error(t('errors.loadingLeague'), error);
    }
  }, [leagueId, t]);

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect({ href: "/api/auth/signin", locale });
    }
    if (status === "authenticated" && leagueId) {
      fetchLeague();
      fetchPlayers();
    }
  }, [status, leagueId, fetchPlayers, fetchLeague, locale]);

  // Reset alla pagina 1 quando cambiano i filtri
  useEffect(() => {
    goToPage(1);
  }, [searchTerm, positionFilter, availableFilter, goToPage]);

  useEffect(() => {
    if (status === "authenticated" && leagueId) {
      fetchPlayers({
        search: searchTerm,
        position: positionFilter,
        available: availableFilter,
        page: pagination.page,
        limit: pagination.limit,
        sortField: sorting.field,
        sortDirection: sorting.direction,
      });
    }
  }, [searchTerm, positionFilter, availableFilter, pagination.page, pagination.limit, sorting.field, sorting.direction, status, leagueId, fetchPlayers]);

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const fileInput = form.file as HTMLInputElement;
    const file = fileInput.files?.[0];

    if (!file) return;

    setUploading(true);

    try {
      const result = await importPlayers(file);

      if (result.success) {
        alert(`${t('common.success')}! ${result.data.count} ${t('navigation.players')} ${t('players.import')}.`);
        setShowImportForm(false);
        form.reset();
      } else {
        if (result.warning) {
          const proceed = confirm(`Attenzione:\n${result.details?.join("\n") || ""}\n\nVuoi procedere comunque?`);
          if (!proceed) return;
        } else {
          alert(`${t('common.error')}: ${result.error}\n${result.details?.join("\n") || ""}`);
        }
      }
    } catch (error) {
      console.error(t('errors.uploadError'), error);
      alert(t('errors.uploadError'));
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePlayer = async (playerId: string, playerName: string) => {
    if (!confirm(t('errors.deleteConfirm', { name: playerName }))) {
      return;
    }

    try {
      const result = await deletePlayer(playerId);
      if (result.success) {
        alert(t('errors.deleteSuccess'));
      } else {
        alert(`${t('common.error')}: ${result.error}`);
      }
    } catch (error) {
      console.error(t('errors.deleteError'), error);
      alert(t('errors.deleteError'));
    }
  };

  const getSortIcon = (field: string) => {
    if (sorting.field !== field) return null;
    return sorting.direction === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  const SortableHeader = ({ field, children, className = "" }: { field: string; children: React.ReactNode; className?: string }) => (
    <TableHead className={`cursor-pointer hover:bg-muted/50 transition-colors ${className}`} onClick={() => toggleSort(field)}>
      <div className="flex items-center gap-2">
        {children}
        {getSortIcon(field)}
      </div>
    </TableHead>
  );

  const getPositionBadge = (position: Player["position"]) => {
    const styles = {
      P: "bg-green-100 text-green-800 border-green-200", // Verde per Portieri
      D: "bg-blue-100 text-blue-800 border-blue-200", // Blu per Difensori
      C: "bg-yellow-100 text-yellow-800 border-yellow-200", // Giallo per Centrocampisti
      A: "bg-red-100 text-red-800 border-red-200", // Rosso per Attaccanti
    } as const;

    const labels = {
      P: t('players.positionLabels.P'),
      D: t('players.positionLabels.D'),
      C: t('players.positionLabels.C'),
      A: t('players.positionLabels.A'),
    };

    return (
      <Badge className={`${styles[position]} hover:opacity-80 transition-opacity`} variant="outline">
        {labels[position]}
      </Badge>
    );
  };

  if (status === "loading" || !league) {
    return <PlayersPageSkeleton />;
  }

  const isAdmin = league.admin.email === session?.user?.email;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t('players.playersTitle', { leagueName: league.name })}</h1>
          <p className="text-muted-foreground">{isAdmin ? t('players.adminDescription') : t('players.playerDescription')}</p>
        </div>
        {isAdmin && league.status === "SETUP" && (
          <Button onClick={() => setShowImportForm(true)}>
            <Upload className="mr-2 h-4 w-4" />
            {t('players.importExcel')}
          </Button>
        )}
      </div>

      {/* Statistiche */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card
          className={`cursor-pointer transition-all hover:shadow-lg ${positionFilter === "P" ? "ring-2 ring-green-500 bg-green-50 border-green-200" : "hover:bg-green-50/50"}`}
          onClick={() => setPositionFilter(positionFilter === "P" ? "all" : "P")}
        >
          <CardContent className="p-4">
            <div className={`text-2xl font-bold ${positionFilter === "P" ? "text-green-800" : ""}`}>{stats.P || 0}</div>
            <div className={`text-sm ${positionFilter === "P" ? "text-green-700" : "text-muted-foreground"}`}>{t('players.goalkeepers')}</div>
            {positionFilter === "P" && <div className="text-xs text-green-700 font-medium mt-1">Filtro attivo</div>}
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all hover:shadow-lg ${positionFilter === "D" ? "ring-2 ring-blue-500 bg-blue-50 border-blue-200" : "hover:bg-blue-50/50"}`}
          onClick={() => setPositionFilter(positionFilter === "D" ? "all" : "D")}
        >
          <CardContent className="p-4">
            <div className={`text-2xl font-bold ${positionFilter === "D" ? "text-blue-800" : ""}`}>{stats.D || 0}</div>
            <div className={`text-sm ${positionFilter === "D" ? "text-blue-700" : "text-muted-foreground"}`}>{t('players.defenders')}</div>
            {positionFilter === "D" && <div className="text-xs text-blue-700 font-medium mt-1">Filtro attivo</div>}
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all hover:shadow-lg ${positionFilter === "C" ? "ring-2 ring-yellow-500 bg-yellow-50 border-yellow-200" : "hover:bg-yellow-50/50"}`}
          onClick={() => setPositionFilter(positionFilter === "C" ? "all" : "C")}
        >
          <CardContent className="p-4">
            <div className={`text-2xl font-bold ${positionFilter === "C" ? "text-yellow-800" : ""}`}>{stats.C || 0}</div>
            <div className={`text-sm ${positionFilter === "C" ? "text-yellow-700" : "text-muted-foreground"}`}>{t('players.midfielders')}</div>
            {positionFilter === "C" && <div className="text-xs text-yellow-700 font-medium mt-1">Filtro attivo</div>}
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all hover:shadow-lg ${positionFilter === "A" ? "ring-2 ring-red-500 bg-red-50 border-red-200" : "hover:bg-red-50/50"}`}
          onClick={() => setPositionFilter(positionFilter === "A" ? "all" : "A")}
        >
          <CardContent className="p-4">
            <div className={`text-2xl font-bold ${positionFilter === "A" ? "text-red-800" : ""}`}>{stats.A || 0}</div>
            <div className={`text-sm ${positionFilter === "A" ? "text-red-700" : "text-muted-foreground"}`}>{t('players.forwards')}</div>
            {positionFilter === "A" && <div className="text-xs text-red-700 font-medium mt-1">Filtro attivo</div>}
          </CardContent>
        </Card>
      </div>

      {/* Form Import */}
      {showImportForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('players.importExcelTitle')}</CardTitle>
            <CardDescription>{t('players.importExcelDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleFileUpload} className="space-y-4">
              <div>
                <Label htmlFor="file">{t('players.excelFile')}</Label>
                <Input id="file" name="file" type="file" accept=".xlsx,.xls" required />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={uploading}>
                  {uploading ? t('players.importing') : t('players.import')}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowImportForm(false)}>
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filtri */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder={t('players.searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
            </div>
            <div className="w-40">
              <Select value={positionFilter} onValueChange={setPositionFilter}>
                <SelectTrigger>
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('players.allRoles')}</SelectItem>
                  <SelectItem value="P">{t('players.goalkeepers')}</SelectItem>
                  <SelectItem value="D">{t('players.defenders')}</SelectItem>
                  <SelectItem value="C">{t('players.midfielders')}</SelectItem>
                  <SelectItem value="A">{t('players.forwards')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Select value={availableFilter} onValueChange={setAvailableFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('players.allStatus')}</SelectItem>
                  <SelectItem value="true">{t('players.availableOnly')}</SelectItem>
                  <SelectItem value="false">{t('players.assignedOnly')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <Select
                value={pagination.limit === 50 ? "50" : pagination.limit === 100 ? "100" : pagination.limit === -1 ? "all" : "50"}
                onValueChange={(value) => setLimit(value === "all" ? -1 : parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">{t('players.itemsPerPage50')}</SelectItem>
                  <SelectItem value="100">{t('players.itemsPerPage100')}</SelectItem>
                  <SelectItem value="all">{t('players.itemsPerPageAll')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Informazioni risultati */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-4 border-t text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>
                <strong className="text-foreground">{players.length}</strong> {t('players.playersDisplayed', { count: players.length })}
                {pagination.total !== players.length && (
                  <span>
                    {t('players.playersDisplayedOf', { total: pagination.total })}
                  </span>
                )}
              </span>

              {/* Filtri attivi */}
              {(searchTerm || positionFilter !== "all" || availableFilter !== "all") && (
                <div className="flex items-center gap-2">
                  <span>•</span>
                  <span>{t('players.activeFilters')}</span>
                  <div className="flex gap-1">
                    {searchTerm && (
                      <Badge variant="secondary" className="text-xs">
                        {t('players.searchFilter', { term: searchTerm })}
                      </Badge>
                    )}
                    {positionFilter !== "all" && (
                      <Badge variant="secondary" className="text-xs">
                        {t('players.roleFilter', { role: positionFilter })}
                      </Badge>
                    )}
                    {availableFilter !== "all" && (
                      <Badge variant="secondary" className="text-xs">
                        {availableFilter === "true" ? t('players.availableOnly') : t('players.assignedOnly')}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Ordinamento attivo */}
            <div className="flex items-center gap-2">
              <span>{t('players.sortedBy')}</span>
              <Badge variant="outline" className="text-xs">
                {sorting.field === "name"
                  ? t('players.sortName')
                  : sorting.field === "position"
                  ? t('players.sortPosition')
                  : sorting.field === "realTeam"
                  ? t('players.sortTeam')
                  : sorting.field === "price"
                  ? t('players.sortPrice')
                  : sorting.field === "isAssigned"
                  ? t('players.sortStatus')
                  : sorting.field}
                {sorting.direction === "asc" ? t('players.sortAsc') : t('players.sortDesc')}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista Calciatori */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <PlayersTableSkeleton showActions={isAdmin && league.status === "SETUP"} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader field="name">{t('common.name')}</SortableHeader>
                  <SortableHeader field="position">{t('players.position')}</SortableHeader>
                  <SortableHeader field="realTeam">{t('players.team')}</SortableHeader>
                  <SortableHeader field="price" className="text-right">
                    {t('players.price')}
                  </SortableHeader>
                  <SortableHeader field="isAssigned" className="text-center">
                    {t('players.status')}
                  </SortableHeader>
                  {isAdmin && league.status === "SETUP" && <TableHead className="text-right">{t('players.actionsColumn')}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.map((player) => (
                  <TableRow key={player.id} className={player.isAssigned ? "bg-muted/30" : ""}>
                    <TableCell className="font-medium">{player.name}</TableCell>
                    <TableCell>{getPositionBadge(player.position)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <TeamLogo teamName={player.realTeam} size={18} />
                        <span className="capitalize">{player.realTeam}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{player.price}€</TableCell>
                    <TableCell className="text-center">
                      {player.isAssigned ? (
                        <Badge variant="outline" className="text-xs">
                          {t('players.assigned')}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          {t('players.available')}
                        </Badge>
                      )}
                    </TableCell>
                    {isAdmin && league.status === "SETUP" && (
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            title={t('players.editPlayer')}
                            onClick={() => {
                              alert(t('errors.editFeatureComing'));
                            }}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          {!player.isAssigned && (
                            <Button size="sm" variant="outline" title={t('players.deletePlayer')} onClick={() => handleDeletePlayer(player.id, player.name)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Paginazione */}
      {pagination.totalPages > 1 && (
        <Card className="mt-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {pagination.totalPages === 1
                  ? t('players.showingAll', { total: pagination.total })
                  : t('players.showingRange', { 
                      start: Math.min(pagination.limit * (pagination.page - 1) + 1, pagination.total),
                      end: Math.min(pagination.limit * pagination.page, pagination.total),
                      total: pagination.total
                    })}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={prevPage} disabled={pagination.page === 1}>
                  <ChevronLeft className="h-4 w-4" />
                  {t('players.previousPage')}
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }

                    return (
                      <Button key={pageNum} variant={pagination.page === pageNum ? "default" : "outline"} size="sm" onClick={() => goToPage(pageNum)} className="w-8 h-8 p-0">
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button variant="outline" size="sm" onClick={nextPage} disabled={pagination.page === pagination.totalPages}>
                  {t('players.nextPage')}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {players.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('players.noPlayersFoundTitle')}</h3>
            <p className="text-muted-foreground mb-4">{isAdmin ? t('players.noPlayersFoundDescriptionAdmin') : t('players.noPlayersFoundDescriptionPlayer')}</p>
            {isAdmin && league.status === "SETUP" && (
              <Button onClick={() => setShowImportForm(true)}>
                <Upload className="mr-2 h-4 w-4" />
                {t('players.importExcel')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground">{t('players.loadingPlayers')}</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
