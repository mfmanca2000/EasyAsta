import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Filter, X } from "lucide-react";

interface PlayersFiltersProps {
  searchTerm: string;
  positionFilter: string;
  availableFilter: string;
  onSearchChange: (value: string) => void;
  onPositionChange: (value: string) => void;
  onAvailableChange: (value: string) => void;
  onResetFilters: () => void;
  filterStats: {
    total: number;
    filtered: number;
    assigned: number;
    available: number;
  };
}

export default function PlayersFilters({
  searchTerm,
  positionFilter,
  availableFilter,
  onSearchChange,
  onPositionChange,
  onAvailableChange,
  onResetFilters,
  filterStats,
}: PlayersFiltersProps) {
  const t = useTranslations();

  const hasActiveFilters = searchTerm !== "" || positionFilter !== "all" || availableFilter !== "all";

  return (
    <div className="space-y-4">
      {/* Search and Quick Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search Input */}
        <div className="flex-1">
          <Label htmlFor="search">{t('common.search')}</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              id="search"
              placeholder={t('players.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Position Filter */}
        <div className="min-w-[140px]">
          <Label>{t('players.position')}</Label>
          <Select value={positionFilter} onValueChange={onPositionChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filters.allPositions')}</SelectItem>
              <SelectItem value="P">{t('players.positions.P')}</SelectItem>
              <SelectItem value="D">{t('players.positions.D')}</SelectItem>
              <SelectItem value="C">{t('players.positions.C')}</SelectItem>
              <SelectItem value="A">{t('players.positions.A')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Available Filter */}
        <div className="min-w-[140px]">
          <Label>{t('common.status')}</Label>
          <Select value={availableFilter} onValueChange={onAvailableChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filters.allPlayers')}</SelectItem>
              <SelectItem value="available">{t('players.available')}</SelectItem>
              <SelectItem value="assigned">{t('players.assigned')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reset Filters Button */}
        {hasActiveFilters && (
          <div className="flex items-end">
            <Button variant="outline" size="sm" onClick={onResetFilters}>
              <X className="h-4 w-4 mr-2" />
              {t('common.reset')}
            </Button>
          </div>
        )}
      </div>

      {/* Filter Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Filter className="h-4 w-4" />
          <span>
            {t('players.showingCount', { 
              showing: filterStats.filtered, 
              total: filterStats.total 
            })}
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-4">
          <span>{t('players.availableCount', { count: filterStats.available })}</span>
          <span>{t('players.assignedCount', { count: filterStats.assigned })}</span>
        </div>
      </div>
    </div>
  );
}