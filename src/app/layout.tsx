import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { CRMProvider } from '@/context/CRMContext';

// Baixada no build e servida pelo próprio site. Pelo Google Fonts a política
// de segurança bloqueava, e a fonte nunca chegava no navegador.
const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-inter',
});

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseRealtimeUrl = supabaseUrl.replace(/^https:/, 'wss:');
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  // Next.js exporta scripts de hidratação inline. GitHub Pages não permite
  // nonce dinâmico/headers, então unsafe-inline é a limitação deste host.
  //
  // 'unsafe-eval' entra SÓ no `npm run dev`: em desenvolvimento o React usa
  // eval() para remontar o rastro do erro, e sem isso o overlay do Next fica
  // acusando um problema que não existe. O site publicado é gerado com
  // NODE_ENV=production e continua sem eval nenhum.
  `script-src 'self' 'unsafe-inline'${
    process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'"
  }`,
  // O projeto ainda usa muitos estilos React inline.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseUrl} ${supabaseRealtimeUrl}`.trim(),
  "frame-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  'upgrade-insecure-requests',
].join('; ');

export const metadata: Metadata = {
  title: 'CRM Nossa Ótica',
  description: 'Gestão de clientes, atendimentos e vendas da Nossa Ótica',
  manifest: `${basePath}/manifest.webmanifest`,
  icons: {
    icon: `${basePath}/logo.png`,
    shortcut: `${basePath}/logo.png`,
    apple: `${basePath}/apple-touch-icon.png`,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Nossa Ótica',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0c0c0e',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <head>
        <meta httpEquiv="Content-Security-Policy" content={contentSecurityPolicy} />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
      </head>
      <body>
        <CRMProvider>
          {children}
        </CRMProvider>
      </body>
    </html>
  );
}
