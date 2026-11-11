/**
 * dsh-permission-fan — 客户端半边
 *
 * 把输入框工具行里的权限切换，从官方那个「盾牌 + 下拉菜单」换成：
 *   按住圆形按钮 → 向上弹出三等分扇形 → 拖到哪一区 → 松手就切到那个权限。
 *
 * ── 接线依据（全部来自 app.asar 里的官方实现，不是猜的）──────────────────
 *
 *   席（slot）：`conversation.input.permission`，single 类型，官方
 *   `client-ui-permission-presets` 就注册在这里。single 插槽后注册者接管该位置。
 *
 *   读当前值：插槽 props 的 `useProjection("permissions")` → `{ currentValue }`，
 *   值域 read-only / workspace-write / danger-full-access。
 *
 *   写新值：`ctx.sessions.binding(sessionId).session.command("/permission <值>")`，
 *   这正是官方客户端的原话 `live.command('/permission ' + preset)`。
 *
 * ── 纪律 ──────────────────────────────────────────────────────────────
 *   1. fail-open：拿不到投影就返回 null（不渲染），绝不连累输入框。
 *   2. 不碰 DOM：不查询、不修改任何官方元素；扇形用 portal 挂到 body。
 *   3. apply 不抛错：注册失败只让这块控件不出现。
 */
window.__ModuleLoader__.load({
  id: "dsh-permission-fan",
  factory(require) {
    const React = require("react");
    const ReactDOM = require("react-dom");

    const PACKAGE_ID = "dsh-permission-fan";
    const SLOT = "conversation.input.permission";
    const NS = "permission.fan";

    /* ── 几何（与效果图完全同一套参数） ── */
    const R0 = 17;            // 内圈半径
    const R1 = 96;            // 外圈半径
    const SPAN = 150;         // 总张角
    const START = -165;       // 起始角（SVG 里 -90° 为正上方）
    const R_ITEM = 65;        // 图标+文字的径向中心
    const CANVAS = 300;       // 浮层画布边长
    const CX = 150;           // 画布内圆心 X
    const CY = 290;           // 画布内圆心 Y（靠底，向上留出扇形空间）
    const OUTER_SLOP = 14;    // 判定半径的宽容量

    const PRESETS = [
      { id: "read-only",          key: "readOnly",  rgb: "109,155,245", hex: "#6D9BF5", icon: "eye"  },
      { id: "workspace-write",    key: "workspace", rgb: "227,176,75",  hex: "#E3B04B", icon: "pen"  },
      { id: "danger-full-access", key: "full",      rgb: "229,102,95",  hex: "#E5665F", icon: "bang" }
    ];

    const DICTS = {
      zh: {
        "label.current": "访问模式，当前：{name}",
        "preset.readOnly": "仅查看",
        "preset.workspace": "工作区",
        "preset.full": "完全权限"
      },
      en: {
        "label.current": "Access mode, current: {name}",
        "preset.readOnly": "Read only",
        "preset.workspace": "Workspace",
        "preset.full": "Full access"
      }
    };

    const CSS = `
button.dpf-btn{
  width:34px !important;
  height:34px !important;
  border-radius:50% !important;
  box-sizing:border-box !important;
  flex:none;
  border:none !important;
  background:transparent !important;
  color:rgb(var(--dpf-rgb));
  display:inline-flex;align-items:center;justify-content:center;
  padding:0;cursor:pointer;outline:none;
  transition:background .16s, transform .16s, box-shadow .16s;
}
button.dpf-btn:hover{background:rgba(var(--dpf-rgb),0.10) !important}
button.dpf-btn[data-open="true"]{
  transform:scale(1.06);
  background:rgba(var(--dpf-rgb),0.16) !important;
  box-shadow:0 0 0 3px rgba(var(--dpf-rgb),0.12);
}
button.dpf-btn:focus-visible{box-shadow:0 0 0 2px rgba(var(--dpf-rgb),0.55)}
button.dpf-btn:disabled{opacity:.45;cursor:default}
button.dpf-btn svg{width:22px !important;height:22px !important;display:block}

.dpf-scrim{
  position:fixed;inset:0;background:rgba(9,12,26,0.46);
  z-index:2147482999;pointer-events:none;
}
.dpf-layer{
  position:fixed;width:${CANVAS}px;height:${CANVAS}px;
  pointer-events:none;z-index:2147483000;
  transform-origin:${CX}px ${CY}px;
  animation:dpf-in .15s cubic-bezier(.2,.9,.3,1.2);
}
@keyframes dpf-in{
  from{opacity:.25;transform:scale(.94)}
  to{opacity:1;transform:scale(1)}
}
.dpf-item{
  position:absolute;transform:translate(-50%,-50%);
  display:flex;flex-direction:column;align-items:center;gap:4px;
  pointer-events:none;white-space:nowrap;
}
.dpf-item svg{width:22px;height:22px;display:block}
.dpf-item span{
  font-size:9px;font-weight:500;line-height:1;letter-spacing:.2px;
  color:rgba(208,219,243,.88);
}
.dpf-item[data-active="true"]{transform:translate(-50%,-50%) scale(1.05)}
.dpf-item[data-active="true"] span{color:#fff;font-weight:700}
@media (prefers-reduced-motion: reduce){
  .dpf-layer{animation:none}
}
`;

    /* ── 几何工具 ── */
    const rad = (d) => (d * Math.PI) / 180;
    const f2 = (n) => n.toFixed(2);
    const polar = (r, a) => [CX + r * Math.cos(rad(a)), CY + r * Math.sin(rad(a))];

    function sectorPath(a1, a2) {
      const p1 = polar(R1, a1);
      const p2 = polar(R1, a2);
      const p3 = polar(R0, a2);
      const p4 = polar(R0, a1);
      return "M" + f2(p1[0]) + " " + f2(p1[1]) +
        " A" + R1 + " " + R1 + " 0 0 1 " + f2(p2[0]) + " " + f2(p2[1]) +
        " L" + f2(p3[0]) + " " + f2(p3[1]) +
        " A" + R0 + " " + R0 + " 0 0 0 " + f2(p4[0]) + " " + f2(p4[1]) + " Z";
    }

    function arcPath(r, a1, a2) {
      const p1 = polar(r, a1);
      const p2 = polar(r, a2);
      return "M" + f2(p1[0]) + " " + f2(p1[1]) +
        " A" + r + " " + r + " 0 0 1 " + f2(p2[0]) + " " + f2(p2[1]);
    }

    /** 指针落在哪一区；-1 表示不在任何一区（太近、太远、或跑到下方）。 */
    function hitTest(x, y, origin) {
      if (!origin) return -1;
      const dx = x - origin.x;
      const dy = y - origin.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < R0 || dist > R1 + OUTER_SLOP) return -1;
      let a = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (a > 0) a -= 360;
      if (a < START || a > START + SPAN) return -1;
      const step = SPAN / PRESETS.length;
      const idx = Math.floor((a - START) / step);
      return Math.max(0, Math.min(PRESETS.length - 1, idx));
    }

    /* ── 图标 ── */
    const SHIELD = "M12 3l7 3v6c0 4-3 7.2-7 9-4-1.8-7-5-7-9V6z";

    function Glyph(props) {
      const { kind, size, strokeWidth } = props;
      const common = {
        viewBox: "0 0 24 24",
        width: size,
        height: size,
        fill: "none",
        stroke: "currentColor",
        strokeWidth: strokeWidth || 2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": true
      };
      if (kind === "eye") {
        return React.createElement("svg", common,
          React.createElement("path", { d: SHIELD }),
          React.createElement("circle", { cx: 12, cy: 11.4, r: 2.3 })
        );
      }
      if (kind === "pen") {
        return React.createElement("svg", common,
          React.createElement("path", { d: SHIELD }),
          React.createElement("path", { d: "M9.2 12l1.9 1.9 3.7-3.8" })
        );
      }
      return React.createElement("svg", common,
        React.createElement("path", { d: SHIELD }),
        React.createElement("path", { d: "M12 8.4v3.6" }),
        React.createElement("circle", { cx: 12, cy: 15.1, r: 0.95, fill: "currentColor", stroke: "none" })
      );
    }

    /* ── 组件 ── */
    function FanPermission(props) {
      const { locked, select, t, useProjection } = props;

      // 官方契约：投影缺失 = 该能力在本机不存在，直接不渲染。
      const selection = useProjection("permissions");

      const [open, setOpen] = React.useState(false);
      const [hover, setHover] = React.useState(-1);
      const [origin, setOrigin] = React.useState(null);
      const [busy, setBusy] = React.useState(false);
      const btnRef = React.useRef(null);

      const currentValue = selection && selection.currentValue;
      let currentIdx = PRESETS.findIndex((p) => p.id === currentValue);
      if (currentIdx < 0) currentIdx = 1;
      const current = PRESETS[currentIdx];

      const close = React.useCallback(() => {
        setOpen(false);
        setHover(-1);
        setOrigin(null);
      }, []);

      React.useEffect(() => {
        if (!open) return undefined;

        const onMove = (e) => {
          setHover(hitTest(e.clientX, e.clientY, origin));
        };

        const onUp = (e) => {
          const idx = hitTest(e.clientX, e.clientY, origin);
          close();
          if (idx < 0) return;
          const target = PRESETS[idx];
          if (!target || target.id === currentValue) return;
          setBusy(true);
          Promise.resolve()
            .then(() => select(target.id))
            .catch((error) => {
              try {
                console.error("[permission-fan] 切换权限失败：", error);
              } catch (_) { /* 忽略 */ }
            })
            .then(() => setBusy(false));
        };

        const onCancel = () => close();
        const onKey = (e) => {
          if (e.key === "Escape") close();
        };

        window.addEventListener("pointermove", onMove, true);
        window.addEventListener("pointerup", onUp, true);
        window.addEventListener("pointercancel", onCancel, true);
        window.addEventListener("keydown", onKey, true);
        return () => {
          window.removeEventListener("pointermove", onMove, true);
          window.removeEventListener("pointerup", onUp, true);
          window.removeEventListener("pointercancel", onCancel, true);
          window.removeEventListener("keydown", onKey, true);
        };
      }, [open, origin, currentValue, select, close]);

      if (selection === undefined || selection === null) return null;

      const label = t("label.current", { name: t("preset." + current.key) });

      const onDown = (e) => {
        if (locked || busy) return;
        if (e.button !== undefined && e.button !== 0) return;
        e.preventDefault();
        const el = btnRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        setOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
        setHover(-1);
        setOpen(true);
        try {
          el.setPointerCapture(e.pointerId);
        } catch (_) { /* 部分环境不支持，忽略 */ }
      };

      const button = React.createElement("button", {
        ref: btnRef,
        type: "button",
        className: "dpf-btn",
        style: {
          "--dpf-rgb": current.rgb,
          width: "34px",
          height: "34px",
          borderRadius: "50%",
          clipPath: "circle(50%)",
          boxSizing: "border-box",
          padding: 0,
          flex: "none",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center"
        },
        "data-open": open ? "true" : "false",
        "aria-label": label,
        "aria-haspopup": "true",
        "aria-expanded": open,
        title: label,
        disabled: Boolean(locked || busy),
        onPointerDown: onDown,
        onContextMenu: (e) => e.preventDefault()
      }, React.createElement(Glyph, { kind: current.icon, size: 22, strokeWidth: 1.9 }));

      if (!open || origin === null) return button;

      /* ── 扇形浮层 ── */
      const step = SPAN / PRESETS.length;
      const edges = [];
      for (let i = 0; i <= PRESETS.length; i += 1) edges.push(START + i * step);

      const sectors = PRESETS.map((p, i) => React.createElement("path", {
        key: "sector-" + p.id,
        d: sectorPath(edges[i], edges[i + 1]),
        fill: "rgba(" + p.rgb + "," + (hover === i ? 0.6 : 0.15) + ")"
      }));

      const dividers = edges.map((a, i) => {
        const p1 = polar(R0, a);
        const p2 = polar(R1, a);
        return React.createElement("line", {
          key: "div-" + i,
          x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1],
          stroke: "rgba(198,214,248,0.30)", strokeWidth: 1
        });
      });

      const arcs = [
        React.createElement("path", {
          key: "arc-outer",
          d: arcPath(R1, START, START + SPAN),
          fill: "none", stroke: "rgba(198,214,248,0.30)", strokeWidth: 1
        }),
        React.createElement("path", {
          key: "arc-inner",
          d: arcPath(R0, START, START + SPAN),
          fill: "none", stroke: "rgba(198,214,248,0.30)", strokeWidth: 1
        })
      ];

      const highlight = hover >= 0 && PRESETS[hover]
        ? React.createElement("path", {
          key: "highlight",
          d: sectorPath(edges[hover], edges[hover + 1]),
          fill: "none",
          stroke: PRESETS[hover].hex,
          strokeWidth: 1.8
        })
        : null;

      const items = PRESETS.map((p, i) => {
        const mid = START + (i + 0.5) * step;
        const q = polar(R_ITEM, mid);
        const active = hover === i;
        return React.createElement("div", {
          key: "item-" + p.id,
          className: "dpf-item",
          style: {
            left: q[0] + "px",
            top: q[1] + "px",
            color: active ? "#FFFFFF" : "rgb(" + p.rgb + ")"
          },
          "data-active": active ? "true" : "false"
        },
          React.createElement(Glyph, { kind: p.icon, size: 22, strokeWidth: 2.15 }),
          React.createElement("span", null, t("preset." + p.key))
        );
      });

      const layer = React.createElement("div", {
        className: "dpf-layer",
        style: { left: origin.x - CX, top: origin.y - CY },
        "aria-hidden": "true"
      },
        React.createElement("svg", {
          viewBox: "0 0 " + CANVAS + " " + CANVAS,
          width: CANVAS,
          height: CANVAS,
          style: { display: "block", overflow: "visible" }
        }, sectors, dividers, arcs, highlight),
        items
      );

      return React.createElement(React.Fragment, null,
        button,
        ReactDOM.createPortal(
          React.createElement(React.Fragment, null,
            React.createElement("div", { className: "dpf-scrim" }),
            layer
          ),
          document.body
        )
      );
    }

    /* ── 插件接线 ── */
    const inject = ["slots", "sessions", "locale"];

    function apply(ctx) {
      const sessions = ctx.sessions;
      if (!sessions || typeof sessions.binding !== "function") {
        try {
          console.error("[permission-fan] 缺少 sessions 服务，扇形按钮不会出现（官方下拉保持原样）");
        } catch (_) { /* 忽略 */ }
        return;
      }

      try {
        ctx.effect(() => ctx.locale.register(NS, DICTS), "permission-fan dictionaries");
      } catch (error) {
        try {
          console.error("[permission-fan] 文案注册失败：", error);
        } catch (_) { /* 忽略 */ }
      }

      try {
        ctx.effect(() => {
          const tag = document.createElement("style");
          tag.dataset.plugin = PACKAGE_ID;
          tag.textContent = CSS;
          document.head.appendChild(tag);
          return () => {
            tag.remove();
          };
        }, "permission-fan styles");
      } catch (error) {
        try {
          console.error("[permission-fan] 样式注册失败：", error);
        } catch (_) { /* 忽略 */ }
      }

      const submit = async (sessionId, preset) => {
        const live = sessions.binding(sessionId)?.session;
        if (live === undefined) throw new Error("this session is not materialized yet");
        const result = await live.command("/permission " + preset);
        if (!result.ok) {
          throw new Error("permission switch failed: " + (result.error && result.error.message ? result.error.message : String(result.error)));
        }
        if (!result.value || !result.value.matched) throw new Error("the host offers no /permission command");
        return true;
      };

      try {
        ctx.slots.inject(SLOT, () => ctx.slots.register({
          name: SLOT,
          locale: NS,
          inject: (sessionId) => ({
            select: (preset) => submit(sessionId, preset)
          })
        }, FanPermission));
      } catch (error) {
        try {
          console.error("[permission-fan] 插槽注册失败，扇形按钮不会出现：", error);
        } catch (_) { /* 忽略 */ }
      }
    }

    return { inject, apply };
  }
});
