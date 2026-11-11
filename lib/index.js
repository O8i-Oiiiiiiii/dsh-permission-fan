/**
 * dsh-permission-fan — 宿主半边
 *
 * 全部功能在客户端半边（`lib/client.js`）。宿主半边存在的唯一理由，是让这个包成为
 * cordis 树上的**一行**：`dsh.client` 的客户端 bundle 是靠「宿主 Loader 的条目里有这个包」
 * 被 `dsh-client-modules` 扫出来、编进 `window.__DSH_BOOT__` 的。没有宿主条目，客户端
 * 产物永远不会被加载。
 *
 * 三条纪律（沿用已被事故验证过的形状）：
 *   1. `apply()` 绝不抛错 —— 同步抛错会让该条目的 fiber 失败，启动审计会报成
 *      「Failed to load plugins」。
 *   2. 不声明任何服务 —— 申明一个从未被 provide 的服务会让 fiber 停在 PENDING。
 *   3. 不打日志噪音 —— 只在客户端产物明显缺失时告警一次（那是唯一一种「装了但界面
 *      不会有东西」的宿主侧可观测故障）。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PACKAGE_ID = "dsh-permission-fan";

/** 静态核对客户端产物：只读文件、查关键标志，**不执行**产物。 */
function auditClientBundle(log) {
  try {
    const bundle = readFileSync(fileURLToPath(new URL("./client.js", import.meta.url)), "utf8");
    const problems = [];
    if (!bundle.includes(`id: "${PACKAGE_ID}"`) && !bundle.includes(`id:"${PACKAGE_ID}"`)) {
      problems.push("bundle id 不匹配");
    }
    if (!bundle.includes("__ModuleLoader__.load")) problems.push("不是模块加载器 bundle");
    if (!bundle.includes("conversation.input.permission")) problems.push("没有声明目标插槽");
    if (!/exports\.apply|apply\s*\(/.test(bundle)) problems.push("没有导出 apply");
    if (problems.length > 0) {
      log(`客户端产物 lib/client.js 检查未通过（界面可能不会出现扇形按钮）：${problems.join("；")}`);
      return;
    }
    log(`客户端产物 lib/client.js 就绪（${Buffer.byteLength(bundle, "utf8")} 字节，静态检查通过）`);
  } catch (error) {
    log(`客户端产物 lib/client.js 不可读（界面不会出现扇形按钮）：${String(error)}`);
  }
}

/**
 * @param ctx 宿主 cordis 上下文（本插件不使用它的任何能力）
 */
export function apply(ctx) {
  try {
    const candidate = ctx?.logger;
    const sink = typeof candidate === "function" ? candidate(PACKAGE_ID) : candidate;
    const log = (message) => {
      try {
        if (sink && typeof sink.info === "function") sink.info(`[${PACKAGE_ID}] ${message}`);
        else console.info(`[${PACKAGE_ID}] ${message}`);
      } catch {
        /* 连日志都不能抛 */
      }
    };
    auditClientBundle(log);
  } catch {
    /* 审计本身失败也必须让 apply 静默成功 */
  }
}

export default { apply };
