import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DartHub",
  description: "Modular, server-authoritative multiplayer dart game",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
