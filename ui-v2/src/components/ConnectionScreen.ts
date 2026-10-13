import { createElement as el } from 'react';
import type { ConnectionState } from '../bridge/types';

export interface ConnectionScreenProps {
  connection: ConnectionState;
  canGoBack: boolean;
  onBack: () => void;
}
const phases = [
  {id:'network',label:'Connect to server',owner:'Network'},
  {id:'session',label:'Authenticate session',owner:'Account'},
  {id:'terrain',label:'Load terrain',owner:'World'},
] as const;

export function ConnectionScreen({connection,canGoBack,onBack}:ConnectionScreenProps) {
  const disconnected = connection.phase==='disconnected';
  const stage = connection.stage ?? (connection.phase==='loading'?'terrain':'network');
  const resources=stage==='resources';
  const world=stage==='world';
  const steps:ReadonlyArray<{id:string;label:string;owner:string}>=resources?[{id:'resources',label:'Apply resources',owner:'Minecraft'}]:world?[{id:'world',label:'Load world',owner:'Minecraft'}]:phases;
  const current = steps.findIndex(item=>item.id===stage);
  const action = connection.phase==='loading' ? null : connection.phase==='connecting' && connection.canCancel ? 'cancel' : canGoBack || disconnected ? 'back' : null;
  const detail = connection.detail.trim();
  return el('section',{className:'screen connection-screen','data-opus-connection-phase':connection.phase,'aria-labelledby':'conn-title','aria-live':disconnected?'assertive':'polite'},
    el('section',{className:'connection-pane material content-material','data-accent':'server'},
      el('div',{className:'connection-identity'},el('div',null,
        el('p',{className:'eyebrow'},`${resources?'MINECRAFT':world?'SINGLEPLAYER':'MULTIPLAYER'}${connection.serverName.trim()?` / ${connection.serverName.trim()}`:''}`),
        el('h1',{id:'conn-title'},disconnected?(world?"Couldn't load world":"Couldn't reach server"):resources?(connection.title||'Loading resources'):world?(connection.title||'Loading world'):connection.phase==='loading'?'Loading terrain':'Connecting to server'),
        el('p',null,connection.serverAddress.trim()),
      )),
      disconnected ? el('div',{className:'connection-error'},
        el('div',null,connection.title || 'Disconnected'),
        el('p',{'data-opus-connection-detail':true,'data-opus-connection-detail-empty':!detail,'aria-hidden':!detail||undefined},detail || 'The connection was closed.'),
      ) : el('div',{className:'phase-list','aria-label':'Connection phases'},
        steps.map((phase,index)=>el('div',{key:phase.id,className:`phase-item${index===current?' is-active':index<current?' is-done':''}`,'data-stage':phase.id,'aria-current':index===current?'step':undefined},
          el('span',{className:'phase-marker','aria-hidden':true},index<current?'✓':index+1),
          el('span',null,phase.label),el('span',{className:'phase-description'},phase.owner),
        )),
      ),
      el('div',{className:'connection-bottom'},
        el('p',{'data-opus-connection-detail':disconnected?undefined:true,'data-opus-connection-detail-empty':disconnected?undefined:!detail,'aria-hidden':!disconnected&&!detail?true:undefined},
          disconnected?(world?'You can return to your worlds.':'You can return to your saved servers.'):detail || (world?'Minecraft is preparing this world.':stage==='session'?'Authenticating your Minecraft session.':stage==='terrain'?'Waiting for the server to send the world.':'Contacting the server.'),
        ),
        action && el('button',{type:'button',className:'button',onClick:onBack,'data-opus-connection-action':action},action==='cancel'?'Cancel':'Back'),
      ),
    ),
  );
}
