# 医学演讲教练助手

一个基于AI的医学演讲分析和改进工具，集成了Coze API进行智能分析。

## 功能特性

- 🎥 视频上传和预览
- 📁 本地文件存储
- 🤖 AI驱动的演讲分析
- 📊 详细的分析报告
- 📄 PDF报告下载
- 🎯 个性化改进建议

## 技术栈

- **前端**: Next.js 15, React 19, TypeScript
- **UI组件**: Radix UI, Tailwind CSS
- **AI服务**: Coze API
- **HTTP客户端**: Axios
- **文件存储**: 本地文件系统

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

创建 `.env.local` 文件并添加以下配置：

```env
# Coze API 配置
COZE_ACCESS_TOKEN=你的Coze访问令牌
COZE_BOT_ID=你的Coze机器人ID

# 应用配置
NEXT_PUBLIC_APP_NAME=医学演讲教练助手
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 3. 获取Coze API配置

1. 登录 [Coze平台](https://www.coze.cn)
2. 创建或选择一个机器人
3. 获取Access Token和Bot ID
4. 配置机器人的能力（视频分析、语音识别等）

### 4. 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000 查看应用。

## 文件上传功能

### 上传流程

1. **文件选择**: 用户选择本地视频文件
2. **文件验证**: 检查文件格式和大小
3. **文件上传**: 上传到服务器本地存储
4. **URL生成**: 生成可访问的文件URL
5. **AI分析**: 使用文件URL调用Coze API

### 支持的文件格式

- MP4 (.mp4)
- AVI (.avi)
- MOV (.mov)
- WMV (.wmv)

### 文件大小限制

- 最大文件大小: 500MB
- 自动文件验证
- 错误处理和用户提示

### 文件存储

- 存储位置: `public/uploads/`
- 文件命名: `video_时间戳_随机字符串.扩展名`
- 自动清理: 上传的文件会被.gitignore忽略

## API集成说明

### 文件上传API

```typescript
// POST /api/upload
const formData = new FormData()
formData.append('file', videoFile)

const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData
})

const result = await response.json()
// result.data.fileUrl - 可访问的文件URL
```

### Coze API配置

应用使用Coze API进行视频分析，需要配置以下参数：

```typescript
// config/api.ts
export const COZE_CONFIG = {
  ACCESS_TOKEN: process.env.COZE_ACCESS_TOKEN,
  BOT_ID: process.env.COZE_BOT_ID,
  API_URL: 'https://api.coze.cn/v3/chat'
}
```

### API调用流程

1. **文件上传**: 用户选择视频文件
2. **文件验证**: 检查文件格式和大小
3. **本地存储**: 保存到public/uploads目录
4. **URL生成**: 生成可访问的文件URL
5. **API调用**: 发送视频URL到Coze API
6. **结果解析**: 解析AI分析结果
7. **报告生成**: 生成结构化的分析报告

### 示例API调用

```javascript
// 前端调用
const response = await fetch('/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    videoUrl: 'http://localhost:3000/uploads/video_123456.mp4',
    userId: 'user_123'
  })
})

const result = await response.json()
```

## 文件结构

```
medical-speech-coach/
├── app/
│   ├── api/
│   │   ├── analyze/route.ts    # Coze API集成
│   │   └── upload/route.ts     # 文件上传API
│   ├── page.tsx                # 主页面
│   └── layout.tsx              # 布局组件
├── components/ui/              # UI组件
├── config/api.ts              # API配置
├── public/uploads/            # 上传文件存储
└── README.md                  # 说明文档
```

## 开发说明

### 添加新的分析维度

1. 更新 `AnalysisReport` 接口
2. 修改Coze API的提示词
3. 更新前端显示逻辑

### 错误处理

应用包含完整的错误处理机制：
- 文件验证错误
- 上传失败处理
- API调用错误
- 网络连接错误
- 备用模拟数据

### 性能优化

- 文件大小限制（500MB）
- 支持的文件格式验证
- 异步文件上传
- 进度显示
- 本地文件存储

### 安全考虑

- 文件类型验证
- 文件大小限制
- 唯一文件名生成
- 上传目录权限控制

## 部署

### Vercel部署

1. 推送代码到GitHub
2. 在Vercel中导入项目
3. 配置环境变量
4. 部署

### 环境变量配置

确保在生产环境中正确配置：
- `COZE_ACCESS_TOKEN`
- `COZE_BOT_ID`
- `NEXT_PUBLIC_BASE_URL`

### 文件存储配置

对于生产环境，建议：
1. 使用云存储服务（如AWS S3、阿里云OSS）
2. 配置CDN加速
3. 实现文件自动清理
4. 添加文件访问权限控制

## 故障排除

### 常见问题

1. **文件上传失败**: 检查文件格式和大小
2. **API调用失败**: 检查Access Token和Bot ID
3. **文件访问失败**: 检查uploads目录权限
4. **分析结果为空**: 检查Coze机器人配置

### 调试模式

启用调试日志：
```typescript
console.log('文件上传详情:', { fileName, fileSize, fileUrl })
console.log('API调用详情:', { url, botId, videoUrl })
```

## 贡献

欢迎提交Issue和Pull Request来改进项目。

## 许可证

MIT License
