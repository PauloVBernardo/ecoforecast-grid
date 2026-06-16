import type { Metadata } from 'next';
import './globals.css';
import 'leaflet/dist/leaflet.css';

export const metadata: Metadata = {
  title: 'EcoForecast',
  description: 'Monitor de Anomalias Climáticas da área urbana de Goiânia'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}