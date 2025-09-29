import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { messageApi } from './messageApi';
import { storageService } from './storageService';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export interface NotificationData {
  message?: string;
  source?: string;
  timestamp?: string;
}

export class NotificationService {
  private notificationListener: any;
  private responseListener: any;

  async initialize() {
    try {
      await this.requestPermissions();
      await this.registerForPushNotifications();
      this.setupNotificationListeners();
    } catch (error) {
      console.error('通知服务初始化失败:', error);
    }
  }

  private async requestPermissions() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      throw new Error('推送通知权限被拒绝');
    }

    await storageService.setNotificationsEnabled(true);
  }

  private async registerForPushNotifications() {
    try {
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('Expo push token:', token);

      await storageService.savePushToken(token);

      await this.registerTokenWithServer(token);

      return token;
    } catch (error) {
      console.error('注册推送通知失败:', error);
      throw error;
    }
  }

  private async registerTokenWithServer(token: string) {
    try {
      const response = await fetch('https://wws741.top/notice/notice_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token,
          platform: Platform.OS,
          app_version: '1.0.0',
          device_name: Platform.OS,
        }),
      });

      if (!response.ok) {
        throw new Error(`注册令牌失败: ${response.status}`);
      }

      const result = await response.json();
      console.log('令牌注册成功:', result);
    } catch (error) {
      console.error('向服务器注册令牌失败:', error);
      throw error;
    }
  }

  private setupNotificationListeners() {
    this.notificationListener = Notifications.addNotificationReceivedListener(
      this.handleNotificationReceived.bind(this)
    );

    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      this.handleNotificationResponse.bind(this)
    );
  }

  private async handleNotificationReceived(notification: Notifications.Notification) {
    console.log('收到新通知:', notification);

    try {
      await this.fetchLatestMessages();
    } catch (error) {
      console.error('获取最新消息失败:', error);
    }
  }

  private async handleNotificationResponse(response: Notifications.NotificationResponse) {
    console.log('用户响应通知:', response);

    try {
      await this.fetchLatestMessages();
    } catch (error) {
      console.error('处理通知响应时获取最新消息失败:', error);
    }
  }

  private async fetchLatestMessages() {
    try {
      console.log('获取最新消息，不保存到本地...');

      const latestMessages = await messageApi.getLatestMessages(10);

      console.log('获取到最新消息:', latestMessages.length, '条');

      this.notifyListeners('messagesUpdated', latestMessages);

      return latestMessages;
    } catch (error) {
      console.error('获取最新消息失败:', error);
      throw error;
    }
  }

  async getLatestMessagesOnDemand() {
    return await this.fetchLatestMessages();
  }

  async scheduleLocalNotification(title: string, body: string, data?: any) {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
        },
        trigger: null,
      });

      return notificationId;
    } catch (error) {
      console.error('发送本地通知失败:', error);
      throw error;
    }
  }

  async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      await Notifications.dismissAllNotificationsAsync();
    } catch (error) {
      console.error('取消所有通知失败:', error);
    }
  }

  private listeners: Map<string, Function[]> = new Map();

  addEventListener(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  removeEventListener(event: string, callback: Function) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event)!;
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private notifyListeners(event: string, data: any) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('通知监听器执行失败:', error);
        }
      });
    }
  }

  async getPushToken(): Promise<string | null> {
    return await storageService.getPushToken();
  }

  async isNotificationsEnabled(): Promise<boolean> {
    return await storageService.getNotificationsEnabled();
  }

  cleanup() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
    this.listeners.clear();
  }
}

export const notificationService = new NotificationService();