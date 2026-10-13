import catalog from './minecraft-catalog.json' with { type: 'json' };
import type { GameOption } from '../bridge/types';

export const minecraftPages = catalog.pages as Record<string, string[]>;
export function classifyMinecraftOption(option: Pick<GameOption, 'key' | 'label'>) {
  if (option.key.startsWith('SOUND:')) return { page: 'audio', section: option.key === 'SOUND:master' ? 'Volume' : 'Sound channels', label: option.label };
  if (option.key.startsWith('KEY:')) return { page: 'controls', section: 'Key bindings', label: option.label };
  if (option.key.startsWith('SKIN:')) return { page: 'skin', section: 'Skin layers', label: option.label };
  if (option.key.startsWith('WORLD:')) return {page:'overview',section:'Current world',label:option.label};
  if (option.key.startsWith('SHADER')) return {page:'shaders',section:option.key.startsWith('SHADER_PACK:')?'Shader pack options':'Shader settings',label:option.label};
  const entry = catalog.options.find(item => item.enums.includes(option.key) || `FIELD:${item.nativeKey}` === option.key);
  return entry ?? { page: 'other', section: 'Additional settings', label: option.label };
}
export function filterMinecraftOptions<T extends Pick<GameOption, 'key' | 'label'>>(options: T[], page: string, search: string): T[] {
  const query = search.trim().toLocaleLowerCase();
  return options.filter(option => {
    const meta = classifyMinecraftOption(option);
    return (query || meta.page === page) && `${meta.label} ${option.label} ${option.key} ${meta.section}`.toLocaleLowerCase().includes(query);
  });
}
export function shouldBlurWorld(route: string, inWorld: boolean): boolean {
  return inWorld && ['hud_editor', 'game_menu', 'quick_hub', 'settings', 'mods_catalog', 'module_detail'].includes(route);
}
