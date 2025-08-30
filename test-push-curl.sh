#!/bin/bash

# Expo 推送通知测试脚本 (使用 curl)
# 使用方法：./test-push-curl.sh <your-expo-push-token>

if [ -z "$1" ]; then
    echo "❌ 请提供推送token"
    echo "使用方法: ./test-push-curl.sh <your-expo-push-token>"
    echo "例如: ./test-push-curl.sh ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
    exit 1
fi

PUSH_TOKEN="$1"

echo "📱 正在发送推送通知..."
echo "Token: $PUSH_TOKEN"

# 使用 curl 发送推送请求
curl -v \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -X POST \
  -d "{
    \"to\": \"$PUSH_TOKEN\",
    \"title\": \"🚀 推送测试 (curl)\",
    \"body\": \"这是一条来自curl测试的推送通知！\",
    \"sound\": \"default\",
    \"data\": {
      \"customData\": \"test\",
      \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\"
    }
  }" \
  https://exp.host/--/api/v2/push/send

echo ""
echo "✅ 推送请求已发送！请检查您的设备。"
