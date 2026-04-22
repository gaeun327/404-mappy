import React from 'react';
import { View, StyleSheet } from 'react-native';
import AiRecommendTab from '../../components/home/AiRecommendTab'; // 기존 컴포넌트 재사용

export default function AiScreen() {
  return (
    <View style={styles.container}>
      <AiRecommendTab />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    paddingTop: 60, // 상단 여백
    paddingHorizontal: 20,
  },
});