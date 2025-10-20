// src/app/layout.tsx
import './globals.css';
import NewServiceNotifier from '@/components/new-service-notifier';
import AuthBar from '@/components/auth-bar';
import Sidebar from '@/components/sidebar';
import OwnerGate from '@/components/owner-gate';

export const metadata = { title: 'Owner Console' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <NewServiceNotifier />

        {/* Shell */}
        <div className="min-h-screen flex">
          {/* Sidebar (assumes your <Sidebar/> renders a fixed/relative column) */}
          <Sidebar />

          {/* Main */}
          <main className="flex-1">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
              <AuthBar />
              <OwnerGate>{children}</OwnerGate>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
