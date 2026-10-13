// Minecraft 1.8.9 stores LWJGL 2 key codes, not browser virtual-key codes.
const codes:Record<string,number>={Digit1:2,Digit2:3,Digit3:4,Digit4:5,Digit5:6,Digit6:7,Digit7:8,Digit8:9,Digit9:10,Digit0:11,Minus:12,Equal:13,Backspace:14,Tab:15,KeyQ:16,KeyW:17,KeyE:18,KeyR:19,KeyT:20,KeyY:21,KeyU:22,KeyI:23,KeyO:24,KeyP:25,BracketLeft:26,BracketRight:27,Enter:28,ControlLeft:29,KeyA:30,KeyS:31,KeyD:32,KeyF:33,KeyG:34,KeyH:35,KeyJ:36,KeyK:37,KeyL:38,Semicolon:39,Quote:40,Backquote:41,ShiftLeft:42,Backslash:43,KeyZ:44,KeyX:45,KeyC:46,KeyV:47,KeyB:48,KeyN:49,KeyM:50,Comma:51,Period:52,Slash:53,ShiftRight:54,NumpadMultiply:55,AltLeft:56,Space:57,CapsLock:58,F1:59,F2:60,F3:61,F4:62,F5:63,F6:64,F7:65,F8:66,F9:67,F10:68,NumLock:69,ScrollLock:70,Numpad7:71,Numpad8:72,Numpad9:73,NumpadSubtract:74,Numpad4:75,Numpad5:76,Numpad6:77,NumpadAdd:78,Numpad1:79,Numpad2:80,Numpad3:81,Numpad0:82,NumpadDecimal:83,F11:87,F12:88,F13:100,F14:101,F15:102,F16:103,F17:104,F18:105,NumpadEnter:156,ControlRight:157,NumpadDivide:181,AltRight:184,Home:199,ArrowUp:200,PageUp:201,ArrowLeft:203,ArrowRight:205,End:207,ArrowDown:208,PageDown:209,Insert:210,Delete:211,MetaLeft:219,MetaRight:220,ContextMenu:221};
const fallback:Record<string,string>={' ':'Space',Control:'ControlLeft',Shift:'ShiftLeft',Alt:'AltLeft',Meta:'MetaLeft','-':'Minus','=':'Equal','[':'BracketLeft',']':'BracketRight',';':'Semicolon',"'":'Quote','`':'Backquote','\\':'Backslash',',':'Comma','.':'Period','/':'Slash'};
export function minecraftKeyCode(event:{code:string;key:string;location:number}):number|null {
 if(event.key==='Escape')return null;
 if(codes[event.code]!==undefined)return codes[event.code];
 const key=event.key.length===1&&/[a-z]/i.test(event.key)?`Key${event.key.toUpperCase()}`:event.key.length===1&&/[0-9]/.test(event.key)?`Digit${event.key}`:fallback[event.key]??event.key;
 const physical=event.location===2&&/Left$/.test(key)?key.replace('Left','Right'):key;
 return codes[physical]??null;
}
