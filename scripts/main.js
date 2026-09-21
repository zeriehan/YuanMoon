/* ==========================================================================
   缘梦 YuanMoon · 交互脚本
   --------------------------------------------------------------------------
   只做四件事：铺星场、按滚动算月相、滚动入场、导航实体化。
   刻意不用任何框架 —— 这个站的全部逻辑加起来不到 200 行。
   ========================================================================== */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ======================================================================
     1. 星场
     按视口面积决定星星数量，小屏不挤、大屏不空。位置一次生成后固定，
     闪烁节奏各不相同，避免整片星空同频呼吸的塑料感。
     ====================================================================== */
  function buildStarfield() {
    var svg = document.getElementById("starfield");
    if (!svg) return;

    var w = window.innerWidth;
    var h = window.innerHeight;
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);

    var count = Math.round(Math.min(Math.max((w * h) / 14000, 60), 180));
    var stars = [];

    for (var i = 0; i < count; i++) {
      var cx = (Math.random() * w).toFixed(1);
      var cy = (Math.random() * h).toFixed(1);
      // 半径小、亮度低的是背景星，偶尔来一颗亮一点的做主星
      var bright = Math.random() > 0.9;
      var r = (bright ? Math.random() * 0.9 + 0.9 : Math.random() * 0.9 + 0.3).toFixed(2);
      var min = (Math.random() * 0.1 + 0.06).toFixed(3);
      var max = (bright ? Math.random() * 0.3 + 0.65 : Math.random() * 0.45 + 0.3).toFixed(3);
      var dur = (Math.random() * 5 + 3).toFixed(2);
      // 用负延迟让星星一上来就处于各自周期的不同位置
      var delay = (Math.random() * 6).toFixed(2);

      stars.push(
        '<circle class="star" cx="' + cx + '" cy="' + cy + '" r="' + r + '"' +
        ' style="--star-min:' + min + ';--star-max:' + max +
        ';--twinkle-dur:' + dur + 's;--twinkle-delay:-' + delay + 's"></circle>'
      );
    }

    svg.innerHTML = stars.join("");
  }

  /* ======================================================================
     2. 月相
     ----------------------------------------------------------------------
     月相的本质是"右半圆"与一个椭圆的和差：
       k = cos(2π·phase)
       · phase = 0    → k = 1  → 椭圆与右半圆完全重合，面积为零（新月）
       · phase = 0.25 → k = 0  → 椭圆退化成直线，只剩右半圆（上弦）
       · phase = 0.5  → k = -1 → 椭圆向左凸出补齐整圆（满月）
     椭圆弧的方向（sweep）由 k 的符号决定：k > 0 时月牙向右凹，
     k < 0 时凸月向左鼓。
     ====================================================================== */
  var MOON_R = 140;
  var MOON_CX = 200;
  var MOON_CY = 200;

  function moonPath(phase) {
    var k = Math.cos(2 * Math.PI * phase);
    // rx 不能为 0：SVG 规范里 A 命令的半径必须大于零
    var rx = Math.max(Math.abs(k) * MOON_R, 0.01);
    // 方向很关键，反了会把新月画成满月：
    //   第二条弧是从底部回到顶部。sweep=0（逆时针）会经过右侧，
    //   与第一条右半圆夹出一条月牙；sweep=1（顺时针）经过左侧，
    //   正好补齐整圆得到满月。所以 k>0（月牙）配 0，k<0（凸月）配 1。
    var sweep = k > 0 ? 0 : 1;

    return "M " + MOON_CX + " " + (MOON_CY - MOON_R) +
           " A " + MOON_R + " " + MOON_R + " 0 0 1 " + MOON_CX + " " + (MOON_CY + MOON_R) +
           " A " + rx.toFixed(2) + " " + MOON_R + " 0 0 " + sweep + " " +
           MOON_CX + " " + (MOON_CY - MOON_R) + " Z";
  }

  var hero = document.querySelector(".hero");
  var moon = document.getElementById("heroMoon");
  var litPath = document.getElementById("moonLitPath");
  var phaseLabel = document.getElementById("moonPhaseLabel");
  var halo = moon ? moon.querySelector(".moon__halo") : null;
  var header = document.getElementById("siteHeader");

  var ticking = false;

  function applyScrollState() {
    var y = window.scrollY || window.pageYOffset || 0;

    // 导航：离开首屏就实体化，避免一直压着月亮
    if (header) {
      header.dataset.scrolled = y > 24 ? "true" : "false";
    }

    if (moon && litPath && phaseLabel) {
      // 用首屏自身高度做基准，而不是 innerHeight ——
      // 移动端地址栏收起会改变 innerHeight，导致月亮忽明忽暗
      var heroHeight = hero ? hero.offsetHeight : window.innerHeight;
      var progress = Math.min(Math.max(y / (heroHeight * 0.82), 0), 1);
      var phase = progress * 0.5;

      litPath.setAttribute("d", moonPath(phase));

      var percent = Math.round(progress * 100);
      phaseLabel.textContent = (percent < 10 ? "0" : "") + percent;

      // 月晕随相位增亮：新月时只够勾出轮廓，满月时整轮月亮在发光
      if (halo) {
        halo.style.setProperty("--halo-opacity", (0.20 + progress * 0.55).toFixed(3));
      }

      // 视差：月亮比页面走得慢，制造纵深感
      if (!reduceMotion) {
        moon.style.setProperty("--moon-parallax", (y * 0.14).toFixed(1) + "px");
      }
    }

    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(applyScrollState);
    }
  }

  /* ======================================================================
     3. 滚动入场
     ====================================================================== */
  function setupReveals() {
    var targets = document.querySelectorAll(".reveal");
    if (!targets.length) return;

    // 无 IntersectionObserver 或用户要求减少动效时，直接全部显示
    if (!("IntersectionObserver" in window) || reduceMotion) {
      for (var i = 0; i < targets.length; i++) {
        targets[i].classList.add("is-visible");
      }
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, {
      // 元素露出约 12% 就开始进场，不用等到完全进入视口
      rootMargin: "0px 0px -12% 0px",
      threshold: 0.05
    });

    for (var j = 0; j < targets.length; j++) {
      observer.observe(targets[j]);
    }
  }

  /* ======================================================================
     4. 启动
     ====================================================================== */
  function init() {
    buildStarfield();
    applyScrollState();
    setupReveals();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    // 星场按整屏算位置，只在明显跨断点时才重排，避免拖动窗口时反复重建
    var resizeTimer = null;
    var lastWidth = window.innerWidth;
    window.addEventListener("resize", function () {
      if (Math.abs(window.innerWidth - lastWidth) < 160) return;
      lastWidth = window.innerWidth;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(buildStarfield, 220);
    }, { passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
