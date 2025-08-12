import Pusher from "pusher";

// Server-side Pusher configuration
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_APP_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

export default pusher;

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

// Helper function to trigger events
export const triggerAuctionEvent = async (
  leagueId: string,
  event: keyof typeof PUSHER_EVENTS,
  data: any
) => {
  try {
    await pusher.trigger(getAuctionChannel(leagueId), PUSHER_EVENTS[event], data);
  } catch (error) {
    console.error(`Failed to trigger Pusher event ${event}:`, error);
  }
};

// Helper function to trigger events to multiple channels
export const triggerMultipleEvents = async (
  channels: string[],
  event: keyof typeof PUSHER_EVENTS,
  data: any
) => {
  try {
    await pusher.trigger(channels, PUSHER_EVENTS[event], data);
  } catch (error) {
    console.error(`Failed to trigger Pusher event ${event} to multiple channels:`, error);
  }
};

// Helper function to trigger events to the general leagues channel
export const triggerLeaguesEvent = async (
  event: keyof typeof PUSHER_EVENTS,
  data: any
) => {
  try {
    await pusher.trigger(getLeaguesChannel(), PUSHER_EVENTS[event], data);
  } catch (error) {
    console.error(`Failed to trigger Pusher leagues event ${event}:`, error);
  }
};