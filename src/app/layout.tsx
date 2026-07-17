import type { Metadata, Viewport } from 'next';
import './globals.css';
import { CRMProvider } from '@/context/CRMContext';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

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
    <html lang="pt-BR">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var reloadKey = 'last-chunk-error-reload';
                function handleChunkError(errMessage) {
                  if (
                    errMessage && (
                      errMessage.indexOf('chunk') !== -1 ||
                      errMessage.indexOf('Loading chunk') !== -1 ||
                      errMessage.indexOf('Cannot find module') !== -1 ||
                      errMessage.indexOf('webpack-runtime') !== -1
                    )
                  ) {
                    var lastReload = sessionStorage.getItem(reloadKey);
                    var now = Date.now();
                    // Prevent infinite reload loops by limiting reload to once every 10 seconds
                    if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
                      sessionStorage.setItem(reloadKey, now.toString());
                      console.warn('Chunk loading error detected, reloading page dynamically: ' + errMessage);
                      window.location.reload();
                    }
                  }
                }
                window.addEventListener('error', function(e) {
                  handleChunkError(e.message || '');
                }, true);
                window.addEventListener('unhandledrejection', function(e) {
                  handleChunkError(e.reason && e.reason.message || '');
                });
              })();
            `
          }}
        />
      </head>
      <body>
        <CRMProvider>
          {children}
        </CRMProvider>
      </body>
    </html>
  );
}
