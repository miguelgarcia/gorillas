import type { Metadata } from 'next';
import './globals.css';

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://miguelgarcia.github.io/gorillas';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  alternates: { canonical: siteUrl },
  title: 'Gorillas — Rooftop Artillery',
  description:
    'Play rooftop artillery solo against the computer or with a friend, with wind, destructible skylines, and mouse-driven aiming.',
  openGraph: {
    title: 'Gorillas — Rooftop Artillery',
    description:
      'Play rooftop artillery solo against the computer or with a friend, with wind, destructible skylines, and mouse-driven aiming.',
    type: 'website',
    url: siteUrl,
    images: [
      {
        url: `${siteUrl}/og.png`,
        width: 1672,
        height: 941,
        alt: 'Two gorillas face off across a windy pixel-art skyline.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gorillas — Rooftop Artillery',
    description:
      'Play rooftop artillery solo against the computer or with a friend, with wind, destructible skylines, and mouse-driven aiming.',
    images: [`${siteUrl}/og.png`],
  },
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
