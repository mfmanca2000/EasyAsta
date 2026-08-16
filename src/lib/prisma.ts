import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// In ambiente serverless (Vercel/Lambda) ogni istanza della funzione apre il
// proprio pool di connessioni. Senza un limite esplicito Prisma usa
// (num_cpu * 2) + 1 connessioni per istanza e, con molte istanze concorrenti,
// il database satura il numero massimo di client (errore EMAXCONN).
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)

/**
 * Aggiunge alla DATABASE_URL i parametri di pooling se non gia' presenti.
 * I valori espliciti nella connection string (o nelle env var) hanno la
 * precedenza, cosi' e' possibile adattare la configurazione senza deploy.
 */
function buildDatasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL

  // Le URL gestite da un pooler esterno (Prisma Accelerate / Data Proxy) non
  // accettano i parametri del pool locale.
  if (!url || url.startsWith('prisma://') || url.startsWith('prisma+postgres://')) {
    return url
  }

  try {
    const parsed = new URL(url)

    const connectionLimit =
      process.env.DATABASE_CONNECTION_LIMIT ?? (isServerless ? '1' : undefined)

    if (connectionLimit && !parsed.searchParams.has('connection_limit')) {
      parsed.searchParams.set('connection_limit', connectionLimit)
    }

    // Attesa massima per ottenere una connessione dal pool prima di fallire.
    if (!parsed.searchParams.has('pool_timeout')) {
      parsed.searchParams.set('pool_timeout', process.env.DATABASE_POOL_TIMEOUT ?? '20')
    }

    // Attesa massima per aprire una nuova connessione verso il database.
    if (!parsed.searchParams.has('connect_timeout')) {
      parsed.searchParams.set('connect_timeout', process.env.DATABASE_CONNECT_TIMEOUT ?? '10')
    }

    return parsed.toString()
  } catch {
    // Connection string non parsabile: la si usa cosi' com'e'.
    return url
  }
}

function createPrismaClient() {
  return new PrismaClient({
    datasourceUrl: buildDatasourceUrl(),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

// La cache globale va mantenuta anche in produzione: su Next.js ogni route
// serverless viene bundlata separatamente e senza questa cache la stessa
// istanza puo' creare piu' PrismaClient (e quindi piu' pool di connessioni).
globalForPrisma.prisma = prisma
