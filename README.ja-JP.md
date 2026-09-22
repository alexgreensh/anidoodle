<p align="center">
  <img src="assets/banner.gif" width="100%" alt="anidoodle:コードで描いたいたずら描きが並ぶ画家の机。名前そのものが書道のように、自ら書きあがっていく。">
</p>

<h1 align="center">anidoodle</h1>

<p align="center"><strong>手描きのアートを、コードで書く。</strong></p>

<p align="center">
  イラスト、アニメーション、そして短編映画を、9つの手描きスタイルで。<br>
  一筆一筆が関数で、一音一音が計算式だから、同じソースコードは<br>
  どのマシンでも、どんなサイズでも、いつまでも同じ絵を描き直す。
</p>

<p align="center">
  <a href="https://github.com/alexgreensh/anidoodle/releases"><img src="https://img.shields.io/github/v/release/alexgreensh/anidoodle?color=c2410c&label=%E3%83%AA%E3%83%AA%E3%83%BC%E3%82%B9" alt="最新リリース"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/%E3%83%A9%E3%82%A4%E3%82%BB%E3%83%B3%E3%82%B9-Apache%202.0-3b6ea5" alt="Apache 2.0 ライセンス"></a>
  <img src="https://img.shields.io/badge/%E7%B4%A0%E6%9D%90-100%25%E3%82%B3%E3%83%BC%E3%83%89-6b8e23" alt="素材は100%コード">
  <img src="https://img.shields.io/badge/%E6%AF%8E%E5%9B%9E%E3%81%AE%E3%83%AC%E3%83%B3%E3%83%80%E3%83%AA%E3%83%B3%E3%82%B0-%E5%90%8C%E4%B8%80-7c5c99" alt="毎回のレンダリングが同一">
</p>

<p align="center"><a href="README.md">English</a> · <b>日本語</b> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ko-KR.md">한국어</a> · <a href="README.fr-FR.md">Français</a> · <a href="README.es-ES.md">Español</a></p>

<p align="center">
  <a href="#選べる9つのスタイル">スタイル</a> ·
  <a href="#つくれるもの">つくれるもの</a> ·
  <a href="#搭載しているもの">搭載しているもの</a> ·
  <a href="#描いてから動きだす">動き</a> ·
  <a href="#はじめる">はじめる</a>
</p>

## 選べる9つのスタイル

<p align="center">
  <img src="assets/styles.jpg" width="100%" alt="9枚のイラスト、それぞれ異なるスタイルで描かれている。鉛筆と水彩のラナンキュラス、マーカーで描いたコミック風の鯉、ボールペンの懐中時計、クレヨンの熱気球、インクと淡彩のミソサザイ、黒板に描いた月の満ち欠け、切り絵のキツネ、リソグラフの灯台、そして一本の線で彫られた月。">
</p>

どのスタイルも、線の生み出し方がまったく違う。ペン先のしなり、水彩のにじみ、黒板チョークの擦れ、切り絵の破れた縁、リソグラフのドラムが作る網点、一本の彫り線が渦を巻いて月になる瞬間。同じ題材でも、9人の描き手がいれば9通りの形になるように、スタイルごとに姿を変える。ブランド用にひとつ選べば、その後のすべての絵が同じ手で描かれたように揃う。上の見本も、コンタクトシートそのものも、すべてこのリポジトリのコードで描かれている。

## つくれるもの

| 用途 | できること |
|---|---|
| **あなたのウェブサイト** | ヒーローイラスト、各機能のスポットアート、空状態や404ページまで、すべて同じ手で。透過PNGは元データから好きなサイズで書き出せるので、Retina対応も印刷用も追加コストなしで手に入る。 |
| **説明資料やレポート** | 仕組み図、断面図、アニメーション付きインフォグラフィックを、手描き風のレタリングでラベル付けして。黒板、設計図、ボールペンのスタイルは真面目な内容にぴったり。 |
| **ブランド表現** | 自ら描き上がっていくロゴ、タイトルシークエンス、どの投稿でもブランドを保てるソーシャルカードのテンプレート。 |
| **SNSやチャット** | 終わりのないループ、GIF、透過背景のアニメーションスタンプを、フィードに合わせたサイズで。 |
| **資料やドキュメント** | ひとつのプログラムから生まれる、章ごとのイラストのファミリー。シード値を変えるだけで、同じスタイルの姉妹画像が手に入る。 |
| **物語** | 絵コンテやアニマティックから、オリジナルスコア付きの短編映画へと育っていく。 |

「採用ページ用にリソグラフ風の灯台のイラストがほしい、1600×900で」とか「料金プランの違いを黒板スタイルで説明する図を作って」というように、ふだんの言葉でお願いすればいい。anidoodleがそれを適切なワークフローとスタイルのレシピに振り分けて、足りない情報だけを聞き返してくる。

## 搭載しているもの

エンジンを作るのは、実は簡単な方の半分。難しいのは職人技の部分で、それはanidoodleがあなたの代わりに背負っている。6つの教訓はどれも、一度失敗してから学んだことを書き留めたもので、前のプロジェクトが終わった地点から始められるようになっている。

- **物語**が、作品に意味を与える。一枚絵ならひとつのアイデアとひとつの主題。映画ならひとつの変化、ひとつの見せ場、そして繰り返し登場するモチーフがひとつ。→ [`storytelling.md`](references/storytelling.md)
- **リアリズム**は、名づけることから生まれる。解剖学的な構造、視点、そして開いた参考資料。それがあってはじめて、蝶は体と翅脈を持つ生き物として見えてくる。→ [`realism-and-craft.md`](references/realism-and-craft.md)
- **スタイル**は、線そのものに宿る。9つの完全なレシピ、案件ごとに選ぶためのガイド、そして自分だけのスタイルを生み出す手順。→ [`styles.md`](references/styles.md)
- **音楽**は、ひとつのレシピに従う。長調、爪弾き、問いを投げかけてから主音に帰って解決するフレーズ、温かくて確かな響き。→ [`music-recipe.md`](references/music-recipe.md)
- **決定性**が、その保証になる。純粋関数とシード付き乱数だから、ソースコードさえあれば誰でもまったく同じ作品を再構築できる。→ [`determinism-and-contract.md`](references/determinism-and-contract.md)
- **手法**が、スピードを保ってくれる。まず一枚の絵で見た目を確かめ、そのまま一気に作り上げ、間違えるとコストの高いところにだけ承認をかける。→ [`working-method.md`](references/working-method.md)

どのフォーマットも、同じソースコードから書き出される。PNG、スコア付きのMP4、GIF、透過対応のWebMとアニメーションPNG、そして単体で完結するHTMLファイルがひとつ。→ [`formats.md`](references/formats.md)

## 描いてから、動きだす

<table>
  <tr>
    <td width="50%" align="center"><img src="assets/act1.gif" alt="サイアノタイプの設計図が、一本一本の線で自ら描かれていく"></td>
    <td width="50%" align="center"><img src="assets/alive.gif" alt="ぜんまい仕掛けの蝶が水彩の中で命を得て、ラナンキュラスの間をひらひらと舞う"></td>
  </tr>
  <tr>
    <td align="center"><sub>線は、手が描くのと同じ順番で<strong>生まれていく</strong>。</sub></td>
    <td align="center"><sub>設計図が水彩の中で目を覚まし、自分の草原へと飛び立っていく。</sub></td>
  </tr>
</table>

**▶ 47秒の完全版フィルム**、音声オンで。1080×1080、オリジナルスコア付き、すべてのフレームとサンプル音がコードで生成されている:

https://github.com/user-attachments/assets/019d46d3-536a-4843-9f68-8e8f5f5c3401

1枚のフレームを描くのは、ひとつの純粋関数。だから完成イラストはその関数を一度呼び出したもの、スタンプは同じ関数をループさせたもの、映画はそこに物語とスコアを添えたもの。3つとも、同じ保証がそのまま成り立つ。

## 一度書けば、何度でも描ける

画像生成モデルは、レンダリングのたびに、フレーム1枚ごとにトークンと計算資源を使い、しかも毎回違うものを描く。コードは、それを一度だけ使う。47秒のフィルムはたった1本のプログラムで、一度書けば1,410フレームすべてとステレオのフルスコアを、どんなサイズでも、どんなマシンでも、実行するたびに無料でレンダリングしてくれる。計算すると、最初の一回にかかるのはフレームあたりコード約60トークン分で、それ以降は毎回ゼロ。一枚絵ならほんの数百行。画像のファミリー全体でも、必要なのはシード値のリストだけだ。

## はじめる

anidoodleはエージェントスキル。トップに`SKILL.md`を置いた、ひとつのフォルダだけで完結している。Claude Codeなら、スキルフォルダにクローンすればいい:

```bash
git clone https://github.com/alexgreensh/anidoodle ~/.claude/skills/anidoodle
```

あとは欲しいものを言葉で伝えるだけ。たとえば「レシピページ用に、鉛筆と水彩で洋梨を描いて」というように。エンジンを直接動かしたいときは:

```bash
node ~/.claude/skills/anidoodle/engine/tools/scaffold.mjs ~/art --still hero --film intro
cd ~/art && npm install && npx playwright-core install chromium

node tools/still.mjs  hero  --out out/hero.png --scale 2   # a finished illustration, print size
node tools/render.mjs intro --out out/intro.gif            # a loop; also .mp4 with score, .webm with alpha
node tools/emit.mjs   intro --out out/intro.html           # the whole piece as one offline file
node tools/gate.mjs   hero                                 # determinism, contract and dead air in one pass
```

Node 20以降が必要。一枚絵なら上記のブラウザだけで足りるが、動くものにはすべて`ffmpeg`も使う。

`emit`は、およそ100KBのHTMLファイルをひとつ書き出す。ダブルクリックすればオフラインのまま、音声付きで再生できる。中にレシピそのものが入っていて、開くたびにすべてをゼロから描き直す。メールに添付すれば、それだけでスタジオを一本まるごと送ったことになる。

4つのバックエンドがひとつのアートコアを共有していて、コア自身はどのバックエンドが描いているのか知らないまま、のんびり構えている: `playwright`、`html-player`、`remotion`、`hyperframes`。

## サンプルのショートフィルム

`example/`には**Mechanical Lepidoptera(機械仕掛けの鱗翅目)**が入っている。1,410フレーム、47秒、自ら製図されていくぜんまい仕掛けの蝶が、水彩の中で命を得て、草の上に自分の設計図を残していく。これはエンジンのすべてが詰まった一作だ。実際の解剖学的構造の上に手で置かれた制御点、1ピクセルが依存するすべての入力に名前をつけるキャッシュキー、レシピから組み立てられたスコア、そして「組み立てられた状態」から「命を得た状態」へと途切れなく移り変わる動き。9枚のスタイルプレートは`engine/src/canvas-core/`にエンジンと並んで置かれていて、それぞれの先頭にレシピが書かれている。どれでも開いて、数字をひとつ変えて、何が動くか見てみてほしい。

## 正直に設計されている

音と動きは、言った通りであることを自分で証明する。スコアや動きについてのどんな主張の裏にも、計測か、人の目による確認のどちらかがある。緑のチェックマークは、再実行して初めてカウントされる。この規律があるからこそ、同じ作品が、どのマシンでも、毎回バイト単位でそのまま戻ってくる。

---

[Apache License 2.0](LICENSE)のもとで公開。Copyright 2026 Alex Greenshpun.

<sub>anidoodleで制作。その知識はすべて、あの蝶を何度か正直に描いてみることで身につけた。</sub>
