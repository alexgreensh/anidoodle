<p align="center">
  <img src="assets/banner.gif" width="100%" alt="anidoodle：一张画满代码手绘涂鸦的画桌，anidoodle 这个名字正以书法字体自己写出自己">
</p>

<h1 align="center">anidoodle</h1>

<p align="center"><strong>手绘的艺术，用代码写成。</strong></p>

<p align="center">
  插画、动画和短片，九种手绘风格任你挑选。<br>
  每一笔都是一个函数，每一个音符都是一次算术运算，于是同一份源码<br>
  在任何机器、任何尺寸下，都会重新画出同一张画，永远如此。
</p>

<p align="center">
  <a href="https://github.com/alexgreensh/anidoodle/releases"><img src="https://img.shields.io/github/v/release/alexgreensh/anidoodle?color=c2410c&label=%E7%89%88%E6%9C%AC" alt="最新版本"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/%E8%AE%B8%E5%8F%AF%E8%AF%81-Apache%202.0-3b6ea5" alt="Apache 2.0 许可证"></a>
  <img src="https://img.shields.io/badge/%E5%8E%9F%E6%96%99-%E7%BA%AF%E4%BB%A3%E7%A0%81-6b8e23" alt="纯代码打造">
  <img src="https://img.shields.io/badge/%E6%AF%8F%E6%AC%A1%E6%B8%B2%E6%9F%93-%E5%AE%8C%E5%85%A8%E4%B8%80%E8%87%B4-7c5c99" alt="每次渲染，完全一致">
</p>

<p align="center"><a href="README.md">English</a> · <a href="README.ja-JP.md">日本語</a> · <b>简体中文</b> · <a href="README.ko-KR.md">한국어</a> · <a href="README.fr-FR.md">Français</a> · <a href="README.es-ES.md">Español</a></p>

<p align="center">
  <a href="#九种风格随你挑选">风格</a> ·
  <a href="#你能做出什么">你能做出什么</a> ·
  <a href="#它自带了什么">它自带了什么</a> ·
  <a href="#先画后动">动态效果</a> ·
  <a href="#开始使用">开始使用</a>
</p>

## 九种风格，随你挑选

<p align="center">
  <img src="assets/styles.jpg" width="100%" alt="九幅插画，各有各的风格：铅笔与水彩画成的陆莲花、马克笔漫画风的锦鲤、圆珠笔画的怀表、蜡笔热气球、墨水与淡彩画的鹪鹩、粉笔黑板上的月相图、剪纸狐狸、孔版印刷风格的灯塔，还有一枚用单线雕刻而成的月亮">
</p>

每种风格都有自己独特的落笔方式：笔尖的收锋、水彩的晕染、粉笔在石板上的揉擦、剪纸边缘的撕裂感、孔版印刷滚筒的网点、一条雕刻线螺旋展开变成一轮月亮。同一个主题，在不同的风格里会呈现出完全不同的样子，就像出自九位不同插画师之手。为你的品牌选定一种风格，之后的每一张画都会出自同一双手。上面的每一幅样图，连同这张对照表本身，都是这个仓库里的代码画出来的。

## 你能做出什么

| 用途 | 你能得到什么 |
|---|---|
| **官网** | 一张主视觉插画，每个功能点一张点缀小图，空状态和 404 页面，全部出自同一双手。同一份源码可以导出任意尺寸的透明 PNG，视网膜屏和印刷都不在话下。 |
| **说明图和报告** | 原理图、剖视图和动态信息图，配上手绘风格的标注文字。严肃一点的话题，粉笔黑板、蓝图和圆珠笔风格都很合适。 |
| **品牌** | 一个会自己画出来的 Logo，一段片头动画，一套每次发帖都保持品牌调性的社交卡片模板。 |
| **社交和聊天** | 无限循环的动图、GIF，以及适配信息流尺寸的透明动态贴纸。 |
| **幻灯片和文档** | 一个程序生成一整套章节插画。换个种子，就能得到风格相同的姊妹图。 |
| **故事** | 分镜和动态预览，一步步长成一部配有原创配乐的完整短片。 |

用大白话说出你的需求就行，比如 *“给我们的招聘页面画一张孔版印刷风格的灯塔，1600×900”*，或者 *“用粉笔黑板风格画一张解释我们定价方案的说明图”*，anidoodle 会自动把它路由到合适的工作流和风格配方，只有在你没说清楚的地方才会追问。

## 它自带了什么

引擎只是简单的那一半。真正的功夫，是 anidoodle 替你背下来的六条心得，每一条都是先画砸了一次才换来的经验，写下来是为了让你从上一个项目结束的地方接着开始：

- **故事**，让每件作品都有一个重点。一张静态图只讲一个想法、聚焦一个主体；一部短片只有一次转变、一个高潮，和一个反复出现的意象。→ [`storytelling.md`](references/storytelling.md)
- **写实感**，来自把它说清楚。解剖结构、观察视角，以及你参考过的资料，都要交代明白，这样一只蝴蝶读起来才像是一个有身体、有翅脉的真实生物。→ [`realism-and-craft.md`](references/realism-and-craft.md)
- **风格**，活在笔触里。九套完整配方，外加一份按场合挑风格的指南，以及自创风格的步骤。→ [`styles.md`](references/styles.md)
- **音乐**，遵循一套配方。大调、拨弦，一句先提问后归家的旋律，温暖而笃定。→ [`music-recipe.md`](references/music-recipe.md)
- **确定性**，是这套系统的承诺。纯函数加上带种子的随机数，任何人拿到源码都能重建出一模一样的作品。→ [`determinism-and-contract.md`](references/determinism-and-contract.md)
- **方法**，让你保持速度。先用一张静态图验证效果，再一路做到底，把审批环节留给那些出错代价高的地方。→ [`working-method.md`](references/working-method.md)

每种格式都出自同一份源码：PNG、带配乐的 MP4、GIF、透明的 WebM 和动态 PNG，还有一个自包含的 HTML 文件。→ [`formats.md`](references/formats.md)

## 先画，后动

<table>
  <tr>
    <td width="50%" align="center"><img src="assets/act1.gif" alt="一张蓝晒图工艺的图版正在一笔一笔画出自己"></td>
    <td width="50%" align="center"><img src="assets/alive.gif" alt="一只机械蝴蝶在水彩中苏醒，在陆莲花间轻盈飞舞"></td>
  </tr>
  <tr>
    <td align="center"><sub>每一笔都是<strong>真的画出来</strong>的，顺序和手绘时一模一样。</sub></td>
    <td align="center"><sub>蓝图在水彩中苏醒，振翅飞向自己的草地。</sub></td>
  </tr>
</table>

**▶ 完整的 47 秒短片**，记得开声音。1080×1080，配有原创配乐，每一帧、每一个音频采样都是代码生成的：

https://github.com/user-attachments/assets/019d46d3-536a-4843-9f68-8e8f5f5c3401

一个纯函数负责画出每一帧，所以一张成品插画，就是这个函数被调用了一次；一枚贴纸，是同一个函数循环调用；一部短片，则是这个函数配上一个故事和一段配乐。三者背后，是同一套保证。

## 画一次，管一辈子

图像模型每渲染一帧都要烧掉 token 和算力，而且每次画出来的都不一样。代码只花这份钱一次。这部 47 秒的短片就是一个程序：写一次，就能在任何机器、任何尺寸下渲染出全部 1,410 帧画面和一整段立体声配乐，而且每次运行都是免费的。折算下来，第一遍大约每帧只花六十个 token 的代码量，之后每一遍都是零成本。一张静态插画不过几百行代码，一整个系列的图像，也不过是一份种子列表。

## 开始使用

anidoodle 是一个 agent skill：一个文件夹，顶层放着一个 `SKILL.md`。如果你用的是 Claude Code，把它克隆进你的 skills 文件夹：

```bash
git clone https://github.com/alexgreensh/anidoodle ~/.claude/skills/anidoodle
```

然后直接说出你想要什么就行，比如 *“给我们的菜谱页面画一个铅笔加水彩风格的梨”*。如果你想亲自操作引擎：

```bash
node ~/.claude/skills/anidoodle/engine/tools/scaffold.mjs ~/art --still hero --film intro
cd ~/art && npm install && npx playwright-core install chromium

node tools/still.mjs  hero  --out out/hero.png --scale 2   # a finished illustration, print size
node tools/render.mjs intro --out out/intro.gif            # a loop; also .mp4 with score, .webm with alpha
node tools/emit.mjs   intro --out out/intro.html           # the whole piece as one offline file
node tools/gate.mjs   hero                                 # determinism, contract and dead air in one pass
```

需要 Node 20 及以上版本。静态图只需要上面那个浏览器；只要涉及动态效果，就还会用到 `ffmpeg`。

`emit` 会输出一个大约 100 KB 的 HTML 文件，双击就能离线播放，声音也在里面。它带着完整的配方，每次打开都会从头重新画一遍。把它作为邮件附件发出去，你就等于交付了一整个工作室。

四个后端共用同一个绘图核心，而这个核心压根不在乎是谁在画：`playwright`、`html-player`、`remotion`、`hyperframes`。

## 示例短片

`example/` 目录里放着**机械鳞翅目**（Mechanical Lepidoptera）：1,410 帧，47 秒，一只机械蝴蝶自己画出自己的图纸，在水彩中苏醒过来，又把蓝图留在了草丛里。这一部作品，就是整个引擎的缩影：控制点是按照真实解剖结构手工摆放的，缓存键记录了每个像素依赖的每一个输入，配乐按照配方生成，从画成到活过来，是一气呵成的一个动作。九张风格样图和引擎放在一起，都在 `engine/src/canvas-core/` 里，每一张的顶部都写着自己的配方。随便打开一个，改一个数字，看看会发生什么变化。

## 诚实是设计出来的

声音和动态效果，靠的是拿实打实的证据说话。每一句关于配乐或动作的描述，背后都有一次测量或一双人眼验证过，绿色对勾也只有在重新跑过之后才算数。正是这份较真，让同一件作品无论在哪台机器上、跑多少次，都能分毫不差地重现。

---

基于 [Apache License 2.0](LICENSE) 协议开源。版权所有 2026 Alex Greenshpun。

<sub>由 anidoodle 绘制，它的全部本事，都是老老实实画了几遍蝴蝶换来的。</sub>
