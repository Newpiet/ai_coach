"use client"

import type React from "react"

import { useState, useCallback, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, FileVideo, DownloadCloud, CheckCircle, AlertCircle, Clock, BarChart3, Trash2 } from "lucide-react"
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

// 统一清理URL尾部多余的斜杠或反斜杠
const sanitizeUrl = (url?: string): string => {
  if (!url) return ""
  return url.trim().replace(/[\\\/]+$/, '')
}

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
    if (e.type === "dragenter" || e.type === "dragleave" || e.type === "dragover") {
      setDragActive(e.type !== "dragleave")
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

  // 移除当前已上传文件，便于重新选择/多次使用
  const handleRemoveFile = useCallback(() => {
    setUploadedFile(null)
    setUploadResult(null)
    setReport(null)
    setIsAnalyzing(false)
    setAnalysisComplete(false)
    setError(null)
    setUploadProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  // 使用useCallback来确保函数引用稳定
  const triggerFileSelect = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    } else {
      const tempInput = document.createElement('input')
      tempInput.type = 'file'
      tempInput.accept = 'video/*,.mp4,.avi,.mov,.wmv'
      tempInput.style.display = 'none'
      tempInput.onchange = (event) => {
        const target = event.target as HTMLInputElement
        if (target.files && target.files[0]) {
          handleFileUpload(target.files[0])
        }
      }
      document.body.appendChild(tempInput)
      tempInput.click()
      setTimeout(() => {
        if (document.body.contains(tempInput)) document.body.removeChild(tempInput)
      }, 2000)
    }
  }, [])

  const validateFile = (file: File): string | null => {
    const allowedTypes = [
      "video/mp4", 
      "video/avi", 
      "video/mov", 
      "video/wmv",
      "video/quicktime",
      "video/x-msvideo",
      "video/x-ms-wmv"
    ]
    const fileName = file.name.toLowerCase()
    const hasValidExtension = fileName.endsWith('.mp4') || fileName.endsWith('.avi') || fileName.endsWith('.mov') || fileName.endsWith('.wmv')
    if (!allowedTypes.includes(file.type) && !hasValidExtension) return "请上传MP4、AVI、MOV或WMV格式的视频文件"

    const maxSize = 52 * 1024 * 1024 // 52MB（与后端插件限制一致）
    if (file.size > maxSize) return "文件大小不能超过52MB"
    return null
  }

  const handleFileUpload = async (file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setUploadedFile(file)
    setIsUploading(true)
    setUploadProgress(0)
    // 重置分析相关状态，确保每次上传后由用户点击按钮再开始分析
    setIsAnalyzing(false)
    setAnalysisComplete(false)
    setReport(null)
    setUploadResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const uploadResponse = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!uploadResponse.ok) throw new Error('文件上传失败')

      const uploadResult = await uploadResponse.json()
      setUploadResult(uploadResult)
      if (!uploadResult.success) throw new Error(uploadResult.error || '文件上传失败')
      if (!uploadResult.data?.fileUrl) throw new Error('文件上传成功但未返回文件URL')

      setUploadProgress(100)
      setIsUploading(false)
      console.log("上传完成，等待用户点击‘开始AI分析’按钮。文件URL:", uploadResult.data.fileUrl)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : '文件上传失败')
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const startAnalysis = async (videoUrl: string) => {
    if (!videoUrl || videoUrl.trim() === '') {
      setError('视频URL无效，无法开始分析')
      return
    }
    setIsAnalyzing(true)
    setError(null)

    try {
      const requestBody = { videoUrl: videoUrl, userId: 'user_' + Date.now() }
      const analysisResponse = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })
      if (!analysisResponse.ok) throw new Error(`分析请求失败: ${analysisResponse.status} - ${await analysisResponse.text()}`)

      const analysisResult = await analysisResponse.json()
      if (!analysisResult.success) throw new Error(analysisResult.error || '分析失败')

      const analysisData = analysisResult.data
      const cleanedDownloadLink = sanitizeUrl(analysisData.downloadLink)
      const cleanedStructuredDownloadLink = sanitizeUrl(analysisData.structured?.downloadLink)
      const reportData: AnalysisReport = {
        rawAnalysis: analysisData.content || analysisData.rawAnalysis || "AI分析完成",
        downloadLink: cleanedDownloadLink,
        structured: analysisData.structured ? {
          downloadLink: cleanedStructuredDownloadLink,
          analysisContent: analysisData.structured.analysisContent || analysisData.content || analysisData.rawAnalysis || "AI分析完成"
        } : {
          downloadLink: cleanedDownloadLink,
          analysisContent: analysisData.content || analysisData.rawAnalysis || "AI分析完成"
        }
      }
      setReport(reportData)
      setAnalysisComplete(true)
      setIsAnalyzing(false)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : '分析失败')
      setIsAnalyzing(false)
      const mockReport: AnalysisReport = { rawAnalysis: "AI分析完成" }
      setReport(mockReport)
      setAnalysisComplete(true)
    }
  }

  const handleDownloadReport = async () => {
    if (!report || !report.rawAnalysis) return
    try {
      const cleanContent = removeDuplicateContent(
        (report.rawAnalysis || '').replace(/\\n/g, '\n').replace(/\\"/g, '"')
      ).replace(/#{1,3}\s*/g, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/- /g, '• ')

      const docDefinition: any = {
        content: [
          { text: 'Medical Speech AI Analysis Report', style: 'header', alignment: 'center', margin: [0, 0, 0, 20] },
          { text: '医学演讲AI分析报告', style: 'subheader', alignment: 'center', margin: [0, 0, 0, 10] },
          { text: `Generated: ${new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`, style: 'footer', alignment: 'center', margin: [0, 0, 0, 20] },
          { text: 'AI分析报告', style: 'sectionTitle', margin: [0, 0, 0, 15] },
          { text: cleanContent, style: 'content', margin: [0, 0, 0, 10] }
        ],
        styles: {
          header: { fontSize: 24, color: '#4162FF', bold: true, margin: [0, 0, 0, 20] },
          subheader: { fontSize: 16, color: '#646464', bold: true, margin: [0, 0, 0, 10] },
          footer: { fontSize: 12, color: '#646464', margin: [0, 0, 0, 10] },
          sectionTitle: { fontSize: 18, color: '#333333', bold: true, margin: [0, 0, 0, 10] },
          content: { fontSize: 12, color: '#4B4B4B', lineHeight: 1.5, margin: [0, 0, 0, 10] }
        }
      }
      pdfMake.createPdf(docDefinition).download(`Medical_Speech_AI_Report_${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (error: unknown) {
      alert(`PDF生成失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-blue-100">
        <div className="max-w-7xl mx-auto pl-4 sm:pl-6 lg:pl-8 pr-0 py-4">
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
            
            {/* 右侧仅保留用户信息 */}
            <div className="flex items-center justify-end">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-600">U</span>
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">用户</p>
                  <p className="text-xs text-gray-500">医学演讲教练</p>
                </div>
              </div>
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
                      <div className="flex items-center space-x-2">
                        {!isUploading && uploadResult?.success && <CheckCircle className="w-6 h-6 text-green-600" />}
                        <button
                          type="button"
                          onClick={handleRemoveFile}
                          className="p-2 rounded hover:bg-red-50 text-gray-500 hover:text-red-600"
                          aria-label="删除并重新选择文件"
                          title="删除并重新选择文件"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
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

                    {!isUploading && !isAnalyzing && uploadedFile && uploadResult?.success && uploadResult?.data?.fileUrl && (
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
              <CardContent className="p-6 relative overflow-hidden rounded-b-lg">
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-20 pointer-events-none"
                  style={{ backgroundImage: "url('/placeholder.jpg')" }}
                />
                <div className="absolute inset-0 bg-gradient-to-br from-white/85 via-white/75 to-blue-50/60 pointer-events-none" />
                <div className="relative space-y-3 text-sm text-gray-700">
                  <div className="flex items-start space-x-2">
                    <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mt-0.5">1</span>
                    <p>上传您的医学演讲视频（5-30分钟）</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mt-0.5">2</span>
                    <p>等待AI分析您的演讲表现</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mt-0.5">3</span>
                    <p>查看详细的分析报告和改进建议</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mt-0.5">4</span>
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
                    {isAnalyzing ? (
                      <div>
                        <div className="relative w-20 h-20 mx-auto mb-6">
                          <span className="absolute inset-0 rounded-full bg-blue-400/20 blur-md animate-ping"></span>
                          <span className="absolute inset-0 rounded-full ring-2 ring-blue-300/40 animate-pulse"></span>
                          <BarChart3 className="relative w-20 h-20 text-blue-600 animate-bounce" />
                        </div>
                        <p className="text-blue-600">AI正在生成报告，请稍候...</p>
                      </div>
                    ) : (
                      <div>
                        <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">上传视频后，AI分析报告将在此显示</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* AI分析报告内容 */}
                    <div className="space-y-4">
                      {/* 显示AI分析内容 */}
                      {report.rawAnalysis && (
                        <div className="relative border border-gray-200 rounded-lg bg-white overflow-hidden">
                          {(report.structured?.downloadLink || report.downloadLink) && (
                            <div className="absolute top-3 right-3 z-10 flex flex-col items-center">
                              <Button
                                onClick={() => window.open(report.structured?.downloadLink || report.downloadLink || '', '_blank')}
                                className="bg-green-600 hover:bg-green-700 text-white shadow-lg ring-2 ring-green-300/60 rounded-full p-4 animate-pulse hover:animate-none transition-transform hover:scale-105"
                                aria-label="下载AI分析文档"
                                title="下载AI分析文档"
                              >
                                <DownloadCloud className="w-7 h-7" />
                              </Button>
                              <span className="mt-1 text-[11px] leading-none text-green-700 bg-white/80 backdrop-blur-sm px-2 py-0.5 rounded shadow-sm">下载报告</span>
                            </div>
                          )}
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
                            <h4 className="text-lg font-medium text-gray-900">医学演讲专业分析</h4>
                            <p className="text-sm text-gray-600">基于AI深度分析的详细报告</p>
                          </div>
                          <div className="p-6">
                            <div className="max-h-[60vh] overflow-y-auto pr-2">
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
