import Image from "next/image";

interface TeamLogoProps {
  teamName: string;
  size?: number;
  className?: string;
}

// Mapping dei nomi delle squadre ai file dei loghi
const teamLogoMap: Record<string, string> = {
  "atalanta": "atalanta.png",
  "bologna": "bologna.png", 
  "cagliari": "cagliari.png",
  "como": "como.png",
  "empoli": "empoli.png",
  "fiorentina": "fiorentina.png",
  "genoa": "genoa.png",
  "hellas verona": "hellas-verona.png",
  "inter": "inter.png",
  "juventus": "juventus.png",
  "lazio": "lazio.png",
  "lecce": "lecce.png",
  "milan": "milan.png",
  "monza": "monza.png",
  "napoli": "napoli.png",
  "parma": "parma.png",
  "roma": "roma.png",
  "torino": "torino.png",
  "udinese": "udinese.png",
  "venezia": "venezia.png",
  // Varianti alternative dei nomi
  "ac milan": "milan.png",
  "fc inter": "inter.png",
  "as roma": "roma.png",
  "ss lazio": "lazio.png",
  "juventus fc": "juventus.png",
  "atalanta bc": "atalanta.png",
  "acf fiorentina": "fiorentina.png",
  "ssc napoli": "napoli.png",
  "torino fc": "torino.png",
  "genoa cfc": "genoa.png",
  "us lecce": "lecce.png",
  "empoli fc": "empoli.png",
  "cagliari calcio": "cagliari.png",
  "udinese calcio": "udinese.png",
  "hellas verona fc": "hellas-verona.png",
  "ac monza": "monza.png",
  "parma calcio": "parma.png",
  "venezia fc": "venezia.png",
  "como 1907": "como.png",
  "bologna fc": "bologna.png",
  // Altre varianti comuni
  "h. verona": "hellas-verona.png",
  "verona": "hellas-verona.png",
};

function normalizeTeamName(teamName: string): string {
  return teamName.toLowerCase().trim();
}

export function TeamLogo({ teamName, size = 20, className = "" }: TeamLogoProps) {
  const normalizedName = normalizeTeamName(teamName);
  const logoFileName = teamLogoMap[normalizedName];

  if (!logoFileName) {
    // Fallback con iniziali del team se logo non trovato
    const initials = teamName
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);

    return (
      <div 
        className={`inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-medium ${className}`}
        style={{ width: size, height: size }}
      >
        {initials}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <Image
        src={`/logos/${logoFileName}`}
        alt={`Logo ${teamName}`}
        width={size}
        height={size}
        className="rounded-sm"
        onError={(e) => {
          // Fallback se l'immagine non carica
          const target = e.target as HTMLElement;
          target.style.display = 'none';
        }}
      />
    </div>
  );
}