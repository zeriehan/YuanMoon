/* ==========================================================================
   图集灯箱 —— 点格子看大图
   --------------------------------------------------------------------------
   任何一页只要有 [data-shot] 的可点元素和 #lightbox 结构，引入这个脚本就能用。

   两条设计原则：
   1. **没有 data-full 就走占位分支**，不假装有图。现在作品区还没有真图，
      但结构、键盘、焦点、计数全部是真实可用的 —— 填上 data-full 就自动切换。
   2. **焦点要还回去。** 打开时记住是谁点的，关闭后焦点回到那个元素，
      否则键盘用户会被丢到页面最顶上。
   ========================================================================== */
(function () {
  "use strict";

  var box = document.getElementById("lightbox");
  if (!box) return;

  var img = document.getElementById("lightboxImg");
  var ph = document.getElementById("lightboxPh");
  var phTitle = document.getElementById("lightboxPhTitle");
  var cap = document.getElementById("lightboxCap");
  var count = document.getElementById("lightboxCount");
  var btnPrev = document.getElementById("lightboxPrev");
  var btnNext = document.getElementById("lightboxNext");
  var btnClose = document.getElementById("lightboxClose");
  var scrim = box.querySelector("[data-close]");

  var cells = [].slice.call(document.querySelectorAll("[data-shot]"));
  if (!cells.length) return;

  var index = 0;
  var opener = null;      // 打开时点的那个元素，关闭后焦点还给它
  var scrollY = 0;

  /* 打开时锁住背景滚动。position: fixed + 还原 top 是唯一在 iOS 上
     也可靠的办法 —— overflow: hidden 在移动端常常不生效。 */
  function lockScroll(on) {
    if (on) {
      scrollY = window.scrollY || 0;
      document.body.style.position = "fixed";
      document.body.style.top = (-scrollY) + "px";
      document.body.style.left = "0";
      document.body.style.right = "0";
    } else {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      window.scrollTo(0, scrollY);
    }
  }

  function show(i) {
    index = (i + cells.length) % cells.length;      // 循环
    var cell = cells[index];
    var full = cell.getAttribute("data-full");
    var label = cell.getAttribute("data-caption") || "";

    if (full) {
      img.setAttribute("src", full);
      img.setAttribute("alt", label);
      img.hidden = false;
      ph.hidden = true;
    } else {
      img.removeAttribute("src");
      img.hidden = true;
      ph.hidden = false;
      phTitle.textContent = label;
    }

    /* 占位分支不重复标题：框里已经写了名字，caption 留给真图 */
    cap.textContent = full ? label : "";
    count.textContent = (index + 1) + " / " + cells.length;
    box.setAttribute("data-single", cells.length < 2 ? "true" : "false");
  }

  function open(i, from) {
    opener = from || cells[i];
    show(i);
    box.hidden = false;
    lockScroll(true);
    (btnClose || btnPrev || btnNext).focus();
  }

  function close() {
    if (box.hidden) return;
    box.hidden = true;
    lockScroll(false);
    if (opener && opener.focus) opener.focus();
    opener = null;
  }

  /* ---- 绑定 ---------------------------------------------------------- */

  cells.forEach(function (cell, i) {
    cell.addEventListener("click", function () { open(i, cell); });
  });

  if (btnPrev) btnPrev.addEventListener("click", function () { show(index - 1); });
  if (btnNext) btnNext.addEventListener("click", function () { show(index + 1); });
  if (btnClose) btnClose.addEventListener("click", close);
  if (scrim) scrim.addEventListener("click", close);

  /* 点击图片本身不关闭 —— 想关就用 Esc 或关闭键，
     否则想放大看细节时一点就关了，很烦。 */
  var stage = box.querySelector(".lightbox__stage");
  if (stage) stage.addEventListener("click", function (e) { e.stopPropagation(); });

  document.addEventListener("keydown", function (e) {
    if (box.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); show(index - 1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); show(index + 1); }
  });

  /* 页面上任何地方都塞着，键盘用户 Tab 到这里时给出提示 */
  if (btnClose) btnClose.setAttribute("aria-label", "关闭（Esc）");
})();
