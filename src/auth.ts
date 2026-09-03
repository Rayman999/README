import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import {
  attachUserToWorkspace,
  getMembership,
  registrationAllowed,
  type Role,
} from "@/lib/workspace";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  // Credentials sign-in requires JWT sessions. The adapter still persists
  // users and linked OAuth accounts; only the session itself is a token.
  session: { strategy: "jwt" },
  // Distinct cookie name. Database-session cookies issued before the switch
  // to JWT cannot be decrypted, and Auth.js does not discard them — it
  // throws JWTSessionError on every request instead. Reading a different
  // name means any stale cookie is simply ignored.
  cookies: {
    sessionToken: {
      name: "readme.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  providers: [
    GitHub,
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await db.query.users.findFirst({
          where: eq(users.email, email.toLowerCase()),
        });

        // Compare against a dummy hash when the account is missing or has no
        // password, so a wrong email costs the same time as a wrong password
        // and cannot be distinguished by timing.
        const hash =
          user?.passwordHash ??
          "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
        const ok = await bcrypt.compare(password, hash);

        if (!ok || !user?.passwordHash) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    // Gate new OAuth accounts when the owner has closed registration.
    // Credentials sign-in only ever reaches an account that already exists.
    async signIn({ user, account }) {
      if (account?.provider === "credentials") return true;
      if (!user.email) return false;

      const existing = await db.query.users.findFirst({
        where: eq(users.email, user.email),
      });
      if (existing) return true;

      return (await registrationAllowed()) || "/login?error=RegistrationClosed";
    },
    async jwt({ token, user }) {
      // Initial sign-in: trust it and record who this is.
      if (user?.id) {
        token.uid = user.id;
        token.role = (await getMembership(user.id))?.role;
        return token;
      }

      if (!token.uid) return token;

      // Every subsequent request re-checks against the database. JWTs are
      // self-contained, so without this a user who has been deleted or
      // removed from the workspace keeps full access until the token
      // expires — which would make "remove a member" do nothing for weeks.
      const uid = token.uid as string;
      const [account, membership] = await Promise.all([
        db.query.users.findFirst({ where: eq(users.id, uid) }),
        getMembership(uid),
      ]);

      // Returning null invalidates the session.
      if (!account || !membership) return null;

      token.role = membership.role;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as Role | undefined;
      }
      return session;
    },
  },
  events: {
    // Fires when the adapter first persists a user — i.e. GitHub sign-up.
    // Password sign-ups attach themselves in the signUp action instead.
    async createUser({ user }) {
      if (user.id) await attachUserToWorkspace(user.id);
    },
  },
});
