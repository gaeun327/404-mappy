import React from 'react';
import { View, StyleSheet } from 'react-native';
import CommunityTab from '../../components/home/CommunityTab';

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
    backgroundColor: '#F2F2F7',
  },
});