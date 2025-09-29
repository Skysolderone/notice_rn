export interface Message {
  id: string;
  message: string;
  source: 'rsi' | 'liquidation' | 'news' | 'manual' | 'webhook';
  timestamp: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  count?: number;
  error?: string;
}

export interface MessageStats {
  total_count: number;
  source_stats: Record<string, number>;
}

export interface TimeRangeResponse {
  success: boolean;
  count: number;
  start: string;
  end: string;
  data: Message[];
}

export class MessageAPI {
  private baseURL: string;
  private apiPrefix: string;

  constructor(baseURL: string = 'https://wws741.top') {
    this.baseURL = baseURL;
    this.apiPrefix = '/notice';
  }

  async getMessages(limit?: number, source?: string): Promise<Message[]> {
    try {
      let url = `${this.baseURL}${this.apiPrefix}/messages`;
      const params = new URLSearchParams();

      if (limit) {
        params.append('limit', limit.toString());
      }
      if (source) {
        params.append('source', source);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<Message[]> = await response.json();

      if (data.success && data.data) {
        return data.data;
      } else {
        throw new Error(data.error || '获取消息失败');
      }
    } catch (error) {
      console.error('获取消息失败:', error);
      throw error;
    }
  }

  async getStats(): Promise<MessageStats> {
    try {
      const response = await fetch(`${this.baseURL}${this.apiPrefix}/messages/stats`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<MessageStats> = await response.json();

      if (data.success && data.data) {
        return data.data;
      } else {
        throw new Error(data.error || '获取统计失败');
      }
    } catch (error) {
      console.error('获取统计失败:', error);
      throw error;
    }
  }

  async getMessagesByTimeRange(startTime: string, endTime: string): Promise<Message[]> {
    try {
      const params = new URLSearchParams({
        start: startTime,
        end: endTime
      });

      const url = `${this.baseURL}${this.apiPrefix}/messages/range?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: TimeRangeResponse = await response.json();

      if (data.success) {
        return data.data;
      } else {
        throw new Error('查询失败');
      }
    } catch (error) {
      console.error('查询失败:', error);
      throw error;
    }
  }

  async getTodayMessages(): Promise<Message[]> {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

    return this.getMessagesByTimeRange(startOfDay, endOfDay);
  }

  async getRecentMessages(hours: number = 1): Promise<Message[]> {
    const end = new Date();
    const start = new Date(end.getTime() - hours * 60 * 60 * 1000);

    return this.getMessagesByTimeRange(start.toISOString(), end.toISOString());
  }

  async getLatestMessages(limit: number = 10): Promise<Message[]> {
    return this.getMessages(limit);
  }
}

export const messageApi = new MessageAPI();