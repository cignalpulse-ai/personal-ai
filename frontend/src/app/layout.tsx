import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXTAUTH_URL || "https://assistant.cignalpulse.com";

export const viewport: Viewport = {
  themeColor: "#131314",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Life Assistant — Personal AI & Routine Workspace | CignalPulse",
    template: "%s | Life Assistant · CignalPulse",
  },
  description:
    "Stay organized with Life Assistant by CignalPulse. Manage daily routines, smart reminders, personal memory, and AI-powered conversations in one fast workspace.",
  keywords: [
    "Life Assistant",
    "CignalPulse",
    "Personal AI Assistant",
    "Routine Manager",
    "Smart Reminders",
    "AI Productivity Workspace",
  ],
  authors: [{ name: "CignalPulse" }],
  creator: "CignalPulse",
  publisher: "CignalPulse",
  applicationName: "Life Assistant",
  category: "Productivity",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Life Assistant · CignalPulse",
    title: "Life Assistant — Personal AI & Routine Workspace | CignalPulse",
    description:
      "Manage daily routines, smart reminders, personal memory, and AI conversations in a clean workspace built by CignalPulse.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Life Assistant — Personal AI & Routine Workspace",
    description:
      "Manage daily routines, smart reminders, personal memory, and AI conversations with CignalPulse.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        inter.variable
      )}
    >
      {/* CHANGED: h-full and overflow-hidden ensures the outer page NEVER scrolls */}
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}