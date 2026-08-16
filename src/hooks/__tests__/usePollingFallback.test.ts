import React from "react";
import { render, cleanup } from "@testing-library/react";
import { usePollingFallback } from "../usePollingFallback";

/**
 * Regressione: `page.tsx` passa a `usePollingFallback` delle callback (onPlayerSelected,
 * onRoundResolved, ecc.) come funzioni inline, quindi con identita' diversa ad ogni render.
 * In precedenza queste finivano nelle dipendenze di useCallback/useEffect a valle,
 * cosi' come `isSyncing`/`lastUpdated` (aggiornati dal poll stesso): il risultato era un
 * loop che rieseguiva l'effetto di avvio del polling e quindi un fetch ad ogni render,
 * chiamando /api/auction decine di volte al secondo invece che ogni 2s (vedi incidente
 * EMAXCONN dopo aver cliccato "Avvio turno").
 */

let fetchMock: jest.Mock;

beforeEach(() => {
  fetchMock = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      hasActiveRound: true,
      availablePlayers: [],
      teams: [],
      currentRound: { id: "round-1", status: "SELECTION", position: "P", roundNumber: 1, selections: [] },
    }),
  }));
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

// Riproduce esattamente il pattern di page.tsx: ogni callback e' una arrow function
// inline, ricreata ad ogni render. Un ticker interno forza inoltre re-render frequenti,
// indipendenti dagli aggiornamenti di stato del hook stesso, per simulare i toast e gli
// altri stati che nella pagina reale cambiano durante un'asta.
function ParentWithInlineCallbacks({ leagueId }: { leagueId: string }) {
  const [, forceRerender] = React.useReducer((c: number) => c + 1, 0);

  React.useEffect(() => {
    const id = setInterval(() => forceRerender(), 50);
    return () => clearInterval(id);
  }, []);

  usePollingFallback({
    leagueId,
    enabled: true,
    onPlayerSelected: () => {},
    onAdminPlayerSelected: () => {},
    onRoundResolved: () => {},
    onAuctionStarted: () => {},
    onNextRoundStarted: () => {},
    onRoundReadyForResolution: () => {},
  });

  return null;
}

test("non richiama /api/auction ad ogni render quando le callback sono inline", async () => {
  render(React.createElement(ParentWithInlineCallbacks, { leagueId: "league-1" }));

  // Timer reali, fuori da act(): e' l'unico modo per osservare il loop reale invece
  // che il comportamento "battezzato" da act(), che nasconde il problema con il batching.
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Prima della correzione, in 800ms si osservavano ~25-30 chiamate (loop ad ogni
  // render, ogni ~30ms). Con la correzione ci si aspetta solo il fetch iniziale,
  // dato che il primo tick dell'intervallo di polling (2000ms) non e' ancora arrivato.
  expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(1);
  expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(3);
});

test("interroga /api/auction all'incirca ogni 2 secondi, non ad ogni render", async () => {
  render(React.createElement(ParentWithInlineCallbacks, { leagueId: "league-1" }));

  await new Promise((resolve) => setTimeout(resolve, 2300));

  // Un fetch iniziale + un tick dell'intervallo da 2s, con un margine per i tempi reali.
  expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(1);
  expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(4);
});
