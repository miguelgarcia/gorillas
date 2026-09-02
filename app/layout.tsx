import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gorillas — Rooftop Artillery',
  description:
    'A local two-player rooftop artillery game with wind, destructible skylines, and mouse-driven aiming.',
  openGraph: {
    title: 'Gorillas — Rooftop Artillery',
    description:
      'A local two-player rooftop artillery game with wind, destructible skylines, and mouse-driven aiming.',
    type: 'website',
    images: [
      {
        url: '/og.png',
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
      'A local two-player rooftop artillery game with wind, destructible skylines, and mouse-driven aiming.',
    images: ['/og.png'],
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
