import React from 'react';
import {
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Platform,
  StatusBar,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { ThemedView } from './ThemedView';
import { ThemedText } from './ThemedText';
import { Message } from '@/services/messageApi';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

interface MessageDetailModalProps {
  visible: boolean;
  message: Message | null;
  onClose: () => void;
}

export const MessageDetailModal: React.FC<MessageDetailModalProps> = ({
  visible,
  message,
  onClose,
}) => {
  if (!message) return null;

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'rsi':
        return '#FF9500';
      case 'liquidation':
        return '#FF3B30';
      case 'news':
        return '#007AFF';
      case 'manual':
        return '#34C759';
      case 'webhook':
        return '#AF52DE';
      default:
        return '#8E8E93';
    }
  };

  const formatFullTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(message.message);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        >
          <BlurView intensity={20} style={StyleSheet.absoluteFill} />
        </TouchableOpacity>

        <View style={styles.modalContainer}>
          <ThemedView style={styles.modalContent}>
            {/* 头部 */}
            <View style={styles.header}>
              <View
                style={[
                  styles.sourceBadge,
                  { backgroundColor: getSourceColor(message.source) },
                ]}
              >
                <ThemedText style={styles.sourceText}>
                  {message.source.toUpperCase()}
                </ThemedText>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <ThemedText style={styles.closeButtonText}>✕</ThemedText>
              </TouchableOpacity>
            </View>

            {/* 时间 */}
            <View style={styles.timestampContainer}>
              <ThemedText style={styles.timestamp}>
                {formatFullTimestamp(message.timestamp)}
              </ThemedText>
            </View>

            {/* 分割线 */}
            <View style={styles.divider} />

            {/* 消息内容 */}
            <ScrollView
              style={styles.messageScrollView}
              showsVerticalScrollIndicator={false}
              bounces={true}
            >
              <ThemedText style={styles.messageText} selectable>
                {message.message}
              </ThemedText>
            </ScrollView>

            {/* 底部按钮 */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { backgroundColor: getSourceColor(message.source) },
                ]}
                onPress={handleCopy}
                activeOpacity={0.8}
              >
                <ThemedText style={styles.actionButtonText}>
                  📋 复制内容
                </ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  modalContent: {
    flex: 1,
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sourceBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  sourceText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(142, 142, 147, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    fontWeight: '600',
    opacity: 0.7,
  },
  timestampContainer: {
    marginBottom: 16,
  },
  timestamp: {
    fontSize: 14,
    opacity: 0.6,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(142, 142, 147, 0.2)',
    marginBottom: 20,
  },
  messageScrollView: {
    flex: 1,
    marginBottom: 20,
  },
  messageText: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '400',
    letterSpacing: 0.1,
  },
  footer: {
    gap: 12,
  },
  actionButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
