"use client"

import type React from "react"

import { useState, useCallback, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Upload, FileVideo, Download, CheckCircle, AlertCircle, Clock, BarChart3, Settings } from "lucide-react"
import MarkdownIt from 'markdown-it'
import { removeDuplicateContent } from '@/utils/textCleanup'
import pdfMake from 'pdfmake/build/pdfmake'
import 'pdfmake/build/vfs_fonts'

// 创建markdown-it实例
const md = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true,
  typographer: true
})

interface AnalysisReport {
  rawAnalysis?: string
  downloadLink?: string
  structured?: {
    downloadLink: string
    analysisContent: string
  }
}

interface ConfigStatus {
  coze: {
    hasAccessToken: boolean
    hasBotId: boolean
    isConfigured: boolean
    accessTokenPrefix: string
    botId: string
  }
  oss: {
    hasAccessKeyId: boolean
    hasAccessKeySecret: boolean
    hasBucket: boolean
    hasEndpoint: boolean
    isConfigured: boolean
    region: string
    secure: boolean
  }
  overall: {
    cozeConfigured: boolean
    ossConfigured: boolean
    fullyConfigured: boolean
  }
}

export default function MedicalSpeechCoach() {
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisComplete, setAnalysisComplete] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [report, setReport] = useState<AnalysisReport | null>(null)
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null)
  const [uploadResult, setUploadResult] = useState<any>(null)
  
  // 使用useRef来确保文件输入框的引用稳定
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 检查配置状态
  useEffect(() => {
    const checkConfig = async () => {
      try {
        const response = await fetch('/api/config/status')
        if (response.ok) {
          const data = await response.json()
          setConfigStatus(data.configStatus)
        }
      } catch (error) {
        console.warn('无法获取配置状态:', error)
      }
    }
    
    checkConfig()
  }, [])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files && files[0]) {
      handleFileUpload(files[0])
    }
  }, [])

  // 使用useCallback来确保函数引用稳定
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("文件选择事件触发", e.target.files)
    const files = e.target.files
    if (files && files[0]) {
      console.log("选择的文件:", files[0])
      handleFileUpload(files[0])
    } else {
      console.log("没有选择文件")
    }
  }, [])

  // 使用useCallback来确保函数引用稳定
  const triggerFileSelect = useCallback(() => {
    console.log("=== 触发文件选择 ===")
    console.log("fileInputRef.current:", fileInputRef.current)
    
    if (fileInputRef.current) {
      console.log("使用ref触发文件选择")
      fileInputRef.current.click()
    } else {
      console.log("ref不存在，创建临时input")
      const tempInput = document.createElement('input')
      tempInput.type = 'file'
      tempInput.accept = 'video/*,.mp4,.avi,.mov,.wmv'
      tempInput.style.display = 'none'
      
      tempInput.onchange = (event) => {
        const target = event.target as HTMLInputElement
        if (target.files && target.files[0]) {
          console.log("✅ 临时input选择了文件:", target.files[0])
          handleFileUpload(target.files[0])
        }
      }
      
      document.body.appendChild(tempInput)
      tempInput.click()
      
      setTimeout(() => {
        if (document.body.contains(tempInput)) {
          document.body.removeChild(tempInput)
        }
      }, 2000)
    }
  }, [])

  const validateFile = (file: File): string | null => {
    console.log("验证文件:", file.name, file.type, file.size)
    
    // 更宽松的文件类型验证
    const allowedTypes = [
      "video/mp4", 
      "video/avi", 
      "video/mov", 
      "video/wmv",
      "video/quicktime",
      "video/x-msvideo",
      "video/x-ms-wmv"
    ]
    
    // 检查文件扩展名作为备用验证
    const fileName = file.name.toLowerCase()
    const hasValidExtension = fileName.endsWith('.mp4') || 
                             fileName.endsWith('.avi') || 
                             fileName.endsWith('.mov') || 
                             fileName.endsWith('.wmv')

    if (!allowedTypes.includes(file.type) && !hasValidExtension) {
      console.log("文件类型不匹配:", file.type)
      return "请上传MP4、AVI、MOV或WMV格式的视频文件"
    }

    const maxSize = 52 * 1024 * 1024 // 52MB（与后端插件限制一致）
    if (file.size > maxSize) {
      console.log("文件过大:", file.size)
      return "文件大小不能超过52MB"
    }

    console.log("文件验证通过")
    return null
  }

  const handleFileUpload = async (file: File) => {
    console.log("开始处理文件上传:", file.name)
    
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setUploadedFile(file)
    setIsUploading(true)
    setUploadProgress(0)

    try {
      // 创建FormData对象
      const formData = new FormData()
      formData.append('file', file)

      console.log("发送文件到上传API...")
      
      // 调用上传API
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (!uploadResponse.ok) {
        throw new Error('文件上传失败')
      }

      const uploadResult = await uploadResponse.json()
      console.log("上传成功:", uploadResult)
      setUploadResult(uploadResult); // 更新上传结果状态

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || '文件上传失败')
      }

      // 检查上传结果中的文件URL
      console.log("上传结果详情:", {
        success: uploadResult.success,
        fileName: uploadResult.data?.fileName,
        originalName: uploadResult.data?.originalName,
        fileSize: uploadResult.data?.fileSize,
        fileUrl: uploadResult.data?.fileUrl
      })

      if (!uploadResult.data?.fileUrl) {
        throw new Error('文件上传成功但未返回文件URL')
      }

      setUploadProgress(100)
      setIsUploading(false)

      // 开始分析，传递文件URL
      console.log("准备开始分析，文件URL:", uploadResult.data.fileUrl)
      await startAnalysis(uploadResult.data.fileUrl)

    } catch (error: unknown) {
      console.error("文件上传失败:", error)
      setError(error instanceof Error ? error.message : '文件上传失败')
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const startAnalysis = async (videoUrl: string) => {
    console.log("=== 开始分析视频 ===")
    console.log("接收到的视频URL:", videoUrl)
    console.log("URL类型:", typeof videoUrl)
    console.log("URL长度:", videoUrl.length)
    
    if (!videoUrl || videoUrl.trim() === '') {
      console.error("错误: 视频URL为空或无效")
      setError('视频URL无效，无法开始分析')
      return
    }
    
    setIsAnalyzing(true)
    setError(null)

    try {
      const requestBody = {
        videoUrl: videoUrl,
        userId: 'user_' + Date.now()
      }
      
      console.log("发送到分析API的请求体:", requestBody)
      
      const analysisResponse = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      console.log("分析API响应状态:", analysisResponse.status)
      console.log("分析API响应头:", Object.fromEntries(analysisResponse.headers.entries()))

      if (!analysisResponse.ok) {
        const errorText = await analysisResponse.text()
        console.error("分析API错误响应:", errorText)
        throw new Error(`分析请求失败: ${analysisResponse.status} - ${errorText}`)
      }

      const analysisResult = await analysisResponse.json()
      console.log("分析结果:", analysisResult)

      if (!analysisResult.success) {
        throw new Error(analysisResult.error || '分析失败')
      }

      // 处理分析结果
      const analysisData = analysisResult.data
      console.log("分析数据详情:", {
        hasContent: !!analysisData.content,
        hasRawAnalysis: !!analysisData.rawAnalysis,
        contentLength: analysisData.content?.length || 0,
        rawAnalysisLength: analysisData.rawAnalysis?.length || 0
      })
      
      // 创建报告对象，包含结构化的数据
      const reportData: AnalysisReport = {
        rawAnalysis: analysisData.content || analysisData.rawAnalysis || "AI分析完成",
        downloadLink: analysisData.downloadLink || "",
        structured: analysisData.structured || {
          downloadLink: analysisData.downloadLink || "",
          analysisContent: analysisData.content || analysisData.rawAnalysis || "AI分析完成"
        }
      }

      console.log("创建的报告数据:", reportData)
      setReport(reportData)
      setAnalysisComplete(true)
      setIsAnalyzing(false)

    } catch (error: unknown) {
      console.error("分析失败:", error)
      setError(error instanceof Error ? error.message : '分析失败')
      setIsAnalyzing(false)
      
      // 如果API调用失败，使用模拟数据作为备用
      console.log("使用模拟数据作为备用")
      const mockReport: AnalysisReport = {
        rawAnalysis: "AI分析完成"
      }

      setReport(mockReport)
      setAnalysisComplete(true)
    }
  }

  const handleDownloadReport = async () => {
    if (!report || !report.rawAnalysis) {
      console.error('没有可下载的报告内容')
      return
    }

    try {
      console.log('开始生成PDF报告...')
      
      // 预处理内容，确保中文正确显示
      const cleanContent = removeDuplicateContent(
        (report.rawAnalysis || '')
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
      )
        .replace(/#{1,3}\s*/g, '') // 移除标题标记
        .replace(/\*\*(.*?)\*\*/g, '$1') // 移除粗体标记
        .replace(/\*(.*?)\*/g, '$1') // 移除斜体标记
        .replace(/- /g, '• ') // 将列表标记转换为项目符号

      const docDefinition: any = {
        content: [
          {
            text: 'Medical Speech AI Analysis Report',
            style: 'header',
            alignment: 'center',
            margin: [0, 0, 0, 20]
          },
          {
            text: '医学演讲AI分析报告',
            style: 'subheader',
            alignment: 'center',
            margin: [0, 0, 0, 10]
          },
          {
            text: `Generated: ${new Date().toLocaleString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })}`,
            style: 'footer',
            alignment: 'center',
            margin: [0, 0, 0, 20]
          },
          {
            text: 'AI分析报告',
            style: 'sectionTitle',
            margin: [0, 0, 0, 15]
          },
          {
            text: cleanContent,
            style: 'content',
            margin: [0, 0, 0, 10]
          }
        ],
        styles: {
          header: {
            fontSize: 24,
            color: '#4162FF', // 蓝色
            bold: true,
            margin: [0, 0, 0, 20]
          },
          subheader: {
            fontSize: 16,
            color: '#646464',
            bold: true,
            margin: [0, 0, 0, 10]
          },
          footer: {
            fontSize: 12,
            color: '#646464',
            margin: [0, 0, 0, 10]
          },
          sectionTitle: {
            fontSize: 18,
            color: '#333333',
            bold: true,
            margin: [0, 0, 0, 10]
          },
          content: {
            fontSize: 12,
            color: '#4B4B4B',
            lineHeight: 1.5,
            margin: [0, 0, 0, 10]
          }
        }
      }

      pdfMake.createPdf(docDefinition).download(`Medical_Speech_AI_Report_${new Date().toISOString().slice(0, 10)}.pdf`)
      
      console.log('PDF报告生成成功')
      
    } catch (error: unknown) {
      console.error('PDF生成失败:', error)
      console.error('错误详情:', error instanceof Error ? error.message : '未知错误')
      console.error('错误堆栈:', error instanceof Error ? error.stack : '无堆栈信息')
      alert(`PDF生成失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-blue-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">医学演讲教练助手</h1>
              <p className="text-sm text-gray-600">专业的医学演讲分析与改进工具</p>
              </div>
            </div>
            
            {/* 右侧功能区域 */}
            <div className="flex items-center space-x-4">
              {/* 配置状态显示 */}
              {configStatus && (
                <div className="flex items-center space-x-2">
                  <Settings className="w-4 h-4 text-gray-500" />
                  <div className="flex items-center space-x-2">
                    <Badge 
                      variant={configStatus.overall.fullyConfigured ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {configStatus.overall.fullyConfigured ? "API已配置" : "API未配置"}
                    </Badge>
                    {!configStatus.overall.fullyConfigured && (
                      <span className="text-xs text-gray-500">
                        请检查环境变量配置
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              {/* 个性化信息 */}
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-600">U</span>
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">用户</p>
                  <p className="text-xs text-gray-500">医学演讲教练</p>
                </div>
              </div>
              
              {/* 设置按钮 */}
              <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700">
                <Settings className="w-4 h-4" />
                <span className="ml-2 hidden sm:inline">设置</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel - Upload Area */}
          <div className="space-y-6">
            <Card className="border-blue-200">
              <CardHeader className="bg-blue-50">
                <CardTitle className="flex items-center space-x-2 text-blue-900">
                  <Upload className="w-5 h-5" />
                  <span>视频上传</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {!uploadedFile ? (
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      dragActive ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-blue-400"
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    <FileVideo className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-lg font-medium text-gray-700 mb-2">拖拽视频文件到此处，或点击选择文件</p>
                    <p className="text-sm text-gray-500 mb-4">支持 MP4、AVI、MOV、WMV 格式，最大 52MB</p>
                    <input
                      type="file"
                      accept="video/*,.mp4,.avi,.mov,.wmv"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="video-upload"
                      ref={fileInputRef}
                    />
                    

                    
                    <Button 
                      type="button"
                      className="bg-blue-600 hover:bg-blue-700 w-full"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        console.log("=== 主文件选择按钮被点击 ===")
                        console.log("事件对象:", e)
                        console.log("事件类型:", e.type)
                        console.log("目标元素:", e.target)
                        console.log("当前目标:", e.currentTarget)
                        
                        // 调用我们的触发函数
                        triggerFileSelect()
                      }}
                    >
                      选择视频文件
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                      <FileVideo className="w-8 h-8 text-blue-600" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{uploadedFile.name}</p>
                        <p className="text-sm text-gray-500">{(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                      </div>
                      {analysisComplete && <CheckCircle className="w-6 h-6 text-green-600" />}
                    </div>

                    {isUploading && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>上传中...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <Progress value={uploadProgress} className="h-2" />
                      </div>
                    )}

                    {isAnalyzing && (
                      <Alert>
                        <Clock className="w-4 h-4" />
                        <AlertDescription>正在分析您的演讲视频，预计需要 2-5 分钟，请耐心等待...</AlertDescription>
                      </Alert>
                    )}

                    {!isUploading && !isAnalyzing && uploadedFile && (
                      <div className="space-y-3">


                        <Button
                          onClick={() => {
                            const url = uploadResult?.data?.fileUrl
                            if (url) {
                              startAnalysis(url)
                            } else {
                              setError('未找到已上传文件的URL，无法开始分析')
                            }
                          }}
                          className="w-full bg-green-600 hover:bg-green-700"
                        >
                          <BarChart3 className="w-4 h-4 mr-2" />
                          开始AI分析
                        </Button>
                      </div>
                    )}

                    {analysisComplete && (
                      <Alert className="border-green-200 bg-green-50">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <AlertDescription className="text-green-800">分析完成！请查看右侧的详细报告。</AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                {error && (
                  <Alert className="mt-4 border-red-200 bg-red-50">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <AlertDescription className="text-red-800">{error}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Usage Instructions */}
            <Card className="border-blue-200">
              <CardHeader className="bg-blue-50">
                <CardTitle className="text-blue-900">使用说明</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3 text-sm text-gray-600">
                  <div className="flex items-start space-x-2">
                    <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mt-0.5">
                      1
                    </span>
                    <p>上传您的医学演讲视频（5-30分钟）</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mt-0.5">
                      2
                    </span>
                    <p>等待AI分析您的演讲表现</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mt-0.5">
                      3
                    </span>
                    <p>查看详细的分析报告和改进建议</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mt-0.5">
                      4
                    </span>
                    <p>下载PDF报告用于后续参考</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Report Preview */}
          <div className="space-y-6">
            <Card className="border-blue-200">
              <CardHeader className="bg-blue-50">
                <CardTitle className="flex items-center space-x-2 text-blue-900">
                  <BarChart3 className="w-5 h-5" />
                  <span>分析报告</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {!report ? (
                  <div className="text-center py-12">
                    <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">上传视频后，AI分析报告将在此显示</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* AI分析报告 */}
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2 mb-4">
                        <BarChart3 className="w-5 h-5 text-blue-600" />
                        <h3 className="text-xl font-semibold text-gray-900">AI分析报告</h3>
                      </div>

                      {/* 显示下载链接（如果有） */}
                      {report.downloadLink && (
                        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden mb-4">
                          <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-gray-200">
                            <h4 className="text-lg font-medium text-gray-900 flex items-center space-x-2">
                              <Download className="w-5 h-5 text-green-600" />
                              <span>相关文档下载</span>
                            </h4>
                            <p className="text-sm text-gray-600">AI分析生成的详细报告文档</p>
                          </div>
                          <div className="p-6">
                            <div className="flex items-center space-x-3">
                              <div className="flex-1">
                                <a 
                                  href={report.downloadLink} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 underline break-all"
                                >
                                  {report.downloadLink}
                                </a>
                              </div>
                              <Button 
                                onClick={() => window.open(report.downloadLink, '_blank')}
                                size="sm" 
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Download className="w-4 h-4 mr-2" />
                                下载
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 显示AI分析内容 */}
                      {report.rawAnalysis && (
                        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
                            <h4 className="text-lg font-medium text-gray-900">医学演讲专业分析</h4>
                            <p className="text-sm text-gray-600">基于AI深度分析的详细报告</p>
                          </div>
                          <div className="p-6">
                            <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
                              {/* 使用markdown-it渲染markdown格式的内容 */}
                              <div 
                                className="markdown-content"
                                dangerouslySetInnerHTML={{
                                  __html: md.render(
                                    removeDuplicateContent(
                                      (report.rawAnalysis || '')
                                        .replace(/\\n/g, '\n')
                                        .replace(/\\"/g, '"')
                                    )
                                  )
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
