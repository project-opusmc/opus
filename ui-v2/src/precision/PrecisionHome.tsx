import { MinecraftText } from './MinecraftText';
import type { ClientInfo, ServerInfo, ServerStatus } from '../bridge/types';

export function PrecisionHome({client, server, status, onWorlds, onServers, onOptions, onModules, onJoin, onQuit}: {
  client: ClientInfo | null; server?: ServerInfo; status?: ServerStatus;
  onWorlds: () => void; onServers: () => void; onOptions: () => void; onModules: () => void; onJoin: (server: ServerInfo) => void; onQuit: () => void;
}) {
  return <section className="screen home-layout" aria-label="Opus main menu">
    <section className="home-console material content-material pane" aria-labelledby="home-title">
      <div className="home-greeting">Minecraft · {client?.minecraft ?? '1.8.9'}</div><h1 id="home-title" className="holo-text">Play</h1><p className="home-lede">Choose a world or server.</p>
      <div className="home-actions" aria-label="Play destinations">
        <button className="destination" type="button" data-accent="world" data-opus-home-action="singleplayer" onClick={onWorlds}><span className="destination-copy"><strong className="accent-text">Singleplayer</strong><small>Open a saved world</small></span></button>
        <button className="destination" type="button" data-accent="server" data-opus-home-action="multiplayer" onClick={onServers}><span className="destination-copy"><strong className="accent-text">Multiplayer</strong><small>Browse saved servers</small></span></button>
      </div>
      <div className="home-utilities"><button className="button" type="button" onClick={onOptions} data-opus-home-action="minecraft-settings">Minecraft settings</button><button className="button" type="button" data-accent="modules" onClick={onModules} data-opus-home-action="client-settings"><span className="accent-text">Modules</span></button></div>
      <div className="home-footer"><button className="text-button precision-quit" onClick={onQuit} data-opus-home-action="quit" type="button">Quit game</button><span>{client?.minecraft ?? '1.8.9'} / {client?.account ?? 'Opus'}</span></div>
    </section>
    <div className="home-outlook"><div className="scene-caption"><span/>OVERWORLD / NIGHTFALL</div>
      {server && <section className="return-pane material" data-accent="server" aria-label="Saved destination"><div className="return-heading"><p className="eyebrow">Saved destination</p><span className="status-chip">{status?.state === 'online' && status.onlinePlayers !== undefined ? `${status.onlinePlayers} online` : 'Saved server'}</span></div>
        <div className="server-identity"><div><h2 className="accent-text">{server.name}</h2><MinecraftText runs={status?.motdRuns} text={status?.motd ?? 'Multiplayer'}/></div></div>
        <div className="return-bottom"><span className="return-meta">{server.address}<br/><b>Multiplayer / {client?.minecraft ?? '1.8.9'}</b></span><button className="button button--primary" type="button" onClick={() => onJoin(server)}>Join server</button></div>
      </section>}
    </div>
  </section>;
}
