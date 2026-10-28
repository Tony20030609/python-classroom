# Python 中文离线课堂 · Module 1

网址：https://tony20030609.github.io/python-classroom/

在普通浏览器中编辑和运行 Python，无需安装 Python 或使用 ChatGPT。

第一次联网打开网站，等待“离线课堂已就绪”，之后可在同一浏览器中离线使用。清除站点数据后需要重新联网准备。

## 内容与功能

- 已导入第 4、6、7、8、9 课，共 177 个单元：98 个中文说明、79 个保持原文的 Python 代码单元。
- 左侧切换课程，各课分别保存编辑；切课会重新启动 Python，变量和输出不会混入另一课。
- Shift+Enter 运行并进入下一单元；Ctrl/Command+Enter 运行当前单元。
- 共享 Python 变量、显示输出与真实错误，支持停止并重启。
- 练习仅保存在各自浏览器，支持导出 Notebook。

原课的语法错误和待填空代码属于教学练习，初始代码有意保留。原课提及的视频和在线聊天机器人不包含在此版本中。目录仅保留已完成的 5 门课程。

第 9 课为明确标注的“离线提示词预览”：运行原代码后显示变量拼接的完整提示词，不调用大模型。实际 AI 答复需要复制提示词到联网的 AI 服务生成。`course/helper_functions.py` 是本项目独立编写的预览兼容模块。

## 发布与维护

此仓库为经过构建的静态网站，GitHub Pages 使用 main 分支根目录发布。index.html 必须位于根目录，.nojekyll 用于按原样发布静态文件。

offline-manifest.json 记录每项离线资源的大小与 SHA-256。更新网站资源时，需同步重新生成离线清单，避免缓存校验失败。

课程来源：[DeepLearning.AI · Running your first program](https://learn.deeplearning.ai/courses/ai-python-for-beginners/lesson/fkmqy/running-your-first-program)。本项目为学习用途的中文本地化页面，不代表原课程官方产品。

运行时使用 Pyodide 0.27.7，随附 runtime/LICENSE；其他组件见 THIRD_PARTY_NOTICES.md。
