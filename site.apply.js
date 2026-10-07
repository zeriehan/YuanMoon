/* ==========================================================================
   配置注入 —— 把 site.config.js 的内容覆盖到页面里
   --------------------------------------------------------------------------
   三条原则，模板使用者不用知道细节：

   1. **只做覆盖，不做生成。** 所有元素在 index.html 里已经写好了正确内容，
      JS 只是把文字换掉。禁用 JS 时页面依然完整可读。
   2. **配置缺失不报错。** site.config.js 不存在、写错了、或者某项没填，
      一律静默回退到 HTML 里的原值。
   3. **主题色只改一个变量。** tokens.css 里所有半透明层都写成
      color-mix(..., var(--halo-300) N%, transparent)，所以覆盖 --halo-300
      一个值，全站跟着变。
   ========================================================================== */
(function () {
  "use strict";

  var cfg = window.SITE;
  if (!cfg || typeof cfg !== "object") return;      // 没配置就用 HTML 原值

  /* ---- 小工具 ------------------------------------------------------- */

  /** 只在配置项是非空字符串时才写入，避免把内容清成空白。 */
  function text(sel, value) {
    if (typeof value !== "string" || !value.trim()) return false;
    var el = document.querySelector(sel);
    if (!el) return false;
    el.textContent = value;
    return true;
  }

  /** 按 data-site="键" 批量写入，HTML 里不用给每个元素写选择器。 */
  function byKey(value, key) {
    if (typeof value !== "string" || !value.trim()) return 0;
    var nodes = document.querySelectorAll('[data-site="' + key + '"]');
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = value;
    return nodes.length;
  }

  function attr(sel, name, value) {
    if (typeof value !== "string" || !value.trim()) return false;
    var el = document.querySelector(sel);
    if (!el) return false;
    el.setAttribute(name, value);
    return true;
  }

  /** 页面上所有 href="[site]" 的元素，换成配置里的地址。 */
  function links(value, keys) {
    if (typeof value !== "string" || !value.trim()) return 0;
    var sel = keys.map(function (k) { return '[data-site-link="' + k + '"]'; }).join(",");
    var nodes = document.querySelectorAll(sel);
    for (var i = 0; i < nodes.length; i++) nodes[i].setAttribute("href", value);
    return nodes.length;
  }

  /* ---- 主题色 ------------------------------------------------------- */

  /* 只改 --halo-300。其余色阶是辅助色，留在 tokens.css 里，
     因为把整套色阶从一个色值派生会明显改变原站的观感。 */
  if (typeof cfg.accent === "string" && /^#[0-9a-f]{3,8}$/i.test(cfg.accent.trim())) {
    document.documentElement.style.setProperty("--halo-300", cfg.accent.trim());
  }

  /* ---- 站名 --------------------------------------------------------- */

  var name = typeof cfg.name === "string" ? cfg.name.trim() : "";
  var nameEn = typeof cfg.nameEn === "string" ? cfg.nameEn.trim() : "";

  if (name) {
    byKey(name, "name");
    /* 浏览器标签页：把原标题拆成「站名 + 标语」重拼，
       这样每个人改完标签页就是自己的站，而不是"缘梦"。 */
    var tag = name + (nameEn ? " · " + nameEn : "");
    document.title = tag;
  }
  if (nameEn) byKey(nameEn, "nameEn");

  /* ---- 标语与介绍 --------------------------------------------------- */

  if (typeof cfg.tagline === "string" && cfg.tagline.trim()) {
    byKey(cfg.tagline, "tagline");
    document.title = (name || "") + (nameEn ? " " + nameEn : "") +
                     " · " + cfg.tagline.trim();
  }
  if (typeof cfg.lede === "string") {
    if (cfg.lede.trim()) {
      byKey(cfg.lede, "lede");
    } else {
      /* 显式留空 = 不要这段引言 */
      var ledeEl = document.querySelector('[data-site="lede"]');
      if (ledeEl && ledeEl.parentNode) ledeEl.parentNode.style.display = "none";
    }
  }

  /* ---- 邮箱 --------------------------------------------------------- */

  if (typeof cfg.email === "string" && cfg.email.trim()) {
    var mail = cfg.email.trim();
    var nodes = document.querySelectorAll('[data-site-link="email"]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].setAttribute("href", "mailto:" + mail);
    }
    byKey(mail, "email");
  }

  /* ---- 页脚 --------------------------------------------------------- */

  if (typeof cfg.footnote === "string" && cfg.footnote.trim()) {
    byKey(cfg.footnote, "footnote");
  }

  /* ---- 游戏卡片 ----------------------------------------------------- */

  /* 卡片是配置驱动的：works 里有几项就渲染几张。
     index.html 里原本那几张作为无 JS 兜底保留，JS 接管后被替换掉。 */
  if (Array.isArray(cfg.games) && cfg.games.length) {
    var wrap = document.querySelector("[data-games]");
    if (wrap) {
      wrap.textContent = "";
      cfg.games.forEach(function (w) {
        wrap.appendChild(buildCard(w));
      });
    }
  }

  /* 一张作品卡。phase 是进度 0–1，不是真实月相位置 ——
     亮面始终从右边生长，所以把 p 映射到 0–0.5 这一半程。 */
  function buildCard(w) {
    var art = document.createElement("article");
    art.className = "work" + (w.href ? " work--live" : "");
    var phase = typeof w.phase === "number" ? Math.max(0, Math.min(1, w.phase)) : 0.25;

    var head = document.createElement("div");
    head.className = "work__head";
    head.innerHTML =
      '<svg class="work__phase" viewBox="0 0 40 40" aria-hidden="true">' +
      '<circle cx="20" cy="20" r="14" fill="#131a2c"/>' +
      litPath(phase) +
      '<circle cx="20" cy="20" r="14" fill="none" stroke="var(--halo-300)" stroke-width="1" opacity="0.45"/>' +
      "</svg>" +
      (w.tag ? '<span class="work__tag"></span>' : "");
    if (w.tag) head.querySelector(".work__tag").textContent = w.tag;
    art.appendChild(head);

    var h3 = document.createElement("h3");
    h3.className = "work__title";
    if (w.href) {
      var a = document.createElement("a");
      a.className = "work__link";
      a.setAttribute("href", w.href);
      a.textContent = w.title || "";
      h3.appendChild(a);
    } else {
      h3.textContent = w.title || "";
    }
    art.appendChild(h3);

    var p = document.createElement("p");
    p.className = "work__desc";
    p.textContent = w.desc || "";
    art.appendChild(p);

    if (w.status) {
      var st = document.createElement("span");
      st.className = "work__status" +
        (w.href ? " work__status--live" : " work__status--soon");
      st.textContent = w.status;
      art.appendChild(st);
    }
    if (w.href) {
      var cta = document.createElement("span");
      cta.className = "work__cta";
      cta.setAttribute("aria-hidden", "true");
      cta.textContent = "开始玩 →";
      art.appendChild(cta);
    }
    return art;
  }

  /* 亮面比例 → 月相路径。
     与 scripts/main.js 同一套几何（k = cos(2π·q)，k>0 配 sweep 0，k<0 配 sweep 1），
     但这里从「亮面比例」反解 q，让配置里的 phase 就是百分比本身 ——
     写 0.85 就真的亮 85%，而不是某个需要心算的相位。

       lit = (1 − cos(2πq)) / 2   ⟹   k = 1 − 2·lit
     半径不能为 0 —— SVG 规范要求 A 命令半径为正。 */
  function litPath(lit) {
    if (!(lit > 0.02)) return "";
    var k = Math.max(-1, Math.min(1, 1 - 2 * lit));
    var rx = Math.max(Math.abs(k) * 14, 0.01);
    var sweep = k > 0 ? 0 : 1;
    return '<path d="M20 6 A14 14 0 0 1 20 34 A' +
      rx.toFixed(2) + " 14 0 0 " + sweep + ' 20 6 Z" fill="var(--halo-100)"/>';
  }
})();
