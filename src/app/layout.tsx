import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "V- | Viral Video Discovery Platform",
  description: "Discover what's trending across the globe. AI-powered search that transcends language barriers. Real-time viral video curation with theater-mode playback and intelligent qualification. The future of content discovery is here.",
  icons: {
    icon: '/icon.svg',
    apple: '/apple-touch-icon.svg',
  },
  openGraph: {
    title: "V- | Viral Video Discovery",
    description: "Discover what's trending across the globe. AI-powered search that transcends language barriers. Real-time viral video curation with theater-mode playback and intelligent qualification.",
    url: 'https://v-minus.vercel.app',
    siteName: 'V-',
    images: [{
      url: '/opengraph-image.svg',
      width: 1200,
      height: 630,
    }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "V- | Viral Video Discovery Platform",
    description: "Discover what's trending across the globe. AI-powered search that transcends language barriers.",
    images: ['/opengraph-image.svg'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
