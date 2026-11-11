import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire("C:/Users/Sorrymaker/.dsh/profiles/desktop/node_modules/x.js");
const sharp = require("sharp");

/* 图标尺寸校对图：把三个图标按实际比例放大 6 倍并排，
   每个都套一个代表「15px 实际格子」的虚线参考框。 */

const ZOOM = 6;
const CELL = 22 * ZOOM;          // 132
const GAP = 56;
const PAD = 40;
const LABEL_H = 46;
const W = PAD * 2 + CELL * 3 + GAP * 2;
const H = PAD * 2 + CELL + LABEL_H;

const PRESETS = [
  { short: "仅查看",   hex: "#6D9BF5", rgb: "109,155,245", icon: "eye"  },
  { short: "工作区",   hex: "#E3B04B", rgb: "227,176,75",  icon: "pen"  },
  { short: "完全权限", hex: "#E5665F", rgb: "229,102,95",  icon: "bang" }
];

const SHIELD = "M12 3l7 3v6c0 4-3 7.2-7 9-4-1.8-7-5-7-9V6z";
const ICON = {
  eye : `<path d="${SHIELD}"/><circle cx="12" cy="11.4" r="2.3"/>`,
  pen : `<path d="${SHIELD}"/><path d="M9.2 12l1.9 1.9 3.7-3.8"/>`,
  bang: `<path d="${SHIELD}"/><path d="M12 8.4v3.6"/><circle cx="12" cy="15.1" r="0.95" fill="currentColor" stroke="none"/>`
};

const f2 = n => n.toFixed(2);

let body = "";
const scale = CELL / 24 * 0.66;   // 与实际扇区内图标同一比例（24 → 15 × 0.66 视觉）

PRESETS.forEach((p, i) => {
  const x = PAD + i * (CELL + GAP);
  const y = PAD;
  const cx = x + CELL / 2;
  const cy = y + CELL / 2;

  // 参考框
  body += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="4"
                 fill="none" stroke="rgba(196,212,246,0.22)" stroke-width="1" stroke-dasharray="4 4"/>`;
  // 图标
  body += `<g transform="translate(${f2(cx)},${f2(cy)}) scale(${f2(scale)}) translate(-12,-12)"
                fill="none" stroke="${p.hex}" stroke-width="2.9"
                stroke-linecap="round" stroke-linejoin="round" color="${p.hex}">${ICON[p.icon]}</g>`;
  // 文字
  body += `<text x="${f2(cx)}" y="${y + CELL + 26}" text-anchor="middle"
                font-size="13" font-family="Microsoft YaHei" fill="rgba(210,221,245,0.9)">${p.short}</text>`;
  body += `<text x="${f2(cx)}" y="${y + CELL + 42}" text-anchor="middle"
                font-size="10" font-family="Microsoft YaHei" fill="#5C6A8C">22 × 22 px</text>`;
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#151B35"/>
  ${body}
</svg>`;

mkdirSync("D:/AI-Work/dsh-permission-wheel/preview/shots", { recursive: true });
await sharp(Buffer.from(svg)).png().toFile("D:/AI-Work/dsh-permission-wheel/preview/shots/07-icon-check.png");
console.log("wrote 07-icon-check", W + "x" + H);
