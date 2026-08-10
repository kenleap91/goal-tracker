# 目標トラッカー (goal-tracker)

シンプルな目標・習慣管理アプリ。日々の達成をチェックし、連続達成日数(ストリーク)や過去の記録をカレンダーで確認できます。

## 使い方

ビルド不要です。`index.html` をブラウザで開くだけで動きます。ローカルサーバー経由で開く場合は、例えば:

```
python3 -m http.server 8000
```

を実行して `http://localhost:8000/` を開いてください。

## 機能

- **記録タブ**: その日の目標一覧。チェックで達成をマークすると、連続達成日数(🔥バッジ)がその場で更新されます。日付を移動して過去の記録も編集できます。
- **カレンダータブ**: 月間カレンダーに達成した目標を色付きドットで表示。日付をタップするとその日に達成した目標の一覧が見られます。
- **統計タブ**: 目標ごとの「現在の連続日数」「最長記録」「合計達成日数」を一覧表示します。

## データの保存場所

現在はブラウザの `localStorage` にデータを保存しています。**同じブラウザ・同じ端末でのみ**データが残り、ブラウザのキャッシュ/データを消去すると失われます。

## サーバーへの移行方法

データの読み書きは `js/storage.js` の1ファイルに集約されています。`LocalStorageRepository` が実装している以下のインターフェースを、サーバーAPIを呼ぶ実装(例: `ServerRepository`、内部で `fetch()` を使う)に差し替えれば、UI側 (`js/app.js`) は一切変更せずにサーバー保存へ移行できます。

```
getActivities(): Promise<Activity[]>
addActivity({ name, color }): Promise<Activity>
deleteActivity(id): Promise<void>
getCompletions(): Promise<Record<activityId, string[]>>   // 'YYYY-MM-DD' の配列
setCompletion(activityId, dateStr, done): Promise<void>
toggleCompletion(activityId, dateStr): Promise<boolean>
```

移行する際は `js/storage.js` 内の `createRepository()` が返すインスタンスを差し替えるだけです。

## ファイル構成

```
index.html       画面構造
style.css        スタイル
js/storage.js    データ保存層(localStorage / 将来のサーバー実装を切り替える場所)
js/streaks.js    日付・連続日数の計算ロジック(ピュア関数)
js/app.js        画面描画とイベント処理
js/main.js       起動処理
```
