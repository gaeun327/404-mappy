import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Alert, ActivityIndicator, ScrollView, SafeAreaView,
  TextInput, Share, Modal, FlatList,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { auth, db } from '../../firebaseConfig';
import {
  collection, query, where, getDocs, deleteDoc,
  doc, getDoc, updateDoc, setDoc, arrayUnion, arrayRemove,onSnapshot,addDoc,serverTimestamp,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';


// ============================================================
// 초대코드 생성
// ============================================================
const generateInviteCode = () => {
  // 헷갈리기 쉬운 O/0/I/1 제외
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  let code = '';

  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
};


// ============================================================
// 레벨 계산
// ============================================================
const getLevel = (count) => {
  if (count >= 50) {
    return {
      name: '전설의 탐험가 👑',
      color: '#8B5CF6',
      next: null,
      max: 50,
    };
  }

  if (count >= 30) {
    return {
      name: '지역 마스터 🥇',
      color: '#FFD700',
      next: 50,
      max: 50,
    };
  }

  if (count >= 15) {
    return {
      name: '동네 보안관 🥉',
      color: '#FF6B35',
      next: 30,
      max: 30,
    };
  }

  if (count >= 7) {
    return {
      name: '로컬 탐험가 🔍',
      color: '#007AFF',
      next: 15,
      max: 15,
    };
  }

  if (count >= 3) {
    return {
      name: '동네 입문자 🗺️',
      color: '#00B4D8',
      next: 7,
      max: 7,
    };
  }

  return {
    name: '새싹 탐험가 🌱',
    color: '#34C759',
    next: 3,
    max: 3,
  };
};


export default function MyPage() {
  const router = useRouter();

  const [myPlaces, setMyPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');

  // 유저 정보
  const [userData, setUserData] = useState(null);
  const [friends, setFriends] = useState([]);

  // 친구 목록 모달
  const [friendsModal, setFriendsModal] = useState(false);

  // 친구 추가
  const [friendCode, setFriendCode] = useState('');
  const [addingFriend, setAddingFriend] = useState(false);
  const [showFriendInput, setShowFriendInput] = useState(false);

  // 저장한 장소
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [savedLoading, setSavedLoading] = useState(false);

  // 읽지 않은 알림 개수
const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

useEffect(() => {
  const myUid = auth.currentUser?.uid;

  if (!myUid) return;

  const notificationQuery = query(
    collection(db, 'notifications'),
    where('recipientUid', '==', myUid)
  );

  const unsubscribe = onSnapshot(
    notificationQuery,
    (snapshot) => {
      const unreadCount = snapshot.docs.filter(
        (notificationDoc) =>
          notificationDoc.data().read === false
      ).length;

      setUnreadNotificationCount(unreadCount);
    },
    (error) => {
      console.log('알림 개수 불러오기 오류:', error);
    }
  );

  return unsubscribe;
}, []);
  // ============================================================
  // 마이페이지 진입 / 포커스 시 데이터 불러오기
  // ============================================================
  useFocusEffect(
    useCallback(() => {
      if (auth.currentUser) {
        fetchUserData();
        fetchMyPlaces();

        if (activeTab === 'saved') {
          fetchSavedPlaces();
        }
      }
    }, [activeTab])
  );


  // ============================================================
  // 유저 정보 가져오기
  //
  // 기존 회원 중 inviteCode가 없는 경우
  // 자동으로 6자리 초대코드를 생성하여 Firestore에 저장
  // ============================================================
  const fetchUserData = async () => {
    try {
      const uid = auth.currentUser?.uid;

      if (!uid) return;

      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);

      // --------------------------------------------------------
      // users 문서가 아예 없는 경우
      // --------------------------------------------------------
      if (!snap.exists()) {
        console.log(
          '유저 문서가 없습니다. 새 유저 문서를 생성합니다.'
        );

        let newInviteCode = '';
        let isUnique = false;

        // 중복되지 않는 초대코드 생성
        while (!isUnique) {
          newInviteCode = generateInviteCode();

          const codeQuery = query(
            collection(db, 'users'),
            where('inviteCode', '==', newInviteCode)
          );

          const codeSnap = await getDocs(codeQuery);

          if (codeSnap.empty) {
            isUnique = true;
          }
        }

        // 문서가 없어도 생성 가능
        await setDoc(
          userRef,
          {
            uid: uid,
            email: auth.currentUser?.email ?? '',
            nickname:
              auth.currentUser?.displayName ?? '탐험가',
            inviteCode: newInviteCode,
            friends: [],
          },
          { merge: true }
        );

        const newUserData = {
          uid: uid,
          email: auth.currentUser?.email ?? '',
          nickname:
            auth.currentUser?.displayName ?? '탐험가',
          inviteCode: newInviteCode,
          friends: [],
        };

        setUserData(newUserData);
        setFriends([]);

        console.log(
          '새 유저 문서 및 초대코드 생성:',
          newInviteCode
        );

        return;
      }

      const data = snap.data();

      // --------------------------------------------------------
      // 기존 회원에게 초대코드가 없는 경우 자동 생성
      // --------------------------------------------------------
      let inviteCode = data.inviteCode;

      if (!inviteCode) {
        let newInviteCode = '';
        let isUnique = false;

        // 다른 사용자와 중복되지 않는 코드가 나올 때까지 생성
        while (!isUnique) {
          newInviteCode = generateInviteCode();

          const codeQuery = query(
            collection(db, 'users'),
            where('inviteCode', '==', newInviteCode)
          );

          const codeSnap = await getDocs(codeQuery);

          if (codeSnap.empty) {
            isUnique = true;
          }
        }

        // ------------------------------------------------------
        // 중요:
        // updateDoc() 대신 setDoc(..., { merge: true }) 사용
        // ------------------------------------------------------
        await setDoc(
          userRef,
          {
            inviteCode: newInviteCode,
          },
          { merge: true }
        );

        inviteCode = newInviteCode;

        console.log(
          '새 초대코드 생성:',
          inviteCode
        );
      }

      // 화면에 사용할 유저 데이터
      const updatedUserData = {
        ...data,
        inviteCode,
      };

      setUserData(updatedUserData);


      // --------------------------------------------------------
      // 친구 목록 로드
      // --------------------------------------------------------
      const friendUids = data.friends ?? [];

      if (friendUids.length > 0) {
        const friendDocs = await Promise.all(
          friendUids.map(
            fuid => getDoc(doc(db, 'users', fuid))
          )
        );

        setFriends(
          friendDocs
            .filter(d => d.exists())
            .map(d => ({
              uid: d.id,
              ...d.data(),
            }))
        );
      } else {
        setFriends([]);
      }

    } catch (e) {
      console.log(
        '유저 데이터 오류:',
        e
      );
    }
  };


  // ============================================================
  // 내가 등록한 장소 가져오기
  // ============================================================
  const fetchMyPlaces = async () => {
    try {
      setLoading(true);

      const q = query(
        collection(db, 'places'),
        where(
          'userEmail',
          '==',
          auth.currentUser?.email
        )
      );

      const snap = await getDocs(q);

      setMyPlaces(
        snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
        }))
      );

    } catch (e) {
      console.log(
        '데이터 로딩 에러:',
        e
      );
    } finally {
      setLoading(false);
    }
  };


  // ============================================================
  // 저장한 장소 가져오기
  // ============================================================
  const fetchSavedPlaces = async () => {
    setSavedLoading(true);

    try {
      const myEmail = auth.currentUser?.email;

      const q = query(
        collection(db, 'places'),
        where(
          'bookmarks',
          'array-contains',
          myEmail
        )
      );

      const snap = await getDocs(q);

      setSavedPlaces(
        snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
        }))
      );

    } catch (e) {
      console.log(
        '저장 장소 오류:',
        e
      );
    } finally {
      setSavedLoading(false);
    }
  };


  // ============================================================
  // 탭 변경
  // ============================================================
  const handleTabChange = (tab) => {
    setActiveTab(tab);

    if (tab === 'saved') {
      fetchSavedPlaces();
    }
  };


  // ============================================================
  // 내 초대코드 복사
  // ============================================================
const copyInviteCode = async () => {
  const code = userData?.inviteCode ?? '';

  if (!code) {
    Alert.alert(
      '알림',
      '초대코드를 불러오는 중입니다.'
    );
    return;
  }

  try {
    await Clipboard.setStringAsync(code);

    Alert.alert(
      '복사됨!',
      '초대코드 ' + code + '가 복사되었습니다.'
    );
  } catch (e) {
    console.log(
      '초대코드 복사 오류:',
      e
    );

    Alert.alert(
      '오류',
      '초대코드 복사에 실패했습니다.'
    );
  }
};


  // ============================================================
  // 내 초대코드 공유
  // ============================================================
  const shareInviteCode = async () => {
    const code = userData?.inviteCode ?? '';

    if (!code) {
      Alert.alert(
        '알림',
        '초대코드를 불러오는 중입니다.'
      );
      return;
    }

    try {
      await Share.share({
        message:
          '📍 Mappy 초대코드\n\n' +
          '[ ' + code + ' ]\n\n' +
          '이 코드를 Mappy 앱에 입력하면 친구 추가 완료!',
      });
    } catch (e) {
      console.log(
        '초대코드 공유 오류:',
        e
      );
    }
  };


  // ============================================================
  // 친구 추가
  // ============================================================
  const handleAddFriend = async () => {
    const code = friendCode
      .trim()
      .toUpperCase();

    if (!code) return;

    if (code === userData?.inviteCode) {
      Alert.alert(
        '알림',
        '자기 자신의 코드는 입력할 수 없어요 😅'
      );
      return;
    }

    setAddingFriend(true);

    try {
      const q = query(
        collection(db, 'users'),
        where('inviteCode', '==', code)
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        Alert.alert(
          '없는 코드',
          '해당 초대코드를 가진 사용자가 없어요.'
        );
        return;
      }

      const friendDoc = snap.docs[0];

      const friendUid = friendDoc.id;
      const myUid = auth.currentUser?.uid;

      if (!myUid) {
        Alert.alert(
          '오류',
          '로그인 정보를 확인해주세요.'
        );
        return;
      }

      if (
        (userData?.friends ?? [])
          .includes(friendUid)
      ) {
        Alert.alert(
          '알림',
          '이미 친구 목록에 있어요!'
        );
        return;
      }

      // 내 친구 목록에 추가
      await setDoc(
        doc(db, 'users', myUid),
        {
          friends: arrayUnion(friendUid),
        },
        { merge: true }
      );

      // 상대방 친구 목록에도 나 추가
      await setDoc(
        doc(db, 'users', friendUid),
        {
          friends: arrayUnion(myUid),
        },
        { merge: true }
      );
console.log('친구 알림 생성 체크:', {
  myUid,
  friendUid,
  myNickname:
    userData?.nickname ||
    auth.currentUser?.displayName ||
    '익명',
});
      // 상대방에게 친구 추가 알림
await addDoc(
  collection(db, 'notifications'),
  {
    recipientUid: friendUid,
    senderUid: myUid,
    senderEmail:
      auth.currentUser?.email ?? '',
    senderNickname:
      userData?.nickname ||
      auth.currentUser?.displayName ||
      '익명',

    type: 'friend',
    title: '새 친구',

    body: `${
      userData?.nickname ||
      auth.currentUser?.displayName ||
      '누군가'
    }님과 친구가 되었어요!`,

    read: false,
    createdAt: serverTimestamp(),
  }
);
console.log('친구 알림 저장 성공');

      const friendNickname =
        friendDoc.data().nickname ?? '익명';

      Alert.alert(
        '친구 추가 완료! 🎉',
        `${friendNickname}님과 친구가 되었어요!`
      );

      setFriendCode('');
      setShowFriendInput(false);

      // 친구 목록 다시 불러오기
      fetchUserData();

    } catch (e) {
      console.log(
        '친구 추가 오류:',
        e
      );

      Alert.alert(
        '오류',
        '친구 추가에 실패했어요.'
      );
    } finally {
      setAddingFriend(false);
    }
  };


  // ============================================================
  // 친구 삭제
  // ============================================================
  const handleRemoveFriend = (
    friendUid,
    friendNickname
  ) => {
    Alert.alert(
      '친구 삭제',
      `${friendNickname}님을 친구 목록에서 삭제할까요?`,
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
              const myUid =
                auth.currentUser?.uid;

              if (!myUid) return;

              await setDoc(
                doc(db, 'users', myUid),
                {
                  friends: arrayRemove(friendUid),
                },
                { merge: true }
              );

              await setDoc(
                doc(db, 'users', friendUid),
                {
                  friends: arrayRemove(myUid),
                },
                { merge: true }
              );

              setFriends(prev =>
                prev.filter(
                  f => f.uid !== friendUid
                )
              );

            } catch (e) {
              console.log(
                '친구 삭제 오류:',
                e
              );

              Alert.alert(
                '오류',
                '친구 삭제에 실패했어요.'
              );
            }
          },
        },
      ]
    );
  };


  // ============================================================
  // 장소 상세 페이지
  // ============================================================
  const goToDetail = (post) => {
    router.push({
      pathname: '/detail',

      params: {
        id: post.id,
        title: post.title ?? '',
        description: post.description ?? '',
        type: post.type ?? 'blue',
        user: post.userNickname ?? '',
        userEmail: post.userEmail ?? '',
        address: post.address ?? '',
        detailAddress: post.detailAddress ?? '',
        imagePaths: encodeURIComponent(
          JSON.stringify(
            post.imagePaths ?? []
          )
        ),
        tags: JSON.stringify(
          post.tags ?? []
        ),
        category: post.category ?? '',
      },
    });
  };


  // ============================================================
  // 장소 삭제
  // ============================================================
  const handleDelete = async (placeId) => {
    Alert.alert(
      '장소 삭제',
      '정말 이 기록을 삭제하시겠습니까?',
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
                doc(db, 'places', placeId)
              );

              setMyPlaces(prev =>
                prev.filter(
                  p => p.id !== placeId
                )
              );

            } catch (e) {
              console.log(
                '장소 삭제 오류:',
                e
              );

              Alert.alert(
                '오류',
                '장소 삭제에 실패했어요.'
              );
            }
          },
        },
      ]
    );
  };


  // ============================================================
  // 레벨
  // ============================================================
  const level = getLevel(
    myPlaces.length
  );

  const progressPercent = level.next
    ? Math.min(
        (myPlaces.length / level.next) * 100,
        100
      )
    : 100;

  const progressLabel = level.next
    ? `다음 레벨까지 ${
        level.next - myPlaces.length
      }개`
    : '최고 레벨 달성! 🎉';


  return (
    <SafeAreaView style={styles.safeArea}>

      {/* 헤더 */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>
            MY PAGE
          </Text>

          <Text style={styles.headerTitle}>
            마이페이지
          </Text>
        </View>

        <View style={styles.headerRight}>

  {/* 알림 버튼 */}
  <TouchableOpacity
    style={styles.notificationBtn}
    onPress={() => router.push('/notifications')}
    activeOpacity={0.8}
  >
    <Ionicons
      name={
        unreadNotificationCount > 0
          ? 'notifications'
          : 'notifications-outline'
      }
      size={23}
      color="#1C1C1E"
    />

    {unreadNotificationCount > 0 && (
      <View style={styles.notificationBadge}>
        <Text style={styles.notificationBadgeText}>
          {unreadNotificationCount > 99
            ? '99+'
            : unreadNotificationCount}
        </Text>
      </View>
    )}
  </TouchableOpacity>

  {/* 로그아웃 */}
  <TouchableOpacity
    style={styles.addBtn}
    onPress={() =>
      auth
        .signOut()
        .then(() =>
          router.replace('/')
        )
    }
    activeOpacity={0.8}
  >
    <Text style={styles.addBtnText}>
      로그아웃
    </Text>
  </TouchableOpacity>

</View>
      </View>


      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >

        {/* ================================================== */}
        {/* 프로필 카드 */}
        {/* ================================================== */}
        <View style={styles.profileCard}>

          <TouchableOpacity
            style={styles.editProfileBtn}
            onPress={() =>
              router.push('/editprofile')
            }
          >
            <Ionicons
              name="pencil-outline"
              size={16}
              color="#8E8E93"
            />
          </TouchableOpacity>


          <View style={styles.avatarEditWrap}>

            {userData?.profileImageUrl ? (
              <Image
                source={{
                  uri:
                    userData.profileImageUrl,
                }}
                style={styles.avatarImg}
              />
            ) : (
              <View style={styles.avatar}>
                <Ionicons
                  name="person"
                  size={32}
                  color="#8B5CF6"
                />
              </View>
            )}

          </View>


          <View
            style={[
              styles.levelBadge,
              {
                backgroundColor:
                  level.color,
              },
            ]}
          >
            <Text style={styles.levelText}>
              {level.name}
            </Text>
          </View>


          <Text style={styles.nickname}>
            {userData?.nickname ??
              auth.currentUser?.displayName ??
              '탐험가'}
          </Text>


          <Text style={styles.userEmail}>
            {auth.currentUser?.email}
          </Text>


          <View style={styles.progressWrap}>

            <View
              style={
                styles.progressLabelRow
              }
            >
              <Text
                style={
                  styles.progressLabel
                }
              >
                {progressLabel}
              </Text>

              <Text
                style={
                  styles.progressCount
                }
              >
                {myPlaces.length}개 등록
              </Text>
            </View>


            <View style={styles.progressBg}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width:
                      `${progressPercent}%`,
                    backgroundColor:
                      level.color,
                  },
                ]}
              />
            </View>

          </View>


          <View style={styles.statsRow}>

            <View style={styles.statBox}>
              <Text
                style={[
                  styles.statVal,
                  { color: '#007AFF' },
                ]}
              >
                {myPlaces.length}
              </Text>

              <Text style={styles.statLabel}>
                등록 장소
              </Text>
            </View>


            <View
              style={styles.statDivider}
            />


            <View style={styles.statBox}>
              <Text
                style={[
                  styles.statVal,
                  { color: '#F59E0B' },
                ]}
              >
                {friends.length}
              </Text>

              <Text style={styles.statLabel}>
                친구
              </Text>
            </View>

          </View>

        </View>


        {/* ================================================== */}
        {/* 초대코드 카드 */}
        {/* ================================================== */}
        <View style={styles.inviteCard}>

          <View style={styles.inviteTop}>

            <View>

              <Text style={styles.inviteLabel}>
                내 초대코드
              </Text>

              <Text style={styles.inviteCode}>
                {userData?.inviteCode ??
                  '생성 중...'}
              </Text>

            </View>


            <View style={styles.inviteBtns}>

              <TouchableOpacity
                style={
                  styles.inviteIconBtn
                }
                onPress={copyInviteCode}
              >
                <Ionicons
                  name="copy-outline"
                  size={18}
                  color="#007AFF"
                />
              </TouchableOpacity>


              <TouchableOpacity
                style={
                  styles.inviteIconBtn
                }
                onPress={shareInviteCode}
              >
                <Ionicons
                  name="share-outline"
                  size={18}
                  color="#007AFF"
                />
              </TouchableOpacity>

            </View>

          </View>


          {!showFriendInput ? (

            <TouchableOpacity
              style={styles.addFriendBtn}
              onPress={() =>
                setShowFriendInput(true)
              }
            >
              <Ionicons
                name="person-add-outline"
                size={16}
                color="#007AFF"
              />

              <Text
                style={
                  styles.addFriendBtnTxt
                }
              >
                친구 코드 입력
              </Text>
            </TouchableOpacity>

          ) : (

            <View
              style={
                styles.friendInputRow
              }
            >

              <TextInput
                style={styles.friendInput}
                placeholder="친구 초대코드 입력"
                value={friendCode}
                onChangeText={t =>
                  setFriendCode(
                    t.toUpperCase()
                  )
                }
                autoCapitalize="characters"
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={
                  handleAddFriend
                }
              />


              <TouchableOpacity
                style={[
                  styles.friendSubmitBtn,
                  {
                    opacity:
                      friendCode.length ===
                      6
                        ? 1
                        : 0.4,
                  },
                ]}
                onPress={
                  handleAddFriend
                }
                disabled={
                  addingFriend ||
                  friendCode.length < 6
                }
              >

                {addingFriend ? (
                  <ActivityIndicator
                    size="small"
                    color="white"
                  />
                ) : (
                  <Text
                    style={
                      styles.friendSubmitTxt
                    }
                  >
                    추가
                  </Text>
                )}

              </TouchableOpacity>


              <TouchableOpacity
                onPress={() => {
                  setShowFriendInput(false);
                  setFriendCode('');
                }}
                style={{ padding: 4 }}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color="#8E8E93"
                />
              </TouchableOpacity>

            </View>

          )}

        </View>


        {/* ================================================== */}
        {/* 친구 목록 버튼 */}
        {/* ================================================== */}
        <TouchableOpacity
          style={styles.friendsBtn}
          onPress={() =>
            setFriendsModal(true)
          }
          activeOpacity={0.8}
        >

          <View
            style={styles.friendsBtnLeft}
          >
            <Ionicons
              name="people-outline"
              size={20}
              color="#007AFF"
            />

            <Text
              style={styles.friendsBtnTxt}
            >
              친구 목록
            </Text>
          </View>


          <View
            style={styles.friendsBtnRight}
          >
            <Text
              style={styles.friendsBtnCount}
            >
              {friends.length}명
            </Text>

            <Ionicons
              name="chevron-forward"
              size={16}
              color="#C7C7CC"
            />
          </View>

        </TouchableOpacity>


        {/* ================================================== */}
        {/* 친구 목록 모달 */}
        {/* ================================================== */}
        <Modal
          visible={friendsModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >

          <SafeAreaView
            style={{
              flex: 1,
              backgroundColor: '#F2F2F7',
            }}
          >

            <View
              style={styles.modalHeader}
            >

              <Text
                style={
                  styles.modalHeaderTitle
                }
              >
                친구 {friends.length}명
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setFriendsModal(false)
                }
              >
                <Ionicons
                  name="close"
                  size={24}
                  color="#1C1C1E"
                />
              </TouchableOpacity>

            </View>


            {friends.length === 0 ? (

              <View
                style={styles.emptyBox}
              >
                <Ionicons
                  name="people-outline"
                  size={48}
                  color="#C7C7CC"
                />

                <Text
                  style={styles.emptyText}
                >
                  아직 친구가 없어요
                </Text>

                <Text
                  style={styles.emptySub}
                >
                  초대코드로 친구를 추가해보세요!
                </Text>
              </View>

            ) : (

              <FlatList
                data={friends}
                keyExtractor={f =>
                  f.uid
                }
                contentContainerStyle={{
                  padding: 16,
                }}
                renderItem={({
                  item: f,
                }) => (

                  <View
                    style={
                      styles.friendItem
                    }
                  >

                    <View
                      style={
                        styles.friendAvatar
                      }
                    >
                      <Text
                        style={
                          styles.friendAvatarTxt
                        }
                      >
                        {(f.nickname ??
                          '?')[0].toUpperCase()}
                      </Text>
                    </View>


                    <View
                      style={{ flex: 1 }}
                    >
                      <Text
                        style={
                          styles.friendName
                        }
                      >
                        {f.nickname ??
                          '익명'}
                      </Text>

                      <Text
                        style={
                          styles.friendEmail
                        }
                      >
                        {f.email}
                      </Text>
                    </View>


                    <TouchableOpacity
                      onPress={() => {
                        setFriendsModal(
                          false
                        );

                        setTimeout(
                          () =>
                            handleRemoveFriend(
                              f.uid,
                              f.nickname
                            ),
                          300
                        );
                      }}
                    >
                      <Ionicons
                        name="person-remove-outline"
                        size={18}
                        color="#C7C7CC"
                      />
                    </TouchableOpacity>

                  </View>

                )}
              />

            )}

          </SafeAreaView>

        </Modal>


        {/* ================================================== */}
        {/* 탭 */}
        {/* ================================================== */}
        <View style={styles.tabRow}>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === 'posts' &&
                styles.tabBtnActive,
            ]}
            onPress={() =>
              handleTabChange('posts')
            }
          >
            <Ionicons
              name="document-text-outline"
              size={14}
              color={
                activeTab === 'posts'
                  ? '#fff'
                  : '#8E8E93'
              }
            />

            <Text
              style={[
                styles.tabBtnText,
                activeTab === 'posts' && {
                  color: '#fff',
                },
              ]}
            >
              내 스팟
            </Text>
          </TouchableOpacity>


          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === 'saved' &&
                styles.tabBtnActive,
            ]}
            onPress={() =>
              handleTabChange('saved')
            }
          >
            <Ionicons
              name="bookmark-outline"
              size={14}
              color={
                activeTab === 'saved'
                  ? '#fff'
                  : '#8E8E93'
              }
            />

            <Text
              style={[
                styles.tabBtnText,
                activeTab === 'saved' && {
                  color: '#fff',
                },
              ]}
            >
              저장한 장소
            </Text>
          </TouchableOpacity>

        </View>


        {/* ================================================== */}
        {/* 내 스팟 */}
        {/* ================================================== */}
        {activeTab === 'posts' && (

          <View style={styles.section}>

            {loading ? (

              <ActivityIndicator
                size="small"
                color="#007AFF"
                style={{ marginTop: 20 }}
              />

            ) : myPlaces.length === 0 ? (

              <View
                style={styles.emptyBox}
              >
                <Ionicons
                  name="leaf-outline"
                  size={40}
                  color="#C7C7CC"
                />

                <Text
                  style={styles.emptyText}
                >
                  아직 등록한 장소가 없네요 🌱
                </Text>
              </View>

            ) : (

              myPlaces.map(post => (

                <TouchableOpacity
                  key={post.id}
                  style={styles.postCard}
                  onPress={() =>
                    goToDetail(post)
                  }
                  activeOpacity={0.8}
                >

                  <View
                    style={[
                      styles.postAccent,
                      {
                        backgroundColor:
                          post.type === 'blue'
                            ? '#007AFF'
                            : '#FF3B30',
                      },
                    ]}
                  />


                  <View
                    style={styles.postBody}
                  >

                    <Text
                      style={styles.postTitle}
                    >
                      {post.title}
                    </Text>


                    {post.description ? (
                      <Text
                        style={
                          styles.postDesc
                        }
                        numberOfLines={2}
                      >
                        {post.description}
                      </Text>
                    ) : null}


                    {post.address ? (
                      <Text
                        style={
                          styles.postAddress
                        }
                      >
                        📍 {post.address}
                      </Text>
                    ) : null}


                    <TouchableOpacity
                      onPress={e => {
                        e.stopPropagation?.();
                        handleDelete(
                          post.id
                        );
                      }}
                      style={
                        styles.deleteBtn
                      }
                    >
                      <Ionicons
                        name="trash-outline"
                        size={15}
                        color="#FF3B30"
                      />

                      <Text
                        style={
                          styles.deleteBtnText
                        }
                      >
                        삭제
                      </Text>
                    </TouchableOpacity>

                  </View>

                </TouchableOpacity>

              ))

            )}

          </View>

        )}


        {/* ================================================== */}
        {/* 저장한 장소 */}
        {/* ================================================== */}
        {activeTab === 'saved' && (

          <View style={styles.section}>

            {savedLoading ? (

              <ActivityIndicator
                size="small"
                color="#007AFF"
                style={{ marginTop: 20 }}
              />

            ) : savedPlaces.length === 0 ? (

              <View
                style={styles.emptyBox}
              >
                <Ionicons
                  name="bookmark-outline"
                  size={40}
                  color="#C7C7CC"
                />

                <Text
                  style={styles.emptyText}
                >
                  저장한 장소가 없어요
                </Text>

                <Text
                  style={styles.emptySub}
                >
                  마음에 드는 장소를 북마크해보세요!
                </Text>
              </View>

            ) : (

              savedPlaces.map(post => (

                <TouchableOpacity
                  key={post.id}
                  style={styles.postCard}
                  onPress={() =>
                    goToDetail(post)
                  }
                  activeOpacity={0.8}
                >

                  <View
                    style={[
                      styles.postAccent,
                      {
                        backgroundColor:
                          post.type === 'blue'
                            ? '#007AFF'
                            : '#FF3B30',
                      },
                    ]}
                  />


                  <View
                    style={styles.postBody}
                  >

                    <Text
                      style={styles.postTitle}
                    >
                      {post.title}
                    </Text>


                    {post.description ? (
                      <Text
                        style={
                          styles.postDesc
                        }
                        numberOfLines={2}
                      >
                        {post.description}
                      </Text>
                    ) : null}


                    {post.address ? (
                      <Text
                        style={
                          styles.postAddress
                        }
                      >
                        📍 {post.address}
                      </Text>
                    ) : null}

                  </View>

                </TouchableOpacity>

              ))

            )}

          </View>

        )}

      </ScrollView>

    </SafeAreaView>
  );
}


// ============================================================
// Styles
// ============================================================
const styles = StyleSheet.create({

  safeArea: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },

  scrollContent: {
    paddingBottom: 40,
  },


  // 헤더
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },

  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#007AFF',
    letterSpacing: 1.5,
    marginBottom: 2,
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },

  headerRight: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
},

notificationBtn: {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: '#FFFFFF',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
},

notificationBadge: {
  position: 'absolute',
  top: -2,
  right: -3,
  minWidth: 18,
  height: 18,
  paddingHorizontal: 4,
  borderRadius: 9,
  backgroundColor: '#FF3B30',
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: 2,
  borderColor: '#F2F2F7',
},

notificationBadgeText: {
  color: '#FFFFFF',
  fontSize: 9,
  fontWeight: '800',
},

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },

  addBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },


  // 프로필 카드
  profileCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },

  avatarEditWrap: {
    position: 'relative',
    marginBottom: 10,
  },

  avatarImg: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },

  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },

  editProfileBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#F3EEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  levelBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
  },

  levelText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },

  nickname: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 4,
  },

  userEmail: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 16,
  },

  progressWrap: {
    width: '100%',
    marginBottom: 20,
  },

  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },

  progressLabel: {
    fontSize: 12,
    color: '#8E8E93',
  },

  progressCount: {
    fontSize: 12,
    color: '#8E8E93',
  },

  progressBg: {
    height: 6,
    backgroundColor: '#F2F2F7',
    borderRadius: 3,
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    borderRadius: 3,
  },

  statsRow: {
    flexDirection: 'row',
    width: '100%',
  },

  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },

  statVal: {
    fontSize: 20,
    fontWeight: '800',
    color: '#007AFF',
  },

  statLabel: {
    fontSize: 11,
    color: '#8E8E93',
  },

  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#F2F2F7',
    alignSelf: 'center',
  },


  // 초대코드
  inviteCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  inviteTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  inviteLabel: {
    fontSize: 11,
    color: '#8E8E93',
    marginBottom: 4,
  },

  inviteCode: {
    fontSize: 26,
    fontWeight: '900',
    color: '#1C1C1E',
    letterSpacing: 4,
  },

  inviteBtns: {
    flexDirection: 'row',
    gap: 8,
  },

  inviteIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EAF3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  addFriendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#EAF3FF',
  },

  addFriendBtnTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: '#007AFF',
  },

  friendInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  friendInput: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 3,
  },

  friendSubmitBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  friendSubmitTxt: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
  },


  // 친구 목록
  friendsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },

  friendsBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  friendsBtnTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
  },

  friendsBtnRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  friendsBtnCount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#007AFF',
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },

  modalHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1C1C1E',
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 12,
  },

  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },

  friendAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E6F1FB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  friendAvatarTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: '#185FA5',
  },

  friendName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
  },

  friendEmail: {
    fontSize: 12,
    color: '#8E8E93',
  },


  // 탭
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
    gap: 4,
  },

  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 10,
  },

  tabBtnActive: {
    backgroundColor: '#1C1C1E',
  },

  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },


  // 장소 목록
  section: {
    paddingHorizontal: 16,
  },

  postCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  postAccent: {
    width: 4,
  },

  postBody: {
    flex: 1,
    padding: 14,
  },

  postTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },

  postDesc: {
    fontSize: 13,
    color: '#3A3A3C',
    lineHeight: 19,
    marginBottom: 6,
  },

  postAddress: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 8,
  },

  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-end',
  },

  deleteBtnText: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '600',
  },


  // 빈 화면
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 50,
    gap: 8,
  },

  emptyText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#8E8E93',
    marginTop: 8,
  },

  emptySub: {
    fontSize: 13,
    color: '#AEAEB2',
    textAlign: 'center',
  },

});