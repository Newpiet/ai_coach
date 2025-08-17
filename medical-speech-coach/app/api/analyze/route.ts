import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { COZE_CONFIG, isCozeConfigured, getConfigStatus } from '@/config/api'
import { cleanAndStructureContent, removeDuplicateContent } from '@/utils/textCleanup'

interface AnalysisRequest {
  videoUrl: string
  userId: string
  debug?: boolean
}

interface AnalysisResponse {
  success: boolean
  data?: any
  error?: string
}

// 清理/去重逻辑改为复用 utils/textCleanup 中的方法

// 解析SSE流式响应的函数
function parseSSEResponse(sseData: string): string {
  console.log('开始解析SSE响应，原始数据长度:', sseData.length)
  
  const lines = sseData.split('\n')
  console.log('SSE响应行数:', lines.length)
  
  let toolOutputContent = '' // 专门存储tool_output_content
  let contentAccumulator = '' // 存储content字段内容
  let dataLineCount = 0
  
  for (const line of lines) {
    if (line.startsWith('data:')) {
      dataLineCount++
      const data = line.substring(5).trim()
      console.log(`第${dataLineCount}行data:`, data.substring(0, 100) + (data.length > 100 ? '...' : ''))
      
      if (data && data !== '[DONE]') {
        try {
          const parsed = JSON.parse(data)
          
          // 检查是否有嵌套的data字段
          if (parsed.data && typeof parsed.data === 'string') {
            try {
              const nestedData = JSON.parse(parsed.data)
              if (nestedData.tool_output_content) {
                toolOutputContent = nestedData.tool_output_content
                console.log('从嵌套data中找到tool_output_content，长度:', toolOutputContent.length)
                console.log('tool_output_content前200字符:', toolOutputContent.substring(0, 200))
                // 找到tool_output_content后，直接返回，不再处理其他内容
                console.log('找到tool_output_content，SSE解析完成')
                return toolOutputContent
              }
            } catch (nestedError) {
              console.log('嵌套data解析失败:', nestedError)
            }
          }
          
          // 直接检查tool_output_content
          if (parsed.tool_output_content) {
            toolOutputContent = parsed.tool_output_content
            console.log('找到tool_output_content，长度:', toolOutputContent.length)
            console.log('tool_output_content前200字符:', toolOutputContent.substring(0, 200))
            // 找到tool_output_content后，直接返回，不再处理其他内容
            console.log('找到tool_output_content，SSE解析完成')
            return toolOutputContent
          }
          
          // 如果没有tool_output_content，检查是否有content字段
          if (parsed.content) {
            contentAccumulator += parsed.content
            console.log('累积content字段，当前总长度:', contentAccumulator.length)
          }
          
        } catch (e) {
          console.log('该行不是JSON格式，跳过处理:', data.substring(0, 100))
        }
      } else if (data === '[DONE]') {
        console.log('收到[DONE]标记，SSE流结束')
      }
    }
  }
  
  // 如果没有找到tool_output_content，返回累积的content
  if (contentAccumulator) {
    console.log('未找到tool_output_content，返回累积的content，长度:', contentAccumulator.length)
    return contentAccumulator
  }
  
  console.log('未找到任何内容，返回空字符串')
  return ''
}

// 当SSE解析未能直接拿到 tool_output_content 时，从任意文本中提取（包括被转义嵌入的情况）
function extractToolOutputCandidates(text: string): string[] {
  if (!text) return []
  const out: string[] = []
  const pushDecoded = (s: string) => {
    let v = s
    // 多轮解转义，尽量还原
    for (let i = 0; i < 3; i++) {
      v = v.replace(/\\n/g, '\n').replace(/\\"/g, '"')
    }
    out.push(v)
  }

  try {
    // 情况1：多层转义: tool_output_content\":\"...\"
    const reEscaped = /tool_output_content\\\":\\\"([\s\S]*?)\\\"/g
    for (const m of text.matchAll(reEscaped)) {
      pushDecoded(m[1])
    }
    // 情况2：普通: tool_output_content":"..."
    const rePlain = /tool_output_content\":\"([\s\S]*?)\"/g
    for (const m of text.matchAll(rePlain)) {
      pushDecoded(m[1])
    }
  } catch {}

  return out
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== 开始处理分析请求 ===')
    
    const body: AnalysisRequest = await request.json()
    const { videoUrl, userId, debug } = body

    console.log('请求参数详情:', { 
      videoUrl, 
      userId,
      videoUrlType: typeof videoUrl,
      videoUrlLength: videoUrl?.length || 0,
      hasVideoUrl: !!videoUrl,
      videoUrlTrimmed: videoUrl?.trim() || '',
      debug: !!debug
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
        const contentLengthHeader = urlCheckResponse.headers.get('content-length')
        const sizeBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : NaN
        if (!Number.isNaN(sizeBytes)) {
          console.log('检测到视频大小(字节):', sizeBytes)
          const LIMIT = 52 * 1024 * 1024
          if (sizeBytes > LIMIT) {
            console.log('视频超过大小限制，提前返回错误，避免调用第三方API')
            return NextResponse.json(
              { success: false, error: `视频大小为 ${(sizeBytes / (1024*1024)).toFixed(0)} MB，超过限制 52 MB，请压缩后重试` },
              { status: 400 }
            )
          }
        }
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

    // 兜底：按出现顺序提取所有 tool_output_content，优先采用第一个（流式返回的首个正文片段）
    const candidates = [
      ...extractToolOutputCandidates(response.data),
      ...extractToolOutputCandidates(fullContent)
    ]
    if (candidates.length > 0) {
      const first = candidates[0]
      console.log('兜底选用第一个 tool_output_content，长度:', first.length)
      outputContent = first
    }

    // 使用新的结构化函数清理和整理内容
    const structuredContent = cleanAndStructureContent(outputContent)
    // 对原始内容进行去噪+去重（两轮，增强强度）
    const dedupedRaw = removeDuplicateContent(removeDuplicateContent(outputContent))
    
    // 返回结构化的分析结果
    const analysisResult: any = {
      content: structuredContent.analysisContent,
      rawOriginal: outputContent,
      rawAnalysis: dedupedRaw,
      downloadLink: structuredContent.downloadLink,
      structured: {
        downloadLink: structuredContent.downloadLink,
        analysisContent: structuredContent.analysisContent
      }
    }

    if (debug) {
      analysisResult.debug = {
        sseFullContent: fullContent,
        outputContent,
        structuredContent,
        lengths: {
          sseFullContent: fullContent.length,
          outputContent: outputContent.length,
          analysisContent: structuredContent.analysisContent.length,
          rawOriginal: outputContent.length,
          rawAnalysis: dedupedRaw.length
        }
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
