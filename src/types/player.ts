import { Position, EntityId, PlayerId, LeagueId, TeamId } from "./common";

// Base player interface - minimal data
export interface BasePlayer {
  id: PlayerId;
  externalId?: string | null;
  name: string;
  position: Position;
  realTeam: string;
  price: number;
}

// Full player interface - includes assignment status
export interface Player extends BasePlayer {
  isAssigned: boolean;
  leagueId: LeagueId;
  createdAt: Date;
  updatedAt: Date;
}

// Player with team assignment
export interface PlayerWithTeam extends Player {
  teamPlayers: TeamPlayer[];
}

// Player selection data
export interface PlayerSelection {
  id: EntityId;
  roundId: EntityId;
  userId: EntityId;
  playerId: PlayerId;
  randomNumber?: number;
  isWinner: boolean;
  isAdminSelection?: boolean;  // Tracks if selection was made by admin
  adminReason?: string;        // Reason if admin selection
  createdAt: Date;
  player?: BasePlayer;
  user?: {
    id: EntityId;
    name?: string;
    email: string;
  };
}

// Team player assignment
export interface TeamPlayer {
  id: EntityId;
  teamId: TeamId;
  playerId: PlayerId;
  acquiredAt: Date;
  player: BasePlayer;
}

// Player assignment result
export interface PlayerAssignment {
  playerId: PlayerId;
  teamId: TeamId;
  winningSelection: PlayerSelection;
  price: number;
}

// Player statistics
export interface PlayerStats {
  total: number;
  byPosition: Record<Position, number>;
  assigned: number;
  available: number;
  totalValue: number;
}

// Player filters
export interface PlayerFilters {
  search?: string;
  position?: Position;
  minPrice?: number;
  maxPrice?: number;
  realTeam?: string;
  isAssigned?: boolean;
}

// Player sort options
export type PlayerSortField = "name" | "position" | "realTeam" | "price";
export type PlayerSortOrder = "asc" | "desc";

export interface PlayerSort {
  field: PlayerSortField;
  order: PlayerSortOrder;
}