// Common types and constants used throughout the application

export type Position = "P" | "D" | "C" | "A";

export const POSITIONS = ["P", "D", "C", "A"] as const;

export const POSITION_LABELS = {
  P: "Portiere",
  D: "Difensore", 
  C: "Centrocampista",
  A: "Attaccante"
} as const;

export const POSITION_LIMITS = {
  P: 3,
  D: 8,
  C: 8,
  A: 6
} as const;

export type UserRole = "PLAYER" | "ADMIN";

export type LeagueStatus = "SETUP" | "AUCTION" | "COMPLETED";

export type RoundStatus = "SELECTION" | "RESOLUTION" | "COMPLETED";

export type AdminActionType = 
  | "ADMIN_SELECT"
  | "CANCEL_SELECTION" 
  | "FORCE_RESOLUTION"
  | "RESET_ROUND"
  | "TIMEOUT_CONFIG"
  | "EMERGENCY_PAUSE"
  | "BACKUP_RESTORE";

// Common loading states
export interface LoadingState {
  loading: boolean;
  error: string | null;
}

// Common ID types
export type EntityId = string;
export type UserId = string;
export type LeagueId = string;
export type TeamId = string;
export type PlayerId = string;
export type RoundId = string;