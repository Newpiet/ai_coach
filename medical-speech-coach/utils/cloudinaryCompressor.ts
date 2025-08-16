import { v2 as cloudinary } from 'cloudinary'
import { configureCloudinary, COMPRESSION_CONFIG } from '@/config/cloudinary'

// 视频压缩结果接口
export interface CompressionResult {
  success: boolean
  originalSize: number
  compressedSize?: number
  originalUrl: string
  compressedUrl?: string
  publicId?: string
  error?: string
}

// 检查是否需要压缩
export function needsCompression(fileSizeMB: number): boolean {
  return fileSizeMB > COMPRESSION_CONFIG.maxSizeMB
}

// 获取压缩建议
export function getCompressionAdvice(fileSizeMB: number): string {
  if (fileSizeMB <= COMPRESSION_CONFIG.maxSizeMB) {
    return '文件大小符合要求，无需压缩'
  }
  
  const reduction = ((fileSizeMB - COMPRESSION_CONFIG.maxSizeMB) / fileSizeMB * 100).toFixed(1)
  return `文件大小 ${fileSizeMB.toFixed(2)}MB 超过 ${COMPRESSION_CONFIG.maxSizeMB}MB 限制，建议压缩 ${reduction}% 以上`
}

// 使用Cloudinary压缩视频
export async function compressVideoWithCloudinary(
  fileBuffer: Buffer, 
  fileName: string, 
  targetSizeMB: number = COMPRESSION_CONFIG.maxSizeMB
): Promise<CompressionResult> {
  try {
    console.log('开始Cloudinary视频压缩...')
    
    // 配置Cloudinary
    const cloudinaryInstance = configureCloudinary()
    
    // 生成唯一的public_id
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const publicId = `medical-speech-coach/videos/${timestamp}_${randomString}`
    
    console.log('上传原始视频到Cloudinary...')
    
    // 上传原始视频
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinaryInstance.uploader.upload_stream(
        {
          resource_type: 'video',
          public_id: publicId,
          folder: 'medical-speech-coach/videos',
          overwrite: false,
          resource_options: {
            type: 'upload'
          }
        },
        (error, result) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        }
      ).end(fileBuffer)
    })
    
    if (!uploadResult || !uploadResult.public_id) {
      throw new Error('Cloudinary上传失败')
    }
    
    console.log('原始视频上传成功，开始压缩...')
    
    // 生成压缩后的视频URL
    const compressedUrl = cloudinaryInstance.url(uploadResult.public_id, {
      resource_type: 'video',
      transformation: [
        { quality: 'auto:low' }, // 自动质量优化
        { format: 'mp4' }, // 输出格式
        { codec: 'h264' }, // 视频编码
        { audio_codec: 'aac' }, // 音频编码
        { bit_rate: '500k' }, // 目标比特率
        { fps: 25 }, // 帧率
        { width: 1280, height: 720, crop: 'scale' }, // 尺寸限制
        { fetch_format: 'mp4' } // 强制MP4格式
      ]
    })
    
    console.log('视频压缩完成')
    
    return {
      success: true,
      originalSize: fileBuffer.length / (1024 * 1024),
      compressedSize: targetSizeMB, // 预估压缩后大小
      originalUrl: uploadResult.secure_url || uploadResult.url,
      compressedUrl: compressedUrl,
      publicId: uploadResult.public_id
    }
    
  } catch (error) {
    console.error('Cloudinary视频压缩失败:', error)
    
    return {
      success: false,
      originalSize: fileBuffer.length / (1024 * 1024),
      originalUrl: '',
      error: error instanceof Error ? error.message : '未知错误'
    }
  }
}

// 获取压缩后的视频信息
export async function getCompressedVideoInfo(publicId: string): Promise<any> {
  try {
    const cloudinaryInstance = configureCloudinary()
    
    const result = await cloudinaryInstance.api.resource(publicId, publicId, {
      resource_type: 'video',
      type: 'upload'
    })
    
    return {
      public_id: result.public_id,
      format: result.format,
      size: result.bytes,
      duration: result.duration,
      width: result.width,
      height: result.height,
      url: result.secure_url || result.url
    }
  } catch (error) {
    console.error('获取压缩视频信息失败:', error)
    throw error
  }
}

// 删除Cloudinary上的视频
export async function deleteCloudinaryVideo(publicId: string): Promise<boolean> {
  try {
    const cloudinaryInstance = configureCloudinary()
    
    await cloudinaryInstance.uploader.destroy(publicId, {
      resource_type: 'video'
    })
    
    console.log('Cloudinary视频删除成功:', publicId)
    return true
  } catch (error) {
    console.error('Cloudinary视频删除失败:', error)
    return false
  }
}
