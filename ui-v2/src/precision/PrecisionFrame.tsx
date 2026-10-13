import type { ReactNode } from 'react';
import type { AccountSummary, ClientInfo } from '../bridge/types';
import { AccountMenu, type AccountCatalogStatus, type AccountFeedbackState, type AccountView } from '../components/Accounts';

export const OPUS_LOGO = '/brand/opus-woven-o-c3.svg';
export function PrecisionFrame({ title, client, children, onHome, onSettings, account, accounts, catalog, loading, feedback, active, onSelect, onManage, navigationLocked=false }: {
  navigationLocked?:boolean; title: string; client: ClientInfo | null; children: ReactNode; onHome: () => void; onSettings: () => void;
  account: AccountSummary | null; accounts: AccountSummary[]; catalog: AccountCatalogStatus;
  loading: boolean; feedback: AccountFeedbackState; active: boolean; onSelect: (id: string) => void; onManage: (view: AccountView) => void;
}) {
  return <div className="workspace precision-workspace">
    <header className="topbar material">
      <button type="button" className="brand-button" disabled={navigationLocked} onClick={onHome} aria-label="Opus Home"><img src={OPUS_LOGO} alt=""/><strong>OPUS</strong><span className="route-crumb">{title}</span></button>
      <span className="build-chip"><i/>Minecraft <span>/</span>{client?.minecraft ?? '1.8.9'}</span>
      <div className="identity"><AccountMenu client={client} account={account} accounts={accounts} catalog={catalog} loading={loading} feedback={feedback} active={active&&!navigationLocked} onSelect={onSelect} onManage={onManage}/><button className="topbar-action" type="button" disabled={navigationLocked} onClick={onSettings}>Client settings</button></div>
    </header>
    <main className="precision-main">{children}</main>
  </div>;
}
