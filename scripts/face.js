/* ==========================================================================
   亮面 / 暗面
   --------------------------------------------------------------------------
   这个站有两面。亮面是能给人看的（游戏、作品），暗面是我自己留着的那部分
   （缘起、关于、联系）。切换时一轮月亮从满月走到新月，走一半时换面。

   三条约束，改之前别动：
   1. **底色不跟着翻。** 底色一直是深空，变的只是月亮走到哪儿。
      如果把暗面做成浅色底，品牌当场就断 —— 从「深空天文台」变成「又一个极简站」。
   2. **几何不写第二套。** 亮面路径直接调 scripts/main.js 里的 moonPath()，
      切换键的小图标也用同一个函数（换算到 r=15）。三处（月亮、切换键、覆盖层）
      共用一个公式，改一处三处一起变。
   3. **没有 JS 时两面都显示。** data-face 由脚本写在 <html> 上；
      脚本不跑就没有这个属性，CSS 里的隐藏规则也就不生效，页面完整可读。
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var btn = document.getElementById("faceToggle");
  var label = document.getElementById("faceToggleLabel");
  var turn = document.getElementById("faceTurn");
  var turnPath = document.getElementById("faceTurnPath");
  var iconPath = document.getElementById("faceTogglePath");
  if (!btn || !turn || !turnPath || !iconPath) return;

  /* main.js 里的那一套几何。半径参数化，r=140 给页面月亮、r=15 给切换键图标。
     k = cos(2π·phase)：k>0 是月牙（sweep 0），k<0 是凸月（sweep 1）。
     phase 0 = 新月，0.5 = 满月。 */
  var CX = 200, CY = 200;
  function moonPath(phase, r, cx, cy) {
    cx = cx === undefined ? CX : cx;
    cy = cy === undefined ? CY : cy;
    var k = Math.cos(2 * Math.PI * phase);
    var rx = Math.max(Math.abs(k) * r, 0.01);
    var sweep = k > 0 ? 0 : 1;
    return "M " + cx + " " + (cy - r) +
           " A " + r + " " + r + " 0 0 1 " + cx + " " + (cy + r) +
           " A " + rx.toFixed(2) + " " + r + " 0 0 " + sweep + " " +
           cx + " " + (cy - r) + " Z";
  }

  var FACES = { lit: 0.5, dark: 0 };   // 满月 / 新月
  var current = "lit";
  var busy = false;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- 切换键上的小月亮：跟着当前面走 ---- */
  function paintIcon(face) {
    var ph = FACES[face];
    /* 反过来画：亮面时月亮是满的，暗面时是空的。
       直接用 phase 会让图标在暗面显示成新月（对的），
       但新月几乎看不见 —— 所以暗面补一点极弱的地球反照。 */
    iconPath.setAttribute("d", ph > 0.4 ? moonPath(ph, 15, 20, 20) : "");
    btn.classList.toggle("is-dark", face === "dark");
  }

  function apply(face) {
    current = face;
    root.setAttribute("data-face", face);
    btn.setAttribute("aria-pressed", face === "dark" ? "true" : "false");
    btn.setAttribute("aria-label", face === "dark" ? "切到亮面" : "切到暗面");
    if (label) label.textContent = face === "dark" ? "暗面" : "亮面";
    paintIcon(face);
  }

  /* ---- 换面动效：一轮月亮从满月走到新月，走到一半时换内容 ----
     用 setTimeout 逐帧而不是 requestAnimationFrame：
     无头浏览器里 rAF 可能一次都不跑（见 headless-html-check 技能），
     动画会卡在第一帧，swapped 永远不置位 —— 表现为「点了没反应」。
     16ms 一步对这种过渡够用了，真机上不比 rAF 差多少。 */
  function flip() {
    if (busy) return;
    busy = true;

    var from = FACES[current];
    var to = FACES[current === "lit" ? "dark" : "lit"];
    var next = current === "lit" ? "dark" : "lit";
    var swapped = false;

    /* 用户要求减少动效：直接换，不播动画 */
    if (reduce) { apply(next); busy = false; return; }

    turn.hidden = false;
    /* 强制一次重排，保证 hidden 去掉后 opacity 的过渡真的会跑 */
    void turn.offsetWidth;
    turn.classList.add("is-on");

    var FRAME = 16;
    var STEPS = 40;                       // 40 × 16 ≈ 640ms
    var k = 0;

    function step() {
      var p = Math.min(k / STEPS, 1);
      /* ease-in-out：两头慢中间快，像真的转过去 */
      var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

      turnPath.setAttribute("d", moonPath(from + (to - from) * e, 140));

      /* 走到一半时换面 —— 这时月亮正好在中间，两面都看不清 */
      if (!swapped && p >= 0.5) { swapped = true; apply(next); }

      if (p < 1) { k++; window.setTimeout(step, FRAME); return; }

      turn.classList.remove("is-on");
      turn.hidden = true;
      busy = false;
    }
    window.setTimeout(step, FRAME);
  }

  btn.addEventListener("click", flip);

  /* ---- 键盘：不用 Tab 一路找过去，直接给一个快捷键 ---- */
  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "d" || e.key === "D") { e.preventDefault(); flip(); }
  });

  /* 首屏就设好，免得第一帧闪一下两面都在 */
  apply("lit");

  /* 切到暗面后，如果当前位置在亮面的区块上，滚到暗面对应的地方，
     否则会停在一条已经不存在的 section 后面。 */
  window.addEventListener("pageshow", function (e) {
    if (!e.persisted) return;
    var id = location.hash.slice(1);
    if (!id) { window.scrollTo(0, 0); return; }
    var el = document.getElementById(id);
    if (el && el.closest("[data-face]")) {
      var want = el.closest("[data-face]").getAttribute("data-face");
      if (want !== current) apply(want);
    }
  });
})();
