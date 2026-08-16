import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"

// Il ruolo viene memorizzato nel JWT e riletto dal database solo di tanto in
// tanto: interrogarlo ad ogni richiesta significava una query per ogni chiamata
// API autenticata (con il polling dell'asta si saturavano le connessioni).
const ROLE_REFRESH_MS = 15 * 60 * 1000

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/it",    // Redirect a homepage italiana
    signOut: "/it",   // Redirect a homepage italiana dopo logout
    error: "/it",     // Redirect a homepage italiana in caso di errore
  },
  callbacks: {
    session: async ({ session, token }) => {
      if (session?.user && token.sub) {
        session.user.id = token.sub
        session.user.role = token.role ?? "PLAYER"
      }
      return session
    },
    jwt: async ({ user, token, trigger }) => {
      if (user) {
        token.uid = user.id
      }

      const userId = user?.id ?? token.sub
      const roleIsStale =
        typeof token.roleUpdatedAt !== "number" ||
        Date.now() - token.roleUpdatedAt > ROLE_REFRESH_MS

      if (userId && (!token.role || trigger === "signIn" || trigger === "update" || roleIsStale)) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
          })
          token.role = dbUser?.role ?? "PLAYER"
          token.roleUpdatedAt = Date.now()
        } catch (error) {
          // Se il database non e' raggiungibile si mantiene il ruolo gia' noto
          // invece di invalidare la sessione dell'utente.
          console.error("Impossibile aggiornare il ruolo utente:", error)
          token.role = token.role ?? "PLAYER"
        }
      }

      return token
    },
  },
  session: {
    strategy: "jwt",
  },
}
