import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "The Positive Press Global | Good news. Wider perspective.", template: "%s | The Positive Press Global" },
  description: "A global publication discovering constructive, uplifting stories and specialist international reporting from around the world.",
  openGraph: { title: "The Positive Press Global", description: "Good news. Wider perspective.", type: "website" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
