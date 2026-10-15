name: Globe Diary

这是环游纪（Globe Diary）前端静态站点源码。

功能亮点：
- 手账编辑器（基于 Fabric.js）：添加照片、编辑文字、自由拼贴、缩放旋转
- 花边绘制：使用 Lace 图案笔刷进行手指绘制
- 贴纸素材（SVG）
- 世界地图（Leaflet）：添加旅行点并保存至本地
- 穿搭收藏、旅行记录、时间线回顾

如何预览

1. 直接在本地打开 index.html（建议使用本地静态服务器，以避免跨域问题）：
   - Python 3: python -m http.server 5173
   - 然后访问 http://localhost:5173

2. 或将仓库部署到 GitHub Pages（分支为 main）：在仓库设置中启用 Pages -> main / root。

说明
- 数据保存在浏览器 localStorage（示例原型用途）。
- 已实现核心可运行功能，适配手机屏幕和触屏操作。后续可扩展云端同步、导入导出更多素材等。
