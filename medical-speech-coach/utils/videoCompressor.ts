import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

// 设置ffmpeg路径 - 修复路径问题
console.log('ffmpeg安装路径:', ffmpegInstaller.path)
console.log('ffmpeg安装目录:', join(process.cwd(), 'node_modules', '@ffmpeg-installer', 'ffmpeg'))
console.log('ffmpeg可执行文件:', ffmpegInstaller.path)

// 尝试多种路径设置方法
try {
  // 方法1：使用path（主要方法）
  if (ffmpegInstaller.path) {
    ffmpeg.setFfmpegPath(ffmpegInstaller.path)
    console.log('✅ 使用path设置成功:', ffmpegInstaller.path)
  }
  // 方法2：使用darwin-arm64路径
  else {
    const darwinArm64Path = join(process.cwd(), 'node_modules', '.pnpm', '@ffmpeg-installer+darwin-arm64@4.1.5', 'node_modules', '@ffmpeg-installer', 'darwin-arm64', 'ffmpeg')
    ffmpeg.setFfmpegPath(darwinArm64Path)
    console.log('✅ 使用darwin-arm64路径设置成功:', darwinArm64Path)
  }
} catch (error) {
  console.error('❌ ffmpeg路径设置失败:', error)
  // 尝试使用系统ffmpeg
  try {
    ffmpeg.setFfmpegPath('ffmpeg')
    console.log('✅ 使用系统ffmpeg设置成功')
  } catch (sysError) {
    console.error('❌ 系统ffmpeg也不可用:', sysError)
  }
}

// 压缩配置
const COMPRESSION_CONFIG = {
  maxSizeMB: 50, // 目标大小：50MB（低于52MB限制）
  targetBitrate: '800k', // 目标比特率
  maxWidth: 1280, // 最大宽度
  maxHeight: 720, // 最大高度
  fps: 25, // 帧率
  audioBitrate: '128k' // 音频比特率
}

// 获取文件大小（MB）
function getFileSizeMB(buffer: Buffer): number {
  return buffer.length / (1024 * 1024)
}

// 生成临时文件路径
function getTempFilePath(prefix: string, extension: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  return join(tmpdir(), `${prefix}_${timestamp}_${random}.${extension}`)
}

// 视频压缩主函数
export async function compressVideo(
  inputBuffer: Buffer, 
  originalFileName: string, 
  targetSizeMB: number = COMPRESSION_CONFIG.maxSizeMB
): Promise<{
  buffer: Buffer
  fileName: string
  compressed: boolean
  originalSize: number
  compressedSize: number
}> {
  
  console.log('开始视频压缩...')
  console.log('原始文件大小:', getFileSizeMB(inputBuffer).toFixed(2), 'MB')
  console.log('目标大小:', targetSizeMB, 'MB')
  
  const originalSize = getFileSizeMB(inputBuffer)
  
  // 如果文件已经足够小，直接返回
  if (originalSize <= targetSizeMB) {
    console.log('文件无需压缩')
    return {
      buffer: inputBuffer,
      fileName: originalFileName,
      compressed: false,
      originalSize,
      compressedSize: originalSize
    }
  }
  
  try {
    // 生成临时文件路径
    const inputPath = getTempFilePath('input', originalFileName.split('.').pop() || 'mp4')
    const outputPath = getTempFilePath('output', 'mp4')
    
    console.log('临时文件路径:', { inputPath, outputPath })
    
    // 写入输入文件
    await writeFile(inputPath, inputBuffer)
    console.log('输入文件写入完成')
    
    // 执行压缩
    const compressedBuffer = await new Promise<Buffer>((resolve, reject) => {
      const ffmpegCommand = ffmpeg(inputPath)
        .inputOptions(['-y']) // 覆盖输出文件
        .videoCodec('libx264') // 使用H.264编码
        .audioCodec('aac') // 使用AAC音频编码
        .size(`${COMPRESSION_CONFIG.maxWidth}x${COMPRESSION_CONFIG.maxHeight}`) // 限制分辨率
        .videoBitrate(COMPRESSION_CONFIG.targetBitrate) // 设置视频比特率
        .audioBitrate(COMPRESSION_CONFIG.audioBitrate) // 设置音频比特率
        .fps(COMPRESSION_CONFIG.fps) // 设置帧率
        .outputOptions([
          '-preset', 'medium', // 压缩预设
          '-crf', '23', // 恒定质量因子
          '-movflags', '+faststart', // 优化网络播放
          '-pix_fmt', 'yuv420p' // 像素格式
        ])
        .on('start', (commandLine) => {
          console.log('FFmpeg命令:', commandLine)
        })
        .on('progress', (progress) => {
          console.log('压缩进度:', progress.percent, '%')
        })
        .on('end', async () => {
          try {
            console.log('压缩完成，读取输出文件...')
            const fs = await import('fs/promises')
            const outputBuffer = await fs.readFile(outputPath)
            resolve(outputBuffer)
          } catch (readError) {
            reject(new Error(`读取压缩文件失败: ${readError}`))
          }
        })
        .on('error', (err) => {
          reject(new Error(`FFmpeg压缩失败: ${err.message}`))
        })
        .save(outputPath)
      
      // 添加超时处理
      setTimeout(() => {
        if (ffmpegCommand) {
          ffmpegCommand.kill('SIGKILL')
          reject(new Error('压缩超时'))
        }
      }, 300000) // 5分钟超时
    })
    
    // 清理临时文件
    try {
      await unlink(inputPath)
      await unlink(outputPath)
      console.log('临时文件清理完成')
    } catch (cleanupError) {
      console.warn('临时文件清理失败:', cleanupError)
    }
    
    const compressedSize = getFileSizeMB(compressedBuffer)
    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1)
    
    console.log('压缩完成!')
    console.log('原始大小:', originalSize.toFixed(2), 'MB')
    console.log('压缩后大小:', compressedSize.toFixed(2), 'MB')
    console.log('压缩率:', compressionRatio, '%')
    
    // 生成新的文件名
    const nameWithoutExt = originalFileName.split('.').slice(0, -1).join('.')
    const extension = originalFileName.split('.').pop()
    const compressedFileName = `${nameWithoutExt}_compressed.${extension}`
    
    return {
      buffer: compressedBuffer,
      fileName: compressedFileName,
      compressed: true,
      originalSize,
      compressedSize
    }
    
  } catch (error) {
    console.error('视频压缩失败:', error)
    
    // 压缩失败时，返回原文件
    console.log('返回原始文件作为备用')
    return {
      buffer: inputBuffer,
      fileName: originalFileName,
      compressed: false,
      originalSize,
      compressedSize: originalSize
    }
  }
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
  
  const reduction = Math.round((fileSizeMB - COMPRESSION_CONFIG.maxSizeMB) / fileSizeMB * 100)
  return `建议压缩以减少 ${reduction}% 的文件大小，确保在52MB限制内`
}
