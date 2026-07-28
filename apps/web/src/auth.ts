import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { loginWithGoogle, verifyOtp } from "@/lib/bff";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    // Only meaningful immediately after the sign-in that set it — read via auth() right after
    // signIn() resolves (see verifyOtpAction), not as a general "is this account new" check on
    // later requests, since the JWT (and this flag with it) persists across the whole session.
    isNewUser?: boolean;
    // Which provider authenticated the current session ("phone-otp" or "google") — lets a caller
    // distinguish signups that already fire their own analytics event synchronously (phone-OTP,
    // in AuthGateProvider) from ones that don't (Google's redirect flow has no such moment on the
    // client — see SignupConversionTracker).
    provider?: string;
  }
  interface User {
    accessToken?: string;
    isNewUser?: boolean;
  }
}

// The "next-auth/jwt" subpath's types pull in a currently-mismatched @auth/core
// version in this workspace — avoid importing it and just extend the token shape locally.
type TokenWithAccessToken = { sub?: string; accessToken?: string; isNewUser?: boolean; provider?: string };

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      id: "phone-otp",
      name: "Phone OTP",
      credentials: {
        phone: { label: "Phone", type: "text" },
        code: { label: "OTP", type: "text" },
      },
      async authorize(credentials) {
        const phone = credentials?.phone as string | undefined;
        const code = credentials?.code as string | undefined;
        if (!phone || !code) return null;

        const session = await verifyOtp(phone, code);
        return {
          id: session.user.id,
          name: session.user.name ?? session.user.phone,
          email: session.user.email,
          // Carried through to the jwt() callback below via the `user` param.
          accessToken: session.accessToken,
          isNewUser: session.isNewUser,
        };
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      const t = token as TokenWithAccessToken;
      // `account` is only present on the actual sign-in call, not on later token reads/refreshes —
      // recorded here so it survives on the token for every subsequent request in the session.
      if (account?.provider) t.provider = account.provider;

      // Phone-OTP sign-in: the accessToken came straight from the BFF via authorize().
      if (user?.accessToken) {
        t.accessToken = user.accessToken;
        t.sub = user.id;
        t.isNewUser = user.isNewUser;
        return token;
      }

      // Google sign-in: NextAuth's own OAuth flow never touches the BFF, so this app
      // has no BFF user/identity for this session yet. Mint one now (same Google ID
      // token NextAuth just verified) so every web session — phone or Google — has a
      // real BFF user id + accessToken, needed for favourites/messaging.
      if (account?.provider === "google" && account.id_token) {
        try {
          const bffSession = await loginWithGoogle(account.id_token);
          t.accessToken = bffSession.accessToken;
          t.sub = bffSession.user.id;
          t.isNewUser = bffSession.isNewUser;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Google sign-in failed";
          console.error("[auth] BFF loginWithGoogle failed:", message);
          throw new Error(message);
        }
      }

      return token;
    },
    async session({ session, token }) {
      const t = token as TokenWithAccessToken;
      session.accessToken = t.accessToken;
      session.isNewUser = t.isNewUser;
      session.provider = t.provider;
      if (t.sub) session.user.id = t.sub;
      return session;
    },
  },
});
