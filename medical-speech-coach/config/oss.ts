import OSS from 'ali-oss'

// 阿里云OSS配置
export const OSS_CONFIG = {
  region: process.env.ALIYUN_OSS_REGION || 'oss-cn-hangzhou',
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || '',
  bucket: process.env.ALIYUN_OSS_BUCKET || '',
  endpoint: process.env.ALIYUN_OSS_ENDPOINT || '',
  secure: true, // 使用HTTPS
  timeout: 120000, // 超时时间2分钟
}

// 创建OSS客户端
export function createOSSClient() {
  if (!OSS_CONFIG.accessKeyId || !OSS_CONFIG.accessKeySecret || !OSS_CONFIG.bucket) {
    throw new Error('阿里云OSS配置不完整，请检查环境变量')
  }

  return new OSS({
    region: OSS_CONFIG.region,
    accessKeyId: OSS_CONFIG.accessKeyId,
    accessKeySecret: OSS_CONFIG.accessKeySecret,
    bucket: OSS_CONFIG.bucket,
    endpoint: OSS_CONFIG.endpoint,
    secure: OSS_CONFIG.secure,
    timeout: OSS_CONFIG.timeout,
  })
}

// 验证OSS配置
export function isOSSConfigured(): boolean {
  return !!(OSS_CONFIG.accessKeyId && OSS_CONFIG.accessKeySecret && OSS_CONFIG.bucket)
}

// 获取OSS配置状态
export function getOSSConfigStatus() {
  return {
    hasAccessKeyId: !!OSS_CONFIG.accessKeyId,
    hasAccessKeySecret: !!OSS_CONFIG.accessKeySecret,
    hasBucket: !!OSS_CONFIG.bucket,
    hasEndpoint: !!OSS_CONFIG.endpoint,
    isConfigured: isOSSConfigured(),
    region: OSS_CONFIG.region,
    secure: OSS_CONFIG.secure
  }
}

// 生成OSS文件URL
export function generateOSSFileURL(fileName: string): string {
  if (!OSS_CONFIG.bucket || !OSS_CONFIG.endpoint) {
    throw new Error('OSS配置不完整，无法生成文件URL')
  }
  
  // 移除endpoint中的协议前缀
  const cleanEndpoint = OSS_CONFIG.endpoint.replace(/^https?:\/\//, '')
  return `https://${OSS_CONFIG.bucket}.${cleanEndpoint}/${fileName}`
}
