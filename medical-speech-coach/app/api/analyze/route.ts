import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { COZE_CONFIG, isCozeConfigured, getConfigStatus } from '@/config/api'

interface AnalysisRequest {
  videoUrl: string
  userId: string
}

interface AnalysisResponse {
  success: boolean
  data?: any
  error?: string
}

// 清理和结构化AI返回内容的函数
function cleanAndStructureContent(rawContent: string): { downloadLink: string; analysisContent: string } {
  console.log('开始清理和结构化AI返回内容')
  console.log('原始内容长度:', rawContent.length)
  console.log('原始内容前500字符:', rawContent.substring(0, 500))
  
  // 查找"下载链接："的位置
  const downloadLinkIndex = rawContent.indexOf('下载链接：')
  
  if (downloadLinkIndex === -1) {
    console.log('未找到"下载链接："标记，返回原始内容')
    return {
      downloadLink: '',
      analysisContent: rawContent
    }
  }
  
  // 提取下载链接和后面的内容
  const contentAfterDownloadLink = rawContent.substring(downloadLinkIndex)
  
  // 分离下载链接和分析内容
  const lines = contentAfterDownloadLink.split('\n')
  let downloadLink = ''
  let analysisContent = ''
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    if (line.startsWith('下载链接：')) {
      // 提取下载链接
      downloadLink = line.replace('下载链接：', '').trim()
      console.log('提取到下载链接:', downloadLink)
      
      // 从下一行开始收集分析内容
      for (let j = i + 1; j < lines.length; j++) {
        analysisContent += lines[j] + '\n'
      }
      break
    }
  }
  
  // 清理分析内容（去除首尾空白）
  analysisContent = analysisContent.trim()
  
  console.log('结构化提取完成:')
  console.log('- 下载链接长度:', downloadLink.length)
  console.log('- 分析内容长度:', analysisContent.length)
  console.log('- 分析内容前200字符:', analysisContent.substring(0, 200))
  
  return {
    downloadLink,
    analysisContent
  }
}

// 解析SSE流式响应的函数
function parseSSEResponse(sseData: string): string {
  console.log('开始解析SSE响应，原始数据长度:', sseData.length)
  
  const lines = sseData.split('\n')
  console.log('SSE响应行数:', lines.length)
  
  let fullContent = ''
  let dataLineCount = 0
  
  for (const line of lines) {
    if (line.startsWith('data:')) {
      dataLineCount++
      const data = line.substring(5).trim()
      console.log(`第${dataLineCount}行data:`, data.substring(0, 100) + (data.length > 100 ? '...' : ''))
      
      if (data && data !== '[DONE]') {
        try {
          const parsed = JSON.parse(data)
          if (parsed.content) {
            fullContent += parsed.content
            console.log('成功解析content字段，长度:', parsed.content.length)
          } else {
            console.log('该行没有content字段，完整内容:', JSON.stringify(parsed))
          }
        } catch (e) {
          console.log('该行不是JSON格式，直接添加内容:', data.substring(0, 100))
          // 如果不是JSON，直接添加内容
          if (data && !data.startsWith('{')) {
            fullContent += data
          }
        }
      } else if (data === '[DONE]') {
        console.log('收到[DONE]标记，SSE流结束')
      }
    }
  }
  
  console.log('SSE解析完成，总内容长度:', fullContent.length)
  console.log('前500字符:', fullContent.substring(0, 500))
  
  return fullContent
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== 开始处理分析请求 ===')
    
    const body: AnalysisRequest = await request.json()
    const { videoUrl, userId } = body

    console.log('请求参数详情:', { 
      videoUrl, 
      userId,
      videoUrlType: typeof videoUrl,
      videoUrlLength: videoUrl?.length || 0,
      hasVideoUrl: !!videoUrl,
      videoUrlTrimmed: videoUrl?.trim() || ''
    })

    if (!videoUrl) {
      console.log('错误: 缺少视频URL')
      return NextResponse.json(
        { success: false, error: '视频URL是必需的' },
        { status: 400 }
      )
    }

    if (videoUrl.trim() === '') {
      console.log('错误: 视频URL为空字符串')
      return NextResponse.json(
        { success: false, error: '视频URL不能为空' },
        { status: 400 }
      )
    }

    // 检查Coze配置
    const configStatus = getConfigStatus()
    console.log('Coze配置状态:', configStatus)

    if (!isCozeConfigured()) {
      console.log('错误: Coze配置不完整')
      return NextResponse.json(
        { 
          success: false, 
          error: 'Coze API配置不完整，请检查环境变量',
          configStatus 
        },
        { status: 500 }
      )
    }

    console.log('=== 准备调用Coze API ===')
    console.log('视频URL:', videoUrl)
    console.log('用户ID:', userId)

    // 检查视频URL是否可访问
    console.log('检查视频URL可访问性...')
    try {
      const urlCheckResponse = await fetch(videoUrl, { method: 'HEAD' })
      if (!urlCheckResponse.ok) {
        console.warn('警告: 视频URL可能无法访问:', videoUrl)
        console.warn('状态码:', urlCheckResponse.status)
        console.warn('这可能会影响Coze API的分析效果')
      } else {
        console.log('视频URL可访问性检查通过')
      }
    } catch (urlError) {
      console.warn('警告: 无法检查视频URL可访问性:', urlError)
      console.warn('这可能会影响Coze API的分析效果')
    }

    // 构造发送给 Coze 的消息
    const objectString = [
      { 
        type: 'text', 
        text: '请帮我分析这个医学演讲视频，并提供详细的分析和建议。请重点关注：1. 语速和语调 2. 专业术语使用 3. 逻辑结构 4. 时间控制 5. 具体改进建议。' 
      },
      { 
        type: 'file', 
        file_url: videoUrl 
      }
    ]

    console.log('发送到Coze的object_string:', JSON.stringify(objectString, null, 2))

    const cozeData = {
      "bot_id": COZE_CONFIG.BOT_ID,
      "user_id": userId || "123456789",
      "stream": true,
      "auto_save_history": true,
      "additional_messages": [
        {
          "role": "user",
          "content": JSON.stringify(objectString),
          "content_type": "object_string"
        }
      ]
    }

    const headers = {
      'Authorization': `Bearer ${COZE_CONFIG.ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    }

    console.log('准备调用Coze API:', {
      url: COZE_CONFIG.API_URL,
      botId: COZE_CONFIG.BOT_ID,
      videoUrl,
      headers: {
        'Authorization': `Bearer ${COZE_CONFIG.ACCESS_TOKEN.substring(0, 10)}...`,
        'Content-Type': 'application/json'
      }
    })

    console.log('发送到Coze的数据:', JSON.stringify(cozeData, null, 2))

    // 调用 Coze API
    console.log('开始调用Coze API...')
    const response = await axios.post(COZE_CONFIG.API_URL, cozeData, { 
      headers,
      responseType: 'text' // 确保接收文本格式的SSE响应
    })

    console.log('Coze API响应状态:', response.status)
    console.log('Coze API响应数据长度:', response.data.length)
    console.log('Coze API响应数据前500字符:', response.data.substring(0, 500))

    // 解析 SSE 响应
    const fullContent = parseSSEResponse(response.data)
    console.log('解析后的完整内容长度:', fullContent.length)
    console.log('解析后的内容前500字符:', fullContent.substring(0, 500))

    // 从Coze返回的内容中提取output对象
    let outputContent = fullContent
    
    try {
      // 尝试找到output字段的内容
      const outputMatch = fullContent.match(/"output":"([^"]+)"/)
      if (outputMatch && outputMatch[1]) {
        outputContent = outputMatch[1]
        console.log('成功提取output内容，长度:', outputContent.length)
      } else {
        console.log('未找到output字段，使用完整内容')
      }
    } catch (parseError) {
      console.error('提取output内容失败:', parseError)
      // 如果提取失败，使用完整内容
      outputContent = fullContent
    }

    // 使用新的结构化函数清理和整理内容
    const structuredContent = cleanAndStructureContent(outputContent)
    
    // 返回结构化的分析结果
    const analysisResult = {
      content: structuredContent.analysisContent,
      rawAnalysis: outputContent,
      downloadLink: structuredContent.downloadLink,
      structured: {
        downloadLink: structuredContent.downloadLink,
        analysisContent: structuredContent.analysisContent
      }
    }

    console.log('最终返回结果:', analysisResult)
    console.log('=== 分析请求处理完成 ===')

    return NextResponse.json({
      success: true,
      data: analysisResult
    })

  } catch (error) {
    console.error('=== 视频分析失败 ===')
    console.error('错误详情:', error)
    
    if (axios.isAxiosError(error)) {
      console.error('Axios错误详情:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      })
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Coze API 错误: ${error.response?.status} - ${error.response?.data?.message || error.message}`,
          details: {
            status: error.response?.status,
            data: error.response?.data
          }
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: false, error: '视频分析过程中发生错误' },
      { status: 500 }
    )
  }
}
