import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire("C:/Users/Sorrymaker/.dsh/profiles/desktop/node_modules/x.js");
const sharp = require("sharp");

/* ═══════════ 画布 ═══════════ */
const W = 760, H = 340;
const CARD = { x: 80, y: 58, w: 600, h: 165, r: 14 };
const ROW_CY = CARD.y + CARD.h - 25;
const BTN_R  = 15;
const BTN_CX = CARD.x + 14 + 28 + 6 + 15;
const BTN_CY = ROW_CY;

const R0 = 17, R1 = 96, SPAN = 150, START = -165, N = 3;
const R_ITEM = 65;          // 图标+文字整体的径向中心

/* ═══════════ 配色 ═══════════ */
const C = {
  bgTop: "#1B2447", bgBot: "#151B35",
  cardTop: "#1F2848", cardBot: "#1B2340",
  line: "#2C3757",
  txt3: "#5C6A8C",
  sendBg: "#2C3A5E", sendFg: "#8FA3CB",
  divider: "rgba(196,212,246,0.30)"
};

const PRESETS = [
  { id: "read-only",          short: "仅查看",  label: "仅可查看",     hex: "#6D9BF5", rgb: "109,155,245", icon: "eye"  },
  { id: "workspace-write",    short: "工作区",  label: "工作区内修改", hex: "#E3B04B", rgb: "227,176,75",  icon: "pen"  },
  { id: "danger-full-access", short: "完全权限", label: "完全权限",     hex: "#E5665F", rgb: "229,102,95",  icon: "bang" }
];

/* ═══════════ 几何 ═══════════ */
const rad = d => d * Math.PI / 180;
const pt  = (r, a) => [BTN_CX + r * Math.cos(rad(a)), BTN_CY + r * Math.sin(rad(a))];
const f2  = n => n.toFixed(2);

function sectorPath(a1, a2) {
  const p1 = pt(R1, a1), p2 = pt(R1, a2), p3 = pt(R0, a2), p4 = pt(R0, a1);
  return `M${f2(p1[0])} ${f2(p1[1])} A${R1} ${R1} 0 0 1 ${f2(p2[0])} ${f2(p2[1])}`
       + ` L${f2(p3[0])} ${f2(p3[1])} A${R0} ${R0} 0 0 0 ${f2(p4[0])} ${f2(p4[1])} Z`;
}

/* ═══════════ 图标 ═══════════ */
const SHIELD = "M12 3l7 3v6c0 4-3 7.2-7 9-4-1.8-7-5-7-9V6z";
const ICON = {
  eye : `<path d="${SHIELD}"/><circle cx="12" cy="11.4" r="2.3"/>`,
  pen : `<path d="${SHIELD}"/><path d="M9.2 12l1.9 1.9 3.7-3.8"/>`,
  bang: `<path d="${SHIELD}"/><path d="M12 8.4v3.6"/><circle cx="12" cy="15.1" r="0.95" fill="currentColor" stroke="none"/>`
};
function iconAt(cx, cy, kind, color, scale = 0.62, sw = 2.6) {
  return `<g transform="translate(${f2(cx)},${f2(cy)}) scale(${scale}) translate(-12,-12)"
             fill="none" stroke="${color}" stroke-width="${sw}"
             stroke-linecap="round" stroke-linejoin="round" color="${color}">${ICON[kind]}</g>`;
}

/* ═══════════ 组件 ═══════════ */
function permButton(p) {
  return `<circle cx="${BTN_CX}" cy="${BTN_CY}" r="${BTN_R + 10}" fill="rgba(${p.rgb},0.07)"/>`
       + `<circle cx="${BTN_CX}" cy="${BTN_CY}" r="${BTN_R + 5}"  fill="rgba(${p.rgb},0.11)"/>`
       + `<circle cx="${BTN_CX}" cy="${BTN_CY}" r="${BTN_R}" fill="rgba(${p.rgb},0.18)"
                stroke="${p.hex}" stroke-width="1.5"/>`
       + iconAt(BTN_CX, BTN_CY, p.icon, p.hex);
}

function plainIcon(cx, cy, path) {
  return `<g transform="translate(${f2(cx)},${f2(cy)})" fill="none" stroke="#8796B7"
             stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${path}</g>`;
}

function composer() {
  let s = "";
  s += `<rect x="${CARD.x}" y="${CARD.y}" width="${CARD.w}" height="${CARD.h}" rx="${CARD.r}"
             fill="url(#card)" stroke="${C.line}" stroke-width="1"/>`;
  s += `<text x="${CARD.x + 16}" y="${CARD.y + 30}" fill="${C.txt3}" font-size="14"
             font-family="Microsoft YaHei">输入消息…（这里模拟 DSH 输入框）</text>`;
  s += plainIcon(CARD.x + 14 + 14, ROW_CY, `<path d="M0 -7v14M-7 0h14"/>`);
  s += plainIcon(CARD.x + 14 + 28 + 6 + 30 + 6 + 14, ROW_CY, `<path d="M4 -7l-8 14"/>`);

  const sx = CARD.x + CARD.w - 14 - 15;
  s += `<circle cx="${f2(sx)}" cy="${f2(ROW_CY)}" r="15" fill="${C.sendBg}"/>`;
  s += `<g transform="translate(${f2(sx)},${f2(ROW_CY)})" fill="none" stroke="${C.sendFg}"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M0 6V-6M-6 0l6-6 6 6"/></g>`;
  return s;
}

/* ═══════════ 扇形 ═══════════ */
function fan(hover) {
  const step = SPAN / N;
  const edges = [];
  for (let i = 0; i <= N; i++) edges.push(START + i * step);

  let s = "";

  /* 1 · 扇区底色 */
  for (let i = 0; i < N; i++) {
    const p = PRESETS[i];
    const active = hover === i;
    s += `<path d="${sectorPath(edges[i], edges[i + 1])}"
              fill="rgba(${p.rgb},${active ? 0.60 : 0.15})"/>`;
  }

  /* 2 · 分区线（径向 4 条 + 外弧） */
  for (const a of edges) {
    const a1 = pt(R0, a), a2 = pt(R1, a);
    s += `<line x1="${f2(a1[0])}" y1="${f2(a1[1])}" x2="${f2(a2[0])}" y2="${f2(a2[1])}"
                stroke="${C.divider}" stroke-width="1"/>`;
  }
  const o1 = pt(R1, START), o2 = pt(R1, START + SPAN);
  s += `<path d="M${f2(o1[0])} ${f2(o1[1])} A${R1} ${R1} 0 0 1 ${f2(o2[0])} ${f2(o2[1])}"
             fill="none" stroke="${C.divider}" stroke-width="1"/>`;
  const i1 = pt(R0, START), i2 = pt(R0, START + SPAN);
  s += `<path d="M${f2(i1[0])} ${f2(i1[1])} A${R0} ${R0} 0 0 1 ${f2(i2[0])} ${f2(i2[1])}"
             fill="none" stroke="${C.divider}" stroke-width="1"/>`;

  /* 3 · 高亮描边（压在分区线之上） */
  if (hover >= 0) {
    const p = PRESETS[hover];
    s += `<path d="${sectorPath(edges[hover], edges[hover + 1])}"
              fill="none" stroke="${p.hex}" stroke-width="1.8"/>`;
  }

  /* 4 · 每个扇区：图标 + 下方小字 */
  for (let i = 0; i < N; i++) {
    const p = PRESETS[i];
    const mid = START + (i + 0.5) * step;
    const c = pt(R_ITEM, mid);
    const active = hover === i;
    const iconY = c[1] - 12;
    const textY = c[1] + 14;

    s += iconAt(c[0], iconY, p.icon, active ? "#FFFFFF" : p.hex, 0.92, 2.15);
    s += `<text x="${f2(c[0])}" y="${f2(textY)}" text-anchor="middle" dy="3.1"
               font-size="9" font-family="Microsoft YaHei"
               font-weight="${active ? 700 : 500}"
               fill="${active ? "#FFFFFF" : "rgba(208,219,243,0.88)"}">${p.short}</text>`;
  }
  return s;
}

/* ═══════════ 组装 ═══════════ */
function build({ open, hover }) {
  const shown = open && hover >= 0 ? PRESETS[hover] : PRESETS[1];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 2}" height="${H * 2}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.bgTop}"/><stop offset="1" stop-color="${C.bgBot}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0" r="0.75">
      <stop offset="0" stop-color="#25335F" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#151B35" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.cardTop}"/><stop offset="1" stop-color="${C.cardBot}"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  ${composer()}
  ${open ? `<rect width="${W}" height="${H}" fill="rgba(9,12,26,0.46)"/>` : ``}
  ${open ? fan(hover) : ``}
  ${permButton(shown)}

  <text x="${W / 2}" y="${H - 18}" text-anchor="middle" font-size="11.5"
        font-family="Microsoft YaHei" fill="${C.txt3}" letter-spacing="0.6">${
    open ? "指针移到哪一区 · 哪一区亮 · 松手生效" : "按住圆形按钮，向扇形拖动选择权限"
  }</text>
</svg>`;
}

/* ═══════════ 输出 ═══════════ */
const OUT = "D:/AI-Work/dsh-permission-wheel/preview/shots";
mkdirSync(OUT, { recursive: true });

const SHOTS = [
  { name: "01-idle",      open: false, hover: -1 },
  { name: "02-open",      open: true,  hover: -1 },
  { name: "03-workspace", open: true,  hover: 1  },
  { name: "04-full",      open: true,  hover: 2  },
  { name: "05-readonly",  open: true,  hover: 0  }
];

for (const shot of SHOTS) {
  await sharp(Buffer.from(build(shot))).png().toFile(`${OUT}/${shot.name}.png`);
  console.log("wrote", shot.name);
}
console.log("all done");
