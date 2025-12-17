import Pusher from "pusher";
import {
  getLeagueChannel,
  getAuctionChannel,
  getRoundChannel,
  getLeaguesChannel,
  PUSHER_EVENTS,
} from "./pusher-shared";

// Re-export shared utilities for convenience
export {
  getLeagueChannel,
  getAuctionChannel,
  getRoundChannel,
  getLeaguesChannel,
  PUSHER_EVENTS,
};

// Server-side Pusher configuration (ONLY used in API routes)
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_APP_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

export default pusher;

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