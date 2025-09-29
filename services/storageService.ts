import AsyncStorage from '@react-native-async-storage/async-storage';
import { Message } from './messageApi';

export interface CachedMessage extends Message {
  cachedAt: string;
}

const STORAGE_KEYS = {
  MESSAGES: '@notice_app_messages',
  LAST_UPDATE: '@notice_app_last_update',
  PUSH_TOKEN: '@notice_app_push_token',
  NOTIFICATIONS_ENABLED: '@notice_app_notifications_enabled',
} as const;

export class StorageService {
  private readonly CACHE_EXPIRY_HOURS = 24;
  private readonly MAX_CACHED_MESSAGES = 500;

  async getMessages(): Promise<CachedMessage[]> {
    try {
      const messagesJson = await AsyncStorage.getItem(STORAGE_KEYS.MESSAGES);
      if (!messagesJson) {
        return [];
      }

      const messages: CachedMessage[] = JSON.parse(messagesJson);
      return this.filterValidMessages(messages);
    } catch (error) {
      console.error('获取本地消息失败:', error);
      return [];
    }
  }

  async saveMessages(messages: Message[]): Promise<void> {
    try {
      const existingMessages = await this.getMessages();
      const newCachedMessages: CachedMessage[] = messages.map(msg => ({
        ...msg,
        cachedAt: new Date().toISOString()
      }));

      const allMessages = this.mergeAndDeduplicateMessages(existingMessages, newCachedMessages);
      const trimmedMessages = this.trimMessages(allMessages);

      await AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(trimmedMessages));
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_UPDATE, new Date().toISOString());
    } catch (error) {
      console.error('保存本地消息失败:', error);
      throw error;
    }
  }

  async clearMessages(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.MESSAGES);
      await AsyncStorage.removeItem(STORAGE_KEYS.LAST_UPDATE);
    } catch (error) {
      console.error('清除本地消息失败:', error);
      throw error;
    }
  }

  async getLastUpdateTime(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.LAST_UPDATE);
    } catch (error) {
      console.error('获取最后更新时间失败:', error);
      return null;
    }
  }

  async shouldRefreshCache(): Promise<boolean> {
    try {
      const lastUpdate = await this.getLastUpdateTime();
      if (!lastUpdate) {
        return true;
      }

      const lastUpdateTime = new Date(lastUpdate);
      const now = new Date();
      const diffHours = (now.getTime() - lastUpdateTime.getTime()) / (1000 * 60 * 60);

      return diffHours >= this.CACHE_EXPIRY_HOURS;
    } catch (error) {
      console.error('检查缓存刷新状态失败:', error);
      return true;
    }
  }

  async savePushToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKEN, token);
    } catch (error) {
      console.error('保存推送令牌失败:', error);
      throw error;
    }
  }

  async getPushToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.PUSH_TOKEN);
    } catch (error) {
      console.error('获取推送令牌失败:', error);
      return null;
    }
  }

  async setNotificationsEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, JSON.stringify(enabled));
    } catch (error) {
      console.error('保存通知设置失败:', error);
      throw error;
    }
  }

  async getNotificationsEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED);
      return enabled ? JSON.parse(enabled) : true;
    } catch (error) {
      console.error('获取通知设置失败:', error);
      return true;
    }
  }

  private filterValidMessages(messages: CachedMessage[]): CachedMessage[] {
    const now = new Date();
    const expiryTime = this.CACHE_EXPIRY_HOURS * 60 * 60 * 1000;

    return messages.filter(message => {
      const cachedTime = new Date(message.cachedAt);
      const isNotExpired = (now.getTime() - cachedTime.getTime()) < expiryTime;
      return isNotExpired;
    });
  }

  private mergeAndDeduplicateMessages(existing: CachedMessage[], newMessages: CachedMessage[]): CachedMessage[] {
    const messageMap = new Map<string, CachedMessage>();

    existing.forEach(msg => {
      messageMap.set(msg.id, msg);
    });

    newMessages.forEach(msg => {
      messageMap.set(msg.id, msg);
    });

    return Array.from(messageMap.values()).sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  private trimMessages(messages: CachedMessage[]): CachedMessage[] {
    return messages.slice(0, this.MAX_CACHED_MESSAGES);
  }

  async getCacheSize(): Promise<number> {
    try {
      const messages = await this.getMessages();
      return messages.length;
    } catch (error) {
      console.error('获取缓存大小失败:', error);
      return 0;
    }
  }

  async getCacheInfo(): Promise<{
    messageCount: number;
    lastUpdate: string | null;
    cacheExpired: boolean;
  }> {
    try {
      const messageCount = await this.getCacheSize();
      const lastUpdate = await this.getLastUpdateTime();
      const cacheExpired = await this.shouldRefreshCache();

      return {
        messageCount,
        lastUpdate,
        cacheExpired
      };
    } catch (error) {
      console.error('获取缓存信息失败:', error);
      return {
        messageCount: 0,
        lastUpdate: null,
        cacheExpired: true
      };
    }
  }
}

export const storageService = new StorageService();