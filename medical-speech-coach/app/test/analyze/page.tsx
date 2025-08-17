"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function AnalyzeDebugger() {
	const [videoUrl, setVideoUrl] = useState('')
	const [loading, setLoading] = useState(false)
	const [resp, setResp] = useState<any>(null)
	const [err, setErr] = useState<string | null>(null)

	const callApi = async () => {
		setLoading(true)
		setErr(null)
		setResp(null)
		try {
			const res = await fetch('/api/analyze', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ videoUrl, userId: 'debug_user', debug: true })
			})
			const data = await res.json()
			setResp(data)
			if (!res.ok) setErr(data?.error || '请求失败')
		} catch (e: any) {
			setErr(e?.message || '请求异常')
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className="max-w-5xl mx-auto p-6 space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Analyze API 调试</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<input
						className="w-full p-3 border rounded"
						placeholder="粘贴视频文件URL（OSS返回的可访问URL）"
						value={videoUrl}
						onChange={(e) => setVideoUrl(e.target.value)}
					/>
					<Button disabled={!videoUrl || loading} onClick={callApi}>
						{loading ? '请求中...' : '调用 /api/analyze (debug)'}
					</Button>
					{err && <div className="text-red-600 text-sm">{err}</div>}
				</CardContent>
			</Card>

			{resp && (
				<Card>
					<CardHeader>
						<CardTitle>响应数据</CardTitle>
					</CardHeader>
					<CardContent>
						<pre className="whitespace-pre-wrap text-xs bg-gray-50 p-3 rounded border max-h-[60vh] overflow-auto">{JSON.stringify(resp, null, 2)}</pre>
					</CardContent>
				</Card>
			)}
		</div>
	)
}


