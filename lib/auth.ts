import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";

const allowedGitHubLogin = (process.env.GITHUB_ALLOWED_USER || "caseysmeekes").toLowerCase();

function getGitHubLogin(profile: unknown): string {
  if (
    typeof profile === "object" &&
    profile !== null &&
    "login" in profile &&
    typeof profile.login === "string"
  ) {
    return profile.login.toLowerCase();
  }

  return "";
}

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
      const login = getGitHubLogin(profile);
      return Boolean(login) && login === allowedGitHubLogin;
    },
    async jwt({ token, profile }) {
      const login = getGitHubLogin(profile);
      if (login) token.githubLogin = login;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.githubLogin = typeof token.githubLogin === "string" ? token.githubLogin : undefined;
      }
      return session;
    }
  }
};
