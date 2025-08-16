import { OSS_CONFIG, isOSSConfigured, getOSSConfigStatus } from './oss'
import { isCloudinaryConfigured, getCloudinaryConfigStatus } from './cloudinary'

// Coze API 配置
export const COZE_CONFIG = {
  ACCESS_TOKEN: process.env.COZE_ACCESS_TOKEN || '',
  BOT_ID: process.env.COZE_BOT_ID || '',
  API_URL: 'https://api.coze.cn/v3/chat'
}

// 验证Coze配置是否完整
export const isCozeConfigured = (): boolean => {
  return !!(COZE_CONFIG.ACCESS_TOKEN && COZE_CONFIG.BOT_ID)
}

// 获取配置状态信息
export const getConfigStatus = () => ({
  hasAccessToken: !!COZE_CONFIG.ACCESS_TOKEN,
  hasBotId: !!COZE_CONFIG.BOT_ID,
  isConfigured: isCozeConfigured(),
  accessTokenPrefix: COZE_CONFIG.ACCESS_TOKEN ? `${COZE_CONFIG.ACCESS_TOKEN.substring(0, 10)}...` : '未配置',
  botId: COZE_CONFIG.BOT_ID || '未配置'
})

// 应用配置
export const APP_CONFIG = {
  NAME: process.env.NEXT_PUBLIC_APP_NAME || '医学演讲教练助手',
  MAX_FILE_SIZE: 500 * 1024 * 1024, // 500MB
  ALLOWED_VIDEO_TYPES: [
    'video/mp4',
    'video/avi', 
    'video/mov',
    'video/wmv',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-ms-wmv'
  ]
}

// 获取完整的系统配置状态
export const getSystemConfigStatus = () => {
  const cozeStatus = getConfigStatus()
  const ossStatus = require('./oss').getOSSConfigStatus()
  const cloudinaryStatus = require('./cloudinary').getCloudinaryConfigStatus()
  
  return {
    coze: cozeStatus,
    oss: ossStatus,
    cloudinary: cloudinaryStatus,
    overall: {
      cozeConfigured: cozeStatus.isConfigured,
      ossConfigured: ossStatus.isConfigured,
      cloudinaryConfigured: cloudinaryStatus.fullyConfigured,
      fullyConfigured: cozeStatus.isConfigured && (ossStatus.isConfigured || cloudinaryStatus.fullyConfigured)
    }
  }
}
