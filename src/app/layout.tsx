import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Literata } from "next/font/google";
import "./globals.css";
import "@/components/documents/documents.css";
import { RouteTransition } from "@/components/shell/RouteTransition";
import { PREFS_SCRIPT } from "@/lib/reading/prefs";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The pre-paint script sets theme and reading attributes on <html>, so
    // React will see attributes it didn't render.
    // Font variables live on <html> so tokens declared on :root can resolve them.
    <html
      lang="en"
      data-theme="graphite"
      className={`${inter.variable} ${literata.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_SCRIPT }} />
      </head>
      <body className="antialiased">
        <a href="#main-content" className="skip-link">Skip to content</a>
        <RouteTransition>{children}</RouteTransition>
      </body>
    </html>
  );
}
