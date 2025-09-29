import React, { useEffect, useState, useRef } from 'react';
import { View, Alert, AppState } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { MessageList } from '@/components/MessageList';
import { notificationService } from '@/services/notificationService';
import { Message } from '@/services/messageApi';

export default function MessagesScreen() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    let isMounted = true;

    const initializeNotifications = async () => {
      try {
        setError(null);
        console.log('初始化通知服务...');

        await notificationService.initialize();

        if (isMounted) {
          setIsInitialized(true);
          console.log('通知服务初始化完成');
        }
      } catch (err) {
        console.error('初始化通知服务失败:', err);

        if (isMounted) {
          const errorMsg = err instanceof Error ? err.message : '未知错误';
          setError(errorMsg);

          if (errorMsg.includes('权限被拒绝')) {
            Alert.alert(
              '权限需要',
              '需要通知权限才能接收推送消息，请在设置中开启。',
              [
                { text: '稍后再说', style: 'cancel' },
                { text: '重试', onPress: initializeNotifications }
              ]
            );
          }
        }
      }
    };

    initializeNotifications();

    const handleAppStateChange = (nextAppState: string) => {
      console.log(`应用状态变化: ${appState.current} -> ${nextAppState}`);

      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('应用从后台恢复，检查最新消息');
        // 当应用从后台恢复时，主动获取最新消息
        notificationService.getLatestMessagesOnDemand().catch(err => {
          console.log('后台恢复时获取消息失败:', err);
        });
      }

      appState.current = nextAppState;
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      isMounted = false;
      appStateSubscription?.remove();
      // 注意：不要在这里调用 notificationService.cleanup()
      // 因为其他组件可能还在使用通知服务
    };
  }, []);

  const handleMessagePress = (message: Message) => {
    Alert.alert(
      '消息详情',
      `来源: ${message.source.toUpperCase()}\n时间: ${new Date(message.timestamp).toLocaleString()}\n\n${message.message}`,
      [{ text: '确定', style: 'default' }]
    );
  };

  if (!isInitialized && !error) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ThemedText style={{ marginBottom: 16, fontSize: 18 }}>正在初始化...</ThemedText>
        <ThemedText style={{ textAlign: 'center', opacity: 0.7 }}>
          正在请求通知权限并注册推送服务
        </ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <ThemedText style={{ marginBottom: 16, fontSize: 18, color: '#ff4444' }}>
          初始化失败
        </ThemedText>
        <ThemedText style={{ textAlign: 'center', opacity: 0.7, marginBottom: 20 }}>
          {error}
        </ThemedText>
        <ThemedText style={{ textAlign: 'center', fontSize: 14, opacity: 0.6 }}>
          消息列表仍可正常使用，但无法接收新的推送通知
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <MessageList
        showHeader={true}
        limit={100}
        onMessagePress={handleMessagePress}
      />
    </ThemedView>
  );
}