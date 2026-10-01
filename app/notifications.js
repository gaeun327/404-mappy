import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { db, auth } from '../firebaseConfig';

import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';


// ========================================
// 알림 시간 표시
// ========================================

const timeAgo = (timestamp) => {
  if (!timestamp) {
    return '';
  }

  const date = timestamp?.toDate
    ? timestamp.toDate()
    : new Date(timestamp);

  const diff = Math.floor(
    (Date.now() - date.getTime()) / 1000
  );

  if (diff < 60) {
    return '방금 전';
  }

  if (diff < 3600) {
    return `${Math.floor(diff / 60)}분 전`;
  }

  if (diff < 86400) {
    return `${Math.floor(diff / 3600)}시간 전`;
  }

  if (diff < 604800) {
    return `${Math.floor(diff / 86400)}일 전`;
  }

  return date.toLocaleDateString('ko-KR');
};


// ========================================
// 알림 종류별 디자인
// ========================================

const getNotificationStyle = (type) => {
  switch (type) {
    case 'comment':
      return {
        icon: 'chatbubble',
        color: '#007AFF',
        backgroundColor: '#EAF3FF',
      };

    case 'like':
      return {
        icon: 'heart',
        color: '#FF2D55',
        backgroundColor: '#FFF0F3',
      };

    case 'friend':
      return {
        icon: 'person-add',
        color: '#5856D6',
        backgroundColor: '#F0EFFF',
      };

    case 'place':
      return {
        icon: 'location',
        color: '#34C759',
        backgroundColor: '#EDFAF1',
      };

    case 'chat':
      return {
        icon: 'chatbubbles',
        color: '#FF9500',
        backgroundColor: '#FFF5E6',
      };

    default:
      return {
        icon: 'notifications',
        color: '#8E8E93',
        backgroundColor: '#F2F2F7',
      };
  }
};


export default function NotificationsScreen() {
  const router = useRouter();

  const [notifications, setNotifications] =
    useState([]);

  const [loading, setLoading] =
    useState(true);


  // ========================================
  // 내 알림 실시간 불러오기
  // ========================================

  useEffect(() => {
    const myUid = auth.currentUser?.uid;

    if (!myUid) {
      setLoading(false);
      return;
    }

    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('recipientUid', '==', myUid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,

      (snapshot) => {
        const list = snapshot.docs.map(
          (notificationDoc) => ({
            id: notificationDoc.id,
            ...notificationDoc.data(),
          })
        );

        setNotifications(list);
        setLoading(false);
      },

      (error) => {
        console.log(
          '알림 목록 불러오기 오류:',
          error
        );

        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);


  // ========================================
  // 알림 누르기
  // ========================================

  const handleNotificationPress = async (notification) => {
  try {
    // 읽음 처리
    if (!notification.read) {
      await updateDoc(
        doc(
          db,
          'notifications',
          notification.id
        ),
        {
          read: true,
        }
      );
    }

    // 장소 관련 알림
    if (notification.placeId) {
      const placeRef = doc(
        db,
        'places',
        notification.placeId
      );

      const placeSnap = await getDoc(placeRef);

      if (!placeSnap.exists()) {
        Alert.alert(
          '알림',
          '해당 장소를 찾을 수 없어요.'
        );
        return;
      }

      const place = placeSnap.data();

      router.push({
        pathname: '/detail',

        params: {
          id: notification.placeId,

          title: place.title ?? '',

          description:
            place.description ?? '',

          type:
            place.type ?? 'blue',

          user:
            place.userNickname ?? '',

          userEmail:
            place.userEmail ?? '',

          address:
            place.address ?? '',

          detailAddress:
            place.detailAddress ?? '',

          imagePaths: encodeURIComponent(
            JSON.stringify(
              place.imagePaths ?? []
            )
          ),

          tags: JSON.stringify(
            place.tags ?? []
          ),

          category:
            place.category ?? '',

          verified:
            place.verified
              ? 'true'
              : 'false',
        },
      });
    }

  } catch (error) {
    console.log(
      '알림 열기 오류:',
      error
    );

    Alert.alert(
      '오류',
      '알림을 여는 중 문제가 발생했어요.'
    );
  }
};


  // ========================================
  // 모두 읽음
  // ========================================

  const markAllAsRead = async () => {
    const myUid = auth.currentUser?.uid;

    if (!myUid) {
      return;
    }

    try {
      const unreadQuery = query(
        collection(db, 'notifications'),
        where('recipientUid', '==', myUid),
        where('read', '==', false)
      );

      const snapshot =
        await getDocs(unreadQuery);

      if (snapshot.empty) {
        return;
      }

      const batch = writeBatch(db);

      snapshot.docs.forEach(
        (notificationDoc) => {
          batch.update(
            notificationDoc.ref,
            {
              read: true,
            }
          );
        }
      );

      await batch.commit();

    } catch (error) {
      console.log(
        '모두 읽음 오류:',
        error
      );
    }
  };


  // ========================================
  // 알림 하나 삭제
  // ========================================

  const deleteNotification = (
    notification
  ) => {
    Alert.alert(
      '알림 삭제',
      '이 알림을 삭제할까요?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(
                doc(
                  db,
                  'notifications',
                  notification.id
                )
              );
            } catch (error) {
              console.log(
                '알림 삭제 오류:',
                error
              );
            }
          },
        },
      ]
    );
  };


  // ========================================
  // 알림 카드
  // ========================================

  const renderNotification = ({
    item,
  }) => {
    const notificationStyle =
      getNotificationStyle(item.type);

    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !item.read &&
            styles.unreadNotification,
        ]}
        activeOpacity={0.75}
        onPress={() =>
          handleNotificationPress(item)
        }
        onLongPress={() =>
          deleteNotification(item)
        }
      >
        {/* 읽지 않은 알림 점 */}
        <View style={styles.unreadArea}>
          {!item.read && (
            <View style={styles.unreadDot} />
          )}
        </View>

        {/* 아이콘 */}
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor:
                notificationStyle.backgroundColor,
            },
          ]}
        >
          <Ionicons
            name={notificationStyle.icon}
            size={21}
            color={notificationStyle.color}
          />
        </View>

        {/* 내용 */}
        <View style={styles.notificationContent}>
          <Text style={styles.notificationTitle}>
            {item.title || '알림'}
          </Text>

          <Text
            style={styles.notificationBody}
            numberOfLines={2}
          >
            {item.body || ''}
          </Text>

          {item.placeTitle ? (
            <View style={styles.placeRow}>
              <Ionicons
                name="location-outline"
                size={12}
                color="#8E8E93"
              />

              <Text
                style={styles.placeTitle}
                numberOfLines={1}
              >
                {item.placeTitle}
              </Text>
            </View>
          ) : null}

          <Text style={styles.timeText}>
            {timeAgo(item.createdAt)}
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={17}
          color="#C7C7CC"
        />
      </TouchableOpacity>
    );
  };


  // ========================================
  // 화면
  // ========================================

  return (
    <View style={styles.container}>

      {/* 상단 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name="chevron-back"
            size={25}
            color="#1C1C1E"
          />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          알림
        </Text>

        <TouchableOpacity
          style={styles.readAllButton}
          onPress={markAllAsRead}
        >
          <Text style={styles.readAllText}>
            모두 읽음
          </Text>
        </TouchableOpacity>
      </View>


      {/* 알림 목록 */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color="#007AFF"
          />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="notifications-outline"
              size={34}
              color="#8E8E93"
            />
          </View>

          <Text style={styles.emptyTitle}>
            아직 알림이 없어요
          </Text>

          <Text style={styles.emptyDescription}>
            댓글이나 좋아요 등 새로운 소식이{'\n'}
            생기면 여기에서 확인할 수 있어요.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            styles.listContent
          }
        />
      )}

    </View>
  );
}


// ========================================
// 스타일
// ========================================

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  header: {
    paddingTop: 58,
    paddingBottom: 14,
    paddingHorizontal: 16,

    flexDirection: 'row',
    alignItems: 'center',

    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },

  headerButton: {
    width: 44,
    height: 40,

    justifyContent: 'center',
    alignItems: 'flex-start',
  },

  headerTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 18,

    textAlign: 'center',

    fontSize: 18,
    fontWeight: '800',
    color: '#1C1C1E',

    pointerEvents: 'none',
  },

  readAllButton: {
    marginLeft: 'auto',
    paddingVertical: 8,
    paddingLeft: 10,
  },

  readAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#007AFF',
  },

  listContent: {
    paddingBottom: 30,
  },

  notificationItem: {
    minHeight: 96,

    flexDirection: 'row',
    alignItems: 'center',

    paddingVertical: 16,
    paddingRight: 18,

    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',

    backgroundColor: '#FFFFFF',
  },

  unreadNotification: {
    backgroundColor: '#F7FAFF',
  },

  unreadArea: {
    width: 22,
    alignItems: 'center',
  },

  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#007AFF',
  },

  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,

    justifyContent: 'center',
    alignItems: 'center',

    marginRight: 12,
  },

  notificationContent: {
    flex: 1,
    paddingRight: 10,
  },

  notificationTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 4,
  },

  notificationBody: {
    fontSize: 14,
    lineHeight: 19,
    color: '#3A3A3C',
  },

  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',

    gap: 3,
    marginTop: 5,
  },

  placeTitle: {
    flex: 1,
    fontSize: 12,
    color: '#8E8E93',
  },

  timeText: {
    fontSize: 11,
    color: '#AEAEB2',
    marginTop: 5,
  },

  center: {
    flex: 1,

    justifyContent: 'center',
    alignItems: 'center',

    paddingHorizontal: 30,
  },

  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,

    backgroundColor: '#F2F2F7',

    justifyContent: 'center',
    alignItems: 'center',

    marginBottom: 18,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1C1C1E',

    marginBottom: 8,
  },

  emptyDescription: {
    fontSize: 14,
    lineHeight: 21,

    color: '#8E8E93',
    textAlign: 'center',
  },

});