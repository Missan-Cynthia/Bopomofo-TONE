# 消防車注音救援 V1.0

手機可開啟 [GitHub Pages 測試版](https://missan-cynthia.github.io/Bopomofo-TONE/public/)。測試版在該裝置保留錄音及作答，無須登入。從同一個網址開啟並安裝到主畫面即可測 PWA。

在專案資料夾執行 `node serve.js`，用電腦 Chrome 或 Edge 開啟 [本機遊戲](http://localhost:4173/)。網頁可直接從 `public/` 提供，無須建置。自動測試使用 `node --test`。

## 匯入、錄音與救援

1. 打開「教材錄音」，貼上或挑選 UTF-8 文字清單。也能用「帶入注音符號一覽表」載入同工作區的教育部參考清單，再確認匯入。清單初始為空。
2. 使用媽媽錄音模式，錄製、試聽並確認儲存任一筆。錄音最長 8 秒，存成單聲道 24 kHz WAV。開啟遊戲即可用該錄音。
3. 錄好哥哥音源後，由媽媽在哥哥錄音模式試聽並驗收。驗收後遊戲優先用哥哥的音源。可切回媽媽或退回重錄。
4. 開始救援。預設五處火焰，可在 `public/core.js` 的 `settings.fires` 調整。聽題目時若瀏覽器要求手動播放，點「聽題目」即可。中途回首頁時，已儲存的作答仍可在學習紀錄看到。

匯入保留四聲項目的原順序，略過輕聲並合併重複項。替換清單會保留已存錄音及紀錄。缺少的聲調在教材頁標為「清單未收錄」。四個遊戲按鈕是當題拼音的聲調選擇，題庫、錄音與紀錄只使用匯入的項目。

## 本機與 Firebase

目前使用 `enlightenment-2` 的 Firebase Web App 設定。若要獨立測試本機模式，可把 `public/cloud-config.js` 的匯出值改為 `null`。本機模式使用同網址瀏覽器的 IndexedDB，與 Firebase 分開保存。

1. 在 Firebase Console 確認 Email/Password Authentication、Cloud Firestore 與 Cloud Storage 已啟用，並建立家庭使用者。Firebase 模式需連線存取資料。
2. 這是既有 KidsTube 使用的 Firebase 專案。Firestore 教材使用 `bopomofoTone`，Storage 錄音使用 `bopomofo-tone/`。將 `firestore.rules` 和 `storage.rules` 中內層的專用 `match` 區塊合併進線上現有規則。檢查有無涵蓋新路徑的寬鬆萬用規則，再用兩個 UID 測試。錄音透過登入後的 SDK 讀取。
3. `.firebaserc` 已將 Hosting 部署目標 `bopomofo-tone` 指向 `bopomofotone`。將 `bopomofotone.firebaseapp.com`、`bopomofotone.web.app` 加入 Authentication 授權網域。將 `cors.json` 中的網域合併進 Storage bucket 現有 CORS 設定，再套用合併後的結果，供瀏覽器以 `getBlob()` 讀取音檔。

```sh
firebase deploy --only hosting:bopomofo-tone --project enlightenment-2
```

共同登入一個家庭帳號的使用者共用教材和紀錄。媽媽或哥哥是錄音角色，驗收由使用家庭帳號的家長操作。連線到正式 Firebase 專案後，用兩個測試 UID 確認彼此不能讀取教材、音檔和作答，並驗證未登入的存取會遭拒。

- [Firebase Storage 瀏覽器下載與 CORS](https://firebase.google.com/docs/storage/web/download-files)
- [Firebase 資料存取規則](https://firebase.google.com/docs/rules/basics)

## 平板安裝及實機驗收

部署 `public/` 到同一個 HTTPS 網站後，直接開啟實際 App 網址。本機電腦可用 localhost 錄音，平板驗收需用 HTTPS。

- Android Chrome 使用頁面「安裝遊戲」或 Chrome 的安裝選項。參考同工作區 KidsTube 的配置，manifest 用相同相對目錄的 identity、start URL 及 scope，採 standalone、192/512 PNG 圖示，Service Worker 在相同目錄註冊。從主畫面開啟確認為獨立視窗。
- iPad Safari 使用分享選單的「加入主畫面」，若顯示「開啟為網頁 App」則啟用，從圖示開啟。[Apple iPad 操作說明](https://support.apple.com/en-mz/guide/ipad/ipad8f1f7a29/ipados)
- 兩台各測一遍匯入、拒絕/允許麥克風、錄製兩個音源、試聽、重錄、驗收後改用哥哥、切回媽媽、橫向觸控、答錯重播、五題完成、關閉重開後的錄音及作答。若使用 Firebase，另外測 Android 與 iPad 互相播放對方裝置錄製的音檔。
