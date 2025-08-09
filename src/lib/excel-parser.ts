import * as XLSX from "xlsx";

export interface PlayerData {
  externalId?: string | null;
  name: string;
  position: "P" | "D" | "C" | "A";
  realTeam: string;
  price: number;
}

export interface ParseResult {
  success: boolean;
  players: PlayerData[];
  errors: string[];
}

export function parseExcelFile(buffer: ArrayBuffer): ParseResult {
  try {
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Converti in array di array
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

    const players: PlayerData[] = [];
    const errors: string[] = [];

    // I dati dei calciatori iniziano dalla riga 5 (indice 5)
    // Headers sono alla riga 4: ['ID', 'Giocatore', 'Squadra', 'Ruolo', 'Ruolo Mod. Av.', 'Fuori lista', 'Quotazione', ...]
    for (let i = 5; i < data.length; i++) {
      const row = data[i];

      // Salta righe vuote
      if (!row || row.length === 0 || !row[1]) {
        continue;
      }

      const externalId = row[0]; // Colonna "ID"
      const name = row[1];
      const realTeam = row[2];
      const position = row[3] as string;
      const fuoriLista = row[5]; // Colonna "Fuori lista"
      const price = row[6];

      // Salta calciatori fuori lista (con asterisco)
      if (fuoriLista && typeof fuoriLista === "string" && fuoriLista.includes("*")) {
        continue;
      }
      
      // Salta calciatori con ruolo "M" (non supportato)
      if (position === "M") {
        continue;
      }

      // Validazioni
      if (!name || typeof name !== "string") {
        errors.push(`Riga ${i + 1}: Nome calciatore mancante o non valido`);
        continue;
      }

      if (!position || !["P", "D", "C", "A"].includes(position)) {
        errors.push(`Riga ${i + 1}: Ruolo "${position}" non valido per ${name} (deve essere P, D, C, A)`);
        continue;
      }

      if (!realTeam || typeof realTeam !== "string") {
        errors.push(`Riga ${i + 1}: Squadra mancante per ${name}`);
        continue;
      }

      if (typeof price !== "number" || price < 1) {
        errors.push(`Riga ${i + 1}: Prezzo non valido per ${name} (deve essere ≥ 1)`);
        continue;
      }

      players.push({
        externalId: externalId ? String(externalId).trim() : null,
        name: name.trim().toUpperCase(),
        position: position as "P" | "D" | "C" | "A",
        realTeam: realTeam.trim().toLowerCase(),
        price: Math.round(price),
      });
    }

    return {
      success: errors.length === 0,
      players,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      players: [],
      errors: [`Errore parsing file Excel: ${error instanceof Error ? error.message : "Errore sconosciuto"}`],
    };
  }
}

export function validatePlayerList(players: PlayerData[]): string[] {
  const errors: string[] = [];

  if (players.length === 0) {
    errors.push("Nessun calciatore trovato nel file");
    return errors;
  }

  // Controlla duplicati per nome
  const nameCount = new Map<string, number>();
  players.forEach((player) => {
    const count = nameCount.get(player.name) || 0;
    nameCount.set(player.name, count + 1);
  });

  nameCount.forEach((count, name) => {
    if (count > 1) {
      errors.push(`Calciatore duplicato: ${name} (${count} occorrenze)`);
    }
  });

  // Controlla composizione minima per ruolo
  const positionCount = {
    P: players.filter((p) => p.position === "P").length,
    D: players.filter((p) => p.position === "D").length,
    C: players.filter((p) => p.position === "C").length,
    A: players.filter((p) => p.position === "A").length,
  };

  if (positionCount.P < 10) {
    errors.push(`Troppo pochi portieri: ${positionCount.P} (minimo consigliato: 10)`);
  }
  if (positionCount.D < 40) {
    errors.push(`Troppo pochi difensori: ${positionCount.D} (minimo consigliato: 40)`);
  }
  if (positionCount.C < 40) {
    errors.push(`Troppo pochi centrocampisti: ${positionCount.C} (minimo consigliato: 40)`);
  }
  if (positionCount.A < 30) {
    errors.push(`Troppo pochi attaccanti: ${positionCount.A} (minimo consigliato: 30)`);
  }

  return errors;
}
