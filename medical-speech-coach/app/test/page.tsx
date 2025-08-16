"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import MarkdownIt from 'markdown-it'
import { cleanAndStructureContent } from '@/utils/textCleanup'

const md = new MarkdownIt({ html: true, breaks: true, linkify: true, typographer: true })

export default function TestTextCleanup() {
	const [raw, setRaw] = useState<string>(`下载链接：https://example.com/report.pdf\n\n第一段内容，可能会重复。\n\n第二段内容。\n\n第一段内容，可能会重复。\n\n第二段内容。`)
	const [result, setResult] = useState<{ downloadLink: string; analysisContent: string } | null>(null)

	const handleRun = () => {
		const structured = cleanAndStructureContent(raw)
		setResult(structured)
	}

	return (
		<div className="max-w-4xl mx-auto p-6 space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>文本清洗测试</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<textarea
						className="w-full h-48 p-3 border rounded"
						value={raw}
						onChange={(e) => setRaw(e.target.value)}
					/>
					<Button onClick={handleRun}>运行清洗</Button>
				</CardContent>
			</Card>

			{result && (
				<Card>
					<CardHeader>
						<CardTitle>渲染结果</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						{result.downloadLink && (
							<div className="text-sm text-blue-600 break-all">下载链接：{result.downloadLink}</div>
						)}
						<div
							className="prose prose-sm max-w-none"
							dangerouslySetInnerHTML={{
								__html: md.render(result.analysisContent)
							}}
						/>
					</CardContent>
				</Card>
			)}
		</div>
	)
}


