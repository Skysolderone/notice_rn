#!/usr/bin/env node

/**
 * Expo 推送通知测试脚本
 * 使用方法：node test-push.js <your-expo-push-token>
 */

const https = require('https');

// 从命令行参数获取推送token
const pushToken = process.argv[2];

if (!pushToken) {
    console.error('❌ 请提供推送token');
    console.log('使用方法: node test-push.js <your-expo-push-token>');
    console.log('例如: node test-push.js ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]');
    process.exit(1);
}

// 推送消息内容
const message = {
    to: pushToken,
    sound: 'default',
    title: '🚀 推送测试',
    body: '这是一条来自本地测试的推送通知！',
    data: {
        customData: 'test',
        timestamp: new Date().toISOString()
    },
};

// 发送推送请求
const postData = JSON.stringify(message);

const options = {
    hostname: 'exp.host',
    port: 443,
    path: '/--/api/v2/push/send',
    method: 'POST',
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': postData.length,
    },
};

console.log('📱 正在发送推送通知...');
console.log('Token:', pushToken);
console.log('消息:', message);

const req = https.request(options, (res) => {
    console.log(`状态码: ${res.statusCode}`);

    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const response = JSON.parse(data);
            console.log('📬 推送响应:', JSON.stringify(response, null, 2));

            if (response.data && response.data.status === 'ok') {
                console.log('✅ 推送发送成功！请检查您的设备。');
            } else {
                console.log('❌ 推送发送可能失败，请检查响应信息。');
            }
        } catch (error) {
            console.error('❌ 解析响应失败:', error);
            console.log('原始响应:', data);
        }
    });
});

req.on('error', (error) => {
    console.error('❌ 请求失败:', error);
});

req.write(postData);
req.end();
