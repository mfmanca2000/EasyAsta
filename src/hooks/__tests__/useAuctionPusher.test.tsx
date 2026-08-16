import React from "react";
import { render, cleanup } from "@testing-library/react";
import { useAuctionPusher } from "../useAuctionPusher";

/**
 * Regressione: l'effetto che sottoscrive il canale Pusher elencava tra le dipendenze
 * tutte le callback passate dal chiamante (onPlayerSelected, onRoundResolved, ecc.),
 * ricreate ad ogni render di page.tsx perche' definite come funzioni inline. Il
 * risultato era un `unbind_all` + `unsubscribe` + `subscribe` ad ogni render invece
 * che una sola volta al mount, con continuo churn del canale realtime.
 *
 * `refreshAuctionState` aveva lo stesso problema in un'altra forma: dipendeva da
 * `isSyncing`, che la funzione stessa aggiornava, quindi la sua identita' cambiava
 * ad ogni fetch e retriggerava a cascata l'effetto di sottoscrizione sopra.
 */

const mockChannel = {
  bind: jest.fn(),
  unbind: jest.fn(),
  unbind_all: jest.fn(),
};

const mockPusherInstance = {
  subscribe: jest.fn(() => mockChannel),
  unsubscribe: jest.fn(),
};

jest.mock("@/lib/pusher-client", () => ({
  getPusherInstance: jest.fn(() => mockPusherInstance),
  addConnectionListener: jest.fn(),
  removeConnectionListener: jest.fn(),
  getConnectionStatus: jest.fn(() => ({
    isConnected: true,
    isLimitReached: false,
    lastError: null,
    reconnectAttempts: 0,
    fallbackMode: false, // niente polling fallback: isola il comportamento di Pusher
  })),
}));

let fetchMock: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ hasActiveRound: false }),
  }));
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
});

// Come page.tsx: callback inline ricreate ad ogni render, piu' un ticker interno che
// forza re-render indipendenti dallo stato del hook (toast, altri effetti della pagina).
function ParentWithInlineCallbacks({ leagueId }: { leagueId: string }) {
  const [, forceRerender] = React.useReducer((c: number) => c + 1, 0);

  React.useEffect(() => {
    const id = setInterval(() => forceRerender(), 20);
    return () => clearInterval(id);
  }, []);

  useAuctionPusher({
    leagueId,
    onPlayerSelected: () => {},
    onAdminPlayerSelected: () => {},
    onRoundResolved: () => {},
    onAuctionStarted: () => {},
    onNextRoundStarted: () => {},
    onRoundReadyForResolution: () => {},
    onConflictResolution: () => {},
    onRoundContinues: () => {},
    onAdminOverride: () => {},
    onUserJoined: () => {},
    onUserLeft: () => {},
    onUserDisconnected: () => {},
    onUserTimeout: () => {},
  });

  return null;
}

test("si sottoscrive al canale Pusher una sola volta, non ad ogni render", async () => {
  render(React.createElement(ParentWithInlineCallbacks, { leagueId: "league-1" }));

  await new Promise((resolve) => setTimeout(resolve, 500));

  expect(mockPusherInstance.subscribe).toHaveBeenCalledTimes(1);
  expect(mockPusherInstance.unsubscribe).not.toHaveBeenCalled();
  expect(mockChannel.unbind_all).not.toHaveBeenCalled();
});

test("non richiama /api/auction ad ogni render", async () => {
  render(React.createElement(ParentWithInlineCallbacks, { leagueId: "league-1" }));

  await new Promise((resolve) => setTimeout(resolve, 500));

  // Un solo fetch iniziale (stato non fornito -> refreshAuctionState al mount),
  // non uno per ciascuno dei ~25 render forzati dal ticker in 500ms.
  expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(2);
});
