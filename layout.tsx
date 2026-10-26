import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Physio Voice — Voice Command Patient Record Management',
  description: 'Voice-based record and session management application for independent physiotherapists',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
