import React from 'react';
import { View, StyleSheet } from 'react-native';
import CommunityTab from '../../components/home/CommunityTab'; // 기존 컴포넌트 재사용

export default function CommunityScreen() {
  return (
    <View style={styles.container}>
      <CommunityTab />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
});