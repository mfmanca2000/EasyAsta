import { useState, useMemo } from "react";

export interface Player {
  id: string;
  name: string;
  position: "P" | "D" | "C" | "A";
  realTeam: string;
  price: number;
  isAssigned: boolean;
}

interface UsePlayersFiltersProps {
  players: Player[];
}

export function usePlayersFilters({ players }: UsePlayersFiltersProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [availableFilter, setAvailableFilter] = useState<string>("all");

  const filteredPlayers = useMemo(() => {
    return players.filter((player) => {
      // Search filter
      const matchesSearch = searchTerm === "" || 
        player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.realTeam.toLowerCase().includes(searchTerm.toLowerCase());

      // Position filter
      const matchesPosition = positionFilter === "all" || player.position === positionFilter;

      // Available filter
      const matchesAvailable = availableFilter === "all" || 
        (availableFilter === "available" && !player.isAssigned) ||
        (availableFilter === "assigned" && player.isAssigned);

      return matchesSearch && matchesPosition && matchesAvailable;
    });
  }, [players, searchTerm, positionFilter, availableFilter]);

  const filterStats = useMemo(() => {
    const total = players.length;
    const filtered = filteredPlayers.length;
    const assigned = players.filter(p => p.isAssigned).length;
    const available = total - assigned;

    return {
      total,
      filtered,
      assigned,
      available,
      filteredAssigned: filteredPlayers.filter(p => p.isAssigned).length,
      filteredAvailable: filteredPlayers.filter(p => !p.isAssigned).length,
    };
  }, [players, filteredPlayers]);

  const resetFilters = () => {
    setSearchTerm("");
    setPositionFilter("all");
    setAvailableFilter("all");
  };

  return {
    // Filter values
    searchTerm,
    positionFilter,
    availableFilter,
    
    // Filter setters
    setSearchTerm,
    setPositionFilter,
    setAvailableFilter,
    
    // Filtered data
    filteredPlayers,
    filterStats,
    
    // Actions
    resetFilters,
  };
}