import React from 'react';
import { View, StyleSheet, FlatList, Text } from 'react-native';
import FeedTab from '../../components/home/FeedTab'; // 기존에 만든 피드 컴포넌트 사용

export default function FeedScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>친구들의 소식</Text>
      </View>
      <FeedTab />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  headerTitle: { fontSize: 22, fontWeight: 'bold' },
});