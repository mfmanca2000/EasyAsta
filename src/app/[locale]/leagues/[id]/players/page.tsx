"use client";

import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { redirect } from "@/i18n/navigation";
import { usePlayers } from "@/hooks/usePlayers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayersPageSkeleton } from "@/components/ui/players-skeleton";

// Import custom hooks
import { usePlayersFilters } from "./hooks/usePlayersFilters";
import { usePlayersImport } from "./hooks/usePlayersImport";
import { usePlayersAdmin } from "./hooks/usePlayersAdmin";

// Import components
import PlayersFilters from "./components/PlayersFilters";
import PlayersTable from "./components/PlayersTable";
import PlayersImportForm from "./components/PlayersImportForm";
import PlayersStats from "./components/PlayersStats";
import PlayersActions from "./components/PlayersActions";

export default function PlayersPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const leagueId = params.id as string;
  const locale = params.locale as string;
  const t = useTranslations();

  // Custom hooks
  const { league, loading: adminLoading, canModifyPlayers } = usePlayersAdmin({ leagueId });
  const { 
    players, 
    stats, 
    loading, 
    pagination, 
    sorting, 
    fetchPlayers, 
    deletePlayer, 
    goToPage, 
    nextPage, 
    prevPage, 
    toggleSort, 
    setLimit 
  } = usePlayers(leagueId);
  
  const {
    searchTerm,
    positionFilter,
    availableFilter,
    setSearchTerm,
    setPositionFilter,
    setAvailableFilter,
    filteredPlayers,
    filterStats,
    resetFilters,
  } = usePlayersFilters({ players });

  const {
    uploading,
    showImportForm,
    importPlayers: doImportPlayers,
    openImportForm,
    closeImportForm,
  } = usePlayersImport({ 
    leagueId, 
    onImportSuccess: fetchPlayers 
  });

  // Check authentication
  if (status === "loading" || adminLoading) {
    return <PlayersPageSkeleton />;
  }
  
  if (!session) {
    redirect({ href: "/auth/signin", locale });
    return null;
  }

  if (!league) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              {t('errors.leagueNotFound')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle import
  const handleImport = async (file: File) => {
    try {
      const result = await doImportPlayers(file);

      if (result.success) {
        alert(`${t('common.success')}! ${result.data?.count} ${t('navigation.players')} ${t('players.import')}.`);
        closeImportForm();
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
    }
  };

  // Handle delete player
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">{t('navigation.players')}</h1>
        <p className="text-muted-foreground">
          {t('players.leaguePlayersDesc', { leagueName: league.name })}
        </p>
      </div>

      {/* Stats */}
      <PlayersStats 
        players={players} 
        leagueStatus={league.status} 
      />

      {/* Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PlayersActions
          canModifyPlayers={canModifyPlayers}
          onImportPlayers={openImportForm}
          onRefreshPlayers={fetchPlayers}
          loading={loading}
        />
      </div>

      {/* Filters */}
      <PlayersFilters
        searchTerm={searchTerm}
        positionFilter={positionFilter}
        availableFilter={availableFilter}
        onSearchChange={setSearchTerm}
        onPositionChange={setPositionFilter}
        onAvailableChange={setAvailableFilter}
        onResetFilters={resetFilters}
        filterStats={filterStats}
      />

      {/* Players Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('players.playersList')}</CardTitle>
          <CardDescription>
            {t('players.playersListDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlayersTable
            players={filteredPlayers}
            loading={loading}
            sorting={sorting}
            pagination={pagination}
            canModifyPlayers={canModifyPlayers}
            onToggleSort={toggleSort}
            onPageChange={goToPage}
            onNextPage={nextPage}
            onPrevPage={prevPage}
            onLimitChange={setLimit}
            onDeletePlayer={handleDeletePlayer}
          />
        </CardContent>
      </Card>

      {/* Import Form Modal */}
      {showImportForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <PlayersImportForm
            uploading={uploading}
            onImport={handleImport}
            onClose={closeImportForm}
          />
        </div>
      )}
    </div>
  );
}