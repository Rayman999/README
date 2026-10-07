import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, IBM_Plex_Mono, Inter, JetBrains_Mono, Literata, Newsreader, Source_Sans_3 } from "next/font/google";
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

// Optional reading faces: not preloaded, so a browser only downloads the one
// a reader has actually chosen.
const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  preload: false,
});

const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  preload: false,
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  style: ["normal", "italic"],
  preload: false,
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  preload: false,
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  preload: false,
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
      className={`${inter.variable} ${literata.variable} ${atkinson.variable} ${sourceSans.variable} ${newsreader.variable} ${plexMono.variable} ${jetbrainsMono.variable}`}
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
