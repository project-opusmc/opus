import { createElement } from 'react';
import type { MinecraftTextRun } from '../bridge/types';

const colors = ['#000000','#0000aa','#00aa00','#00aaaa','#aa0000','#aa00aa','#ffaa00','#aaaaaa',
  '#555555','#5555ff','#55ff55','#55ffff','#ff5555','#ff55ff','#ffff55','#ffffff'];

/** Display-only Minecraft text. Server text never becomes HTML, links, or CSS. */
export function minecraftTextRuns(input: MinecraftTextRun[]): MinecraftTextRun[] {
  const out: MinecraftTextRun[] = [];
  let remaining = 2048;
  for (const source of input.slice(0,128)) {
    if (!remaining) break;
    let style: Omit<MinecraftTextRun,'text'> = {};
    if (/^#[\da-f]{6}$/i.test(source.color ?? '')) style.color = source.color;
    if (source.bold === true) style.bold = true;
    if (source.italic === true) style.italic = true;
    if (source.underlined === true) style.underlined = true;
    if (source.strikethrough === true) style.strikethrough = true;
    let text = '';
    const flush = () => { if (text) { out.push({text,...style}); text=''; } };
    const value = String(source.text ?? '');
    for (let index=0;index<value.length && remaining>0;index++) {
      const character = value[index];
      if (character==='§' && index+1<value.length) {
        flush();
        const code = value[++index].toLowerCase(), color = parseInt(code,16);
        if (/^[0-9a-f]$/.test(code)) style={color:colors[color]};
        else if(code==='r') style={};
        else if(code==='l') style={...style,bold:true};
        else if(code==='o') style={...style,italic:true};
        else if(code==='n') style={...style,underlined:true};
        else if(code==='m') style={...style,strikethrough:true};
        // Obfuscated text is kept readable, unknown codes are never displayed.
      } else if (!/[\u0000-\u0008\u000b-\u001f\u007f]/.test(character)) {
        text+=character; remaining--;
      }
    }
    flush();
  }
  return out;
}

export function MinecraftText({runs,text,className=''}: {runs?:MinecraftTextRun[];text?:string;className?:string}) {
  const content = minecraftTextRuns(runs?.length ? runs : [{text:text??''}]);
  return createElement('span',{className:`minecraft-text ${className}`.trim()},
    content.map((run,index)=>createElement('span',{key:index,style:{
      color:run.color,fontWeight:run.bold?700:undefined,fontStyle:run.italic?'italic':undefined,
      textDecoration:[run.underlined?'underline':'',run.strikethrough?'line-through':''].filter(Boolean).join(' ')||undefined,
    }},run.text)));
}
