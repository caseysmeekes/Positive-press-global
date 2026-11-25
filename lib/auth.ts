import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";

const allowedGitHubLogin = (process.env.GITHUB_ALLOWED_USER || "caseysmeekes").toLowerCase();

export const authOptions: NextAuthOptions = {
  providers: [GitHubProvider({
    clientId: process.env.GITHUB_ID || "",
    clientSecret: process.env.GITHUB_SECRET || ""
  })],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ profile }) {
      const login = typeof profile?.login === "string" ? profile.login.toLowerCase() : "";
      return Boolean(login) && login === allowedGitHubLogin;
    },
    async jwt({ token, profile }) {
      if (profile && typeof profile.login === "string") token.githubLogin = profile.login;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.githubLogin = typeof token.githubLogin === "string" ? token.githubLogin : undefined;
      return session;
    }
  }
};
