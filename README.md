# Globe Diary — 云同步 & 全屏 iPhone 版本

在已有原型基础上，我���为项目加入了可选的 Firebase 云同步与登录示例，并对界面进行了 iPhone 全屏视觉适配。

主要新增
- Firebase 登录（Google / 邮箱）和 Firestore 同步（pages / markers / outfits）
- 在 UI 顶部增加了登录与同步按钮
- 更大的 iPhone 全屏样式（safe-area、独立 tab 栏、圆角卡片、毛玻璃导航）
- manifest.json，支持添加到主屏幕

重要：为了启用云同步，你需要创建自己的 Firebase 项目并把配置信息填到 `app-cloud.js` 的 firebaseConfig 中（见下面步骤）。

本地运行（与之前相同）

1. 拉取仓库并进入目录
2. 启动本地静态服务器，例如：
   - Python: `python -m http.server 5173`
   - Node: `npx serve` 或 `npm i -g serve` 然后 `serve .`
3. 在浏览器打开 `http://localhost:5173`

启用 Firebase 云同步步骤

1. 前往 https://console.firebase.google.com/ 创建一个项目（免费层足够）
2. 在项目设置 -> 添加 Web 应用，记下 firebaseConfig（apiKey, authDomain, projectId ...）
3. 在 Firestore 中启用数据库（建议测试环境选择測试模式，但上线前请设置正确的规则）
4. 在 Authentication -> 登录方法，启用 Google 与 Email/Password
5. 打开 `app-cloud.js`，替换顶部的 firebaseConfig
6. 重新��本地打开页面，点击右上角用户按钮进行登录

安全与规则建议

- Firestore 测试模式会允许任何人读写；上线前请在 Rules 中按 `request.auth.uid` 限制每个用户只能访问自己的数据，例如：

  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }

部署建议

- 若使用 GitHub Pages：直接在仓库 Pages 中开启 main 分支 / root。注意 Firebase Auth 的 redirect 可能需要配置授权域。
- 若使用 Firebase Hosting：可以直接 `firebase init hosting`，选择此目录， `firebase deploy`。
- 也可部署到 Vercel/Netlify。

后续改进（可选）

- 将前端迁移到 React + Vite，提高可维护性
- 优化同步冲突解决（当前策略为简单合并）
- 支持图片到 Firebase Storage（当前以 DataURL 存储到 Firestore / localStorage，适合原型，小项目）
- 添加离线/同步状态指示与同步队列

如果你希望，我可以：
- 立即把 Firestore Security Rules 示例写入并推到仓库；
- 把项目迁移到 React + Vite，并配置 Firebase 环境变量与 CI/CD（Vercel/Netlify）部署示例；
- 实现图片上传到 Firebase Storage 并更新 outfits/pages 引用。
