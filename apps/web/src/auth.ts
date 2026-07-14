import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { loginWithGoogle, verifyOtp } from "@/lib/bff";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
  }
  interface User {
    accessToken?: string;
  }
}

// The "next-auth/jwt" subpath's types pull in a currently-mismatched @auth/core
// version in this workspace — avoid importing it and just extend the token shape locally.
type TokenWithAccessToken = { sub?: string; accessToken?: string };

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

      // Phone-OTP sign-in: the accessToken came straight from the BFF via authorize().
      if (user?.accessToken) {
        t.accessToken = user.accessToken;
        t.sub = user.id;
        return token;
      }

      // Google sign-in: NextAuth's own OAuth flow never touches the BFF, so this app
      // has no BFF user/identity for this session yet. Mint one now (same Google ID
      // token NextAuth just verified) so every web session — phone or Google — has a
      // real BFF user id + accessToken, needed for favourites/messaging.
      if (account?.provider === "google" && account.id_token) {
        const bffSession = await loginWithGoogle(account.id_token);
        t.accessToken = bffSession.accessToken;
        t.sub = bffSession.user.id;
      }

      return token;
    },
    async session({ session, token }) {
      const t = token as TokenWithAccessToken;
      session.accessToken = t.accessToken;
      if (t.sub) session.user.id = t.sub;
      return session;
    },
  },
});
