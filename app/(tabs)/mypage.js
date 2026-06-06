import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, SafeAreaView,
  TextInput, Share, Clipboard, Modal, FlatList,
} from 'react-native';
import { auth, db } from '../../firebaseConfig';
import {
  collection, query, where, getDocs, deleteDoc,
  doc, getDoc, updateDoc, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

const getLevel = (count) => {
  if (count >= 50) return { name: '전설의 탐험가 👑', color: '#8B5CF6', next: null, max: 50 };
  if (count >= 30) return { name: '지역 마스터 🥇',   color: '#FFD700', next: 50,   max: 50 };
  if (count >= 15) return { name: '동네 보안관 🥉',   color: '#FF6B35', next: 30,   max: 30 };
  if (count >= 7)  return { name: '로컬 탐험가 🔍',   color: '#007AFF', next: 15,   max: 15 };
  if (count >= 3)  return { name: '동네 입문자 🗺️',   color: '#00B4D8', next: 7,    max: 7  };
  return           { name: '새싹 탐험가 🌱',           color: '#34C759', next: 3,    max: 3  };
};

export default function MyPage() {
  const router = useRouter();
  const [myPlaces, setMyPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');

  // 유저 정보
  const [userData, setUserData] = useState(null);
  const [friends, setFriends] = useState([]); // { uid, nickname, email }

  // 친구 목록 모달
  const [friendsModal, setFriendsModal] = useState(false);

  // 친구 추가
  const [friendCode, setFriendCode] = useState('');
  const [addingFriend, setAddingFriend] = useState(false);
  const [showFriendInput, setShowFriendInput] = useState(false);

  // 저장한 장소
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [savedLoading, setSavedLoading] = useState(false);

  useFocusEffect(useCallback(() => {
    if (auth.currentUser) {
      fetchUserData();
      fetchMyPlaces();
    }
  }, []));

  const fetchUserData = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const data = snap.data();
        setUserData(data);
        // 친구 목록 로드
        const friendUids = data.friends ?? [];
        if (friendUids.length > 0) {
          const friendDocs = await Promise.all(
            friendUids.map(fuid => getDoc(doc(db, 'users', fuid)))
          );
          setFriends(friendDocs
            .filter(d => d.exists())
            .map(d => ({ uid: d.id, ...d.data() }))
          );
        } else {
          setFriends([]);
        }
      }
    } catch (e) { console.log('유저 데이터 오류:', e); }
  };

  const fetchMyPlaces = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'places'), where('userEmail', '==', auth.currentUser?.email));
      const snap = await getDocs(q);
      setMyPlaces(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.log('데이터 로딩 에러:', e); }
    finally { setLoading(false); }
  };

  const fetchSavedPlaces = async () => {
    setSavedLoading(true);
    try {
      const myEmail = auth.currentUser?.email;
      const q = query(collection(db, 'places'), where('bookmarks', 'array-contains', myEmail));
      const snap = await getDocs(q);
      setSavedPlaces(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.log('저장 장소 오류:', e); }
    finally { setSavedLoading(false); }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'saved' && savedPlaces.length === 0) fetchSavedPlaces();
  };

  // 초대코드 복사
  const copyInviteCode = () => {
    const code = userData?.inviteCode ?? '';
    Clipboard.setString(code);
    Alert.alert('복사됨!', `초대코드 ${code}가 복사되었습니다.`);
  };

  // 초대코드 공유
  const shareInviteCode = async () => {
    const code = userData?.inviteCode ?? '';
    await Share.share({
      message: `📍 Mappy 초대코드\n\n[ ${code} ]\n\n이 코드를 Mappy 앱에 입력하면 친구 추가 완료!`,
    });
  };

  // 친구 추가
  const handleAddFriend = async () => {
    const code = friendCode.trim().toUpperCase();
    if (!code) return;
    if (code === userData?.inviteCode) {
      Alert.alert('알림', '자기 자신의 코드는 입력할 수 없어요 😅');
      return;
    }
    setAddingFriend(true);
    try {
      // 코드로 상대방 찾기
      const q = query(collection(db, 'users'), where('inviteCode', '==', code));
      const snap = await getDocs(q);
      if (snap.empty) {
        Alert.alert('없는 코드', '해당 초대코드를 가진 사용자가 없어요.');
        return;
      }
      const friendDoc = snap.docs[0];
      const friendUid = friendDoc.id;
      const myUid = auth.currentUser?.uid;

      // 이미 친구인지 확인
      if ((userData?.friends ?? []).includes(friendUid)) {
        Alert.alert('알림', '이미 친구 목록에 있어요!');
        return;
      }

      // 양쪽 다 friends 배열에 추가
      await updateDoc(doc(db, 'users', myUid), { friends: arrayUnion(friendUid) });
      await updateDoc(doc(db, 'users', friendUid), { friends: arrayUnion(myUid) });

      const friendNickname = friendDoc.data().nickname ?? '익명';
      Alert.alert('친구 추가 완료! 🎉', `${friendNickname}님과 친구가 되었어요!`);
      setFriendCode('');
      setShowFriendInput(false);
      fetchUserData(); // 친구 목록 새로고침
    } catch (e) {
      Alert.alert('오류', '친구 추가에 실패했어요.');
    } finally {
      setAddingFriend(false);
    }
  };

  // 친구 삭제
  const handleRemoveFriend = (friendUid, friendNickname) => {
    Alert.alert('친구 삭제', `${friendNickname}님을 친구 목록에서 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          const myUid = auth.currentUser?.uid;
          await updateDoc(doc(db, 'users', myUid), { friends: arrayRemove(friendUid) });
          await updateDoc(doc(db, 'users', friendUid), { friends: arrayRemove(myUid) });
          setFriends(prev => prev.filter(f => f.uid !== friendUid));
        }
      }
    ]);
  };

  const handleDelete = async (placeId) => {
    Alert.alert('장소 삭제', '정말 이 기록을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          await deleteDoc(doc(db, 'places', placeId));
          setMyPlaces(prev => prev.filter(p => p.id !== placeId));
        },
      },
    ]);
  };

  const level = getLevel(myPlaces.length);
  const progressPercent = level.next ? Math.min((myPlaces.length / level.next) * 100, 100) : 100;
  const progressLabel = level.next ? `다음 레벨까지 ${level.next - myPlaces.length}개` : '최고 레벨 달성! 🎉';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>내 정보</Text>
        <TouchableOpacity onPress={() => auth.signOut().then(() => router.replace('/'))} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* 프로필 카드 */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color="#8B5CF6" />
          </View>
          <View style={[styles.levelBadge, { backgroundColor: level.color }]}>
            <Text style={styles.levelText}>{level.name}</Text>
          </View>
          <Text style={styles.nickname}>{userData?.nickname ?? auth.currentUser?.displayName ?? '탐험가'}</Text>
          <Text style={styles.userEmail}>{auth.currentUser?.email}</Text>

          <View style={styles.progressWrap}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>{progressLabel}</Text>
              <Text style={styles.progressCount}>{myPlaces.length}개 등록</Text>
            </View>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: level.color }]} />
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{myPlaces.length}</Text>
              <Text style={styles.statLabel}>등록 장소</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={[styles.statVal, { color: '#007AFF' }]}>{friends.length}</Text>
              <Text style={styles.statLabel}>친구</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={[styles.statVal, { color: '#F59E0B' }]}>{myPlaces.length * 100}P</Text>
              <Text style={styles.statLabel}>포인트</Text>
            </View>
          </View>
        </View>

        {/* 초대코드 카드 */}
        <View style={styles.inviteCard}>
          <View style={styles.inviteTop}>
            <View>
              <Text style={styles.inviteLabel}>내 초대코드</Text>
              <Text style={styles.inviteCode}>{userData?.inviteCode ?? '...'}</Text>
            </View>
            <View style={styles.inviteBtns}>
              <TouchableOpacity style={styles.inviteIconBtn} onPress={copyInviteCode}>
                <Ionicons name="copy-outline" size={18} color="#007AFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.inviteIconBtn} onPress={shareInviteCode}>
                <Ionicons name="share-outline" size={18} color="#007AFF" />
              </TouchableOpacity>
            </View>
          </View>

          {!showFriendInput ? (
            <TouchableOpacity style={styles.addFriendBtn} onPress={() => setShowFriendInput(true)}>
              <Ionicons name="person-add-outline" size={16} color="#007AFF" />
              <Text style={styles.addFriendBtnTxt}>친구 코드 입력</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.friendInputRow}>
              <TextInput
                style={styles.friendInput}
                placeholder="친구 초대코드 입력"
                value={friendCode}
                onChangeText={t => setFriendCode(t.toUpperCase())}
                autoCapitalize="characters"
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={handleAddFriend}
              />
              <TouchableOpacity
                style={[styles.friendSubmitBtn, { opacity: friendCode.length === 6 ? 1 : 0.4 }]}
                onPress={handleAddFriend}
                disabled={addingFriend || friendCode.length < 6}
              >
                {addingFriend
                  ? <ActivityIndicator size="small" color="white" />
                  : <Text style={styles.friendSubmitTxt}>추가</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setShowFriendInput(false); setFriendCode(''); }} style={{ padding: 4 }}>
                <Ionicons name="close" size={20} color="#8E8E93" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 친구 목록 버튼 */}
        <TouchableOpacity style={styles.friendsBtn} onPress={() => setFriendsModal(true)} activeOpacity={0.8}>
          <View style={styles.friendsBtnLeft}>
            <Ionicons name="people-outline" size={20} color="#007AFF" />
            <Text style={styles.friendsBtnTxt}>친구 목록</Text>
          </View>
          <View style={styles.friendsBtnRight}>
            <Text style={styles.friendsBtnCount}>{friends.length}명</Text>
            <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
          </View>
        </TouchableOpacity>

        {/* 친구 목록 모달 */}
        <Modal visible={friendsModal} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={{ flex: 1, backgroundColor: '#F2F2F7' }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>친구 {friends.length}명</Text>
              <TouchableOpacity onPress={() => setFriendsModal(false)}>
                <Ionicons name="close" size={24} color="#1C1C1E" />
              </TouchableOpacity>
            </View>
            {friends.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="people-outline" size={48} color="#C7C7CC" />
                <Text style={styles.emptyText}>아직 친구가 없어요</Text>
                <Text style={styles.emptySub}>초대코드로 친구를 추가해보세요!</Text>
              </View>
            ) : (
              <FlatList
                data={friends}
                keyExtractor={f => f.uid}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item: f }) => (
                  <View style={styles.friendItem}>
                    <View style={styles.friendAvatar}>
                      <Text style={styles.friendAvatarTxt}>{(f.nickname ?? '?')[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.friendName}>{f.nickname ?? '익명'}</Text>
                      <Text style={styles.friendEmail}>{f.email}</Text>
                    </View>
                    <TouchableOpacity onPress={() => {
                      setFriendsModal(false);
                      setTimeout(() => handleRemoveFriend(f.uid, f.nickname), 300);
                    }}>
                      <Ionicons name="person-remove-outline" size={18} color="#C7C7CC" />
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </SafeAreaView>
        </Modal>

        {/* 탭 */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'posts' && styles.tabBtnActive]}
            onPress={() => handleTabChange('posts')}
          >
            <Ionicons name="document-text-outline" size={14} color={activeTab === 'posts' ? '#fff' : '#8E8E93'} />
            <Text style={[styles.tabBtnText, activeTab === 'posts' && { color: '#fff' }]}>내 스팟</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'saved' && styles.tabBtnActive]}
            onPress={() => handleTabChange('saved')}
          >
            <Ionicons name="bookmark-outline" size={14} color={activeTab === 'saved' ? '#fff' : '#8E8E93'} />
            <Text style={[styles.tabBtnText, activeTab === 'saved' && { color: '#fff' }]}>저장한 장소</Text>
          </TouchableOpacity>
        </View>

        {/* 내 스팟 탭 */}
        {activeTab === 'posts' && (
          <View style={styles.section}>
            {loading ? (
              <ActivityIndicator size="small" color="#007AFF" style={{ marginTop: 20 }} />
            ) : myPlaces.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="leaf-outline" size={40} color="#C7C7CC" />
                <Text style={styles.emptyText}>아직 등록한 장소가 없네요 🌱</Text>
              </View>
            ) : (
              myPlaces.map(post => (
                <View key={post.id} style={styles.postCard}>
                  <View style={[styles.postAccent, { backgroundColor: post.type === 'blue' ? '#007AFF' : '#FF3B30' }]} />
                  <View style={styles.postBody}>
                    <Text style={styles.postTitle}>{post.title}</Text>
                    {post.description ? <Text style={styles.postDesc} numberOfLines={2}>{post.description}</Text> : null}
                    {post.address ? <Text style={styles.postAddress}>📍 {post.address}</Text> : null}
                    <TouchableOpacity onPress={() => handleDelete(post.id)} style={styles.deleteBtn}>
                      <Ionicons name="trash-outline" size={15} color="#FF3B30" />
                      <Text style={styles.deleteBtnText}>삭제</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* 저장한 장소 탭 */}
        {activeTab === 'saved' && (
          <View style={styles.section}>
            {savedLoading ? (
              <ActivityIndicator size="small" color="#007AFF" style={{ marginTop: 20 }} />
            ) : savedPlaces.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="bookmark-outline" size={40} color="#C7C7CC" />
                <Text style={styles.emptyText}>저장한 장소가 없어요</Text>
                <Text style={styles.emptySub}>마음에 드는 장소를 북마크해보세요!</Text>
              </View>
            ) : (
              savedPlaces.map(post => (
                <View key={post.id} style={styles.postCard}>
                  <View style={[styles.postAccent, { backgroundColor: post.type === 'blue' ? '#007AFF' : '#FF3B30' }]} />
                  <View style={styles.postBody}>
                    <Text style={styles.postTitle}>{post.title}</Text>
                    {post.description ? <Text style={styles.postDesc} numberOfLines={2}>{post.description}</Text> : null}
                    {post.address ? <Text style={styles.postAddress}>📍 {post.address}</Text> : null}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F2F7' },
  scrollContent: { paddingBottom: 40 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F2F2F7',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1C1C1E' },
  logoutBtn: { paddingHorizontal: 4 },
  logoutText: { color: '#FF3B30', fontSize: 14, fontWeight: '600' },

  profileCard: {
    backgroundColor: '#fff', margin: 16, borderRadius: 20, padding: 24, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#F3EEFF', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  levelBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, marginBottom: 8 },
  levelText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  nickname: { fontSize: 17, fontWeight: '800', color: '#1C1C1E', marginBottom: 4 },
  userEmail: { fontSize: 13, color: '#8E8E93', marginBottom: 16 },
  progressWrap: { width: '100%', marginBottom: 20 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 12, color: '#8E8E93' },
  progressCount: { fontSize: 12, color: '#8E8E93' },
  progressBg: { height: 6, backgroundColor: '#F2F2F7', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  statsRow: { flexDirection: 'row', width: '100%' },
  statBox: { flex: 1, alignItems: 'center', gap: 4 },
  statVal: { fontSize: 20, fontWeight: '800', color: '#007AFF' },
  statLabel: { fontSize: 11, color: '#8E8E93' },
  statDivider: { width: 1, height: 36, backgroundColor: '#F2F2F7', alignSelf: 'center' },

  inviteCard: {
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  inviteTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  inviteLabel: { fontSize: 11, color: '#8E8E93', marginBottom: 4 },
  inviteCode: { fontSize: 26, fontWeight: '900', color: '#1C1C1E', letterSpacing: 4 },
  inviteBtns: { flexDirection: 'row', gap: 8 },
  inviteIconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center' },
  addFriendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: '#EAF3FF' },
  addFriendBtnTxt: { fontSize: 14, fontWeight: '700', color: '#007AFF' },
  friendInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  friendInput: { flex: 1, backgroundColor: '#F2F2F7', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, fontWeight: '700', letterSpacing: 3 },
  friendSubmitBtn: { backgroundColor: '#007AFF', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  friendSubmitTxt: { color: 'white', fontWeight: '700', fontSize: 14 },

  friendsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, marginBottom: 12, backgroundColor: '#fff',
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  friendsBtnLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  friendsBtnTxt: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  friendsBtnRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  friendsBtnCount: { fontSize: 14, fontWeight: '700', color: '#007AFF' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  modalHeaderTitle: { fontSize: 17, fontWeight: '800', color: '#1C1C1E' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1C1C1E', marginBottom: 12 },
  friendItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  friendAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E6F1FB', alignItems: 'center', justifyContent: 'center' },
  friendAvatarTxt: { fontSize: 14, fontWeight: '700', color: '#185FA5' },
  friendName: { fontSize: 14, fontWeight: '700', color: '#1C1C1E' },
  friendEmail: { fontSize: 12, color: '#8E8E93' },

  tabRow: {
    flexDirection: 'row', marginHorizontal: 16, backgroundColor: '#fff',
    borderRadius: 14, padding: 4, marginBottom: 14, gap: 4,
  },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 10 },
  tabBtnActive: { backgroundColor: '#1C1C1E' },
  tabBtnText: { fontSize: 12, fontWeight: '600', color: '#8E8E93' },

  section: { paddingHorizontal: 16 },
  postCard: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, marginBottom: 10, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  postAccent: { width: 4 },
  postBody: { flex: 1, padding: 14 },
  postTitle: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', marginBottom: 4 },
  postDesc: { fontSize: 13, color: '#3A3A3C', lineHeight: 19, marginBottom: 6 },
  postAddress: { fontSize: 12, color: '#8E8E93', marginBottom: 8 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-end' },
  deleteBtnText: { fontSize: 12, color: '#FF3B30', fontWeight: '600' },

  emptyBox: { alignItems: 'center', paddingVertical: 50, gap: 8 },
  emptyText: { fontSize: 15, fontWeight: '700', color: '#8E8E93', marginTop: 8 },
  emptySub: { fontSize: 13, color: '#AEAEB2', textAlign: 'center' },
});