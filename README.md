# dsh-web-search

[中文](README.md) · [English](README.en.md)

[![npm version](https://img.shields.io/npm/v/dsh-web-search.svg)](https://www.npmjs.com/package/dsh-web-search)
[![License: MIT](https://img.shields.io/npm/l/dsh-web-search.svg)](https://opensource.org/licenses/MIT)
[![CI](https://img.shields.io/github/actions/workflow/status/haibinwang9/dsh-web-search/ci.yml)](https://github.com/haibinwang9/dsh-web-search/actions)

> **本插件移植自 [nicobailon/pi-web-access](https://github.com/nicobailon/pi-web-access)**（MIT），为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 适配：搜索回退链、DuckDuckGo 解析与正文提取逻辑源自该项目，网络层改用 Node 原生 `fetch`。感谢原作者。

## 它能做什么

**一个插件，补齐 DSH 的联网能力：**

- 🔍 **多引擎搜索自动回退** —— 接管内置 `web_search` 工具：SearXNG → Tavily → Brave → **DuckDuckGo 零配置兜底**，未配置的自动跳过，**一个 key 都不填也能搜**
- 📄 **URL 正文提取** —— `get_search_content` 工具：抓任意网页，HTML 自动转可读纯文本（优先正文区域、剔除脚本样式），JSON 美化输出，二进制内容明确提示
- 🎚️ **一键切换默认搜索引擎** —— 设置页开关：开 = 用本插件回退链，关 = 委托官方 DeepSeek 搜索
- 🛠️ **补齐 fetch seam** —— 注册搜索 + 抓取双 provider，内置 `web_fetch` 因此恢复可用
- ⚙️ **配置全部在设置页** —— 三个密钥（SearXNG / Tavily / Brave）写入 credentials 服务，卡片式管理，无需改配置文件

## 安装

**从 npm 安装（推荐）：**

```sh
dsh plugin --profile web add dsh-web-search
```

**从源码安装：**

```sh
git clone https://github.com/haibinwang9/dsh-web-search.git
cd dsh-web-search && dsh plugin --profile web add .
```

安装后重启 DSH，在 **设置 → 插件 → Web access** 里配置密钥/开关即可。

## 配置项

| 字段 | 凭证名 | 说明 |
|---|---|---|
| 使用本插件作为默认搜索引擎 | `PIWA_SEARCH_ENABLED` | 开 = 回退链；关 = 官方 DeepSeek 搜索 |
| SearXNG 地址 | `SEARXNG_BASE_URL` | 如 `https://search.example.com` |
| Tavily API Key | `TAVILY_API_KEY` | https://app.tavily.com 申请 |
| Brave API Key | `BRAVE_API_KEY` | https://brave.com/search/api/ 申请 |

取值优先级：环境变量 → harness credentials 服务（也可写 `~/.dsh/.credentials.yaml`）。

## 工具

| 工具 | 说明 |
|---|---|
| `web_search` | 内置搜索工具，由本插件回退链驱动 |
| `get_search_content` | 抓取 URL 并提取可读正文 |

## 工作原理

```
web_search ──▶ ctx.web.search() ──▶ 'web-access' provider
                                         │
                      PIWA_SEARCH_ENABLED? ── 是 ──▶ SearXNG → Tavily → Brave → DuckDuckGo
                                         │
                                         └── 否 ──▶ 官方 DeepSeek 搜索
```

## 许可证

MIT —— 搜索与正文提取逻辑改编自 [nicobailon/pi-web-access](https://github.com/nicobailon/pi-web-access)（MIT）。
