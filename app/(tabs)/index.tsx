import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as Notifications from 'expo-notifications';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, FlatList, ScrollView, Text, TouchableOpacity, View } from 'react-native';

// 配置通知处理
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// 定义消息类型
interface MessageItem {
  text: string;
  timestamp: string; // ISO 字符串
}

function FCMPushScreen() {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [fcmStatus, setFcmStatus] = useState<'initializing' | 'ready' | 'error'>('initializing');
  const [selectedMessage, setSelectedMessage] = useState<MessageItem | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [debugLogs, setDebugLogs] = useState<{ time: number; message: string }[]>([]);
  const [pushToken, setPushToken] = useState<string>('');
  const [lastTokenSentTime, setLastTokenSentTime] = useState<number>(0);
  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);
  const appState = useRef(AppState.currentState);
  
  const STORAGE_KEY = 'FCM_MESSAGES';
  const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
  const MAX_LOGS = 200;

  const addLog = useCallback((message: string) => {
    setDebugLogs((prev) => {
      const entry = { time: Date.now(), message };
      const next = [entry, ...prev];
      return next.length > MAX_LOGS ? next.slice(0, MAX_LOGS) : next;
    });
  }, []);
  const clearLogs = () => setDebugLogs([]);

  // 发送token到服务器
  const sendTokenToServer = useCallback(async (token: string, forceResend = false) => {
    try {
      const now = Date.now();
      const timeSinceLastSent = now - lastTokenSentTime;
      
      // 防止5分钟内重复发送相同token（除非强制重发）
      if (!forceResend && timeSinceLastSent < 5 * 60 * 1000) {
        addLog(`Token发送跳过: 距离上次发送仅${Math.round(timeSinceLastSent / 1000)}秒`);
        return;
      }
      
      addLog('开始发送Token到服务器');
      
      // 创建FormData
      const formData = new FormData();
      formData.append('token', token);
      formData.append('platform', 'expo');
      formData.append('timestamp', new Date().toISOString());
      formData.append('resend', forceResend ? 'true' : 'false');
      
      const response = await fetch('https://wws741.top/notice_token', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const result = await response.text();
        addLog(`Token发送成功: ${result}`);
        console.log('Token发送成功:', result);
        setLastTokenSentTime(now);
      } else {
        const statusText = response.statusText || '未知错误';
        if (response.status === 409) {
          addLog(`Token发送跳过: 服务器表示Token已存在 (HTTP ${response.status})`);
          console.log('Token已存在，无需重复发送');
          // 409错误不算失败，更新最后发送时间
          setLastTokenSentTime(now);
        } else {
          addLog(`Token发送失败: HTTP ${response.status} - ${statusText}`);
          console.error('Token发送失败:', response.status, statusText);
        }
      }
    } catch (error) {
      addLog(`Token发送异常: ${error}`);
      console.error('Token发送异常:', error);
    }
  }, [addLog, lastTokenSentTime]);

  // 初始化FCM推送
  const initializeFCM = useCallback(async () => {
    try {
      addLog('开始初始化FCM推送服务');
      
      // 请求通知权限
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        addLog('通知权限被拒绝');
        Alert.alert('权限需要', '请允许通知权限以接收推送消息');
        setFcmStatus('error');
        return;
      }
      addLog('通知权限已获得');
      
      // 获取推送token
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: '360af40b-a183-4b14-9714-7f0afafafc26',
      });
      setPushToken(token.data);
      addLog(`获取推送Token成功: ${token.data}`);
      console.log('Expo Push Token:', token.data);
      
      // 发送token到服务器
      await sendTokenToServer(token.data);
      
      setFcmStatus('ready');
      addLog('FCM推送服务初始化完成');
    } catch (error) {
      addLog(`FCM初始化失败: ${error}`);
      console.error('FCM初始化失败:', error);
      setFcmStatus('error');
    }
  }, [addLog, sendTokenToServer]);

  // 初始化：加载本地消息
  useEffect(() => {
    (async () => {
      try {
        // 加载消息
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const arr: MessageItem[] = JSON.parse(stored);
          // 只保留一个月内的消息
          const now = Date.now();
          const filtered = arr.filter(m => now - new Date(m.timestamp).getTime() < ONE_MONTH_MS);
          setMessages(filtered);
          addLog(`加载了 ${filtered.length} 条历史消息`);
        }
      } catch (error) {
        addLog(`加载历史消息失败: ${error}`);
      }
    })();
  }, [ONE_MONTH_MS, addLog]);

  // 保存消息到本地
  const saveMessages = useCallback(async (msgs: MessageItem[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
      addLog(`消息已保存到本地存储，共${msgs.length}条`);
    } catch (error) {
      addLog(`保存消息到本地存储失败: ${error}`);
    }
  }, [addLog]);

  const getMessageKey = (m: MessageItem) => `${m.timestamp}__${m.text}`;

  const handleEnterSelectionMode = () => {
    setIsSelectionMode(true);
    setSelectedKeys(new Set());
  };

  const handleCancelSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedKeys(new Set());
  };

  const handleToggleSelect = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleSelectAllToggle = () => {
    if (selectedKeys.size === messages.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(messages.map(getMessageKey)));
    }
  };

  const handleDeleteAll = () => {
    setMessages([]);
    saveMessages([]);
    setSelectedMessage(null);
    setSelectedKeys(new Set());
    setIsSelectionMode(false);
  };

  const handleDeleteSelected = () => {
    if (selectedKeys.size === 0) return;
    const filtered = messages.filter((m) => !selectedKeys.has(getMessageKey(m)));
    setMessages(filtered);
    saveMessages(filtered);
    if (selectedMessage && selectedKeys.has(getMessageKey(selectedMessage))) {
      setSelectedMessage(null);
    }
    setSelectedKeys(new Set());
    setIsSelectionMode(false);
  };

  // 处理接收到的推送消息
  const handlePushNotification = useCallback((notification: Notifications.Notification) => {
    const { title, body } = notification.request.content;
    addLog(`收到推送通知: ${title} - ${body}`);
    
    // 创建消息项
    const msg: MessageItem = {
      text: body || title || '空消息',
      timestamp: new Date().toISOString(),
    };
    
    // 添加到消息列表
    setMessages((prev) => {
      const newMsgs = [msg, ...prev].filter(m => 
        Date.now() - new Date(m.timestamp).getTime() < ONE_MONTH_MS
      );
      saveMessages(newMsgs);
      return newMsgs;
    });
    
    addLog(`已添加消息到列表`);
  }, [ONE_MONTH_MS, addLog]);
  
  // 处理用户点击推送通知
  const handleNotificationResponse = useCallback((response: Notifications.NotificationResponse) => {
    const { title, body } = response.notification.request.content;
    addLog(`用户点击了推送通知: ${title} - ${body}`);
    
    // 保存点击的通知消息
    const msg: MessageItem = {
      text: body || title || '空消息',
      timestamp: new Date().toISOString(),
    };
    
    setMessages((prev) => {
      const newMsgs = [msg, ...prev].filter(m => 
        Date.now() - new Date(m.timestamp).getTime() < ONE_MONTH_MS
      );
      saveMessages(newMsgs);
      addLog(`已保存点击的通知消息`);
      return newMsgs;
    });
  }, [ONE_MONTH_MS, addLog, saveMessages]);

  // 检查启动时的通知和未处理通知（处理冷启动场景）
  const checkStartupNotification = useCallback(async () => {
    try {
      addLog('检查启动时是否有通知');
      
      // 1. 检查用户最后点击的通知
      const lastNotificationResponse = await Notifications.getLastNotificationResponseAsync();
      if (lastNotificationResponse) {
        const { title, body } = lastNotificationResponse.notification.request.content;
        addLog(`发现启动通知: ${title} - ${body}`);
        
        // 保存启动时的通知
        const msg: MessageItem = {
          text: body || title || '空消息',
          timestamp: new Date(lastNotificationResponse.notification.date).toISOString(),
        };
        
        setMessages((prev) => {
          // 检查是否已存在相同的消息（避免重复保存）
          const isDuplicate = prev.some(m => 
            m.text === msg.text && 
            Math.abs(new Date(m.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 5000
          );
          
          if (!isDuplicate) {
            const newMsgs = [msg, ...prev].filter(m => 
              Date.now() - new Date(m.timestamp).getTime() < ONE_MONTH_MS
            );
            saveMessages(newMsgs);
            addLog(`已保存启动时的通知消息`);
            return newMsgs;
          } else {
            addLog(`启动通知已存在，跳过保存`);
            return prev;
          }
        });
      }
      
      // 2. 检查所有未处理的通知（这里我们可以通过服务端API获取未读通知）
      await checkMissedNotifications();
      
    } catch (error) {
      addLog(`检查启动通知失败: ${error}`);
    }
  }, [ONE_MONTH_MS, addLog, saveMessages, checkMissedNotifications]);

  // 检查服务端未读通知的函数
  const checkMissedNotifications = useCallback(async () => {
    try {
      if (!pushToken) {
        addLog('Push token不存在，跳过检查未读通知');
        return;
      }
      
      addLog('检查服务端未读通知');
      
      // 获取上次检查时间
      const lastCheckKey = 'LAST_NOTIFICATION_CHECK';
      const lastCheckStr = await AsyncStorage.getItem(lastCheckKey);
      const lastCheck = lastCheckStr ? parseInt(lastCheckStr) : Date.now() - 24 * 60 * 60 * 1000; // 默认检查24小时内
      
      const formData = new FormData();
      formData.append('token', pushToken);
      formData.append('since', lastCheck.toString());
      
      const response = await fetch('https://wws741.top/get_missed_notifications', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const missedNotifications = await response.json();
        addLog(`找到 ${missedNotifications.length} 条未读通知`);
        
        if (missedNotifications.length > 0) {
          const newMessages: MessageItem[] = missedNotifications.map((notif: any) => ({
            text: notif.body || notif.title || '空消息',
            timestamp: new Date(notif.timestamp).toISOString(),
          }));
          
          setMessages((prev) => {
            // 合并新消息，去重并按时间排序
            const allMessages = [...newMessages, ...prev];
            const uniqueMessages = allMessages.filter((msg, index, arr) => 
              arr.findIndex(m => 
                m.text === msg.text && 
                Math.abs(new Date(m.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 5000
              ) === index
            ).filter(m => 
              Date.now() - new Date(m.timestamp).getTime() < ONE_MONTH_MS
            ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            
            saveMessages(uniqueMessages);
            addLog(`已保存 ${newMessages.length} 条未读通知`);
            return uniqueMessages;
          });
        }
        
        // 更新最后检查时间
        await AsyncStorage.setItem(lastCheckKey, Date.now().toString());
        
      } else {
        addLog(`检查未读通知失败: HTTP ${response.status}`);
      }
    } catch (error) {
      addLog(`检查未读通知异常: ${error}`);
    }
  }, [pushToken, addLog, saveMessages, ONE_MONTH_MS]);

  // 应用状态变化处理
  const handleAppStateChange = useCallback((nextAppState: string) => {
    addLog(`应用状态变化: ${appState.current} -> ${nextAppState}`);
    
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      addLog('应用从后台恢复，检查未读通知');
      // 应用从后台恢复到前台时检查未读通知
      checkMissedNotifications();
    }
    
    appState.current = nextAppState;
  }, [addLog, checkMissedNotifications]);

  // 主初始化Effect
  useEffect(() => {
    addLog('组件初始化，开始设置FCM推送监听');
    
    // 初始化FCM
    initializeFCM();
    
    // 检查启动时的通知
    checkStartupNotification();
    
    // 设置推送通知监听器
    notificationListener.current = Notifications.addNotificationReceivedListener(handlePushNotification);
    
    // 设置用户响应监听器
    responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
    
    // 设置应用状态监听器
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      addLog('组件卸载，清理FCM推送监听器');
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
      subscription?.remove();
    };
  }, [initializeFCM, handlePushNotification, handleNotificationResponse, addLog, checkStartupNotification, handleAppStateChange]);

  // 测试本地推送
  const handleTestLocalPush = useCallback(async () => {
    try {
      addLog('发送测试推送通知');
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '测试推送',
          body: `这是一条测试消息 - ${new Date().toLocaleTimeString()}`,
          data: { testData: 'local_test' },
        },
        trigger: null, // 立即发送
      });
      addLog('测试推送通知已发送');
    } catch (error) {
      addLog(`发送测试推送失败: ${error}`);
    }
  }, [addLog]);
  
  // 复制推送Token
  const handleCopyToken = useCallback(async () => {
    if (!pushToken) {
      Alert.alert('提示', '推送Token尚未获取');
      return;
    }
    try {
      // 尝试使用 expo-clipboard
      await Clipboard.setStringAsync(pushToken);
      Alert.alert('成功', 'Token已复制到剪贴板');
      addLog('Token已成功复制到剪贴板');
    } catch (error) {
      // 如果 expo-clipboard 不可用，显示Token让用户手动复制
      addLog(`剪贴板功能不可用: ${error}`);
      Alert.alert(
        '推送Token',
        `请手动复制以下Token:\n\n${pushToken}`,
        [
          { text: '关闭', style: 'cancel' },
          { text: '好的', style: 'default' }
        ]
      );
    }
  }, [pushToken, addLog]);



  // 时间格式化
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString();
  };

  return (
    <View style={{ flex: 1, padding: 0, backgroundColor: '#f7f8fa' }}>
      {/* 调试按钮 - 右上角固定位置 */}
      <TouchableOpacity
        onPress={() => {
          setDebugEnabled((v) => {
            const newValue = !v;
            if (newValue) {
              setShowDebugPanel(true);
            } else {
              setShowDebugPanel(false);
            }
            return newValue;
          });
        }}
        activeOpacity={0.7}
        style={{
          position: 'absolute',
          top: 50,
          right: 20,
          backgroundColor: debugEnabled ? '#4caf50' : '#bbb',
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 18,
          zIndex: 1000,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
          elevation: 5,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>
          {debugEnabled ? '调试:开' : '调试:关'}
        </Text>
      </TouchableOpacity>
      
      {/* 美化头部 */}
      <View style={{
        backgroundColor: '#fff',
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        paddingTop: 48,
        paddingBottom: 16,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
        alignItems: 'center',
      }}>
        <Text style={{ fontSize: 26, fontWeight: 'bold', color: '#222', letterSpacing: 1 }}>推送消息列表</Text>
        {/* FCM状态显示 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
          <View style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            marginRight: 6,
            backgroundColor:
              fcmStatus === 'ready' ? '#4caf50' :
              fcmStatus === 'initializing' ? '#ff9800' :
              '#f44',
          }} />
          <Text style={{
            color:
              fcmStatus === 'ready' ? '#4caf50' :
              fcmStatus === 'initializing' ? '#ff9800' :
              '#f44',
            fontWeight: 'bold',
            fontSize: 14,
          }}>
            {fcmStatus === 'ready' && 'FCM就绪'}
            {fcmStatus === 'initializing' && '初始化中...'}
            {fcmStatus === 'error' && 'FCM错误'}
          </Text>
        </View>
        <Text style={{ color: '#666', marginTop: 4, fontSize: 12 }}>
          等待接收FCM推送通知...
        </Text>

        {/* 头部删除与调试操作区 */}
        {!selectedMessage && (
          <View style={{ marginTop: 10, paddingHorizontal: 10 }}>
            {!isSelectionMode ? (
              <>
                {/* 第一行按钮 */}
                <View style={{ 
                  flexDirection: 'row', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  flexWrap: 'wrap',
                  gap: 8,
                  marginBottom: 8,
                }}>
                  <TouchableOpacity
                    onPress={handleEnterSelectionMode}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: '#007AFF',
                      paddingVertical: 7,
                      paddingHorizontal: 12,
                      borderRadius: 16,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>多选删除</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleDeleteAll}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: '#f44',
                      paddingVertical: 7,
                      paddingHorizontal: 12,
                      borderRadius: 16,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>删除全部</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleCopyToken}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: '#9c27b0',
                      paddingVertical: 7,
                      paddingHorizontal: 12,
                      borderRadius: 16,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>复制Token</Text>
                  </TouchableOpacity>
                </View>
                
                {/* 第二行按钮 */}
                <View style={{ 
                  flexDirection: 'row', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  flexWrap: 'wrap', 
                  gap: 8,
                }}>
                  <TouchableOpacity
                    onPress={() => pushToken && sendTokenToServer(pushToken, true)}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: pushToken ? '#ff9800' : '#ccc',
                      paddingVertical: 7,
                      paddingHorizontal: 12,
                      borderRadius: 16,
                      alignItems: 'center',
                    }}
                    disabled={!pushToken}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>强制发送</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => checkMissedNotifications()}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: '#2196F3',
                      paddingVertical: 7,
                      paddingHorizontal: 12,
                      borderRadius: 16,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>检查未读</Text>
                  </TouchableOpacity>
                  {debugEnabled && (
                    <TouchableOpacity
                      onPress={() => setShowDebugPanel((v) => !v)}
                      activeOpacity={0.7}
                      style={{
                        backgroundColor: '#6c6cff',
                        paddingVertical: 7,
                        paddingHorizontal: 12,
                        borderRadius: 16,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>
                        {showDebugPanel ? '隐藏日志' : '查看日志'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            ) : (
              <View style={{ 
                flexDirection: 'row', 
                justifyContent: 'center', 
                alignItems: 'center',
                flexWrap: 'wrap', 
                gap: 8,
              }}>
                <TouchableOpacity
                  onPress={handleCancelSelectionMode}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: '#999',
                    paddingVertical: 7,
                    paddingHorizontal: 12,
                    borderRadius: 16,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSelectAllToggle}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: '#007AFF',
                    paddingVertical: 7,
                    paddingHorizontal: 12,
                    borderRadius: 16,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>
                    {selectedKeys.size === messages.length ? '全不选' : '全选'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDeleteSelected}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: selectedKeys.size > 0 ? '#f44' : '#f8a1a1',
                    paddingVertical: 7,
                    paddingHorizontal: 12,
                    borderRadius: 16,
                    alignItems: 'center',
                  }}
                  disabled={selectedKeys.size === 0}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>删除所选</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 0 }}>
        <FlatList
          data={messages}
          keyExtractor={(item) => getMessageKey(item)}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => {
                if (isSelectionMode) {
                  handleToggleSelect(getMessageKey(item));
                } else {
                  setSelectedMessage(item);
                }
              }}
            >
              <View
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 14,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 4,
                  elevation: 2,
                  borderWidth: isSelectionMode && selectedKeys.has(getMessageKey(item)) ? 2 : 1,
                  borderColor: isSelectionMode && selectedKeys.has(getMessageKey(item)) ? '#007AFF' : '#eee',
                }}
              >
                {isSelectionMode && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        marginRight: 8,
                        borderWidth: 2,
                        borderColor: selectedKeys.has(getMessageKey(item)) ? '#007AFF' : '#ccc',
                        backgroundColor: selectedKeys.has(getMessageKey(item)) ? '#007AFF' : 'transparent',
                      }}
                    />
                    <Text style={{ fontSize: 12, color: '#666' }}>点击切换选择</Text>
                  </View>
                )}
                <Text style={{ fontSize: 16, color: '#222', marginBottom: 8 }} numberOfLines={3} ellipsizeMode="tail">
                  {item.text}
                </Text>
                <Text style={{ fontSize: 12, color: '#888', textAlign: 'right' }}>{formatTime(item.timestamp)}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
      {selectedMessage && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: '#f7f8fa',
          }}
        >
          <View
            style={{
              backgroundColor: '#fff',
              borderBottomLeftRadius: 24,
              borderBottomRightRadius: 24,
              paddingTop: 48,
              paddingBottom: 16,
              paddingHorizontal: 20,
              marginBottom: 10,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 4,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <TouchableOpacity
              onPress={() => setSelectedMessage(null)}
              activeOpacity={0.7}
              style={{ paddingVertical: 8, paddingHorizontal: 12 }}
            >
              <Text style={{ fontSize: 16, color: '#007AFF' }}>返回</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#222' }}>消息详情</Text>
            <View style={{ width: 60 }} />
          </View>
          <View style={{ flex: 1, padding: 20 }}>
            <View
              style={{
                backgroundColor: '#fff',
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: '#eee',
                flex: 1,
              }}
            >
              <Text style={{ fontSize: 12, color: '#888', marginBottom: 12, textAlign: 'right' }}>
                {formatTime(selectedMessage.timestamp)}
              </Text>
              <Text style={{ fontSize: 16, color: '#222', lineHeight: 22 }}>{selectedMessage.text}</Text>
            </View>
          </View>
        </View>
      )}
      {debugEnabled && showDebugPanel && (
        <View
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            bottom: 100,
            height: 220,
            backgroundColor: 'rgba(0,0,0,0.85)',
            borderRadius: 12,
            padding: 12,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>调试日志</Text>
            <TouchableOpacity onPress={clearLogs}>
              <Text style={{ color: '#ff8a8a' }}>清空</Text>
            </TouchableOpacity>
          </View>
          <ScrollView>
            {debugLogs.map((l, idx) => (
              <Text key={`${l.time}-${idx}`} style={{ color: '#ddd', fontSize: 12, marginBottom: 4 }}>
                {new Date(l.time).toLocaleTimeString()} - {l.message}
              </Text>
            ))}
          </ScrollView>
        </View>
      )}
      {/* 底部按钮区：FCM控制 */}
      <View
        style={{
          marginTop: 0,
          marginBottom: 0,
          paddingVertical: 16,
          paddingHorizontal: 20,
          backgroundColor: '#fff',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        {/* FCM 控制行 */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={handleTestLocalPush}
            activeOpacity={0.7}
            style={{
              backgroundColor: '#4caf50',
              paddingVertical: 12,
              paddingHorizontal: 24,
              borderRadius: 24,
              minWidth: 120,
              alignItems: 'center',
              marginRight: 16,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16, letterSpacing: 1 }}>测试推送</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => initializeFCM()}
            activeOpacity={0.7}
            style={{
              backgroundColor: '#007AFF',
              paddingVertical: 12,
              paddingHorizontal: 24,
              borderRadius: 24,
              minWidth: 120,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16, letterSpacing: 1 }}>重新初始化</Text>
          </TouchableOpacity>
        </View>
        {pushToken && (
          <View style={{ marginTop: 12, backgroundColor: '#f5f5f5', padding: 8, borderRadius: 8 }}>
            <Text style={{ fontSize: 10, color: '#666', textAlign: 'center' }}>
              Token: {pushToken.slice(0, 30)}...
            </Text>
          </View>
        )}
      </View>


    </View>
  );
}

export default FCMPushScreen;

