import { NextResponse } from 'next/server'
import { getSystemConfigStatus } from '@/config/api'

export async function GET() {
  try {
    const systemStatus = getSystemConfigStatus()
    
    return NextResponse.json({
      success: true,
      systemStatus
    })
  } catch (error) {
    console.error('获取配置状态失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '获取配置状态失败',
        systemStatus: null
      },
      { status: 500 }
    )
  }
}
