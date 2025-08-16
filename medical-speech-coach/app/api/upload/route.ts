import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { createOSSClient, generateOSSFileURL, isOSSConfigured } from '@/config/oss'
// 暂时禁用视频压缩功能，直接上传
// import { compressVideoWithCloudinary, needsCompression, getCompressionAdvice } from '@/utils/cloudinaryCompressor'

// 配置上传目录（作为备用）
const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads')
const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB
const COZE_SIZE_LIMIT = 52 * 1024 * 1024 // Coze API限制：52MB

// 确保上传目录存在
async function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true })
  }
}

// 上传到OSS
async function uploadToOSS(file: File, fileName: string): Promise<string> {
  try {
    console.log('开始上传到OSS:', fileName)
    
    const client = createOSSClient()
    
    // 将文件转换为Buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    // 上传到OSS
    const result = await client.put(fileName, buffer, {
      headers: {
        'Content-Type': file.type,
        'Cache-Control': 'max-age=31536000', // 1年缓存
      }
    })
    
    console.log('OSS上传成功:', result.url)
    return result.url
    
  } catch (error) {
    console.error('OSS上传失败:', error)
    throw new Error(`OSS上传失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

// 本地备用上传
async function uploadToLocal(file: File, fileName: string): Promise<string> {
  try {
    console.log('使用本地备用上传:', fileName)
    
    await ensureUploadDir()
    const filePath = join(UPLOAD_DIR, fileName)
    
    // 将文件写入磁盘
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)
    
    // 生成本地URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const fileUrl = `${baseUrl}/uploads/${fileName}`
    
    console.log('本地上传成功:', fileUrl)
    return fileUrl
    
  } catch (error) {
    console.error('本地上传失败:', error)
    throw new Error(`本地上传失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== 开始处理文件上传请求 ===')
    
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      console.log('错误: 没有找到文件')
      return NextResponse.json(
        { success: false, error: '没有找到文件' },
        { status: 400 }
      )
    }

    console.log('文件信息:', {
      name: file.name,
      type: file.type,
      size: file.size,
      sizeMB: (file.size / (1024 * 1024)).toFixed(2) + 'MB'
    })

    // 验证文件类型
    const allowedTypes = [
      'video/mp4',
      'video/avi',
      'video/mov',
      'video/wmv',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-ms-wmv'
    ]

    if (!allowedTypes.includes(file.type)) {
      console.log('错误: 不支持的文件类型:', file.type)
      return NextResponse.json(
        { success: false, error: '不支持的文件类型' },
        { status: 400 }
      )
    }

    // 验证文件大小
    if (file.size > MAX_FILE_SIZE) {
      console.log('错误: 文件大小超过限制:', file.size)
      return NextResponse.json(
        { success: false, error: '文件大小超过限制' },
        { status: 400 }
      )
    }

    // 检查文件大小是否超过Coze限制
    const fileSizeMB = file.size / (1024 * 1024)
    const exceedsCozeLimit = fileSizeMB > 52
    
    if (exceedsCozeLimit) {
      console.log('警告: 文件超过Coze API限制，可能影响分析效果')
    }

    // 生成唯一文件名
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const fileExtension = file.name.split('.').pop()
    const fileName = `video_${timestamp}_${randomString}.${fileExtension}`

    let fileUrl: string
    let uploadMethod: string

    // 优先使用OSS，如果失败则使用本地备用
    if (isOSSConfigured()) {
      try {
        fileUrl = await uploadToOSS(file, fileName)
        uploadMethod = 'OSS'
      } catch (ossError) {
        console.warn('OSS上传失败，使用本地备用:', ossError)
        fileUrl = await uploadToLocal(file, fileName)
        uploadMethod = 'Local'
      }
    } else {
      console.log('OSS未配置，使用本地上传')
      fileUrl = await uploadToLocal(file, fileName)
      uploadMethod = 'Local'
    }

    console.log('文件上传成功:', {
      originalName: file.name,
      fileName: fileName,
      fileSize: file.size,
      fileUrl: fileUrl,
      uploadMethod: uploadMethod,
      exceedsCozeLimit: exceedsCozeLimit
    })

    return NextResponse.json({
      success: true,
      data: {
        fileName: fileName,
        originalName: file.name,
        fileSize: file.size,
        fileUrl: fileUrl,
        uploadMethod: uploadMethod,
        exceedsCozeLimit: exceedsCozeLimit,
        compressionAdvice: exceedsCozeLimit 
          ? `文件大小 ${fileSizeMB.toFixed(2)}MB 超过Coze API的52MB限制。建议：1. 使用较小的视频文件 2. 或者使用视频编辑软件手动压缩到52MB以下`
          : '文件大小符合要求'
      }
    })

  } catch (error) {
    console.error('=== 文件上传失败 ===')
    console.error('错误详情:', error)
    console.error('错误堆栈:', error instanceof Error ? error.stack : '无堆栈信息')
    
    return NextResponse.json(
      { 
        success: false, 
        error: '文件上传失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

// 配置API路由以支持大文件上传
export const config = {
  api: {
    bodyParser: false,
  },
}
