#!/usr/bin/env node

/**
 * Expo 推送通知测试脚本 (使用 fetch)
 * 使用方法：node test-push-v2.js <your-expo-push-token>
 */

// 检查 Node.js 版本是否支持 fetch
if (!global.fetch) {
    console.log('正在安装 node-fetch...');
    try {
        const fetch = require('node-fetch');
        global.fetch = fetch;
    } catch (error) {
        console.error('❌ 需要安装 node-fetch: npm install node-fetch');
        process.exit(1);
    }
}

// 从命令行参数获取推送token
const pushToken = process.argv[2];

if (!pushToken) {
    console.error('❌ 请提供推送token');
    console.log('使用方法: node test-push-v2.js <your-expo-push-token>');
    console.log('例如: node test-push-v2.js ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]');
    process.exit(1);
}

// 推送消息内容 - 必须是数组格式
const messages = [{
    to: pushToken,
    sound: 'default',
    title: '🚀 推送测试 V2',
    body: '这是一条来自本地测试的推送通知！',
    data: {
        customData: 'test',
        timestamp: new Date().toISOString()
    },
}];

async function sendPushNotification() {
    console.log('📱 正在发送推送通知...');
    console.log('Token:', pushToken);
    console.log('消息:', JSON.stringify(messages, null, 2));

    try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(messages),
        });

        console.log(`状态码: ${response.status}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ HTTP错误:', response.status, errorText);
            return;
        }

        const result = await response.json();
        console.log('📬 推送响应:', JSON.stringify(result, null, 2));

        if (result.data && Array.isArray(result.data) && result.data.length > 0) {
            const firstResult = result.data[0];
            if (firstResult.status === 'ok') {
                console.log('✅ 推送发送成功！请检查您的设备。');
                if (firstResult.id) {
                    console.log('📋 推送ID:', firstResult.id);
                }
            } else if (firstResult.status === 'error') {
                console.log('❌ 推送发送失败:', firstResult.message);
                if (firstResult.details) {
                    console.log('📝 错误详情:', firstResult.details);
                }
            } else {
                console.log('⚠️  推送状态未知:', firstResult.status);
            }
        } else {
            console.log('⚠️  推送响应格式异常，请检查响应信息。');
        }

    } catch (error) {
        console.error('❌ 发送推送失败:', error.message);
    }
}

// 执行推送
sendPushNotification();
