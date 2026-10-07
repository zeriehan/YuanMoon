/* ==========================================================================
   光路挑战 · 几何光学
   --------------------------------------------------------------------------
   玩法是把一束光引到靶心。内核只有三件事：直线传播、镜面反射、斯涅尔折射。
   全反射不是特例逻辑 —— 它是折射无解时的自然结果，所以不用单独写。

   【为什么这样设计】
   往后要加的两层玩法，都是"换掉 n，不换追迹"：
     · 波动光学：把单条光线换成波前累加（光程 → 相位）
     · 广义相对论：弱场下光线偏折等价于穿过折射率随位置变化的介质，
       即 n = n(p) 而不是常数。追迹循环一个字都不用改。
   所以这里刻意不做"介质栈"和"嵌套玻璃"：v1 约定所有玻璃互不重叠，
   外部介质恒为空气。代码因此短了一截，而以后加层时接口是现成的。
   ========================================================================== */
(function () {
  "use strict";

  /* ====================== 常量 ====================== */
  var VB_W = 880;
  var VB_H = 520;
  var MAX_DEPTH = 64;          // 追迹段数上限，防止两面镜子对着无限弹
  var EPS = 1e-6;
  var FAR = 4000;              // 射出界面后画多远

  var AIR = 1;

  /* ====================== 向量 ====================== */
  function v(x, y) { return { x: x, y: y }; }
  function sub(a, b) { return v(a.x - b.x, a.y - b.y); }
  function mul(a, s) { return v(a.x * s, a.y * s); }
  function dot(a, b) { return a.x * b.x + a.y * b.y; }
  function cross(a, b) { return a.x * b.y - a.y * b.x; }
  function len(a) { return Math.sqrt(a.x * a.x + a.y * a.y); }
  function norm(a) { var l = len(a) || 1; return v(a.x / l, a.y / l); }
  function d2r(d) { return d * Math.PI / 180; }
  function r2d(r) { return r * 180 / Math.PI; }
  function dirOf(deg) { var a = d2r(deg); return v(Math.cos(a), Math.sin(a)); }

  /* 2D 旋转。引力偏折要按角度转方向，用它比三角函数手算靠谱。 */
  function rotate(d, ang) {
    var c = Math.cos(ang), s = Math.sin(ang);
    return v(d.x * c - d.y * s, d.x * s + d.y * c);
  }

  /* ====================== 相交与反射折射 ====================== */

  /* 射线 P + tD 与线段 A→B 的最近正向交点参数。平行或不在范围内返回 -1。 */
  function raySeg(px, py, dx, dy, ax, ay, bx, by) {
    var ex = bx - ax, ey = by - ay;
    var den = dx * ey - dy * ex;
    if (Math.abs(den) < EPS) return -1;
    var qx = ax - px, qy = ay - py;
    var t = (qx * ey - qy * ex) / den;
    var u = (qx * dy - qy * dx) / den;
    if (t > EPS && u >= -1e-4 && u <= 1 + 1e-4) return t;
    return -1;
  }

  /* 射线 P + tD 与圆（心 C、半径 r）是否相交。返回射线上的最近点参数。 */
  function rayCircle(px, py, dx, dy, cx, cy, r) {
    var vx = cx - px, vy = cy - py;
    var t = vx * dx + vy * dy;
    if (t <= EPS) return -1;
    var perp2 = vx * vx + vy * vy - t * t;
    if (perp2 > r * r) return -1;
    return t;
  }

  /* 点到线段的垂距（拖动时量"离靶心多远"用） */
  function pointSegDist(px, py, ax, ay, bx, by) {
    var ex = bx - ax, ey = by - ay;
    var l2 = ex * ex + ey * ey;
    if (l2 < EPS) return Math.hypot(px - ax, py - ay);
    var t = ((px - ax) * ex + (py - ay) * ey) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + ex * t), py - (ay + ey * t));
  }

  function reflect(d, n) {
    var k = 2 * dot(d, n);
    return v(d.x - k * n.x, d.y - k * n.y);
  }

  /* 斯涅尔定律的矢量形式。I 是入射方向（单位，指向界面），
     N 是逆着 I 的法线（保证 dot(N,I) < 0），eta = n1 / n2。
     返回 null 表示无解 —— 那就是全反射。 */
  function refract(d, n, eta) {
    var cosi = dot(d, n);
    var k = 1 - eta * eta * (1 - cosi * cosi);
    if (k < 0) return null;
    var s = eta * cosi + Math.sqrt(k);
    return norm(v(eta * d.x - s * n.x, eta * d.y - s * n.y));
  }

  /* 从"密"到"稀"的临界角（度）。n1 > n2 才有。 */
  function criticalAngle(n1, n2) {
    var k = n1 / n2;
    if (k <= 1) return null;
    return r2d(Math.asin(1 / k));
  }

  /* ====================== 元件 → 线段 ====================== */

  /* 镜面：一条线段，两面都反光（单面镜在这个玩法里只会添乱） */
  function mirrorSegs(p, angleDeg, halfLen, id) {
    var d = dirOf(angleDeg);
    return [{
      kind: "mirror",
      ax: p.x - d.x * halfLen, ay: p.y - d.y * halfLen,
      bx: p.x + d.x * halfLen, by: p.y + d.y * halfLen,
      nx: -d.y, ny: d.x,
      id: id
    }];
  }

  /* 玻璃砖 / 水池：一个凸四边形。每条边记着自己的外法线和这一侧的折射率。
     光线沿法线方向穿出就是"从里面出去"，反之是"进到里面来" ——
     所以只要看法线朝向就知道 n1 和 n2，不需要判断点是否在多边形内。 */
  function mediumSegs(p, angleDeg, hw, hh, n, id) {
    var a = d2r(angleDeg), ca = Math.cos(a), sa = Math.sin(a);
    var local = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
    var c = local.map(function (q) {
      return v(p.x + q[0] * ca - q[1] * sa, p.y + q[0] * sa + q[1] * ca);
    });
    var segs = [];
    for (var i = 0; i < 4; i++) {
      var A = c[i], B = c[(i + 1) % 4];
      var e = norm(sub(B, A));
      var perp = v(-e.y, e.x);                 // 边的垂直方向
      var mid = v((A.x + B.x) / 2, (A.y + B.y) / 2);
      if (dot(sub(mid, p), perp) < 0) perp = mul(perp, -1);  // 取指向外面那个
      segs.push({
        kind: "edge",
        ax: A.x, ay: A.y, bx: B.x, by: B.y,
        nx: perp.x, ny: perp.y,
        n: n, id: id
      });
    }
    return segs;
  }

  /* 点是否在这个矩形内（用来判断光源一开始泡在什么介质里） */
  function insideMedium(p, m) {
    var a = d2r(-m.angle), ca = Math.cos(a), sa = Math.sin(a);
    var dx = p.x - m.x, dy = p.y - m.y;
    var lx = dx * ca - dy * sa;
    var ly = dx * sa + dy * ca;
    return Math.abs(lx) <= m.hw && Math.abs(ly) <= m.hh;
  }

  function mediumAt(p, parts) {
    var n = AIR;
    for (var i = 0; i < parts.length; i++) {
      var q = parts[i];
      if (q.kind === "glass" || q.kind === "water") {
        if (insideMedium(p, q)) n = q.n;
      }
    }
    return n;
  }

  /* ====================== 追迹 ====================== */

  /* 场景快照：把当前元件状态编译成线段集合 + 质量点。
     渲染、命中判定、提示扫描全都基于这一份快照，保证三者算的是同一件事。 */
  function buildScene(parts, targets) {
    var segs = [];
    var masses = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.kind === "mirror") {
        segs = segs.concat(mirrorSegs(p, p.angle, p.half, i));
      } else if (p.kind === "glass" || p.kind === "water") {
        segs = segs.concat(mediumSegs(p, p.angle, p.hw, p.hh, p.n, i));
      } else if (p.kind === "mass") {
        p.idx = i;
        masses.push(p);
      }
    }
    return { segs: segs, masses: masses, targets: targets || [] };
  }

  /* 光线射出最后一件事：画到它离开台面为止。
     早先版本直接画 4000px，结果光从台面穿出去糊在下面的控制台上。 */
  function exitT(p, d) {
    var t = FAR;
    if (d.x > EPS) t = Math.min(t, (VB_W - p.x) / d.x);
    if (d.x < -EPS) t = Math.min(t, (0 - p.x) / d.x);
    if (d.y > EPS) t = Math.min(t, (VB_H - p.y) / d.y);
    if (d.y < -EPS) t = Math.min(t, (0 - p.y) / d.y);
    return t > 0 ? t : 0;
  }

  function exitView(p, d) {
    var t = exitT(p, d);
    return v(p.x + d.x * t, p.y + d.y * t);
  }

  function trace(start, dir, scene, startN) {
    var p = v(start.x, start.y);
    var d = norm(dir);
    var media = startN || AIR;

    var pts = [v(p.x, p.y)];
    var segMedia = [];          // 第 i 段（pts[i]→pts[i+1]）所处的折射率
    var marks = [];             // 折射 / 全反射 / 引力偏折的标注点
    var hit = {};               // 命中的靶心下标
    var minDist = {};           // 每个靶心到光路的最近距离
    var absorbed = false;       // 掉进质量里了
    /* 每个质量在**这一段光路**里只作用一次。
       不加这个限制会出事：偏折之后垂足又落在附近，而 bestT 是 Infinity，
       条件恒成立 → 光每走 20 像素就被掰一次，在原地抖到 MAX_DEPTH 耗尽。
       物理上一条光线掠过质量一次就只弯一次，薄透镜近似也正是这么算的。 */
    var used = {};
    /* 每个质量在**这一段光路**里只作用一次。
       不加这个限制会出事：偏折之后垂足又落在附近，而 bestT 是 Infinity，
       条件恒成立 → 光每走 20 像素就被掰一次，在原地抖到 MAX_DEPTH 耗尽。
       物理上一条光线掠过质量一次就只弯一次，薄透镜近似也正是这么算的。 */
    var used = {};

    var i, j, t, best, bestT, k, seg, np, leaving, n1, n2, N, out, dRef;

    for (k = 0; k < MAX_DEPTH; k++) {
      best = null; bestT = Infinity;

      for (i = 0; i < scene.segs.length; i++) {
        seg = scene.segs[i];
        t = raySeg(p.x, p.y, d.x, d.y, seg.ax, seg.ay, seg.bx, seg.by);
        if (t > 0 && t < bestT) { bestT = t; best = { type: "seg", seg: seg }; }
      }

      for (j = 0; j < scene.targets.length; j++) {
        var tg = scene.targets[j];
        t = rayCircle(p.x, p.y, d.x, d.y, tg.x, tg.y, tg.r);
        if (t > 0 && t < bestT) { bestT = t; best = { type: "target", i: j }; }
      }

      /* ---- 引力：找最近的一次「掠过质量」 ----
         弱场近似下偏折角 Δθ = 4GM / (c²b)。牛顿引力给的光偏折是
         2GM / (c²b) —— 广义相对论正好是它的两倍，这个「两倍」是爱因斯坦
         1919 年那次日食观测测出来的东西，也是这关的题眼。

         为什么不在这里算折射率梯度（n = n(p)）：那样能做，但要切成几十层
         薄壳逐层折射，数值上会发散、也不好验证。直接用偏折公式更短、
         更准，而且「是牛顿的两倍」可以直接断言。 */
      var gm = null, gmB = Infinity, gmT = 0, swallowed = null;
      for (i = 0; i < (scene.masses || []).length; i++) {
        var m = scene.masses[i];
        var mdx = m.x - p.x, mdy = m.y - p.y;
        var along = mdx * d.x + mdy * d.y;          // 质心在光线方向上的投影
        if (along <= 0) continue;                     // 质心在身后，不算
        /* 垂足到质心的距离 */
        var bx = m.x - (p.x + d.x * along);
        var by = m.y - (p.y + d.y * along);
        var b = Math.sqrt(bx * bx + by * by);
        /* 捕获判据用**光子球** r_s = 2GM/c²，不是视觉上的吸积盘半径。
           这里 k 就是 4GM/c²，所以 r_s = k/2。b 小于它，光就不是被掰弯，
           而是被直接吸进去 —— 这也顺带解决了数值问题：Δθ = k/b 在 b 趋近 r_s
           时会发散（掠得越近弯得越狠，物理上是错的）。 */
        if (b < m.absorb || b < m.k / 2) { swallowed = m; continue; }
        if (b < gmB) { gmB = b; gmT = along; gm = m; }
      }

      // 更新每个靶心的最近距离（无论这次命中了什么，都算一遍）
      var reach = best ? v(p.x + d.x * bestT, p.y + d.y * bestT) : exitView(p, d);
      for (j = 0; j < scene.targets.length; j++) {
        var q = scene.targets[j];
        var dd = pointSegDist(q.x, q.y, p.x, p.y, reach.x, reach.y);
        if (minDist[j] === undefined || dd < minDist[j]) minDist[j] = dd;
      }

      /* ---- 引力点比镜面/靶心更近？那就先把光推到偏折点 ----
         必须和 bestT 比先后：否则光会先被引力掰弯、再回头去撞它本该
         先撞上的镜子，顺序全乱。
         还要看它是不是在出界之前 —— 偏折点已经在视口外，说明光早就飞出去了。 */
      var tExit = exitT(p, d);
      if (gm && gmT < bestT && gmT < tExit && !used[gm.idx]) {
        used[gm.idx] = true;
        var gp = v(p.x + d.x * gmT, p.y + d.y * gmT);
        pts.push(gp);
        segMedia.push(media);

        var toC = norm(v(gm.x - gp.x, gm.y - gp.y));
        /* 封顶：Δθ = k/b 只在 b 远大于 r_s 时成立（薄透镜近似）。
           掠得比较近时公式会给出过于夸张的角度，压到 78° 封顶，
           免得光被甩到一个物理上不可能的方向去。 */
        var delta = Math.min(gm.k / gmB, 1.36);       // 1.36 rad ≈ 78°
        /* 往质心那一侧转：toC 在 d 的哪一侧由叉积定符号 */
        var sgn = cross(d, toC) >= 0 ? 1 : -1;
        d = norm(rotate(d, delta * sgn));
        marks.push({ x: gp.x, y: gp.y, text: "偏折 " + r2d(delta).toFixed(2) + "°" });

        p = gp;
        continue;
      }

      if (swallowed) {
        // 落进质量：光被吞掉，路径停在这儿
        pts.push(reach);
        segMedia.push(media);
        absorbed = true;
        break;
      }

      if (!best) {
        pts.push(reach);
        segMedia.push(media);
        break;
      }

      np = v(p.x + d.x * bestT, p.y + d.y * bestT);
      segMedia.push(media);
      pts.push(np);

      if (best.type === "target") {
        hit[best.i] = true;
        p = np;                                  // 靶心不吸收，光穿过去
        continue;
      }

      seg = best.seg;

      if (seg.kind === "mirror") {
        d = reflect(d, v(seg.nx, seg.ny));
        p = np;
        continue;
      }

      // 介质界面：法线朝向告诉我们是"进"还是"出"
      dRef = v(seg.nx, seg.ny);
      leaving = dot(d, dRef) > 0;
      n1 = leaving ? seg.n : AIR;
      n2 = leaving ? AIR : seg.n;

      N = dot(d, dRef) > 0 ? mul(dRef, -1) : dRef;   // 保证 dot(N, d) < 0
      out = refract(d, N, n1 / n2);

      if (out === null) {
        // 折射无解 → 全反射，光留在原介质里
        d = reflect(d, dRef);
        marks.push({ x: np.x, y: np.y, text: "全反射" });
      } else {
        d = out;
        media = n2;
        marks.push({ x: np.x, y: np.y, text: "折射" });
      }
      p = np;
    }

    return { pts: pts, segMedia: segMedia, marks: marks, hit: hit,
             minDist: minDist, absorbed: absorbed };
  }

  /* ====================== 关卡 ====================== */
  /* pivot 指出"这一关该拧哪个元件"，提示按钮靠它出答案区间。 */
  var LEVELS = [
    {
      name: "反射",
      hint: "先点一下镜面选中它，再拖镜面上的金色圆环改变角度。",
      lesson: "入射角等于反射角。镜面转 θ，反射光就转 2θ —— 镜子转一半，方向差一倍。",
      pivot: 1,
      parts: [
        { kind: "emitter", x: 130, y: 400, angle: -22, label: "光源" },
        { kind: "mirror", x: 450, y: 300, angle: 20, half: 95, label: "镜面" }
      ],
      targets: [{ x: 790, y: 120, r: 34 }]
    },
    {
      name: "折射",
      hint: "光在玻璃里走得慢，方向会拐。转动玻璃砖，把它掰回靶心。",
      lesson: "折射定律 n₁sinθ₁ = n₂sinθ₂。进玻璃时偏向法线，出玻璃时又掰回来；因为玻璃两面平行，出来的光和进去的平行，只是错开了一段。",
      pivot: 1,
      parts: [
        { kind: "emitter", x: 110, y: 120, angle: 16, label: "光源" },
        { kind: "glass", x: 470, y: 250, angle: -20, hw: 100, hh: 58, n: 1.5, label: "玻璃砖" }
      ],
      targets: [{ x: 800, y: 390, r: 30 }]
    },
    {
      name: "全反射",
      hint: "光源已经在水里了。把它转得越平，光在水面折回得越狠 —— 靶心在池底。",
      lesson: "从水射向空气时，入射角超过临界角就再也射不出去，全部弹回。临界角 θc = arcsin(1/n)，水是 48.8°，玻璃是 41.8°。转成锐角它就飞走了，转平它就砸回池底。",
      pivot: 0,
      parts: [
        { kind: "emitter", x: 200, y: 300, angle: 60, label: "光源" },
        { kind: "water", x: 440, y: 245, angle: 0, hw: 290, hh: 75, n: 1.33, label: "水池" }
      ],
      targets: [{ x: 560, y: 250, r: 24 }]
    },
    {
      name: "引力透镜",
      hint: "中间那颗不是玻璃球，是质量。光从它旁边过会被掰弯 —— 转到刚好擦着边打中靶心。",
      lesson: "弱场近似下偏折角 Δθ = 4GM/(c²b)。牛顿引力算出来是 2GM/(c²b) —— 广义相对论" +
              "正好是它的两倍。这个两倍是 1919 年日食观测测出来的，也是爱因斯坦那篇论文" +
              "最硬的一条证据。b 越小弯得越狠，掉进吸积盘就被吞掉。",
      pivot: 0,
      parts: [
        { kind: "emitter", x: 110, y: 130, angle: 50, label: "光源" },
        { kind: "mass", x: 480, y: 250, angle: 0, k: 260, absorb: 66, label: "质量" }
      ],
      targets: [{ x: 830, y: 400, r: 30 }]
    },
    {
      name: "自由搭建",
      hint: "没有目标，随便拖。镜子和玻璃都能转，试试让光在两面镜子之间来回。",
      lesson: "沙盒里的每个元件都能平移和旋转。这里没有标准答案，光线会告诉你它想去哪。",
      pivot: -1,
      free: true,
      parts: [
        { kind: "emitter", x: 120, y: 420, angle: -18, label: "光源" },
        { kind: "mirror", x: 360, y: 250, angle: 35, half: 90, label: "镜面 A" },
        { kind: "mirror", x: 640, y: 400, angle: -40, half: 90, label: "镜面 B" },
        { kind: "glass", x: 600, y: 170, angle: 12, hw: 90, hh: 50, n: 1.5, label: "玻璃砖" },
        { kind: "mass", x: 430, y: 250, angle: 0, k: 700, absorb: 54, label: "质量" }
      ],
      targets: []
    }
  ];

  var SOLVE_STEP = 0.5;        // 提示扫描的角度步长（度）

  /* 扫描 pivot 元件的旋转角，找出所有能让全部靶心命中的角度。
     这既是提示的来源，也顺手证明"这一关确实有解" —— 无解会 warn。
     注意：被扫描的永远是 pivot，但**发射点始终是光源**。 */
  function solveAngles(level) {
    if (level.free || level.pivot < 0 || !level.targets.length) return [];
    var emIdx = -1;
    level.parts.forEach(function (p, i) { if (p.kind === "emitter") emIdx = i; });
    if (emIdx < 0) return [];

    var found = [];
    var probe = cloneParts(level.parts);
    for (var a = 0; a < 360; a += SOLVE_STEP) {
      probe[level.pivot].angle = a;
      var scene = buildScene(probe, level.targets);
      var em = probe[emIdx];
      var r = trace(v(em.x, em.y), dirOf(em.angle), scene, mediumAt(v(em.x, em.y), probe));
      var all = level.targets.every(function (_, i) { return r.hit[i]; });
      if (all) found.push(a);
    }
    // 收成区间，提示时好说
    var groups = [];
    found.forEach(function (a) {
      var g = groups[groups.length - 1];
      if (g && a - g[g.length - 1] <= SOLVE_STEP * 1.5) g.push(a);
      else groups.push([a]);
    });
    return groups.map(function (g) {
      return { lo: g[0], hi: g[g.length - 1], mid: (g[0] + g[g.length - 1]) / 2 };
    });
  }

  function cloneParts(parts) {
    return parts.map(function (p) {
      var q = {};
      for (var k in p) q[k] = p[k];
      return q;
    });
  }

  /* ====================== DOM ====================== */
  var svg = document.getElementById("bench");
  var gGrid = document.getElementById("gridLayer");
  var gPart = document.getElementById("partLayer");
  var gBeam = document.getElementById("beamLayer");
  var gMark = document.getElementById("markLayer");
  var gTgt = document.getElementById("targetLayer");
  var gHandle = document.getElementById("handleLayer");

  var elLevelTag = document.getElementById("levelTag");
  var elName = document.getElementById("taskName");
  var elHint = document.getElementById("taskHint");
  var elLesson = document.getElementById("lessonText");
  var elFeedback = document.getElementById("feedback");
  var elReadName = document.getElementById("readoutName");
  var elReadMeta = document.getElementById("readoutMeta");
  var elReset = document.getElementById("resetBtn");
  var elSolve = document.getElementById("solveBtn");
  var elCrit = document.getElementById("critAngle");
  var btns = [].slice.call(document.querySelectorAll(".lvnav__btn"));

  var SVGNS = "http://www.w3.org/2000/svg";
  function el(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function txt(node, s) { node.textContent = s; }

  /* ====================== 状态 ====================== */
  var state = {
    li: 0,
    parts: [],
    targets: [],
    sel: -1,
    drag: null,
    solvedGroups: [],
    cleared: {}
  };
  try {
    state.cleared = JSON.parse(localStorage.getItem("yuanmoon.light.cleared") || "{}");
  } catch (e) { state.cleared = {}; }

  function level() { return LEVELS[state.li]; }

  /* ====================== 渲染 ====================== */
  function buildGrid() {
    var out = [];
    for (var x = 40; x < VB_W; x += 40) {
      out.push('<line class="grid-line' + (x % 200 === 0 ? " grid-line--major" : "") +
               '" x1="' + x + '" y1="0" x2="' + x + '" y2="' + VB_H + '"/>');
    }
    for (var y = 40; y < VB_H; y += 40) {
      out.push('<line class="grid-line' + (y % 200 === 0 ? " grid-line--major" : "") +
               '" x1="0" y1="' + y + '" x2="' + VB_W + '" y2="' + y + '"/>');
    }
    gGrid.innerHTML = out.join("");
  }

  function partRadius(p) {
    if (p.kind === "mirror") return p.half;
    if (p.kind === "mass") return p.absorb;
    if (p.kind === "glass" || p.kind === "water") {
      return Math.hypot(p.hw, p.hh);
    }
    return 34;                                  // 光源：手柄离中心的距离
  }

  /* 元件节点只建一次，之后只改 transform —— 拖动时每帧重建 DOM 会明显卡顿，
     而且会把正在拖的那个元素换掉，手感直接崩掉。 */
  var partNodes = [];

  function buildParts() {
    gPart.textContent = "";
    partNodes = [];
    state.parts.forEach(function (p, i) {
      var g = el("g", { class: "opt", "data-i": i });
      g.setAttribute("transform", partTransform(p));

      if (p.kind === "mirror") {
        g.appendChild(el("line", {
          class: "opt__face", x1: -p.half, y1: 0, x2: p.half, y2: 0
        }));
        // 背面斜线：这面是反光面
        for (var t = -p.half + 8; t < p.half; t += 14) {
          g.appendChild(el("line", {
            class: "opt__back", x1: t, y1: 0, x2: t - 7, y2: 8
          }));
        }
        g.appendChild(el("line", {
          class: "opt__hit", x1: -p.half, y1: 0, x2: p.half, y2: 0
        }));
      } else if (p.kind === "glass" || p.kind === "water") {
        g.appendChild(el("rect", {
          class: "opt__body" + (p.kind === "water" ? " opt__body--water" : ""),
          x: -p.hw, y: -p.hh, width: p.hw * 2, height: p.hh * 2, rx: 3
        }));
        g.appendChild(el("rect", {
          class: "opt__hit", x: -p.hw, y: -p.hh,
          width: p.hw * 2, height: p.hh * 2, rx: 3
        }));
        var lb = el("text", { class: "opt__tag", x: 0, y: p.hh + 16, "text-anchor": "middle" });
        lb.textContent = p.label + " n=" + p.n;
        g.appendChild(lb);
      } else if (p.kind === "mass") {
        /* 质量：不是玻璃球，不折射也不反射 —— 它只是把光掰弯。
           外面一圈吸积盘兼命中区（掉进去就被吞），外加一层透镜光晕。 */
        g.appendChild(el("circle", { class: "mass__halo", cx: 0, cy: 0, r: p.absorb * 1.5 }));
        g.appendChild(el("circle", { class: "mass__disk", cx: 0, cy: 0, r: p.absorb }));
        g.appendChild(el("circle", { class: "mass__core", cx: 0, cy: 0, r: p.absorb * 0.56 }));
        g.appendChild(el("circle", { class: "opt__hit", cx: 0, cy: 0, r: p.absorb }));
        var mt = el("text", {
          class: "opt__tag", x: 0, y: p.absorb + 18, "text-anchor": "middle"
        });
        mt.textContent = p.label;
        g.appendChild(mt);
      } else {
        g.appendChild(el("line", { class: "opt__dir", x1: 0, y1: 0, x2: 26, y2: 0 }));
        g.appendChild(el("polygon", { class: "opt__dirhead", points: "26,0 17,-5 17,5" }));
        g.appendChild(el("circle", { class: "opt__lamp", cx: 0, cy: 0, r: 9 }));
        g.appendChild(el("circle", { class: "opt__hit", cx: 0, cy: 0, r: 20 }));
      }

      gPart.appendChild(g);
      partNodes.push(g);
    });
  }

  function syncParts() {
    for (var i = 0; i < partNodes.length; i++) {
      partNodes[i].setAttribute("transform", partTransform(state.parts[i]));
      partNodes[i].classList.toggle("is-on", i === state.sel);
    }
  }

  /* 所有元件共用这一个 transform（旋转手柄靠它定位）。
     质量是个圆盘、没有「朝向」，所以 angle 要容错 ——
     之前没容错，一进第四关就 p.angle.toFixed 崩掉。 */
  function partTransform(p) {
    return "translate(" + p.x.toFixed(2) + " " + p.y.toFixed(2) +
           ") rotate(" + (p.angle || 0).toFixed(2) + ")";
  }

  function renderTargets(hitMap) {
    gTgt.textContent = "";
    state.targets.forEach(function (t, i) {
      var on = !!(hitMap && hitMap[i]);
      var g = el("g", { class: "target" + (on ? " is-hit" : ""), transform: "translate(" + t.x + " " + t.y + ")" });
      g.appendChild(el("circle", { class: "target__glow", cx: 0, cy: 0, r: t.r * 1.9 }));
      g.appendChild(el("circle", { class: "target__ring", cx: 0, cy: 0, r: t.r }));
      g.appendChild(el("circle", { class: "target__core", cx: 0, cy: 0, r: t.r * 0.28 }));
      var lb = el("text", { class: "target__flag", x: 0, y: t.r + 16 });
      lb.textContent = on ? "命中" : "靶心";
      g.appendChild(lb);
      gTgt.appendChild(g);
    });
  }

  function renderHandle() {
    gHandle.textContent = "";
    if (state.sel < 0) return;
    var p = state.parts[state.sel];
    if (!p) return;
    var r = partRadius(p);
    gHandle.appendChild(el("circle", {
      class: "handle__ring", cx: p.x, cy: p.y, r: r
    }));
    var hx = p.x + Math.cos(d2r(p.angle)) * r;
    var hy = p.y + Math.sin(d2r(p.angle)) * r;
    gHandle.appendChild(el("line", {
      class: "handle__arm", x1: p.x, y1: p.y, x2: hx, y2: hy
    }));
    gHandle.appendChild(el("circle", { class: "handle", cx: hx, cy: hy, r: 11 }));
  }

  var lastTrace = null;

  function render() {
    var em = state.parts.filter(function (p) { return p.kind === "emitter"; })[0];
    if (!em) return;

    var scene = buildScene(state.parts, state.targets);
    var startN = mediumAt(v(em.x, em.y), state.parts);
    var res = trace(v(em.x, em.y), dirOf(em.angle), scene, startN);
    lastTrace = res;

    gBeam.textContent = "";
    for (var i = 0; i < res.pts.length - 1; i++) {
      var a = res.pts[i], b = res.pts[i + 1];
      gBeam.appendChild(el("path", {
        class: "beam" + (res.segMedia[i] > 1.001 ? " beam--in" : ""),
        d: "M " + a.x.toFixed(2) + " " + a.y.toFixed(2) +
           " L " + b.x.toFixed(2) + " " + b.y.toFixed(2)
      }));
    }
    var tip = res.pts[res.pts.length - 1];
    gBeam.appendChild(el("circle", { class: "beam-dot", cx: tip.x, cy: tip.y, r: 3.5 }));

    gMark.textContent = "";
    res.marks.forEach(function (m) {
      gMark.appendChild(el("circle", { class: "mark__dot", cx: m.x, cy: m.y, r: 4 }));
      var t = el("text", {
        class: "mark__label",
        x: m.x + 10,
        y: m.y - 8
      });
      t.textContent = m.text;
      gMark.appendChild(t);
    });

    renderTargets(res.hit);
    syncParts();
    renderHandle();
    updateReadout(res);
    checkClear(res);
  }

  function updateReadout(res) {
    var lv = level();
    if (lv.free || !state.targets.length) {
      elReadName.textContent = "自由搭建";
      var tir = res.marks.filter(function (m) { return m.text === "全反射"; }).length;
      elReadMeta.textContent = "路径 " + (res.pts.length - 1) + " 段 · 光学事件 " +
        res.marks.length + " 处" + (tir ? "（含全反射 " + tir + " 次）" : "");
      return;
    }
    var all = state.targets.every(function (_, i) { return res.hit[i]; });
    if (all) {
      elReadName.textContent = "命中靶心";
      elReadMeta.textContent = "路径 " + (res.pts.length - 1) + " 段 · 全程 " +
        (res.pts.length - 1) + " 次界面事件";
      return;
    }
    // 还差多少：取所有未命中靶心里最近的那个
    var best = Infinity;
    state.targets.forEach(function (_, i) {
      if (!res.hit[i] && res.minDist[i] < best) best = res.minDist[i];
    });
    elReadName.textContent = "离靶心 " + Math.max(0, Math.round(best)) + " px";
    var tilt = state.parts[lv.pivot] ? Math.round(normAngle(state.parts[lv.pivot].angle)) : 0;
    elReadMeta.textContent = state.sel >= 0
      ? "已选中 " + (state.parts[state.sel].label || "元件") + " · 方向键旋转，Shift 加速"
      : "点一个元件选中它 · 当前角度 " + tilt + "°";
  }

  function normAngle(a) { return ((a % 360) + 360) % 360; }

  function checkClear(res) {
    var lv = level();
    if (lv.free || !state.targets.length) return;
    var all = state.targets.every(function (_, i) { return res.hit[i]; });
    if (!all) return;
    if (state.cleared[state.li]) return;
    state.cleared[state.li] = 1;
    try { localStorage.setItem("yuanmoon.light.cleared", JSON.stringify(state.cleared)); } catch (e) {}
    markCleared();
    elFeedback.dataset.tone = "good";
    elFeedback.innerHTML = '<span class="grade">过关</span>这束光走到该去的地方了。' +
      (state.li < 3 ? '换下一关，或者继续摆弄这一关。' : '三关都过了 —— 去自由搭建里拆点更狠的。');
  }

  function markCleared() {
    btns.forEach(function (b, i) {
      b.classList.toggle("is-clear", !!state.cleared[i]);
    });
  }

  /* ====================== 交互 ====================== */
  function toSvg(evt) {
    var m = svg.getScreenCTM();
    if (m && m.inverse) {
      var p = new DOMPoint(evt.clientX, evt.clientY).matrixTransform(m.inverse());
      return v(p.x, p.y);
    }
    var r = svg.getBoundingClientRect();
    return v((evt.clientX - r.left) / r.width * VB_W, (evt.clientY - r.top) / r.height * VB_H);
  }

  svg.addEventListener("pointerdown", function (e) {
    var handle = e.target.closest && e.target.closest(".handle");
    var opt = e.target.closest && e.target.closest(".opt");

    if (handle) {
      state.drag = { mode: "rotate", i: state.sel };
      handle.classList.add("is-drag");
      try { svg.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
      return;
    }
    if (opt) {
      var i = Number(opt.getAttribute("data-i"));
      state.sel = i;
      state.drag = { mode: "move", i: i };
      opt.classList.add("is-drag");
      try { svg.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
      render();
      return;
    }
    // 点空白：取消选中
    state.sel = -1;
    state.drag = null;
    render();
  });

  svg.addEventListener("pointermove", function (e) {
    if (!state.drag) return;
    var p = state.parts[state.drag.i];
    if (!p) return;
    var q = toSvg(e);

    if (state.drag.mode === "move") {
      p.x = Math.max(12, Math.min(VB_W - 12, q.x));
      p.y = Math.max(12, Math.min(VB_H - 12, q.y));
    } else {
      p.angle = normAngle(r2d(Math.atan2(q.y - p.y, q.x - p.x)));
    }
    render();
  });

  function endDrag(e) {
    if (!state.drag) return;
    state.drag = null;
    svg.querySelectorAll(".is-drag").forEach(function (n) { n.classList.remove("is-drag"); });
    render();
  }
  svg.addEventListener("pointerup", endDrag);
  svg.addEventListener("pointercancel", endDrag);

  /* 键盘：←/→ 旋转，↑/↓ 平移，Shift 加速 */
  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var p = state.sel >= 0 ? state.parts[state.sel] : null;
    if (!p) return;
    var step = e.shiftKey ? 5 : 1;
    var handled = true;
    if (e.key === "ArrowLeft") p.angle = normAngle(p.angle - step);
    else if (e.key === "ArrowRight") p.angle = normAngle(p.angle + step);
    else if (e.key === "ArrowUp") p.y = Math.max(12, p.y - step * 4);
    else if (e.key === "ArrowDown") p.y = Math.min(VB_H - 12, p.y + step * 4);
    else handled = false;
    if (handled) { e.preventDefault(); render(); }
  });

  elReset.addEventListener("click", function () { load(state.li); });

  elSolve.addEventListener("click", function () {
    var lv = level();
    if (lv.free) {
      elFeedback.dataset.tone = "ok";
      elFeedback.innerHTML = '<span class="grade">沙盒</span>这里没有答案。' +
        '想看有意思的东西 —— 把两面镜子摆成接近平行，光会在里面来回弹很久。';
      return;
    }
    if (!state.solvedGroups.length) {
      elFeedback.dataset.tone = "bad";
      elFeedback.innerHTML = '<span class="grade">无解</span>这一关的元件组合扫不到解，' +
        '这是关卡数据的问题，不是你的操作问题。';
      return;
    }
    var cur = normAngle(state.parts[lv.pivot].angle);
    var near = state.solvedGroups[0];
    state.solvedGroups.forEach(function (g) {
      if (dist2Angle(cur, g.mid) < dist2Angle(cur, near.mid)) near = g;
    });
    elFeedback.dataset.tone = "ok";
    elFeedback.innerHTML = '<span class="grade">提示</span>把 <b>' +
      (state.parts[lv.pivot].label || "元件") + '</b> 转到 <b>' +
      Math.round(near.lo) + '° – ' + Math.round(near.hi) + '°</b> 之间。';
  });

  function dist2Angle(a, b) {
    var d = Math.abs(normAngle(a) - normAngle(b));
    return Math.min(d, 360 - d);
  }

  btns.forEach(function (b) {
    b.addEventListener("click", function () { load(Number(b.getAttribute("data-level"))); });
  });

  /* ====================== 关卡装载 ====================== */
  function load(li) {
    state.li = li;
    var lv = LEVELS[li];
    state.parts = cloneParts(lv.parts);
    state.targets = lv.targets.map(function (t) {
      return { x: t.x, y: t.y, r: t.r };
    });
    state.sel = -1;
    state.solvedGroups = solveAngles(lv);

    if (!lv.free && !state.solvedGroups.length && window.console) {
      window.console.warn("[光路] 第 " + (li + 1) + " 关扫不到解，请检查关卡数据");
    }

    elLevelTag.textContent = lv.free ? "沙盒 · 无目标" : "第 " + (li + 1) + " 关 / 共 4 关";
    elName.textContent = lv.name;
    elHint.textContent = lv.hint;
    elLesson.textContent = lv.lesson;
    elFeedback.textContent = "";
    elFeedback.removeAttribute("data-tone");
    elSolve.textContent = lv.free ? "这里有什么" : "给个提示";

    btns.forEach(function (b, i) {
      b.classList.toggle("is-on", i === li);
    });
    markCleared();

    buildParts();
    render();
  }

  /* ====================== 启动 ====================== */

  /* 验收钩子：让无头浏览器能直接对内核做断言（折射角是否落在 28.1°、
     水到空气 60° 是否全反射、每一关到底有没有解）。页面本身不依赖它。 */
  window.__light = {
    trace: trace, reflect: reflect, refract: refract, raySeg: raySeg,
    criticalAngle: criticalAngle, buildScene: buildScene, mediumAt: mediumAt,
    dirOf: dirOf, norm: norm, dot: dot, r2d: r2d, d2r: d2r,
    LEVELS: LEVELS, state: state, load: load,
    solution: function () { return state.solvedGroups; }
  };

  function init() {
    buildGrid();
    var ca = criticalAngle(1.33, AIR);
    if (ca !== null) elCrit.textContent = ca.toFixed(1) + "°";
    load(0);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
