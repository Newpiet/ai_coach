// 文本清洗与结构化工具，前后端共用

function sanitizeCozeArtifacts(input: string): string {
	let text = input || ''
	// 统一转义形式（尽量不破坏 URL 与中文）
	text = text
		.replace(/\\r\\n/g, '\n')
		.replace(/\\n/g, '\n')
		.replace(/\\t/g, '  ')
		.replace(/\\\"/g, '"')
		.replace(/\\\//g, '/')
		// 处理行尾反斜杠导致的“续行符”
		.replace(/\\\s*\n/g, '\n')

	// 移除 generate_answer_finish 片段（支持转义与非转义）
	text = text.replace(/\{\"msg_type\":\"generate_answer_finish\"[\s\S]*?\}/g, '')
	text = text.replace(/\{"msg_type":"generate_answer_finish"[\s\S]*?\}/g, '')

	// 移除开头的插件 JSON 前缀，如 {"name":"ts-..."} 直到首个 biz error 或中文正文
	text = text.replace(/^\{[^}]*\}(?=\s*biz error:|\s*[\u4e00-\u9fa5]|\s*$)/s, '')

	return text
}

export function removeDuplicateContent(content: string): string {
	// 基础清理
	const prelimRaw = (content || '')
	// 先清理噪声
	const sanitized = sanitizeCozeArtifacts(prelimRaw)
	const prelim = sanitized
		.replace(/\r\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.replace(/\s+$/gm, '')
		.trim()

	// 段落去重（以空行分段），保留第一次出现的段落，顺序稳定
	const paragraphs = prelim.split(/\n{2,}/)
	const seen = new Set<string>()
	const uniqueParagraphs: string[] = []

	for (const rawPara of paragraphs) {
		const normalized = rawPara.replace(/\s+/g, ' ').trim()
		if (!normalized) continue
		if (!seen.has(normalized)) {
			seen.add(normalized)
			uniqueParagraphs.push(rawPara.trim())
		}
	}

	let deduped = uniqueParagraphs.join('\n\n')

	// 相邻行级去重：若两行（非空）在规范化后完全相同且长度>=6，则去除后者，保留换行结构
	const adjLines = deduped.split('\n')
	const adjResult: string[] = []
	let prevNorm = ''
	for (const raw of adjLines) {
		const norm = raw.replace(/\s+/g, ' ').trim()
		if (norm && prevNorm && norm === prevNorm && norm.length >= 6) {
			// skip duplicate adjacent line
			continue
		}
		adjResult.push(raw)
		prevNorm = norm || ''
		if (!norm) prevNorm = '' // 空行重置，避免跨段落误杀
	}

	deduped = adjResult.join('\n')

	// 3) 行级全局去重（顺序保持）：
	// 对于偶发的整块重复（包括再次出现的标题、分隔线、下载链接），确保全局仅保留第一次
	const lineSeen = new Set<string>()
	const normalized = (line: string) => line.replace(/\s+/g, ' ').trim()
	const lines = deduped.split(/\n/)
	const resultLines: string[] = []

	let downloadLinkKept = false
	for (const rawLine of lines) {
		const line = rawLine
		const norm = normalized(line)
		if (!norm) {
			resultLines.push(rawLine)
			continue
		}

		// 仅保留第一条“下载链接：”
		if (/^下载链接：/.test(norm)) {
			if (downloadLinkKept) {
				continue
			}
			downloadLinkKept = true
			resultLines.push(rawLine)
			continue
		}

		// 去除仅含单个斜杠的残留行
		if (/^\/?$/.test(norm) || norm === '\\') {
			continue
		}

		// 对足够长的重复行进行全局去重（避免误杀短项目符号、序号等）
		if (norm.length >= 8) {
			if (lineSeen.has(norm)) {
				continue
			}
			lineSeen.add(norm)
			resultLines.push(rawLine)
			continue
		}

		resultLines.push(rawLine)
	}

	deduped = resultLines.join('\n')
	return deduped
}

export function cleanAndStructureContent(rawContent: string): { downloadLink: string; analysisContent: string } {
	const content = rawContent || ''
	// 查找“下载链接：”标记
	const downloadLinkIndex = content.indexOf('下载链接：')

	if (downloadLinkIndex === -1) {
		return {
			downloadLink: '',
			analysisContent: removeDuplicateContent(content)
		}
	}

	const contentAfterDownloadLink = content.substring(downloadLinkIndex)
	const lines = contentAfterDownloadLink.split('\n')
	let downloadLink = ''
	let analysisContent = ''

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim()
		if (line.startsWith('下载链接：')) {
			downloadLink = line.replace('下载链接：', '').trim()
			for (let j = i + 1; j < lines.length; j++) {
				analysisContent += lines[j] + '\n'
			}
			break
		}
	}

	analysisContent = removeDuplicateContent(analysisContent.trim())

	return {
		downloadLink,
		analysisContent
	}
}


