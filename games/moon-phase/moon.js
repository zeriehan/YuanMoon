/* ==========================================================================
   月相挑战 · 游戏逻辑
   --------------------------------------------------------------------------
   首页那轮月亮只走完了「新月 → 满月」的半程。这里要跑完整的朔望月，
   于是多了一半的工作：盈月亮在右侧，亏月亮在左侧。

   做法不是写两套几何，而是只写「盈月」那半套，亏月时把亮面路径水平镜像。
   镜像变换 translate(400 0) scale(-1 1) 对 viewBox 400 宽的中心轴（x=200）
   是对称的，所以镜像后的形状和直接画左半圆完全等价。
   ========================================================================== */
(function () {
  "use strict";

  /* ====================== 常量 ====================== */
  var R = 140;                 // 月盘半径（viewBox 400 内）
  var CX = 200;
  var CY = 200;
  var VB = 400;                // viewBox 宽度，镜像变换要用
  var SYNODIC = 29.53;         // 朔望月平均长度（天）

  /* 八个月相，以及它们各自在周期里的中心位置 */
  var PHASES = [
    { name: "新月",   at: 0,      exact: true  },
    { name: "蛾眉月", at: 0.125,  exact: false },
    { name: "上弦月", at: 0.25,   exact: true  },
    { name: "盈凸月", at: 0.375,  exact: false },
    { name: "满月",   at: 0.5,    exact: true  },
    { name: "亏凸月", at: 0.625,  exact: false },
    { name: "下弦月", at: 0.75,   exact: true  },
    { name: "残月",   at: 0.875,  exact: false }
  ];

  /* 出题池：新月 / 上弦 / 满月 / 下弦 是判断其余月相的锚点，
     所以让它们出现得更频繁（每个出现两次）。 */
  var QUESTION_POOL = [0, 0, 1, 2, 2, 3, 4, 4, 5, 6, 6, 7];
  var QUESTION_COUNT = 10;

  /* 评分容差。
     精确月相（朔/弦/望）是一个点，要求严；
     蛾眉月、凸月、残月本身是一段范围，容差放宽。 */
  var TOL = {
    exact: [0.010, 0.025, 0.048, 0.085, 0.150, 0.230],
    loose: [0.030, 0.060, 0.100, 0.140, 0.200, 0.300]
  };

  var LUNAR_NAMES = [
    "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
    "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
    "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"
  ];

  /* ====================== 月相几何 ====================== */

  /* 把相位 [0,1) 换成一个能直接塞进 <path d> 的亮面路径。
     相位 0 = 新月，0.25 = 上弦，0.5 = 满月，0.75 = 下弦。
     返沪 mirrored 告诉调用方要不要做水平镜像。 */
  function litGeometry(phase) {
    var p = ((phase % 1) + 1) % 1;
    var mirrored = p > 0.5;
    // 亏月镜像之后，形状等同于「1 - p」这个盈月相位
    var q = mirrored ? 1 - p : p;

    // k = cos(2πq)：q=0 时 k=1（新月），q=0.25 时 k=0（上弦），q=0.5 时 k=-1（满月）
    var k = Math.cos(2 * Math.PI * q);
    var rx = Math.max(Math.abs(k) * R, 0.01);   // 不能为 0，A 命令的半径必须为正
    // 方向反了会把新月画成满月：第二条弧从底部回到顶部，
    // sweep=0（逆时针）经过右侧，与右半圆夹出月牙；sweep=1 经过左侧，补齐成整圆。
    var sweep = k > 0 ? 0 : 1;

    var d = "M " + CX + " " + (CY - R) +
            " A " + R + " " + R + " 0 0 1 " + CX + " " + (CY + R) +
            " A " + rx.toFixed(2) + " " + R + " 0 0 " + sweep + " " + CX + " " + (CY - R) + " Z";

    return { d: d, mirrored: mirrored };
  }

  /* 被照亮的比例：0 = 新月，1 = 满月 */
  function illumination(phase) {
    return (1 - Math.cos(2 * Math.PI * phase)) / 2;
  }

  /* 按形状把相位叫出名来 */
  function phaseName(phase) {
    var p = ((phase % 1) + 1) % 1;
    var near = 0.02;   // 离得足够近就算「正好是」那个月相
    if (p < near || p > 1 - near) return "新月";
    if (Math.abs(p - 0.25) < near) return "上弦月";
    if (Math.abs(p - 0.5) < near) return "满月";
    if (Math.abs(p - 0.75) < near) return "下弦月";
    if (p < 0.25) return "蛾眉月";
    if (p < 0.5) return "盈凸月";
    if (p < 0.75) return "亏凸月";
    return "残月";
  }

  /* 相位对应的农历日期（近似 —— 真实农历还有朔的时刻与闰月的影响） */
  function lunarLabel(phase) {
    var p = ((phase % 1) + 1) % 1;
    var day = Math.round(p * SYNODIC) + 1;
    if (day < 1) day = 1;
    if (day > 30) day = 30;
    return "约农历" + LUNAR_NAMES[day - 1];
  }

  /* 两个相位之间的最短距离 —— 相位是环形的，0.98 和 0.02 只差 0.04 */
  function phaseDiff(a, b) {
    var d = Math.abs(((a - b) % 1 + 1) % 1);
    return Math.min(d, 1 - d);
  }

  function gradeOf(diff, exact) {
    var t = exact ? TOL.exact : TOL.loose;
    if (diff < t[0]) return 100;
    if (diff < t[1]) return 90;
    if (diff < t[2]) return 72;
    if (diff < t[3]) return 50;
    if (diff < t[4]) return 25;
    return 0;
  }

  function toneOf(score) {
    if (score >= 90) return "good";
    if (score >= 50) return "ok";
    return "bad";
  }

  function verdictOf(score) {
    if (score === 100) return "分毫不差。";
    if (score >= 90) return "很准，几乎就是它。";
    if (score >= 72) return "形状对了，位置还差一点。";
    if (score >= 50) return "方向没错，再想想亮面朝向哪边。";
    if (score >= 25) return "偏得有点多，看仔细一点。";
    return "这次偏得比较远。";
  }

  /* ====================== 元素引用 ====================== */
  var litPath = document.getElementById("moonLitPath");
  var halo = document.getElementById("moonHalo");
  var stage = document.querySelector(".moon-stage");
  var readoutName = document.getElementById("readoutName");
  var readoutMeta = document.getElementById("readoutMeta");
  var taskBlock = document.getElementById("taskBlock");
  var taskTarget = document.getElementById("taskTarget");
  var roundLabel = document.getElementById("roundLabel");
  var slider = document.getElementById("slider");
  var submitBtn = document.getElementById("submitBtn");
  var modeBtn = document.getElementById("modeBtn");
  var feedback = document.getElementById("feedback");
  var lastScoreEl = document.getElementById("lastScore");
  var totalScoreEl = document.getElementById("totalScore");
  var bestScoreEl = document.getElementById("bestScore");

  /* ====================== 状态 ====================== */
  var state = {
    mode: "challenge",   // challenge | free | done
    phase: 0.5,
    questions: [],
    qIndex: 0,
    answered: false,
    total: 0,
    best: null
  };

  /* ====================== 渲染 ====================== */

  /* 把当前相位画到月亮上，并同步各种读数。
     挑战模式且尚未确认时，故意不报月相名字 —— 那是要玩家靠形状判断的。 */
  function render() {
    var g = litGeometry(state.phase);
    litPath.setAttribute("d", g.d);
    litPath.setAttribute("transform",
      g.mirrored ? "translate(" + VB + " 0) scale(-1 1)" : "");

    var lit = illumination(state.phase);
    // 月晕随被照亮面积一起变亮，新月时只剩一圈微弱的光
    halo.style.setProperty("--halo-opacity", (0.20 + lit * 0.55).toFixed(3));
    if (stage) {
      stage.style.setProperty("--stage-glow", (0.14 + lit * 0.5).toFixed(3));
    }

    var reveal = state.mode === "free" || state.answered;
    if (reveal) {
      readoutName.textContent = phaseName(state.phase);
      readoutMeta.textContent = lunarLabel(state.phase) +
                                " · 亮面 " + Math.round(lit * 100) + "%";
    } else {
      readoutName.textContent = "？";
      readoutMeta.textContent = "拖动滑块改变月相";
    }

    // 屏幕阅读器用户看不到月亮，必须把当前月相念出来
    slider.setAttribute("aria-valuetext", phaseName(state.phase) + "，" + lunarLabel(state.phase));
  }

  function setPhase(p) {
    state.phase = ((p % 1) + 1) % 1;
    slider.value = String(Math.round(state.phase * 1000));
    render();
  }

  function setTarget() {
    var ph = PHASES[state.questions[state.qIndex]];
    taskTarget.textContent = ph.name;
    roundLabel.innerHTML = "第 <b>" + (state.qIndex + 1) + "</b> / " + state.questions.length + " 轮";
  }

  function refreshScoreboard() {
    totalScoreEl.textContent = String(state.total);
    bestScoreEl.textContent = state.best === null ? "—" : String(state.best);
  }

  /* ====================== 出题 ====================== */

  function makeQuestions(count) {
    var qs = [];
    var last = -1;
    while (qs.length < count) {
      var idx = QUESTION_POOL[Math.floor(Math.random() * QUESTION_POOL.length)];
      if (idx === last) continue;   // 别连着出同一道
      qs.push(idx);
      last = idx;
    }
    return qs;
  }

  /* ====================== 流程 ====================== */

  function submit() {
    if (state.mode === "done") {
      startChallenge();
      return;
    }
    if (state.mode === "free") return;

    if (state.answered) {
      nextQuestion();
      return;
    }

    var qi = state.questions[state.qIndex];
    var target = PHASES[qi];
    var diff = phaseDiff(state.phase, target.at);
    var score = gradeOf(diff, target.exact);

    state.total += score;
    if (state.best === null || score > state.best) state.best = score;
    state.answered = true;

    var tuned = phaseName(state.phase);
    var same = tuned === target.name;

    feedback.dataset.tone = toneOf(score);
    feedback.innerHTML =
      '<span class="grade">+' + score + '</span>' +
      verdictOf(score) +
      (same
        ? "你调的正是 <b>" + target.name + "</b>。"
        : "你调出的是 <b>" + tuned + "</b>，答案是 <b>" + target.name + "</b>。") +
      (score < 100 ? "现在月亮停在你的答案上，可以拖动滑块看看差别，再进入下一题。" : "");

    lastScoreEl.textContent = String(score);
    refreshScoreboard();
    submitBtn.textContent = "下一题";
    render();
  }

  function nextQuestion() {
    state.qIndex += 1;
    if (state.qIndex >= state.questions.length) {
      finish();
      return;
    }
    state.answered = false;
    feedback.textContent = "";
    feedback.removeAttribute("data-tone");
    submitBtn.textContent = "确认";
    setPhase(state.phase);   // 保持月亮不动，玩家继续调
    setTarget();
    render();
  }

  function finish() {
    state.mode = "done";
    var max = state.questions.length * 100;
    var pct = Math.round(state.total / max * 100);
    var comment;
    if (pct >= 95) comment = "你已经把八个阶段的形状刻在脑子里了。";
    else if (pct >= 80) comment = "很稳。剩下的偏差多半出在月牙的朝向上。";
    else if (pct >= 60) comment = "基本认得出来，再多玩两轮会顺很多。";
    else if (pct >= 35) comment = "锚点还没记牢 —— 先分清上弦和下弦，其它就好推了。";
    else comment = "别急。先只看四个：新月、上弦、满月、下弦。";

    taskBlock.hidden = false;
    taskTarget.textContent = pct + " 分";
    roundLabel.innerHTML = "十轮结束";
    submitBtn.textContent = "再来一轮";
    feedback.dataset.tone = toneOf(pct);
    feedback.innerHTML =
      '<span class="grade">' + state.total + " / " + max + '</span>' + comment;
    lastScoreEl.textContent = state.best === null ? "—" : String(state.best);
    render();
  }

  function startChallenge() {
    state.mode = "challenge";
    state.questions = makeQuestions(QUESTION_COUNT);
    state.qIndex = 0;
    state.answered = false;
    state.total = 0;
    state.best = null;

    taskBlock.hidden = false;
    taskTarget.textContent = "上弦月";
    submitBtn.textContent = "确认";
    submitBtn.disabled = false;
    modeBtn.textContent = "自由玩";
    feedback.textContent = "";
    feedback.removeAttribute("data-tone");
    lastScoreEl.textContent = "—";
    refreshScoreboard();
    setPhase(0.5);
    setTarget();
    render();
  }

  function enterFree() {
    state.mode = "free";
    state.answered = false;
    taskBlock.hidden = true;
    roundLabel.innerHTML = "自由探索";
    submitBtn.disabled = true;
    modeBtn.textContent = "开始挑战";
    feedback.dataset.tone = "ok";
    feedback.innerHTML = '随便拖。月亮停在哪儿，这行字就报出它的名字 —— 认熟了再去挑战。';
    render();
  }

  /* ====================== 交互绑定 ====================== */

  slider.addEventListener("input", function () {
    state.phase = Number(slider.value) / 1000;
    render();
  });

  submitBtn.addEventListener("click", submit);

  modeBtn.addEventListener("click", function () {
    if (state.mode === "free") {
      startChallenge();
    } else {
      enterFree();
    }
  });

  /* 方向键微调。原生 range 的步进是 1/1000，太小，
     这里接管过来：普通方向键一次 1.2%，按住 Shift 一次 5%。 */
  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var dir = 0;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") dir = -1;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") dir = 1;
    if (!dir) return;
    if (state.mode === "done") return;
    e.preventDefault();
    setPhase(state.phase + dir * (e.shiftKey ? 0.05 : 0.012));
  });

  /* ====================== 启动 ====================== */
  startChallenge();

  /* 页面通过 BFCache 恢复时（用户从别的页返回），把状态对齐显示 */
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) render();
  });
})();
