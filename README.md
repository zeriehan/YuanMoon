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

---

## 二、部署到 Cloudflare Pages

### 方式 A：连 Git 仓库（推荐，以后 push 即上线）

1. 把本站推到 GitHub：

   ```bash
   git add -A
   git commit -m "初始版本：缘梦品牌门户"
   git branch -M main
   git remote add origin git@github.com:<你的用户名>/yuanmoon.git
   git push -u origin main
   ```

2. 打开 Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. 授权 GitHub，选中刚才的仓库
4. 构建设置这样填（**这一步最容易填错**）：

   | 字段 | 填什么 |
   |---|---|
   | Production branch | `main` |
   | Framework preset | `None` |
   | Build command | **留空** |
   | Build output directory | `/` |

   因为本站是纯静态、没有编译过程，所以 build command 留空、输出目录就是仓库根。
5. 点 **Save and Deploy**，一两分钟后拿到 `yuanmoon.pages.dev` 这样的地址。

> 如果以后你把仓库上移到 `YuanMoon/` 根目录、站点挪进 `web/start/`，把
> Build output directory 改成 `web/start` 就行，一个仓库能挂多个站。

### 方式 B：直接上传（不想连 Git）

Cloudflare Dashboard → Workers & Pages → Create → Pages → **Upload assets**，
把整个 `start` 目录打包成 zip 上传。缺点是没有自动部署，每次改都要重传。

### 每次更新

```bash
git add -A && git commit -m "改了什么" && git push
```

推送后 Cloudflare 自动重建，约 30 秒生效。免费版每月 500 次构建，日常改动绰绰有余。

---

## 三、拿到 yuanmoon.me 这个域名（学生免费一年）

站点先用 `*.pages.dev` 也能跑，但品牌域名值得花十分钟领一下。

1. 打开 GitHub → 右上角头像 → **Settings** → **Education benefits** → 申请 GitHub Student
   Developer Pack，提交学生证明（学生证 / 在读证明 / 课表任选其一）。
2. 审核通过后进入 **GitHub Education** 页面，找到 **Namecheap** 条目，点 **Get Domain**。
3. 在 Namecheap 搜索 `yuanmoon.me`，右侧出现 **FREE** 就加入购物车结算。
   结算时**用你 GitHub 的主邮箱**，否则优惠不生效。
4. 顺手把 **Name.com** 那条也看一眼 —— 它能在 25 个以上后缀里任选一个
   （`.dev` / `.app` / `.live` / `.studio` 等），也是免费一年。想要 `yuanmoon.dev`
   这类更适合开发者的后缀可以从这里拿。

**务必记下两件事**：免费期是**一年**，以及**续费价**（`.me` 大约每年 10–15 美元）。
到期不想续，提前把域名换掉就行，站点本身不受影响。

### 把域名接到站点上

推荐把 DNS 交给 Cloudflare 管（以后加子域名、接 R2 都方便）：

1. Cloudflare Dashboard → **Add a site** → 输入 `yuanmoon.me` → 选 **Free** 计划
2. Cloudflare 会给你两个 nameserver 地址，复制下来
3. 回到 Namecheap → **Domain List** → `yuanmoon.me` 右侧 **Manage** →
   **Nameservers** → 选 **Custom DNS** → 填入 Cloudflare 那两个地址 → 保存
4. 等生效（通常十几分钟到几小时）
5. 回到 Cloudflare Pages 项目 → **Custom domains** → **Set up a custom domain** →
   输入 `yuanmoon.me` → 按提示确认，Cloudflare 会自动加好 DNS 记录
6. 顺手把 `www.yuanmoon.me` 也加上，指向同一个项目

> 懒人方案：不接 Cloudflare DNS，直接在 Namecheap 的 **Advanced DNS** 里加一条
> `CNAME @ → 你的项目.pages.dev`。能用，但少了 Cloudflare 那层免费加速和管理能力。

**不需要备案**。Cloudflare Pages 走的是境外节点，不涉及 ICP 备案。
代价是国内访问速度一般（联通晚高峰可能几百毫秒），这是"零成本"必然的交换。

---

## 四、以后要放的东西

### 小游戏

放在 `games/<游戏名>/index.html`，首页卡片直接链过去。HTML5 小游戏通常几 MB，
Cloudflare Pages 单文件 25MB 的限制完全够用。

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
├── index.html                 页面结构、文案、月相 SVG
├── styles/
│   ├── tokens.css             设计令牌：颜色、字阶、间距、圆角、阴影、动效
│   ├── base.css               字体声明、重置、排版基线、焦点、降级动效
│   └── components.css         全部组件与构成
├── scripts/
│   └── main.js                星场生成、月相计算、滚动入场、导航状态
├── assets/
│   ├── fonts/                 Cormorant Garamond 自托管 woff2（共约 92KB）
│   └── img/favicon.svg
└── README.md
```

**改颜色改字阶一律去 `tokens.css`**，组件层不写死色值。这样以后想换整体色调只需要
动一个文件。

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
