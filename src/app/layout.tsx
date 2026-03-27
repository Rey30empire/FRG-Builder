import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Builder-FRG-LLC | Construction Intelligence Platform",
  description:
    "AI-powered construction management platform for estimations, learning, marketing, and project management. Modular system with skills, tools, and memory.",
  keywords: [
    "construction",
    "estimation",
    "takeoff",
    "CRM",
    "marketing",
    "AI",
    "contractor",
    "builder",
  ],
  authors: [{ name: "FRG LLC" }],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Builder-FRG-LLC",
    description: "AI-powered construction intelligence platform",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          forcedTheme="dark"
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
