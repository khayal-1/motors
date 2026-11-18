import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "El Khayal Motor's | الخيال موتورز",
  description: 'منصة الخيال موتورز لإدارة وعرض الدراجات النارية.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
