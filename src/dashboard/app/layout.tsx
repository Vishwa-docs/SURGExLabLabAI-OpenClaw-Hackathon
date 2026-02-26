import '../styles/globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ridhwan — Agent Governance Dashboard',
  description: 'Enterprise Trust & Commerce Mesh for Autonomous Agents',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="dashboard-layout">
          <Sidebar />
          <main className="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">🔥 RIDHWAN</div>
      <div className="sidebar-subtitle">Agent Governance</div>
      <ul className="sidebar-nav">
        <li><a href="/" className="active">📊 Overview</a></li>
        <li><a href="/policies">🛡️ Policies</a></li>
        <li><a href="/audit">📋 Audit Log</a></li>
        <li><a href="/wallet">💰 Wallet</a></li>
        <li><a href="/receipts">🧾 Receipts</a></li>
      </ul>
    </aside>
  );
}
