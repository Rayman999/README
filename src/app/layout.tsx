import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Inter, JetBrains_Mono, Literata } from "next/font/google";
import "./globals.css";
import "@/components/documents/documents.css";
import { auth } from "@/auth";
import { RouteTransition } from "@/components/shell/RouteTransition";
import { ReaderBoot } from "@/components/reading/ReadingPreferences";
import { prefsScript } from "@/lib/reading/prefs";
import { getReaderProfile } from "@/lib/reading/server";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  axes: ["opsz"],
});

const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "readme",
  description: "A documentation wiki built to be written by agents and humans alike.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0B" },
    { media: "(prefers-color-scheme: light)", color: "#F2F2EF" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const saved = session?.user?.id ? await getReaderProfile(session.user.id) : null;

  return (
    // Font variables live on <html> so tokens declared on :root can resolve
    // them. The pre-paint script sets theme and reading attributes on <html>,
    // so React will see attributes it didn't render.
    <html
      lang="en"
      data-theme="graphite"
      className={`${inter.variable} ${literata.variable} ${atkinson.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: prefsScript(saved, Boolean(session?.user)) }} />
      </head>
      <body className="antialiased">
        <a href="#main-content" className="skip-link">Skip to content</a>
        <ReaderBoot />
        <RouteTransition>{children}</RouteTransition>
      </body>
    </html>
  );
}
