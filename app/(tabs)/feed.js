import React from 'react';
import { View, StyleSheet } from 'react-native';
import FeedTab from '../../components/home/FeedTab'; // 기존에 만든 피드 컴포넌트 사용

export default function FeedScreen() {
  return (
    <View style={styles.container}>
      <FeedTab />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
});