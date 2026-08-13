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

Supabase(Postgres + Auth)にデータを保存しています。メールのマジックリンクでログインすると、その端末・ブラウザに関わらずアカウントに紐づいたデータが見られます。ログインしていない状態では使えません。

データアクセスは Row Level Security (RLS) で自分のデータのみに制限されています。テーブル定義は [`supabase/schema.sql`](supabase/schema.sql) を参照してください。テーブル名は他アプリと同じSupabaseプロジェクトを共有する前提で `goal_tracker_` を接頭辞にしています。

`js/storage.js` の `LocalStorageRepository` は、以前ローカルにあったデータを初回ログイン時にSupabaseへ一括インポートするためだけに残しています(`js/main.js` 参照)。データの読み書きの本体は `js/server-repository.js` の `ServerRepository` です。どちらも以下の共通インターフェースを実装しています。

```
getActivities(): Promise<Activity[]>
addActivity({ name, color }): Promise<Activity>
deleteActivity(id): Promise<void>
getCompletions(): Promise<Record<activityId, string[]>>   // 'YYYY-MM-DD' の配列
setCompletion(activityId, dateStr, done): Promise<void>
toggleCompletion(activityId, dateStr): Promise<boolean>
```

## ファイル構成

```
index.html               画面構造(ログイン画面 + アプリ本体)
style.css                スタイル
js/supabase-config.js    Supabase プロジェクトURL・公開キー
js/auth.js               Supabase Auth(マジックリンク)まわり
js/storage.js            LocalStorageRepository(移行用に残置)
js/server-repository.js  ServerRepository(Supabase Postgresへの読み書き)
js/streaks.js            日付・連続日数の計算ロジック(ピュア関数)
js/app.js                画面描画とイベント処理
js/main.js               起動処理(認証ゲート・ローカルデータ移行)
supabase/schema.sql      テーブル定義・RLSポリシー
```
