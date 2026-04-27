import React from 'react';
import { View, StyleSheet } from 'react-native';
import AiRecommendTab from '../../components/home/AiRecommendTab';

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
    backgroundColor: '#F2F2F7',
  },
});