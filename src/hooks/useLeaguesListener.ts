import { useEffect, useRef } from "react";
import { Channel } from "pusher-js";
import { getPusherInstance } from "@/lib/pusher-client";
import { getLeaguesChannel, PUSHER_EVENTS } from "@/lib/pusher-shared";

interface UseLeaguesListenerProps {
  enabled?: boolean;
  onLeagueCreated?: (data: any) => void;
  onTeamJoined?: (data: any) => void;
  onLeagueUpdated?: (data: any) => void;
  onBotConfigUpdated?: (data: any) => void;
}

export function useLeaguesListener({
  enabled = true,
  onLeagueCreated,
  onTeamJoined,
  onLeagueUpdated,
  onBotConfigUpdated,
}: UseLeaguesListenerProps) {
  const pusherRef = useRef(getPusherInstance());
  const channelRef = useRef<Channel | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const pusher = pusherRef.current;
    const channelName = getLeaguesChannel();
    const channel = pusher.subscribe(channelName);
    channelRef.current = channel;

    if (process.env.NODE_ENV === 'development') {
      console.log('[PUSHER] Subscribed to leagues channel:', channelName);
    }

    // Bind event listeners
    if (onLeagueCreated) {
      channel.bind(PUSHER_EVENTS.LEAGUE_CREATED, onLeagueCreated);
    }
    if (onTeamJoined) {
      channel.bind(PUSHER_EVENTS.TEAM_JOINED, onTeamJoined);
    }
    if (onLeagueUpdated) {
      channel.bind(PUSHER_EVENTS.LEAGUE_UPDATED, onLeagueUpdated);
    }
    if (onBotConfigUpdated) {
      channel.bind(PUSHER_EVENTS.BOT_CONFIG_UPDATED, onBotConfigUpdated);
    }

    // Cleanup function
    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
      if (process.env.NODE_ENV === 'development') {
        console.log('[PUSHER] Unsubscribed from leagues channel');
      }
    };
  }, [
    enabled,
    onLeagueCreated,
    onTeamJoined,
    onLeagueUpdated,
    onBotConfigUpdated,
  ]);

  return {
    pusher: pusherRef.current,
    channel: channelRef.current,
  };
}