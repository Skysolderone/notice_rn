import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { display: 'none' }, // 隐藏TabBar
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
       
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'notice',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
    
    </Tabs>
  );
}
