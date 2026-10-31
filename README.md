# Nomi 糯米

Nomi 糯米 是一个基于 [DS Bot](https://github.com/Fei2411/DS-Bot) 和 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的桌面 AI 助手项目。当前版本为 **0.1**，仍在开发中。

## 功能

- 创建和管理多个 Bot，为它们选择头像、模型和工作文件夹。
- 与 Bot 单独对话，或通过群聊协作。
- 在对话中添加文件和图片，并管理 Bot 记忆。
- 使用桌面应用界面调整 Bot、模型及相关设置。

模型能力和文件处理效果取决于所配置的模型及服务。请自行配置模型账号或 API 密钥；不要将凭证、聊天记录或个人数据提交到仓库。

## 运行和开发

桌面壳位于 [`app/`](app/)，Bot 插件位于 [`ds-bot/`](ds-bot/)。构建说明参见 [桌面应用文档](app/README.md)和[插件文档](ds-bot/README.md)。

本仓库尚未发布可下载的 Nomi 糯米 安装包。上游平台和安装说明不代表 Nomi 糯米 版本已经在所有平台验证。

## 致谢与许可

本项目基于 [DS Bot](https://github.com/Fei2411/DS-Bot) 开发。头像使用 [blob-avatar](https://github.com/c0le0ni/blob-avatar) 等开源项目的代码。相关版权、许可证及其他第三方说明见 [NOTICE](NOTICE)、[LICENSE](LICENSE) 和各组件内的许可证。原项目说明保留在 [README.upstream.md](README.upstream.md)。
