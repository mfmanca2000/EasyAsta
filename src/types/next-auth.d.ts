import { DefaultSession } from "next-auth"
import { UserRole } from "@prisma/client"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: UserRole
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string
    role?: UserRole
    /** Timestamp (ms) dell'ultima rilettura del ruolo dal database */
    roleUpdatedAt?: number
  }
}