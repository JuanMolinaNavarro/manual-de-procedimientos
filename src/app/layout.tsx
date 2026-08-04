import type { Metadata } from "next";
import { IBM_Plex_Mono, Nunito, Playfair_Display, Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// Fuente redondeada para el módulo de organigrama (estilo neumorphic). Solo se expone
// como variable CSS; no cambia la tipografía por defecto de la app.
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

// Fuente del nombre del sistema (AURELIUS) en headers y login.
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "AURELIUS",
  description: "Manual operativo para agentes de call center ISP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${spaceGrotesk.variable} ${plexMono.variable} ${nunito.variable} ${playfair.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
