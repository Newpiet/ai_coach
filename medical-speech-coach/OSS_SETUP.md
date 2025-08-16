# 阿里云OSS配置指南

## 1. 获取阿里云访问密钥

1. 登录阿里云控制台
2. 进入"访问控制" -> "用户" -> "创建用户"
3. 选择"编程访问"，创建AccessKey
4. 记录AccessKey ID和AccessKey Secret

## 2. 创建OSS Bucket

1. 进入"对象存储OSS" -> "Bucket列表"
2. 点击"创建Bucket"
3. 选择合适的地域（如：华东1-杭州）
4. 设置Bucket名称
5. 记录Bucket名称和地域信息

## 3. 配置环境变量

在项目根目录创建 `.env.local` 文件，添加以下配置：

```bash
# Coze API 配置
COZE_ACCESS_TOKEN=your_coze_access_token_here
COZE_BOT_ID=your_coze_bot_id_here

# 阿里云OSS配置
ALIYUN_ACCESS_KEY_ID=your_access_key_id_here
ALIYUN_ACCESS_KEY_SECRET=your_access_key_secret_here
ALIYUN_OSS_BUCKET=your_bucket_name_here
ALIYUN_OSS_REGION=oss-cn-hangzhou
ALIYUN_OSS_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com

# 应用配置
NEXT_PUBLIC_APP_NAME=医学演讲教练助手
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## 4. 配置说明

### OSS配置参数

- `ALIYUN_ACCESS_KEY_ID`: 阿里云访问密钥ID
- `ALIYUN_ACCESS_KEY_SECRET`: 阿里云访问密钥Secret
- `ALIYUN_OSS_BUCKET`: OSS存储桶名称
- `ALIYUN_OSS_REGION`: OSS地域（如：oss-cn-hangzhou）
- `ALIYUN_OSS_ENDPOINT`: OSS访问域名

### 地域对应关系

| 地域 | Region | Endpoint |
|------|--------|----------|
| 华东1-杭州 | oss-cn-hangzhou | https://oss-cn-hangzhou.aliyuncs.com |
| 华东2-上海 | oss-cn-shanghai | https://oss-cn-shanghai.aliyuncs.com |
| 华北1-青岛 | oss-cn-qingdao | https://oss-cn-qingdao.aliyuncs.com |
| 华北2-北京 | oss-cn-beijing | https://oss-cn-beijing.aliyuncs.com |
| 华北3-张家口 | oss-cn-zhangjiakou | https://oss-cn-zhangjiakou.aliyuncs.com |
| 华北5-呼和浩特 | oss-cn-huhehaote | https://oss-cn-huhehaote.aliyuncs.com |
| 华北6-乌兰察布 | oss-cn-wulanchabu | https://oss-cn-wulanchabu.aliyuncs.com |
| 华南1-深圳 | oss-cn-shenzhen | https://oss-cn-shenzhen.aliyuncs.com |
| 华南2-河源 | oss-cn-heyuan | https://oss-cn-heyuan.aliyuncs.com |
| 华南3-广州 | oss-cn-guangzhou | https://oss-cn-guangzhou.aliyuncs.com |

## 5. 权限配置

确保OSS用户具有以下权限：

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "oss:PutObject",
        "oss:GetObject",
        "oss:DeleteObject",
        "oss:ListObjects"
      ],
      "Resource": [
        "acs:oss:*:*:your-bucket-name/*"
      ]
    }
  ]
}
```

## 6. 测试配置

配置完成后，重启开发服务器，页面头部应该显示：

- ✅ API已配置（如果Coze和OSS都配置完成）
- ⚠️ API未配置（如果任一配置缺失）

## 7. 故障排除

### 常见问题

1. **AccessKey错误**: 检查AccessKey ID和Secret是否正确
2. **Bucket不存在**: 确认Bucket名称和地域是否正确
3. **权限不足**: 检查用户是否具有OSS操作权限
4. **网络问题**: 确认服务器能够访问阿里云OSS

### 调试方法

1. 查看浏览器控制台日志
2. 检查服务器端日志
3. 验证环境变量是否正确加载
4. 测试OSS连接是否正常

## 8. 安全建议

1. **不要提交敏感信息**: 确保 `.env.local` 文件已添加到 `.gitignore`
2. **使用最小权限**: 只授予必要的OSS操作权限
3. **定期轮换密钥**: 定期更新AccessKey
4. **监控访问日志**: 关注OSS访问日志，发现异常访问
