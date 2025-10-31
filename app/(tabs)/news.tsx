import React, { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { MessageList } from '@/components/MessageList';
import { MessageDetailModal } from '@/components/MessageDetailModal';
import { Message } from '@/services/messageApi';

export default function NewsScreen() {
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const handleMessagePress = (message: Message) => {
    setSelectedMessage(message);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setTimeout(() => setSelectedMessage(null), 300);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.content}>
        <MessageList
          showHeader={true}
          limit={100}
          source="news"
          onMessagePress={handleMessagePress}
        />
        <MessageDetailModal
          visible={modalVisible}
          message={selectedMessage}
          onClose={handleCloseModal}
        />
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
