// Shared Pusher configuration (safe for both client and server)
// This file contains only pure functions and constants, no instantiation

// Channel naming conventions
export const getLeagueChannel = (leagueId: string) => `league-${leagueId}`;
export const getAuctionChannel = (leagueId: string) => `auction-${leagueId}`;
export const getRoundChannel = (leagueId: string, roundId: string) => `round-${leagueId}-${roundId}`;
export const getLeaguesChannel = () => 'leagues'; // General channel for all leagues

// Event naming conventions (matching Socket.io events)
export const PUSHER_EVENTS = {
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
  AUCTION_STARTED: "auction-started",

  // Admin events
  ADMIN_ACTION: "admin-action",
  ADMIN_OVERRIDE: "admin-override",

  // Connection events
  USER_CONNECTED: "user-connected",
  USER_LEFT: "user-left",
  USER_DISCONNECTED: "user-disconnected",
  USER_TIMEOUT: "user-timeout",
  USERS_ONLINE: "users-online",

  // League management events
  LEAGUE_CREATED: "league-created",
  TEAM_JOINED: "team-joined",
  LEAGUE_UPDATED: "league-updated",
  BOT_CONFIG_UPDATED: "bot-config-updated",

  // System events
  HEARTBEAT: "heartbeat",
  RECONNECT: "reconnect",
} as const;
