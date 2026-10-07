# 缘梦 YuanMoon

个人品牌门户站。纯手写 HTML / CSS / JS，无框架、无构建步骤，改完直接就是能上线的文件。

- **域名（计划）**：`yuanmoon.me`
- **托管**：Cloudflare Pages（免费）
- **构建**：无。没有 npm，没有 bundler，没有 node_modules

---

## 一、本地预览

在站点目录下起一个静态服务即可。**不要双击 index.html 直接打开** —— `file://` 协议下
字体和脚本的相对路径会被浏览器拦，你会看到一个没样式的空页面。

```bash
cd web/start
python -m http.server 8137
# 打开 http://127.0.0.1:8137
```

访问 <http://127.0.0.1:8137>，四个入口都该通：

| 路径 | 是什么 |
|---|---|
| `/` | 品牌门户首页 |
| `/games/moon-phase/` | 月相挑战 |
| `/games/light-path/` | 光路挑战 |
| `/404.html` | 找不到页面时的样子 |

> 这个服务是后台进程，**换个会话/隔夜再回来通常已经停了**，
> 表现是浏览器报"无法访问此网站"。重跑一次上面的命令即可。
> 判断方法：`curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8137/`
> 返回 `200` 就是在跑，返回 `000` 就是没跑。

---

## 二、上线：三步

**建议顺序：先用免费的 `pages.dev` 上线拿到地址，再去领 `yuanmoon.me` 换上去。**
这样你今天就能拿到一个能打开的网址，而不是等域名审核（学生包可能要几天）。

### 第 1 步 · 推到 GitHub

1. 打开 <https://github.com/new> 建仓库
   - Repository name：`yuanmoon`
   - 选 **Public**（连 Cloudflare 最省事）
   - **不要**勾 "Add a README file" —— 本地已经有
2. 连远端并推送（在仓库目录里执行）：

   ```bash
   git branch -M main
   git remote add origin git@github.com:<你的用户名>/yuanmoon.git
   git push -u origin main
   ```

   推送要凭据，二选一：
   - **SSH**（推荐）：上面那条 `git@github.com:` 就是。若你的 SSH 不是默认配置，
     前面加 `GIT_SSH_COMMAND`，例如
     `GIT_SSH_COMMAND="ssh -p 端口 -i 私钥路径" git push -u origin main`
   - **HTTPS**：把 remote 换成 `https://github.com/<用户名>/yuanmoon.git`，
     密码位置要填 **Personal Access Token**（GitHub 密码已停用）。
     令牌在 Settings → Developer settings → Personal access tokens 生成，勾 `repo` 即可。

   > 本地已有三个提交，**不需要**再执行 `git commit`。

### 第 2 步 · 连 Cloudflare Pages

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. 授权 GitHub，选中 `yuanmoon` 仓库
3. 构建设置这样填（**这一步最容易填错**）：

   | 字段 | 填什么 |
   |---|---|
   | Production branch | `main` |
   | Framework preset | `None` |
   | Build command | **留空** |
   | Build output directory | `/` |

   本站是纯静态、没有编译过程，所以 build command 留空、输出目录就是仓库根。
4. 点 **Save and Deploy**，一两分钟后拿到 `xxx.pages.dev` 这样的地址

5. **当场验一遍**（这四条都要通）：

   | 打开 | 期望 |
   |---|---|
   | `https://xxx.pages.dev/` | 首页，首屏一轮月亮 |
   | `.../games/moon-phase/` | 月相挑战，能玩 |
   | `.../games/light-path/` | 光路挑战，能玩 |
   | `.../随便敲个不存在的路径` | 落到 404 页 |

   > 注意：此时 `canonical` / `og:image` 里的域名还是占位的 `yuanmoon.me`，
   > **这是对的**，等域名到手再换（见第 3 步）。

> 如果以后你把仓库上移到 `YuanMoon/` 根目录、站点挪进 `web/start/`，
> 把 Build output directory 改成 `web/start` 就行，一个仓库能挂多个站。

### 第 3 步 · 领 yuanmoon.me 并绑上去

**先去申请 GitHub 学生包**，审核要 1–3 天，先申请着，不影响站已经上线。

1. GitHub → 头像 → **Settings** → **Education benefits** → 申请 GitHub Student
   Developer Pack（学生证 / 在读证明 / 课表任选其一）
2. 审核通过后进入 **GitHub Education** 页面，找到 **Namecheap** 条目 → **Get Domain**
3. 搜 `yuanmoon.me`，右侧出现 **FREE** 就加入购物车结算。**结算时用你 GitHub 的主邮箱**，
   否则优惠不生效
4. Cloudflare Dashboard → **Add a site** → 输入 `yuanmoon.me` → 选 **Free**
5. Cloudflare 给你两个 nameserver → 回 Namecheap → **Domain List** → `yuanmoon.me`
   → **Manage** → **Nameservers** → **Custom DNS** → 填入 → 保存
6. 等生效（十几分钟到几小时）→ 回 Pages 项目 → **Custom domains** →
   **Set up a custom domain** → 输入 `yuanmoon.me`
7. **换掉占位域名**：找 `yuanmoon.me` 改成实际域名的地方（见下面「换域名」一节），
   提交等一次自动部署

### 换域名要改的地方（漏了不报错，只会让分享预览和收录悄悄失效）

```bash
grep -rn "yuanmoon.me" --include="*.html" --include="*.txt" --include="*.xml" .
```

会列出五个文件，逐个替换成新域名即可。

### 以后每次更新

```bash
git add -A && git commit -m "改了什么" && git push
```

推送后 Cloudflare 自动重建，约 30 秒生效。免费版每月 500 次构建，日常改动绰绰有余。

> **改完记得自己验一遍**：`.workbuddy/checks/` 下有验收脚本，见目录结构那一节。
> 浏览器缓存会让你看到改之前的旧样式，别被它骗了。

### 不想连 Git 的做法

Cloudflare Dashboard → Workers & Pages → Create → Pages → **Upload assets**，
把整个 `start` 目录打包成 zip 上传。缺点是没有自动部署，每次改都要重传。

---

## 三、关于 yuanmoon.me 这个域名

**具体操作流程在「二、第 3 步」**，这一节只记三件容易被忘掉的事。

**为什么值得领。** `*.pages.dev` 也能跑，但别人看到的是" someone's Cloudflare 站点"。
品牌域名是"这是他做的"的第一层证据 —— 而且 `.me` 单价便宜、学生包免费一年。

**免费期只有一年。** 到期不续的话，把域名换掉就行，站点本身完全不受影响
（换个 Custom domain 指向同一个 Pages 项目，两分钟的事）。

**顺便看一眼 Name.com 那条。** GitHub 学生包在 Name.com 也能在 25 个以上后缀里任选一个
（`.dev` / `.app` / `.live` / `.studio` 等），同样免费一年。想要 `yuanmoon.dev`
这类更适合开发者的后缀可以从那里拿 —— 但注意 `.dev` / `.app` 强制 HTTPS，
Cloudflare Pages 默认就带证书，不受影响。

**不需要备案。** Cloudflare Pages 走境外节点，不涉及 ICP 备案。代价是国内访问速度一般
（晚高峰可能几百毫秒），这是"零成本"必然的交换。想国内秒开必须备案，
而备案需要国内云资源 = 花钱。

---

## 四、以后要放的东西

### 小游戏

放在 `games/<游戏名>/index.html`，首页卡片直接链过去。HTML5 小游戏通常几 MB，
Cloudflare Pages 单文件 25MB 的限制完全够用。

**已经上线两个：**

**`games/moon-phase/` 月相挑战** —— 十个回合，把月亮调到题目要的月相。
主页那轮"只会从新月长到满月"的月亮的完整版 —— 主页只画盈月那半程，
游戏里跑完整朔望月，亏月不做第二套几何，而是把亮面路径水平镜像
（`transform="translate(400 0) scale(-1 1)"`，对 viewBox 的中心轴 x=200 严格对称）。

模式有两个：**挑战**（十道题的靶心计分，朔/弦/望容差严、月牙/凸月容差宽）和
**自由玩**（拖到哪儿报出哪儿的月相，用于认形状）。键盘左右方向键可微调，
按住 Shift 是五倍步长。

**`games/light-path/` 光路挑战** —— 三关教几何光学：反射 → 折射 → 全反射，外加一个沙盒。
内核只有三件事：直线传播、镜面反射、斯涅尔折射。**全反射不是特例逻辑**，
它是折射无解时的自然结果，所以不用单独写。

关卡数据里 `pivot` 指出该拧哪个元件，开关时脚本会扫一遍这个元件的旋转角，
把所有能通关的角度收成区间 —— 这既是"给个提示"按钮的答案来源，
也顺手证明这一关确实有解（无解会在控制台 warn）。

> **为什么这三关的代码是给后面两层玩的**：
> 波动光学 = 把单条光线换成波前累加（光程 → 相位）；
> 广义相对论下的光线偏折 = 弱场下等价于穿过折射率随位置变化的介质，即 `n = n(p)`。
> 两种改法都只动"介质"这一层，追迹循环一个字不改。所以 v1 刻意不做介质栈和
> 嵌套玻璃（约定玻璃互不重叠、外部恒为空气），代码因此短了一截，而接口是现成的。

### 小程序

微信小程序不能托管在这里，只能放二维码或跳转链接。首页那张卡片目前是占位态。

### 大游戏（狭义相对论 / 时空）—— 这里有个坑要提前知道

**Cloudflare Pages 和腾讯 EdgeOne 都限制单个文件最大 25MB。**
用 Three.js 自己写通常没问题；但如果是 **Unity WebGL 导出**，包体经常到 20–40MB+，
一定会撞上这个限制。三个解法，按推荐顺序：

1. **Unity 侧分包压缩**：Build Settings 里开启 Brotli 压缩，勾选
   `Split Application Binary` 把资源切成多个小文件。多数情况能压到限制内。
2. **大资源丢 Cloudflare R2**：R2 免费额度是 10GB 存储 + 每月 100 万次写 / 1000 万次读，
   **出站流量免费**（这是它最值钱的地方 —— 意味着玩家下载游戏资源不花你一分钱）。
   站点只放壳，资源从 R2 拉。
3. **降低目标**：先做 2D 或轻量 3D 版本，把包体控制在 25MB 以内。

不要用 GitHub Releases 托管游戏大文件 —— 国内下载速度会让你很难受。

---

## 五、目录结构

```
start/
├── index.html                 品牌门户：首屏、缘起、作品、关于
├── 404.html                   Cloudflare Pages 自动接管找不到的路径
├── robots.txt / sitemap.xml   给搜索引擎的入口（换域名时要改）
├── styles/
│   ├── tokens.css             设计令牌：颜色、字阶、间距、圆角、阴影、动效
│   ├── base.css               字体声明、重置、排版基线、焦点、降级动效
│   └── components.css         全部组件与构成（含 404 页）
├── scripts/
│   └── main.js                星场生成、月相计算、滚动入场、导航状态
├── games/
│   ├── moon-phase/            小游戏 01：月相挑战
│   │   ├── index.html  game.css  moon.js
│   ├── light-path/            小游戏 02：光路挑战（几何光学）
│   │   ├── index.html  game.css  light.js
│   └── <新游戏>/              每个游戏一个目录，页面复用 ../../styles/*
├── assets/
│   ├── fonts/                 Cormorant Garamond 自托管 woff2（共约 92KB）
│   └── img/
│       ├── favicon.svg
│       ├── og-card.svg        分享卡源文件（1200×630）
│       └── og-card.png        分享卡成品，社交平台只认位图
└── README.md
```

**改颜色改字阶一律去 `tokens.css`**，组件层不写死色值。这样以后想换整体色调只需要
动一个文件。

**验收脚本在 `.workbuddy/checks/`**（随 `.workbuddy/` 一起被 gitignore，属本地工具）。
三个驱动 + 三份探针，跑之前先在站点根目录起 `python -m http.server 8137`：

| 脚本 | 验什么 |
|---|---|
| `sitecheck.py` | 全站终检（链接可达、meta、无溢出）+ 首页回归（月相进度、字体、星场）+ 各页截图 |
| `gamecheck.py` | 月相挑战：8 档月相的几何与命名 + 计分 + 溢出 |
| `lightcheck.py` | 光路挑战：反射/折射/全反射的数学 + 三关可解性 + 拖动交互 |
| `worksshot.py` | 整页截图并切出作品区（切片要 Pillow，用 Anaconda 那套 python） |

> 页面改了以后**先跑一遍再看效果**。这套脚本抓到过三个真 bug：探针里正则匹配到了
> SVG 的第一条弧、关卡扫描把镜子当成光源发射光线、以及光线没钳到台面内糊在控制台上。
> 另外：验收必须用**独立的浏览器 profile**，复用会命中 HTTP 缓存，让你看到改之前的旧 CSS。

> **域名占位提示**：全站现在按 `yuanmoon.me` 写死了三处绝对地址 ——
> `index.html` 与 `games/moon-phase/index.html` 里的 `canonical` / `og:url` / `og:image`，
> 以及 `robots.txt`、`sitemap.xml`。**如果最后领到的域名不是这个，这五处要一起换。**
> 换漏了不会报错，只会让分享预览和搜索引擎收录默默失效。

---

## 五之二、再添一个小游戏

1. 建 `games/<游戏名>/`，里面的页面从 `../../styles/tokens.css` 起加载样式 —— 设计令牌、
   字体、按钮、卡片全部复用，视觉自然和主页一致。
2. 新页面头部照抄 `games/moon-phase/index.html` 的 `<head>`（canonical + og 那一段），
   记得改 URL。
3. 首页 `index.html` 的 `.works` 里加一张卡：`<article class="work work--live">`，
   标题里放 `<a class="work__link" href="games/xxx/">`。这个写法让**整张卡都能点，
   但读屏软件念出来的仍然只有标题文字**（而不是"卡片 1 链接"）。
4. 卡片图标的月相 = 进度。细月牙用 `A8.2 14 0 0 0`，盈凸月用 `A9.9 14 0 0 1`，
   满月（做完）直接去掉亮面路径。
5. 顺手往 `sitemap.xml` 里补一个 `<url>` 块。

---

## 六、设计说明

**定调**：深空天文台的克制语言。近黑的靛蓝底（主色 60%）+ 月白与灰阶承载全部文字
（辅助 30%）+ 月华金只用在强调和可交互处（10%）。全程只有一个强调色。

**记忆点 —— 滚动驱动的月相盈亏**。首屏那轮月亮不是图片，是一条由脚本实时计算的
SVG 路径。往下滚，它从新月一路长到满月，同时月晕一点点亮起来。这不是装饰：
「缘」是起点，「元」是圆，「梦」是把它做出来 —— 品牌释义被翻译成了一个月相周期。

月相的几何原理写在 `scripts/main.js` 的注释里：本质上是一个「右半圆」和一个椭圆
的和差，椭圆的半轴长等于 `|cos(2π·相位)|`，弧的凹凸方向由该值的正负决定。

**字体**：展示字 Cormorant Garamond（衬线，高对比度，笔画像星图上的刻线），
拉丁文用它；中文标题回落到宋体栈，同样保住衬线感；正文用系统中文字体栈保证渲染质量。
字体文件**自托管**在 `assets/fonts/` —— 不走 Google Fonts，因为国内访问
`fonts.googleapis.com` 不稳定，而字体在首屏渲染的关键路径上。

**降级与可访问性**：
- `prefers-reduced-motion: reduce` 时全部动效关闭，星场停止闪烁
- 禁用 JS 时页面完整可读（滚动入场只在 `html.js` 下才隐藏元素）
- 正文对比度实测 ≥ 5.5:1，交互目标 ≥ 44×44px
- 语义化地标 + 跳转链接 + 可见焦点环

---

## 七、改内容的速查

| 想改什么 | 去哪 |
|---|---|
| 首屏那句介绍 | `index.html` 里的 `.hero__lede` |
| 四个字的释义文案 | `index.html` 里的 `.gloss` 区块 |
| 作品卡片（标题、描述、状态） | `index.html` 里的 `.work` 区块 |
| 卡片图标（月相） | 卡片里的 `work__phase` SVG，改 `fill` 深浅即可 |
| 整体色调 | `styles/tokens.css` 顶部的色板 |
| 月亮变圆的速度 | `scripts/main.js` 里的 `heroHeight * 0.82`，调大即变慢 |
| 游戏题目数量 / 八个月相的名字 | `games/moon-phase/moon.js` 顶部的 `QUESTION_COUNT` 与 `PHASES` |
| 游戏评分松紧 | 同文件的 `TOL`（六档容差） |
| 光路关卡 / 元件位置 | `games/light-path/light.js` 的 `LEVELS`（viewBox 是 880×520） |
| 光路的水和玻璃折射率 | 同文件各关的 `n`（水 1.33、玻璃 1.5，临界角 48.8° / 41.8°） |
| 分享卡（社交预览图） | 改 `assets/img/og-card.svg`，再按下方命令重渲染 PNG |

分享卡是 SVG 画完再转成 PNG 的（社交平台不认 SVG），改完源文件后重跑：

```bash
"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
  --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --user-data-dir="$TEMP/profile" --window-size=1200,630 --virtual-time-budget=8000 \
  --screenshot="assets/img/og-card.png" \
  "http://127.0.0.1:8137/assets/img/og-card.svg"
```

（需要本地预览服务已启动，SVG 里的 `@font-face` 走的是相对路径。）
