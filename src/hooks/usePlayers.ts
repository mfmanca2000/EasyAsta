import { useState, useCallback } from "react";

export interface Player {
  id: string;
  name: string;
  position: "P" | "D" | "C" | "A";
  realTeam: string;
  price: number;
  isAssigned: boolean;
}

export interface PlayersState {
  players: Player[];
  stats: Record<string, number>;
  loading: boolean;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  sorting: {
    field: string;
    direction: 'asc' | 'desc';
  };
}

export function usePlayers(leagueId: string) {
  const [state, setState] = useState<PlayersState>({
    players: [],
    stats: {},
    loading: false,
    pagination: {
      page: 1,
      limit: 50,
      total: 0,
      totalPages: 0,
    },
    sorting: {
      field: 'name',
      direction: 'asc',
    },
  });

  const fetchPlayers = useCallback(async (filters?: {
    search?: string;
    position?: string;
    available?: string;
    page?: number;
    limit?: number;
    sortField?: string;
    sortDirection?: 'asc' | 'desc';
  }) => {
    if (!leagueId) return;

    setState(prev => ({ ...prev, loading: true }));

    try {
      const params = new URLSearchParams({ leagueId });

      if (filters?.search) params.append("search", filters.search);
      if (filters?.position && filters.position !== "all") {
        params.append("position", filters.position);
      }
      if (filters?.available && filters.available !== "all") {
        params.append("available", filters.available);
      }
      if (filters?.page) {
        params.append("page", filters.page.toString());
      }
      if (filters?.limit) {
        params.append("limit", filters.limit.toString());
      }
      if (filters?.sortField) {
        params.append("sortField", filters.sortField);
      }
      if (filters?.sortDirection) {
        params.append("sortDirection", filters.sortDirection);
      }

      const response = await fetch(`/api/players?${params}`);
      if (response.ok) {
        const data = await response.json();
        setState(prev => ({
          ...prev,
          players: data.players,
          stats: data.stats || {},
          pagination: {
            ...data.pagination,
            limit: prev.pagination.limit // Mantieni il limite interno, non quello dell'API
          },
          loading: false,
        }));
      } else {
        setState(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error("Errore caricamento calciatori:", error);
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [leagueId]);

  const importPlayers = useCallback(async (file: File) => {
    if (!leagueId) return { success: false, error: "ID lega mancante" };

    const formData = new FormData();
    formData.append("file", file);
    formData.append("leagueId", leagueId);

    try {
      const response = await fetch("/api/players/import", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        // Ricarica la lista dopo l'import
        await fetchPlayers();
        return { success: true, data: result };
      } else {
        return { success: false, error: result.error, details: result.details, warning: result.warning };
      }
    } catch (error) {
      console.error("Errore import calciatori:", error);
      return { success: false, error: "Errore durante l'upload del file" };
    }
  }, [leagueId, fetchPlayers]);

  const goToPage = useCallback((page: number) => {
    setState(prev => ({
      ...prev,
      pagination: { ...prev.pagination, page }
    }));
  }, []);

  const nextPage = useCallback(() => {
    setState(prev => {
      const nextPage = Math.min(prev.pagination.page + 1, prev.pagination.totalPages);
      return {
        ...prev,
        pagination: { ...prev.pagination, page: nextPage }
      };
    });
  }, []);

  const prevPage = useCallback(() => {
    setState(prev => {
      const prevPage = Math.max(prev.pagination.page - 1, 1);
      return {
        ...prev,
        pagination: { ...prev.pagination, page: prevPage }
      };
    });
  }, []);

  const setSorting = useCallback((field: string, direction: 'asc' | 'desc') => {
    setState(prev => ({
      ...prev,
      sorting: { field, direction },
      pagination: { ...prev.pagination, page: 1 } // Reset to first page when sorting
    }));
  }, []);

  const toggleSort = useCallback((field: string) => {
    setState(prev => {
      const newDirection = prev.sorting.field === field && prev.sorting.direction === 'asc' ? 'desc' : 'asc';
      return {
        ...prev,
        sorting: { field, direction: newDirection },
        pagination: { ...prev.pagination, page: 1 }
      };
    });
  }, []);

  const setLimit = useCallback((limit: number) => {
    setState(prev => ({
      ...prev,
      pagination: { ...prev.pagination, limit, page: 1 }
    }));
  }, []);

  return {
    ...state,
    fetchPlayers,
    importPlayers,
    goToPage,
    nextPage,
    prevPage,
    setSorting,
    toggleSort,
    setLimit,
  };
}