// 测试OSS配置和连接
async function testOSSConnection() {
  console.log('=== 测试阿里云OSS连接 ===');
  
  try {
    // 检查环境变量
    console.log('检查环境变量...');
    const requiredEnvVars = [
      'ALIYUN_ACCESS_KEY_ID',
      'ALIYUN_ACCESS_KEY_SECRET', 
      'ALIYUN_OSS_BUCKET',
      'ALIYUN_OSS_REGION',
      'ALIYUN_OSS_ENDPOINT'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.log('❌ 缺少环境变量:', missingVars);
      return;
    }
    
    console.log('✅ 环境变量配置完整');
    console.log('配置详情:', {
      region: process.env.ALIYUN_OSS_REGION,
      bucket: process.env.ALIYUN_OSS_BUCKET,
      endpoint: process.env.ALIYUN_OSS_ENDPOINT,
      hasAccessKey: !!process.env.ALIYUN_ACCESS_KEY_ID,
      hasSecret: !!process.env.ALIYUN_ACCESS_KEY_SECRET
    });
    
    // 测试OSS客户端创建
    console.log('测试OSS客户端创建...');
    
    // 动态导入OSS模块
    const { createOSSClient } = await import('./config/oss.js');
    const client = createOSSClient();
    console.log('✅ OSS客户端创建成功');
    
    // 测试列出Bucket中的文件
    console.log('测试列出Bucket文件...');
    const listResult = await client.list();
    console.log('✅ 成功列出Bucket文件:', listResult.objects?.length || 0, '个文件');
    
    // 测试上传一个小文件
    console.log('测试上传文件...');
    const testContent = 'Hello OSS Test - ' + new Date().toISOString();
    const testFileName = `test_${Date.now()}.txt`;
    
    const uploadResult = await client.put(testFileName, Buffer.from(testContent), {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'max-age=3600'
      }
    });
    
    console.log('✅ 文件上传成功:', uploadResult.url);
    
    // 测试下载文件
    console.log('测试下载文件...');
    const downloadResult = await client.get(testFileName);
    console.log('✅ 文件下载成功，内容:', downloadResult.content.toString());
    
    // 清理测试文件
    console.log('清理测试文件...');
    await client.delete(testFileName);
    console.log('✅ 测试文件清理完成');
    
    console.log('🎉 OSS连接测试完全成功！');
    
  } catch (error) {
    console.error('❌ OSS测试失败:', error.message);
    console.error('错误详情:', error);
  }
}

// 运行测试
testOSSConnection();
