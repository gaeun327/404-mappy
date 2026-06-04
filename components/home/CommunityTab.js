import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  SafeAreaView, ActivityIndicator, Alert, RefreshControl, TextInput, Modal,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../../firebaseConfig';
import {
  collection, query, where, orderBy, getDocs, addDoc,
  onSnapshot, serverTimestamp, doc, getDoc,
} from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';

const CATEGORIES = [
  { key: '전체',    icon: 'apps',          color: '#1C1C1E' },
  { key: '장소공유', icon: 'location',   color: '#FF6B35' },
  { key: '번개모임', icon: 'flash',        color: '#F59E0B' },
  { key: '자유수다', icon: 'chatbubbles',  color: '#10B981' },
  { key: '동네질문', icon: 'help-circle',  color: '#3B82F6' },
];

const CATEGORY_META = {
  '자유수다': { color: '#10B981', bg: '#EDFAF4' },
  '장소공유': { color: '#FF6B35', bg: '#FFF3EE' },
  '번개모임': { color: '#F59E0B', bg: '#FFFBEB' },
  '동네질문': { color: '#3B82F6', bg: '#EFF6FF' },
};

// 좌표 → 구 이름 추출
const getDistrictFromCoords = async (lat, lng) => {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (results.length > 0) {
      const r = results[0];
      return r.subregion || r.district || r.city || '알 수 없음';
    }
  } catch (e) { console.log('reverseGeocode 오류:', e); }
  return null;
};

export default function CommunityTab() {
  const router = useRouter();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState('전체');
  const [myDistrict, setMyDistrict] = useState(null);
  const [districtLoading, setDistrictLoading] = useState(true);

  // 방장 관리
  const [editModal, setEditModal] = useState(false);
  const [editRoom, setEditRoom] = useState(null);
  const [editRoomName, setEditRoomName] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // 방 만들기 모달
  const [createModal, setCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCategory, setNewRoomCategory] = useState('자유수다');
  const [creating, setCreating] = useState(false);

  useFocusEffect(useCallback(() => {
    initDistrict();
  }, []));

  const initDistrict = async () => {
    setDistrictLoading(true);
    try {
      // 1. Firestore users에 저장된 구 확인
      const uid = auth.currentUser?.uid;
      if (uid) {
        const userSnap = await getDoc(doc(db, 'users', uid));
        if (userSnap.exists() && userSnap.data().district) {
          setMyDistrict(userSnap.data().district);
          fetchRooms(userSnap.data().district);
          setDistrictLoading(false);
          return;
        }
      }
      // 2. 없으면 GPS로 감지
      await detectDistrict();
    } catch (e) {
      setDistrictLoading(false);
    }
  };

  const detectDistrict = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('위치 권한 필요', '동네 채팅방 이용을 위해 위치 권한이 필요해요.');
        setDistrictLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const district = await getDistrictFromCoords(loc.coords.latitude, loc.coords.longitude);
      if (district) {
        setMyDistrict(district);
        // Firestore에 저장
        const uid = auth.currentUser?.uid;
        if (uid) {
          const { updateDoc } = await import('firebase/firestore');
          await updateDoc(doc(db, 'users', uid), { district });
        }
        fetchRooms(district);
      }
    } catch (e) { console.log('위치 감지 오류:', e); }
    finally { setDistrictLoading(false); }
  };

  const fetchRooms = async (district) => {
    try {
      const q = query(
        collection(db, 'chatRooms'),
        where('district', '==', district),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.log('채팅방 불러오기 오류:', e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (myDistrict) fetchRooms(myDistrict);
    else { setRefreshing(false); detectDistrict(); }
  };

  const handleEditRoom = async () => {
    if (!editRoomName.trim()) return;
    setEditLoading(true);
    try {
      await updateDoc(doc(db, 'chatRooms', editRoom.id), { name: editRoomName.trim() });
      setRooms(prev => prev.map(r => r.id === editRoom.id ? { ...r, name: editRoomName.trim() } : r));
      setEditModal(false);
    } catch (e) { Alert.alert('오류', '수정에 실패했어요.'); }
    finally { setEditLoading(false); }
  };

  const handleDeleteRoom = (room) => {
    Alert.alert('방 삭제', `"${room.name}" 방을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'chatRooms', room.id));
            setRooms(prev => prev.filter(r => r.id !== room.id));
          } catch (e) { Alert.alert('오류', '삭제에 실패했어요.'); }
        }
      }
    ]);
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return Alert.alert('알림', '방 이름을 입력해주세요.');
    setCreating(true);
    try {
      await addDoc(collection(db, 'chatRooms'), {
        name: newRoomName.trim(),
        category: newRoomCategory,
        district: myDistrict,
        createdBy: auth.currentUser?.email,
        creatorNickname: auth.currentUser?.displayName ?? '익명',
        lastMsg: '채팅방이 생성되었습니다.',
        lastMsgAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        memberCount: 1,
      });
      setNewRoomName('');
      setNewRoomCategory('자유수다');
      setCreateModal(false);
      fetchRooms(myDistrict);
    } catch (e) { Alert.alert('오류', '방 만들기에 실패했어요.'); }
    finally { setCreating(false); }
  };

  const filtered = activeCategory === '전체'
    ? rooms
    : rooms.filter(r => r.category === activeCategory);

  const renderRoom = ({ item }) => {
    const meta = CATEGORY_META[item.category] ?? { color: '#8E8E93', bg: '#F2F2F7' };
    const catIcon = CATEGORIES.find(c => c.key === item.category)?.icon ?? 'chatbubble';

    return (
      <TouchableOpacity
        style={styles.room}
        activeOpacity={0.8}
        onPress={() => router.push({ pathname: '/chat', params: { roomId: item.id, roomName: item.name, district: item.district, createdBy: item.createdBy ?? '' } })}
      >
        <View style={[styles.roomIcon, { backgroundColor: meta.bg }]}>
          <Ionicons name={catIcon} size={20} color={meta.color} />
        </View>

        <View style={styles.roomInfo}>
          <View style={styles.roomTopRow}>
            <Text style={styles.roomName} numberOfLines={1}>{item.name}</Text>

            <Text style={styles.roomTime}>
              {item.lastMsgAt?.toDate ? item.lastMsgAt.toDate().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''}
            </Text>
          </View>

          <View style={styles.roomMidRow}>
            <View style={[styles.catBadge, { backgroundColor: meta.bg }]}>
              <Text style={[styles.catBadgeText, { color: meta.color }]}>{item.category}</Text>
            </View>
          </View>

          <Text style={styles.lastMsg} numberOfLines={1}>{item.lastMsg}</Text>

          <View style={styles.roomBottomRow}>
            <Ionicons name="location-outline" size={11} color="#AEAEB2" />
            <Text style={styles.metaText}>{item.district}</Text>
            <View style={styles.metaDot} />
            <Text style={styles.metaText}>by {item.creatorNickname ?? '익명'}</Text>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
      </TouchableOpacity>
    );
  };

  // 동네 인증 전 화면
  if (districtLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.centerText}>동네 확인 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!myDistrict) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerBox}>
          <Ionicons name="location-outline" size={52} color="#C7C7CC" />
          <Text style={styles.centerTitle}>동네 인증이 필요해요</Text>
          <Text style={styles.centerSub}>위치 권한을 허용하면{'\n'}내 동네 채팅방을 이용할 수 있어요!</Text>
          <TouchableOpacity style={styles.authBtn} onPress={detectDistrict}>
            <Ionicons name="location" size={16} color="white" />
            <Text style={styles.authBtnTxt}>동네 인증하기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>NEARBY</Text>
          <Text style={styles.headerTitle}>동네 소통방</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setCreateModal(true)} activeOpacity={0.8}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>방 만들기</Text>
        </TouchableOpacity>
      </View>

      {/* 동네 배너 */}
      <View style={styles.districtBanner}>
        <View style={styles.districtDot} />
        <Text style={styles.districtText}>
          <Text style={styles.districtName}>{myDistrict}</Text> 채팅방 {rooms.length}개
        </Text>
        <TouchableOpacity onPress={detectDistrict}>
          <Text style={styles.reAuthTxt}>재인증</Text>
        </TouchableOpacity>
      </View>

      {/* 카테고리 필터 */}
      <View style={styles.categoryWrap}>
        {CATEGORIES.map(cat => {
          const isActive = activeCategory === cat.key;
          return (
            <TouchableOpacity
              key={cat.key}
              style={[styles.catPill, isActive && { backgroundColor: '#1C1C1E' }]}
              onPress={() => setActiveCategory(cat.key)}
              activeOpacity={0.75}
            >
              <Ionicons name={cat.icon} size={13} color={isActive ? '#fff' : '#8E8E93'} style={{ marginRight: 4 }} />
              <Text style={[styles.catPillText, isActive && { color: '#fff' }]}>{cat.key}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 채팅방 목록 */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderRoom}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#007AFF" />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="chatbubbles-outline" size={44} color="#C7C7CC" />
              <Text style={styles.emptyText}>{myDistrict}에 채팅방이 없어요</Text>
              <Text style={styles.emptySub}>첫 번째 방을 만들어보세요!</Text>
            </View>
          }
        />
      )}

      {/* 방 수정 모달 */}
      <Modal visible={editModal} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={[styles.modalOverlay, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]} onPress={() => setEditModal(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>채팅방 관리</Text>
            <Text style={styles.modalLabel}>방 이름 수정</Text>
            <TextInput
              style={styles.modalInput}
              value={editRoomName}
              onChangeText={setEditRoomName}
              maxLength={30}
            />
            <TouchableOpacity style={styles.createBtn} onPress={handleEditRoom} disabled={editLoading}>
              {editLoading ? <ActivityIndicator color="white" /> : <Text style={styles.createBtnTxt}>수정 완료</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: '#FF3B30', marginTop: 10 }]}
              onPress={() => { setEditModal(false); handleDeleteRoom(editRoom); }}
            >
              <Text style={styles.createBtnTxt}>방 삭제</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 방 만들기 모달 */}
      <Modal visible={createModal} transparent animationType="slide">
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={[styles.modalOverlay, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]} onPress={() => setCreateModal(false)} />
          <KeyboardAvoidingView
            style={{ flex: 1, justifyContent: 'flex-end' }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
          <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>새 채팅방 만들기</Text>
          <Text style={styles.modalDistrict}>📍 {myDistrict}</Text>

          <Text style={styles.modalLabel}>방 이름</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="채팅방 이름을 입력하세요"
            value={newRoomName}
            onChangeText={setNewRoomName}
            maxLength={30}
          />

          <Text style={styles.modalLabel}>카테고리</Text>
          <View style={styles.modalCatWrap}>
            {CATEGORIES.filter(c => c.key !== '전체').map(cat => (
              <TouchableOpacity
                key={cat.key}
                style={[styles.modalCatBtn, newRoomCategory === cat.key && { backgroundColor: '#1C1C1E', borderColor: '#1C1C1E' }]}
                onPress={() => setNewRoomCategory(cat.key)}
              >
                <Text style={[styles.modalCatTxt, newRoomCategory === cat.key && { color: '#fff' }]}>{cat.key}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.createBtn} onPress={handleCreateRoom} disabled={creating}>
            {creating
              ? <ActivityIndicator color="white" />
              : <Text style={styles.createBtnTxt}>만들기</Text>
            }
          </TouchableOpacity>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F2F7' },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 40 },
  centerTitle: { fontSize: 18, fontWeight: '800', color: '#1C1C1E', textAlign: 'center' },
  centerText: { fontSize: 15, color: '#8E8E93' },
  centerSub: { fontSize: 14, color: '#8E8E93', textAlign: 'center', lineHeight: 22 },
  authBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#007AFF', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, marginTop: 8 },
  authBtnTxt: { color: 'white', fontWeight: '700', fontSize: 15 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerLabel: { fontSize: 11, fontWeight: '700', color: '#007AFF', letterSpacing: 1.5, marginBottom: 2 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.5 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1C1C1E', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  districtBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 14, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  districtDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34C759' },
  districtText: { flex: 1, fontSize: 13, color: '#3A3A3C' },
  districtName: { fontWeight: '800', color: '#1C1C1E' },
  reAuthTxt: { fontSize: 12, color: '#007AFF', fontWeight: '600' },

  categoryWrap: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  catPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E5EA' },
  catPillText: { fontSize: 13, fontWeight: '600', color: '#8E8E93' },

  listContent: { paddingHorizontal: 16, paddingBottom: 30 },
  room: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  roomIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  roomInfo: { flex: 1, gap: 3 },
  roomTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roomName: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', flex: 1, marginRight: 8 },
  roomTime: { fontSize: 11, color: '#AEAEB2' },
  roomMidRow: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  catBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  catBadgeText: { fontSize: 11, fontWeight: '600' },
  lastMsg: { fontSize: 13, color: '#8E8E93', marginTop: 1 },
  roomBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText: { fontSize: 11, color: '#AEAEB2' },
  metaDot: { width: 2, height: 2, borderRadius: 1, backgroundColor: '#D1D1D6' },

  emptyBox: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#8E8E93', marginTop: 8 },
  emptySub: { fontSize: 13, color: '#AEAEB2' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 44 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E5E5EA', alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1C1C1E', marginBottom: 4 },
  modalDistrict: { fontSize: 13, color: '#8E8E93', marginBottom: 20 },
  modalLabel: { fontSize: 13, fontWeight: '700', color: '#1C1C1E', marginBottom: 8 },
  modalInput: { backgroundColor: '#F2F2F7', borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 20 },
  modalCatWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  modalCatBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#E5E5EA', backgroundColor: '#fff' },
  modalCatTxt: { fontSize: 13, fontWeight: '600', color: '#8E8E93' },
  createBtn: { backgroundColor: '#1C1C1E', padding: 16, borderRadius: 14, alignItems: 'center' },
  createBtnTxt: { color: 'white', fontWeight: '800', fontSize: 16 },
});