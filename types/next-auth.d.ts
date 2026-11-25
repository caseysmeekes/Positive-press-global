import type { DefaultSession } from "next-auth";
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: { githubLogin?: string } & NonNullable<DefaultSession["user"]>;
  }
}
