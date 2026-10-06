export function FilamentBackdrop() {
  return (
    <svg
      className="home-filament"
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="filament-path" x1="140" y1="560" x2="1460" y2="360" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6D8CB8" stopOpacity="0" />
          <stop offset=".2" stopColor="#8FA8C8" stopOpacity=".24" />
          <stop offset=".5" stopColor="#F0F5FA" stopOpacity=".42" />
          <stop offset=".78" stopColor="#7394BE" stopOpacity=".22" />
          <stop offset="1" stopColor="#5D7DA7" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="filament-node">
          <stop stopColor="#FFFFFF" />
          <stop offset=".42" stopColor="#B9CEE9" stopOpacity=".65" />
          <stop offset="1" stopColor="#7195C4" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g fill="none" stroke="url(#filament-path)" strokeLinecap="round">
        <path d="M-40 650C265 415 490 706 738 486C952 296 1176 498 1648 224" strokeWidth="1.15" />
        <path d="M-32 698C286 478 508 764 764 515C1016 270 1238 518 1648 266" strokeWidth=".72" opacity=".66" />
        <path d="M84 445C351 252 531 587 744 431C961 273 1153 431 1518 198" strokeWidth=".65" opacity=".46" />
        <path d="M125 732C374 557 579 780 806 585C1018 403 1253 646 1543 479" strokeWidth=".62" opacity=".4" />
        <path d="M392 176C597 294 626 459 800 467C992 476 1052 286 1257 202" strokeWidth=".78" opacity=".52" />
        <path d="M367 782C571 635 650 480 807 469C986 456 1060 651 1238 756" strokeWidth=".72" opacity=".4" />
        <path d="M232 351C434 307 542 408 727 410C949 412 1089 291 1370 340" strokeWidth=".5" opacity=".32" />
      </g>

      <g opacity=".58">
        <circle cx="395" cy="484" r="7" fill="url(#filament-node)" />
        <circle cx="744" cy="486" r="8" fill="url(#filament-node)" />
        <circle cx="1050" cy="389" r="6" fill="url(#filament-node)" />
        <circle cx="1232" cy="506" r="5" fill="url(#filament-node)" />
      </g>

      <g fill="#BBD0EA" opacity=".34">
        <circle cx="318" cy="459" r="1.1" />
        <circle cx="472" cy="538" r=".9" />
        <circle cx="607" cy="527" r="1" />
        <circle cx="893" cy="424" r=".9" />
        <circle cx="975" cy="454" r=".8" />
        <circle cx="1119" cy="354" r="1" />
        <circle cx="1296" cy="435" r=".8" />
        <circle cx="1384" cy="329" r=".7" />
      </g>
    </svg>
  );
}
