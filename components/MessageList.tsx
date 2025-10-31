import React, { useEffect, useState, useCallback } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  View,
} from 'react-native';
import { ThemedView } from './ThemedView';
import { ThemedText } from './ThemedText';
import { Message, messageApi } from '@/services/messageApi';
import { storageService } from '@/services/storageService';
import { notificationService } from '@/services/notificationService';

interface MessageItemProps {
  message: Message;
  onPress?: () => void;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, onPress }) => {
  const getSourceColor = (source: string) => {
    switch (source) {
      case 'rsi':
        return '#FF9500'; // 活力橙
      case 'liquidation':
        return '#FF3B30'; // 鲜红色
      case 'news':
        return '#007AFF'; // iOS蓝
      case 'manual':
        return '#34C759'; // 翠绿色
      case 'webhook':
        return '#AF52DE'; // 紫色
      default:
        return '#8E8E93'; // 中性灰
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;

    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <TouchableOpacity onPress={onPress} style={styles.messageItem}>
      <ThemedView style={styles.messageContent}>
        <View style={styles.messageHeader}>
          <ThemedView
            style={[
              styles.sourceBadge,
              { backgroundColor: getSourceColor(message.source) }
            ]}
          >
            <ThemedText style={styles.sourceText}>{message.source.toUpperCase()}</ThemedText>
          </ThemedView>
          <ThemedText style={styles.timestamp}>
            {formatTimestamp(message.timestamp)}
          </ThemedText>
        </View>
        <ThemedText style={styles.messageText} numberOfLines={3}>
          {message.message}
        </ThemedText>
      </ThemedView>
    </TouchableOpacity>
  );
};

export interface MessageListProps {
  showHeader?: boolean;
  limit?: number;
  source?: string;
  onMessagePress?: (message: Message) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  showHeader = true,
  limit = 50,
  source,
  onMessagePress,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(async (forceRefresh: boolean = false) => {
    try {
      setError(null);

      if (forceRefresh || await storageService.shouldRefreshCache()) {
        console.log('从API获取消息...');
        const apiMessages = await messageApi.getMessages(limit, source);
        await storageService.saveMessages(apiMessages);
        setMessages(apiMessages);
      } else {
        console.log('从缓存加载消息...');
        const cachedMessages = await storageService.getMessages();
        const filteredMessages = source
          ? cachedMessages.filter(msg => msg.source === source)
          : cachedMessages;
        setMessages(filteredMessages.slice(0, limit));
      }
    } catch (err) {
      console.error('加载消息失败:', err);
      setError('加载消息失败，请稍后重试');

      try {
        const cachedMessages = await storageService.getMessages();
        const filteredMessages = source
          ? cachedMessages.filter(msg => msg.source === source)
          : cachedMessages;
        setMessages(filteredMessages.slice(0, limit));
      } catch (cacheErr) {
        console.error('从缓存加载消息也失败了:', cacheErr);
      }
    }
  }, [limit, source]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMessages(true);
    setRefreshing(false);
  }, [loadMessages]);

  const handleMessagePress = useCallback((message: Message) => {
    if (onMessagePress) {
      onMessagePress(message);
    } else {
      Alert.alert(
        '消息详情',
        message.message,
        [{ text: '确定', style: 'default' }]
      );
    }
  }, [onMessagePress]);

  useEffect(() => {
    const initializeMessages = async () => {
      setLoading(true);
      await loadMessages();
      setLoading(false);
    };

    initializeMessages();
  }, [loadMessages]);

  useEffect(() => {
    const handleMessagesUpdated = (latestMessages: Message[]) => {
      console.log('收到最新消息更新:', latestMessages.length, '条');

      const filteredMessages = source
        ? latestMessages.filter(msg => msg.source === source)
        : latestMessages;

      setMessages(prev => {
        const messageMap = new Map();
        [...filteredMessages, ...prev].forEach(msg => {
          messageMap.set(msg.id, msg);
        });

        const uniqueMessages = Array.from(messageMap.values())
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, limit);

        return uniqueMessages;
      });
    };

    notificationService.addEventListener('messagesUpdated', handleMessagesUpdated);

    return () => {
      notificationService.removeEventListener('messagesUpdated', handleMessagesUpdated);
    };
  }, [source, limit]);

  const renderMessage = ({ item }: { item: Message }) => (
    <MessageItem
      message={item}
      onPress={() => handleMessagePress(item)}
    />
  );

  const renderEmpty = () => (
    <ThemedView style={styles.emptyContainer}>
      <ThemedText style={styles.emptyText}>
        {error || '暂无消息'}
      </ThemedText>
      {error && (
        <TouchableOpacity onPress={() => handleRefresh()} style={styles.retryButton}>
          <ThemedText style={styles.retryText}>点击重试</ThemedText>
        </TouchableOpacity>
      )}
    </ThemedView>
  );

  const renderHeader = () => {
    if (!showHeader) return null;

    return (
      <ThemedView style={styles.header}>
        <ThemedText type="title" style={styles.headerTitle}>
          消息中心
        </ThemedText>
        <ThemedText style={styles.headerSubtitle}>
          {messages.length} 条消息
          {source && ` · ${source.toUpperCase()}`}
        </ThemedText>
      </ThemedView>
    );
  };

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <ThemedText style={styles.loadingText}>正在加载消息...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
            title="下拉刷新"
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={messages.length === 0 ? styles.emptyContent : undefined}
      />
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    opacity: 0.7,
    fontWeight: '500',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    opacity: 0.65,
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  messageItem: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  messageContent: {
    padding: 18,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sourceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  sourceText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  timestamp: {
    fontSize: 13,
    opacity: 0.5,
    fontWeight: '500',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    letterSpacing: 0.1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
    gap: 20,
  },
  emptyContent: {
    flexGrow: 1,
  },
  emptyText: {
    fontSize: 17,
    textAlign: 'center',
    opacity: 0.5,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});