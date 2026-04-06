import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, View, Text, TouchableOpacity, TextInput, Modal, Alert, 
  Dimensions, ActivityIndicator, Animated, PanResponder, ScrollView, FlatList
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../firebaseConfig'; 
import { collection, addDoc, getDocs, query, orderBy, where, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function HomeScreen() {
  const mapRef = useRef(null);
  const [markers, setMarkers] = useState([]);
  const [myPlaces, setMyPlaces] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, good, bad
  const [activeTab, setActiveTab] = useState(0); 

  // --- 등록 모달 상태 ---
  const [modalVisible, setModalVisible] = useState(false);
  const [newCoords, setNewCoords] = useState(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [rating, setRating] = useState(5);
  const [type, setType] = useState('good'); // good or bad

  // --- 바텀 시트 애니메이션 ---
  const sheetMinHeight = 120; 
  const sheetMaxHeight = SCREEN_HEIGHT * 0.85; 
  const panY = useRef(new Animated.Value(SCREEN_HEIGHT - sheetMinHeight)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderMove: (e, gestureState) => {
        const newY = SCREEN_HEIGHT - sheetMinHeight + gestureState.dy;
        if (newY >= SCREEN_HEIGHT - sheetMaxHeight && newY <= SCREEN_HEIGHT - sheetMinHeight) {
          panY.setValue(newY);
        }
      },
      onPanResponderRelease: (e, gestureState) => {
        if (gestureState.dy < -50) {
          Animated.spring(panY, { toValue: SCREEN_HEIGHT - sheetMaxHeight, useNativeDriver: false }).start();
        } else {
          Animated.spring(panY, { toValue: SCREEN_HEIGHT - sheetMinHeight, useNativeDriver: false }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    fetchMarkers();
    getCurrentLocation();
    fetchMyPlaces();
  }, []);

  useEffect(() => { if (activeTab === 3) fetchMyPlaces(); }, [activeTab]);

  const getCurrentLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      let loc = await Location.getCurrentPositionAsync({});
      setUserLocation(loc.coords);
      moveToLocation(loc.coords.latitude, loc.coords.longitude);
    }
  };

  const moveToLocation = (lat, lng) => {
    mapRef.current?.animateToRegion({
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    }, 1000);
  };

  const fetchMarkers = async () => {
    try {
      const q = query(collection(db, "places"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setMarkers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) { console.log("마커 로딩 에러:", e); }
  };

  const fetchMyPlaces = async () => {
    if (!auth.currentUser) return;
    const q = query(collection(db, "places"), where("userEmail", "==", auth.currentUser.email));
    const snap = await getDocs(q);
    setMyPlaces(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  // --- 지도를 꾹 눌렀을 때 장소 등록 ---
  const handleLongPress = (e) => {
    setNewCoords(e.nativeEvent.coordinate);
    setModalVisible(true);
  };

  const savePlace = async () => {
    if (!title) return Alert.alert("이름을 입력해주세요!");
    try {
      await addDoc(collection(db, "places"), {
        title,
        description: desc,
        rating,
        type,
        coordinate: newCoords,
        userEmail: auth.currentUser.email,
        createdAt: serverTimestamp(),
      });
      setModalVisible(false);
      setTitle(''); setDesc('');
      fetchMarkers();
      fetchMyPlaces();
    } catch (e) { console.log("저장 에러:", e); }
  };

  const deletePlace = async (id) => {
    Alert.alert("삭제", "정말 삭제할까요?", [
      { text: "취소" },
      { text: "삭제", onPress: async () => {
          await deleteDoc(doc(db, "places", id));
          fetchMarkers(); fetchMyPlaces();
      }}
    ]);
  };

  // 🏆 9단계 등급 로직
  const getUserLevel = (count) => {
    if (count >= 50) return { name: "마스터 👑", color: "#FFD700", next: "MAX" };
    if (count >= 40) return { name: "인싸 큐레이터", color: "#6C5CE7", next: 50 - count };
    if (count >= 30) return { name: "트렌드 헌터", color: "#A29BFE", next: 40 - count };
    if (count >= 20) return { name: "숨은스팟 발견자", color: "#00CEC9", next: 30 - count };
    if (count >= 15) return { name: "로컬 탐색자", color: "#81ECEC", next: 20 - count };
    if (count >= 10) return { name: "길잡이", color: "#FAB1A0", next: 15 - count };
    if (count >= 5)  return { name: "지도 입문자", color: "#FFEAA7", next: 10 - count };
    if (count >= 2)  return { name: "동네 탐험가", color: "#55EFC4", next: 5 - count };
    return { name: "새싹 탐험가 🌱", color: "#00B894", next: 2 - count };
  };

  const level = getUserLevel(myPlaces.length);
  
  // 검색 및 타입 필터링 적용
  const filteredMarkers = markers.filter(m => {
    const matchSearch = m.title.includes(searchQuery);
    const matchType = filterType === 'all' || m.type === filterType;
    return matchSearch && matchType;
  });

  const renderTabContent = () => {
    switch(activeTab) {
      case 0: return (
        <View style={styles.tabInner}>
          <Text style={styles.tabTitle}>👥 실시간 추천 피드</Text>
          <FlatList 
            data={markers}
            keyExtractor={item => item.id}
            renderItem={({item}) => (
              <TouchableOpacity style={styles.feedCard} onPress={() => moveToLocation(item.coordinate.latitude, item.coordinate.longitude)}>
                <View style={styles.rowBetween}>
                  <Text style={styles.feedUser}>{item.userEmail?.split('@')[0]}님</Text>
                  <Text style={[styles.feedTag, {color: item.type === 'good' ? '#007AFF' : '#FF3B30'}]}>
                    {item.type === 'good' ? '👍 추천' : '⚠️ 주의'}
                  </Text>
                </View>
                <Text style={styles.feedPlace}>{item.title}</Text>
                <Text style={styles.feedDesc} numberOfLines={1}>{item.description}</Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={{paddingBottom: 150}}
          />
        </View>
      );
      case 1: return (
        <View style={styles.tabInner}>
          <Text style={styles.tabTitle}>🤖 AI 메뉴 추천</Text>
          <View style={styles.aiCard}>
            <Ionicons name="sparkles" size={24} color="#007AFF" />
            <Text style={styles.aiText}>"팀장님, 지금 위치 근처에는 평점 4.8인 '성수 소문난 감자탕'이 가장 핫해요!"</Text>
          </View>
          <TextInput style={styles.chatInput} placeholder="메뉴 추천을 받아보세요..." />
        </View>
      );
      case 3: return (
        <ScrollView style={styles.tabInner} showsVerticalScrollIndicator={false}>
          <Text style={styles.tabTitle}>내 프로필</Text>
          <View style={styles.profileCard}>
            <View style={[styles.levelBadge, {backgroundColor: level.color}]}>
              <Text style={styles.levelText}>{level.name}</Text>
            </View>
            <Text style={styles.userEmail}>{auth.currentUser?.email}</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}><Text style={styles.statVal}>{myPlaces.length}</Text><Text style={styles.statLabel}>등록 장소</Text></View>
              <View style={styles.divider} />
              <View style={styles.statBox}><Text style={styles.statVal}>{myPlaces.length * 100}P</Text><Text style={styles.statLabel}>포인트</Text></View>
            </View>
          </View>
          <Text style={styles.sectionTitle}>내가 공유한 장소</Text>
          {myPlaces.map(item => (
            <View key={item.id} style={styles.placeItem}>
              <View style={{flex:1}}>
                <Text style={styles.placeTitle}>{item.title}</Text>
                <View style={{flexDirection:'row'}}>{[1,2,3,4,5].map(i=><Ionicons key={i} name={i<=item.rating?"star":"star-outline"} size={12} color="#FFD700" />)}</View>
              </View>
              <TouchableOpacity onPress={() => deletePlace(item.id)}><Ionicons name="trash-outline" size={18} color="#FF3B30" /></TouchableOpacity>
            </View>
          ))}
          <View style={{height: 200}} />
        </ScrollView>
      );
      default: return <View style={styles.emptyView}><Text>준비 중...</Text></View>;
    }
  };

  return (
    <View style={styles.container}>
      {/* 지도 영역 */}
      <MapView 
        ref={mapRef} 
        style={styles.map} 
        showsUserLocation 
        onLongPress={handleLongPress}
      >
        {filteredMarkers.map(m => (
          <Marker 
            key={m.id} 
            coordinate={m.coordinate} 
            title={m.title} 
            pinColor={m.type === 'good' ? '#007AFF' : '#FF3B30'} 
          />
        ))}
      </MapView>

      {/* 상단 검색 및 필터 */}
      <View style={styles.topContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#007AFF" />
          <TextInput style={styles.searchInput} placeholder="맛집, 카페 검색" value={searchQuery} onChangeText={setSearchQuery} />
        </View>
        <View style={styles.filterRow}>
          <FilterBtn label="전체" active={filterType==='all'} onPress={()=>setFilterType('all')} />
          <FilterBtn label="👍 추천" active={filterType==='good'} onPress={()=>setFilterType('good')} />
          <FilterBtn label="⚠️ 주의" active={filterType==='bad'} onPress={()=>setFilterType('bad')} />
        </View>
      </View>

      {/* 내 위치 버튼 */}
      <TouchableOpacity style={styles.myLocationBtn} onPress={getCurrentLocation}>
        <Ionicons name="locate" size={28} color="#007AFF" />
      </TouchableOpacity>

      {/* 바텀 시트 */}
      <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: panY }] }]}>
        <View {...panResponder.panHandlers} style={styles.handleContainer}><View style={styles.handle} /></View>
        <View style={styles.contentContainer}>{renderTabContent()}</View>
      </Animated.View>

      {/* 하단 탭바 */}
      <View style={styles.tabBar}>
        <TabItem icon="map" label="지도" active={activeTab===0} onPress={()=>setActiveTab(0)} />
        <TabItem icon="sparkles" label="AI" active={activeTab===1} onPress={()=>setActiveTab(1)} />
        <TabItem icon="person" label="마이" active={activeTab===3} onPress={()=>setActiveTab(3)} />
      </View>

      {/* 장소 등록 모달 */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>새로운 장소 등록</Text>
            <TextInput style={styles.input} placeholder="장소 이름" value={title} onChangeText={setTitle} />
            <TextInput style={[styles.input, {height: 80}]} placeholder="설명 (맛, 분위기 등)" multiline value={desc} onChangeText={setDesc} />
            
            <View style={styles.typeRow}>
              <TouchableOpacity style={[styles.typeBtn, type==='good' && styles.typeBtnActive]} onPress={()=>setType('good')}>
                <Text style={{color: type==='good'?'white':'#007AFF'}}>👍 추천해요</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.typeBtn, type==='bad' && styles.typeBtnActiveBad]} onPress={()=>setType('bad')}>
                <Text style={{color: type==='bad'?'white':'#FF3B30'}}>⚠️ 별로예요</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={()=>setModalVisible(false)}><Text>취소</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={savePlace}><Text style={{color:'white', fontWeight:'bold'}}>저장하기</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// 소형 컴포넌트
const TabItem = ({ icon, label, active, onPress }) => (
  <TouchableOpacity style={styles.tabItem} onPress={onPress}>
    <Ionicons name={icon} size={22} color={active ? '#007AFF' : '#8E8E93'} />
    <Text style={{fontSize: 10, marginTop: 4, color: active ? '#007AFF' : '#8E8E93', fontWeight: 'bold'}}>{label}</Text>
  </TouchableOpacity>
);

const FilterBtn = ({ label, active, onPress }) => (
  <TouchableOpacity style={[styles.filterBtn, active && styles.filterBtnActive]} onPress={onPress}>
    <Text style={[styles.filterBtnText, active && {color:'white'}]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  map: { width: width, height: SCREEN_HEIGHT },
  topContainer: { position: 'absolute', top: 60, width: '100%', paddingHorizontal: 20, zIndex: 10 },
  searchBar: { backgroundColor: 'white', height: 50, borderRadius: 25, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, elevation: 5, shadowOpacity: 0.1, marginBottom: 10 },
  searchInput: { flex: 1, marginLeft: 10 },
  filterRow: { flexDirection: 'row' },
  filterBtn: { backgroundColor: 'white', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginRight: 8, elevation: 3, shadowOpacity: 0.05 },
  filterBtnActive: { backgroundColor: '#007AFF' },
  filterBtnText: { fontSize: 12, fontWeight: '600', color: '#555' },
  myLocationBtn: { position: 'absolute', top: 180, right: 20, backgroundColor: 'white', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', elevation: 5, zIndex: 10 },
  bottomSheet: { position: 'absolute', top: 0, left: 0, right: 0, height: SCREEN_HEIGHT, backgroundColor: 'white', borderTopLeftRadius: 30, borderTopRightRadius: 30, elevation: 20 },
  handleContainer: { width: '100%', alignItems: 'center', paddingVertical: 15 },
  handle: { width: 40, height: 5, backgroundColor: '#EEE', borderRadius: 3 },
  contentContainer: { flex: 1, paddingHorizontal: 25 },
  tabInner: { flex: 1 },
  tabTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  tabBar: { position: 'absolute', bottom: 0, flexDirection: 'row', width: '100%', height: 90, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#F2F2F7', paddingBottom: 25, zIndex: 100 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  feedCard: { padding: 15, backgroundColor: '#F8F9FA', borderRadius: 15, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  feedUser: { fontWeight: 'bold' },
  feedTag: { fontSize: 10, fontWeight: 'bold' },
  feedPlace: { fontSize: 16, fontWeight: 'bold' },
  feedDesc: { fontSize: 13, color: '#666' },
  profileCard: { backgroundColor: '#F8F9FA', borderRadius: 20, padding: 25, alignItems: 'center', marginBottom: 25 },
  levelBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginBottom: 8 },
  levelText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  userEmail: { fontSize: 16, fontWeight: 'bold' },
  statsRow: { flexDirection: 'row', marginTop: 20 },
  statBox: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: 'bold', color: '#007AFF' },
  statLabel: { fontSize: 11, color: '#888' },
  divider: { width: 1, height: 30, backgroundColor: '#EEE' },
  placeItem: { flexDirection: 'row', backgroundColor: '#F8F9FA', padding: 15, borderRadius: 12, marginBottom: 10, alignItems: 'center' },
  placeTitle: { fontWeight: 'bold' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 20, padding: 25 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  input: { backgroundColor: '#F2F2F7', padding: 15, borderRadius: 12, marginBottom: 15 },
  typeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  typeBtn: { flex: 0.48, padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#EEE' },
  typeBtnActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  typeBtnActiveBad: { backgroundColor: '#FF3B30', borderColor: '#FF3B30' },
  modalBtns: { flexDirection: 'row', justifyContent: 'space-between' },
  cancelBtn: { flex: 0.45, padding: 15, alignItems: 'center' },
  saveBtn: { flex: 0.45, backgroundColor: '#007AFF', padding: 15, borderRadius: 12, alignItems: 'center' }
});