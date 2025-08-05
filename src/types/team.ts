import { UserId, LeagueId, TeamId } from "./common";
import { TeamPlayer } from "./player";

// Base team interface
export interface BaseTeam {
  id: TeamId;
  name: string;
  userId: UserId;
  leagueId: LeagueId;
  remainingCredits: number;
  createdAt: Date;
  updatedAt: Date;
}

// Team with user info
export interface TeamWithUser extends BaseTeam {
  user: {
    id: UserId;
    name?: string;
    email: string;
    image?: string;
  };
}

// Team with players
export interface TeamWithPlayers extends TeamWithUser {
  teamPlayers: TeamPlayer[];
}

// Team statistics
export interface TeamStats {
  totalPlayers: number;
  playersByPosition: {
    P: number;
    D: number;
    C: number;
    A: number;
  };
  totalSpent: number;
  remainingCredits: number;
  isComplete: boolean;
}

// Team roster composition
export interface RosterComposition {
  required: {
    P: number;
    D: number;
    C: number;
    A: number;
  };
  current: {
    P: number;
    D: number;
    C: number;
    A: number;
  };
  missing: {
    P: number;
    D: number;
    C: number;
    A: number;
  };
}

// Team selection summary
export interface TeamSelectionSummary {
  teamId: TeamId;
  teamName: string;
  hasSelected: boolean;
  selectedPlayerId?: string;
  selectedPlayerName?: string;
  remainingCredits: number;
}
