// Socket.io event types for real-time communication

import { PlayerSelection, PlayerAssignment, Player } from "./player";
import { AuctionRound } from "./index";

// Base socket event
export interface BaseSocketEvent {
  leagueId: string;
  roundId?: string;
  timestamp?: Date;
}

// Player selection events
export interface PlayerSelectedEvent extends BaseSocketEvent {
  selection: PlayerSelection;
  userId: string;
  playerName: string;
  teamName: string;
}

export interface SelectionCancelledEvent extends BaseSocketEvent {
  userId: string;
  teamName: string;
  reason?: string;
}

// Round resolution events
export interface RoundResolvedEvent extends BaseSocketEvent {
  assignments: PlayerAssignment[];
  conflicts?: ConflictResolution[];
  nextRound?: AuctionRound;
  canContinue: boolean;
}

export interface ConflictResolution {
  playerId: string;
  playerName: string;
  conflictedSelections: PlayerSelection[];
  winner: PlayerSelection | null;
  randomNumbers: Record<string, number>;
}

// Auction state events
export interface AuctionStateUpdateEvent extends BaseSocketEvent {
  status: "SETUP" | "AUCTION" | "COMPLETED";
  currentRound?: any; // Using any to avoid circular import, will be AuctionRound
  message?: string;
}

export interface NextRoundStartedEvent {
  leagueId: string;
  round: any; // AuctionRound object from server
  position: string;
  message: string;
}

// Admin events
export interface AdminActionEvent extends BaseSocketEvent {
  action: string;
  adminName: string;
  targetTeam?: string;
  playerName?: string;
  reason?: string;
}

export interface AdminOverrideEvent extends BaseSocketEvent {
  action: "cancel-selection" | "force-resolution" | "reset-round";
  adminName: string;
  message: string;
}

// Connection events
export interface UserConnectedEvent {
  leagueId: string;
  userId: string;
  userName: string;
}

export interface UserDisconnectedEvent {
  leagueId: string;
  userId: string;
  userName: string;
}

// Error events
export interface SocketErrorEvent {
  error: string;
  message?: string;
  code?: string;
}

// Socket event types matching useSocketIO AuctionEvents interface
export interface PlayerSelectedSocketEvent {
  selection: {
    id: string;
    user: { id: string; name: string };
    player: Player;
  };
  leagueId: string;
  roundId: string;
}

export interface RoundResolvedSocketEvent {
  leagueId: string;
  roundId: string;
  result: {
    assignments: any[];
    canContinue: boolean;
  };
  assignments: any[];
  canContinue: boolean;
}

export interface ConflictResolutionData {
  leagueId: string;
  roundId: string;
  conflicts: any[];
  roundContinues: boolean;
  assignments: any[];
}

export interface RoundContinuesData {
  leagueId: string;
  roundId: string;
  teamsWithoutAssignments: Array<{
    id: string;
    name: string;
  }>;
  message: string;
}

export interface AdminPlayerSocketData {
  selection: {
    id: string;
    user: { id: string; name: string };
    player: Player;
  };
  leagueId: string;
  roundId: string;
  isAdminAction: boolean;
  adminReason: string;
  targetTeam: {
    id: string;
    name: string;
    userName: string;
  };
}

export interface AdminPlayerSelectedData extends PlayerSelectedEvent {
  isAdminAction: boolean;
  adminReason: string;
  targetTeam: {
    id: string;
    name: string;
    userName: string;
  };
}

export interface RoundReadyData {
  leagueId: string;
  roundId: string;
  message: string;
}

export interface AdminOverrideData extends AdminActionEvent {
  action: "cancel-selection" | "force-resolution" | "reset-round";
  result: {
    action: string;
    message: string;
    cancelledPlayer?: string;
  };
}

// Additional interfaces moved from index.ts
export interface SocketEventData {
  leagueId: string;
  roundId?: string;
  timestamp?: Date;
}

export interface AuctionResultData {
  assignments: AssignmentData[];
  conflicts: ConflictData[];
  roundContinues: boolean;
  canContinue: boolean;
  teamsWithoutAssignments: Array<{ id: string; name: string }>;
  message: string;
}

export interface AssignmentData {
  playerId: string;
  winnerId: string;
  winnerName: string;
  playerName: string;
  price: number;
  randomNumber?: number;
}

export interface ConflictData {
  teamId: string;
  playerName: string;
  randomNumbers: Record<string, number>;
}

// Socket event names (for type safety)
export const SOCKET_EVENTS = {
  // Player events
  PLAYER_SELECTED: "player-selected",
  ADMIN_PLAYER_SELECTED: "admin-player-selected",
  SELECTION_CANCELLED: "selection-cancelled",

  // Round events
  ROUND_RESOLVED: "round-resolved",
  ROUND_READY_FOR_RESOLUTION: "round-ready-for-resolution",
  CONFLICT_RESOLUTION: "conflict-resolution",
  ROUND_CONTINUES: "round-continues",
  NEXT_ROUND_STARTED: "next-round-started",

  // Auction events
  AUCTION_STATE_UPDATE: "auction-state-update",

  // Admin events
  ADMIN_ACTION: "admin-action",
  ADMIN_OVERRIDE: "admin-override",

  // Connection events
  USER_CONNECTED: "user-connected",
  USER_LEFT: "user-left",
  USER_DISCONNECTED: "user-disconnected",
  USER_TIMEOUT: "user-timeout",
  USERS_ONLINE: "users-online",

  // Error events
  SOCKET_ERROR: "socket-error",

  // System events
  HEARTBEAT: "heartbeat",
  RECONNECT: "reconnect",
} as const;

export type SocketEventName = keyof typeof SOCKET_EVENTS;
