import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';

import FeedTab from '../../components/home/FeedTab';

import { auth, db } from '../../firebaseConfig';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
} from 'firebase/firestore';

export default function FeedScreen() {

  // 피드 화면에 들어오면 새 글을 확인한 것으로 처리
  useFocusEffect(
    useCallback(() => {
      const markFeedAsSeen = async () => {
        try {
          const myUid = auth.currentUser?.uid;

          if (!myUid) return;

          const q = query(
            collection(db, 'notifications'),
            where('recipientUid', '==', myUid),
            where('type', '==', 'friend_place'),
            where('feedSeen', '==', false)
          );

          const snapshot = await getDocs(q);

          if (snapshot.empty) return;

          await Promise.all(
            snapshot.docs.map((notificationDoc) =>
              updateDoc(
                doc(db, 'notifications', notificationDoc.id),
                {
                  feedSeen: true,
                }
              )
            )
          );

          console.log('피드 새 글 확인 완료');
        } catch (error) {
          console.log('피드 확인 처리 오류:', error);
        }
      };

      markFeedAsSeen();
    }, [])
  );

  return (
    <View style={styles.container}>
      <FeedTab />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
});