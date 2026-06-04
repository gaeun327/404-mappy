import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../firebaseConfig';
import {
  collection, query, where, orderBy, onSnapshot,
  limit, doc, getDoc,
} from 'firebase/firestore';
import { useRouter } from 'expo-router';

const NOTIF_DURATION = 4000;

export default function InAppNotification() {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const translateY = useRef(new Animated.Value(-100)).current;
  const timeoutRef = useRef(null);
  const isShowingRef = useRef(false);
  const queueRef = useRef([]);

  const showNotif = useCallback((notif) => {
    if (isShowingRef.current) {
      queueRef.current.push(notif);
      return;
    }
    isShowingRef.current = true;
    setNotifications([notif]);
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
    timeoutRef.current = setTimeout(() => {
      Animated.timing(translateY, { toValue: -120, duration: 300, useNativeDriver: true }).start(() => {
        isShowingRef.current = false;
        setNotifications([]);
        if (queueRef.current.length > 0) {
          const next = queueRef.current.shift();
          setTimeout(() => showNotif(next), 200);
        }
      });
    }, NOTIF_DURATION);
  }, [translateY]);

  const dismiss = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    Animated.timing(translateY, { toValue: -120, duration: 250, useNativeDriver: true }).start(() => {
      isShowingRef.current = false;
      setNotifications([]);
    });
  };

  useEffect(() => {
    const myEmail = auth.currentUser?.email;
    const myUid = auth.currentUser?.uid;
    if (!myEmail || !myUid) return;

    const unsubs = [];
    let initialized = { comments: false, places: false };

    // 1. 내 글에 달린 새 댓글 감지
    // places 컬렉션에서 내 글 목록 가져온 뒤 각각 comments 감지
    const watchComments = async () => {
      try {
        const placesSnap = await getDoc(doc(db, 'users', myUid));
        const myPlacesQ = query(collection(db, 'places'), where('userEmail', '==', myEmail));
        const { getDocs } = await import('firebase/firestore');
        const snap = await getDocs(myPlacesQ);
        snap.docs.forEach(placeDoc => {
          const commentsQ = query(
            collection(db, 'places', placeDoc.id, 'comments'),
            orderBy('createdAt', 'desc'),
            limit(1)
          );
          let first = true;
          const unsub = onSnapshot(commentsQ, (s) => {
            if (first) { first = false; return; }
            s.docChanges().forEach(change => {
              if (change.type === 'added') {
                const data = change.doc.data();
                if (data.userEmail !== myEmail) {
                  showNotif({
                    id: change.doc.id,
                    type: 'comment',
                    title: '새 댓글',
                    body: `${data.userNickname ?? '누군가'}님이 댓글을 달았어요`,
                    icon: 'chatbubble',
                    color: '#007AFF',
                    placeId: placeDoc.id,
                    placeTitle: placeDoc.data().title,
                  });
                }
              }
            });
          });
          unsubs.push(unsub);
        });
      } catch (e) { console.log('댓글 감지 오류:', e); }
    };
    watchComments();

    // 2. 친구 새 글 감지
    const watchFriendPlaces = async () => {
      try {
        const userSnap = await getDoc(doc(db, 'users', myUid));
        if (!userSnap.exists()) return;
        const friendUids = userSnap.data().friends ?? [];
        if (friendUids.length === 0) return;

        const friendDocs = await Promise.all(friendUids.map(uid => getDoc(doc(db, 'users', uid))));
        const friendEmails = friendDocs.filter(d => d.exists()).map(d => d.data().email);
        if (friendEmails.length === 0) return;

        // 친구 이메일 10명씩 나눠서 감지 (orderBy 없이 인덱스 불필요)
        const chunks = [];
        for (let i = 0; i < Math.min(friendEmails.length, 10); i += 10) {
          chunks.push(friendEmails.slice(i, i + 10));
        }
        chunks.forEach(chunk => {
          const placesQ = query(
            collection(db, 'places'),
            where('userEmail', 'in', chunk)
          );
          let first = true;
          const unsub = onSnapshot(placesQ, (s) => {
            if (first) { first = false; return; }
            s.docChanges().forEach(change => {
              if (change.type === 'added') {
                const data = change.doc.data();
                showNotif({
                  id: change.doc.id,
                  type: 'place',
                  title: '친구 새 글 ✨',
                  body: `${data.userNickname ?? '친구'}님이 새 장소를 등록했어요`,
                  icon: 'location',
                  color: '#34C759',
                  placeId: change.doc.id,
                });
              }
            });
          });
          unsubs.push(unsub);
        });
      } catch (e) { console.log('친구 글 감지 오류:', e); }
    };
    watchFriendPlaces();

    // 3. 채팅 새 메시지 감지 (내가 만든 방 또는 참여한 방)
    const watchChatMessages = async () => {
      try {
        // 내 구 채팅방 목록 감지
        const userSnap = await getDoc(doc(db, 'users', myUid));
        const district = userSnap.data()?.district;
        if (!district) return;

        const roomsQ = query(
          collection(db, 'chatRooms'),
          where('district', '==', district)
        );
        const { getDocs } = await import('firebase/firestore');
        const roomsSnap = await getDocs(roomsQ);

        roomsSnap.docs.forEach(roomDoc => {
          const messagesQ = query(
            collection(db, 'chatRooms', roomDoc.id, 'messages'),
            orderBy('createdAt', 'desc'),
            limit(1)
          );
          let first = true;
          const unsub = onSnapshot(messagesQ, (s) => {
            if (first) { first = false; return; }
            s.docChanges().forEach(change => {
              if (change.type === 'added') {
                const data = change.doc.data();
                if (data.userEmail !== myEmail) {
                  showNotif({
                    id: change.doc.id,
                    type: 'chat',
                    title: `💬 ${roomDoc.data().name}`,
                    body: `${data.userNickname ?? '누군가'}: ${data.text}`,
                    icon: 'chatbubbles',
                    color: '#FF9500',
                  });
                }
              }
            });
          });
          unsubs.push(unsub);
        });
      } catch (e) { console.log('채팅 감지 오류:', e); }
    };
    watchChatMessages();

    return () => unsubs.forEach(u => u());
  }, [showNotif]);

  if (notifications.length === 0) return null;

  const notif = notifications[0];

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY }] }]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={[styles.card, { borderLeftColor: notif.color }]}
        activeOpacity={0.9}
        onPress={() => {
          dismiss();
          if (notif.placeId) {
            router.push({ pathname: '/detail', params: { id: notif.placeId } });
          }
        }}
      >
        <View style={[styles.iconWrap, { backgroundColor: notif.color + '18' }]}>
          <Ionicons name={notif.icon} size={18} color={notif.color} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>{notif.title}</Text>
          <Text style={styles.body} numberOfLines={1}>{notif.body}</Text>
        </View>
        <TouchableOpacity onPress={dismiss} style={styles.closeBtn}>
          <Ionicons name="close" size={16} color="#AEAEB2" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 30,
    left: 16, right: 16,
    zIndex: 9999,
  },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'white',
    borderRadius: 16, padding: 14,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  textWrap: { flex: 1 },
  title: { fontSize: 13, fontWeight: '800', color: '#1C1C1E', marginBottom: 2 },
  body: { fontSize: 13, color: '#8E8E93' },
  closeBtn: { padding: 4 },
});