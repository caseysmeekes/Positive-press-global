"use client";
import { signOut } from "next-auth/react";

export function SignOutButton() {
  return <button className="admin-signout" onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</button>;
}
