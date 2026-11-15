import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kiataker: Collect your rent, we'll handle the rest",
  description:
    "Kiataker is a landlord-first rental property management platform for Nigeria. Run your properties by chat on WhatsApp, with an evidence-backed record of every step.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
