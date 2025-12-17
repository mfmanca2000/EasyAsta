import { useEffect, useRef } from "react";
import { Channel } from "pusher-js";
import { getPusherInstance } from "@/lib/pusher-client";
import { getAuctionChannel, PUSHER_EVENTS } from "@/lib/pusher-shared";

interface UsePusherListenerProps {
  leagueId: string;
  enabled?: boolean;
  onPlayerSelected?: () => void;
  onRoundResolved?: () => void;
  onAuctionStateUpdate?: () => void;
  onAdminPlayerSelected?: () => void;
  onNextRoundStarted?: () => void;
}

export function usePusherListener({
  leagueId,
  enabled = true,
  onPlayerSelected,
  onRoundResolved,
  onAuctionStateUpdate,
  onAdminPlayerSelected,
  onNextRoundStarted,
}: UsePusherListenerProps) {
  const pusherRef = useRef(getPusherInstance());
  const channelRef = useRef<Channel | null>(null);

  useEffect(() => {
    if (!leagueId || !enabled) return;

    const pusher = pusherRef.current;
    const channelName = getAuctionChannel(leagueId);
    const channel = pusher.subscribe(channelName);
    channelRef.current = channel;

    // Bind event listeners
    if (onPlayerSelected) {
      channel.bind(PUSHER_EVENTS.PLAYER_SELECTED, onPlayerSelected);
    }
    if (onAdminPlayerSelected) {
      channel.bind(PUSHER_EVENTS.ADMIN_PLAYER_SELECTED, onAdminPlayerSelected);
    }
    if (onRoundResolved) {
      channel.bind(PUSHER_EVENTS.ROUND_RESOLVED, onRoundResolved);
    }
    if (onAuctionStateUpdate) {
      channel.bind(PUSHER_EVENTS.AUCTION_STATE_UPDATE, onAuctionStateUpdate);
      channel.bind("auction-started", onAuctionStateUpdate);
    }
    if (onNextRoundStarted) {
      channel.bind(PUSHER_EVENTS.NEXT_ROUND_STARTED, onNextRoundStarted);
    }

    // Cleanup function
    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
    };
  }, [
    leagueId,
    enabled,
    onPlayerSelected,
    onRoundResolved,
    onAuctionStateUpdate,
    onAdminPlayerSelected,
    onNextRoundStarted,
  ]);

  return {
    pusher: pusherRef.current,
    channel: channelRef.current,
  };
}