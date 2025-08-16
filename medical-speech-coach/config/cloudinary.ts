import { v2 as cloudinary } from 'cloudinary'

// Cloudinary配置
export const CLOUDINARY_CONFIG = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
}

// 检查Cloudinary是否已配置
export function isCloudinaryConfigured(): boolean {
  return !!(CLOUDINARY_CONFIG.cloud_name && CLOUDINARY_CONFIG.api_key && CLOUDINARY_CONFIG.api_secret)
}

// 获取Cloudinary配置状态
export function getCloudinaryConfigStatus() {
  return {
    cloud_name: !!CLOUDINARY_CONFIG.cloud_name,
    api_key: !!CLOUDINARY_CONFIG.api_key,
    api_secret: !!CLOUDINARY_CONFIG.api_secret,
    fullyConfigured: isCloudinaryConfigured()
  }
}

// 配置Cloudinary客户端
export function configureCloudinary() {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary配置不完整')
  }
  
  cloudinary.config({
    cloud_name: CLOUDINARY_CONFIG.cloud_name,
    api_key: CLOUDINARY_CONFIG.api_key,
    api_secret: CLOUDINARY_CONFIG.api_secret,
  })
  
  return cloudinary
}

// 视频压缩配置
export const COMPRESSION_CONFIG = {
  maxSizeMB: 50, // 目标压缩大小
  quality: 'auto:low', // 自动质量优化
  format: 'mp4', // 输出格式
  codec: 'h264', // 视频编码
  audioCodec: 'aac', // 音频编码
  bitrate: '500k', // 目标比特率
  fps: 25, // 帧率
  width: 1280, // 最大宽度
  height: 720, // 最大高度
}

// 生成压缩后的视频URL
export function generateCompressedVideoURL(publicId: string, options: any = {}): string {
  const defaultOptions = {
    quality: COMPRESSION_CONFIG.quality,
    format: COMPRESSION_CONFIG.format,
    codec: COMPRESSION_CONFIG.codec,
    audio_codec: COMPRESSION_CONFIG.audioCodec,
    bit_rate: COMPRESSION_CONFIG.bitrate,
    fps: COMPRESSION_CONFIG.fps,
    width: COMPRESSION_CONFIG.width,
    height: COMPRESSION_CONFIG.height,
    crop: 'scale',
    ...options
  }
  
  return cloudinary.url(publicId, {
    resource_type: 'video',
    transformation: [
      { quality: defaultOptions.quality },
      { format: defaultOptions.format },
      { codec: defaultOptions.codec },
      { audio_codec: defaultOptions.audioCodec },
      { bit_rate: defaultOptions.bitrate },
      { fps: defaultOptions.fps },
      { width: defaultOptions.width, height: defaultOptions.height, crop: defaultOptions.crop }
    ]
  })
}
