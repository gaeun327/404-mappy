import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Image, FlatList, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { db, auth, storage } from '../firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const CATEGORIES = [
  { id: 'food',     label: '🍽️ 음식점' },
  { id: 'cafe',     label: '☕ 카페·디저트' },
  { id: 'nature',   label: '🌿 자연·공원' },
  { id: 'culture',  label: '🎨 문화·전시' },
  { id: 'popup',    label: '🎪 팝업·이벤트' },
  { id: 'shop',     label: '🛍️ 쇼핑' },
  { id: 'hospital', label: '🏥 병원·약국' },
  { id: 'beauty',   label: '💇 미용' },
  { id: 'parking',  label: '🚗 주차장' },
  { id: 'stay',     label: '🏨 숙소' },
  { id: 'fitness',  label: '🏋️ 운동·헬스' },
  { id: 'study',    label: '📚 카공·스터디' },
  { id: 'play',     label: '🎮 오락·취미' },
  { id: 'etc',      label: '📍 기타' },
];
const PRESET_THEMES = ['🌸 벚꽃', '🍂 단풍', '❄️ 눈', '🌙 야경', '💑 데이트', '🐶 애견', '👤 혼자', '👯 친구들과', '📸 뷰맛집', '💰 가성비'];
const MAX_IMAGES = 10;
const { width } = Dimensions.get('window');

export default function EditPlaceScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [pinType, setPinType] = useState('blue');
  const [pinTitle, setPinTitle] = useState('');
  const [pinDesc, setPinDesc] = useState('');
  const [address, setAddress] = useState('');
  const [detailAddress, setDetailAddress] = useState('');
  const [category, setCategory] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [customTag, setCustomTag] = useState('');

  // existingImages: Storage에 이미 있는 이미지 { url, path }
  // newImages: 새로 추가한 로컬 uri
  // removedPaths: Storage에서 삭제할 경로들
  const [existingImages, setExistingImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [removedPaths, setRemovedPaths] = useState([]);

  useEffect(() => {
    const fetchPlace = async () => {
      if (!id) { Alert.alert('오류', '장소 ID가 없습니다.'); router.back(); return; }
      try {
        const snap = await getDoc(doc(db, 'places', id));
        if (!snap.exists()) { Alert.alert('오류', '장소를 찾을 수 없습니다.'); router.back(); return; }

        const data = snap.data();

        // 본인 글인지 확인
        if (data.userEmail !== auth.currentUser?.email) {
          Alert.alert('오류', '본인이 등록한 장소만 수정할 수 있습니다.');
          router.back();
          return;
        }

        setPinType(data.type ?? 'blue');
        setPinTitle(data.title ?? '');
        setPinDesc(data.description ?? '');
        setAddress(data.address ?? '');
        setDetailAddress(data.detailAddress ?? '');
        setCategory(data.category ?? '');
        setSelectedTags(data.tags ?? []);

        const urls = data.imageUrls ?? [];
        const paths = data.imagePaths ?? [];
        setExistingImages(urls.map((url, i) => ({ url, path: paths[i] ?? '' })));
      } catch (e) {
        Alert.alert('오류', '데이터를 불러오지 못했습니다.');
        router.back();
      } finally {
        setLoading(false);
      }
    };
    fetchPlace();
  }, [id]);

  const toggleTag = (tag) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const addCustomTag = () => {
    if (!customTag.trim()) return;
    const tag = customTag.startsWith('#') ? customTag.trim() : `#${customTag.trim()}`;
    if (!selectedTags.includes(tag)) setSelectedTags(prev => [...prev, tag]);
    setCustomTag('');
  };

  const totalImages = existingImages.length + newImages.length;

  const pickFromGallery = async () => {
    if (totalImages >= MAX_IMAGES) { Alert.alert('알림', `사진은 최대 ${MAX_IMAGES}장까지 추가할 수 있어요.`); return; }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - totalImages, quality: 0.7,
    });
    if (!result.canceled) {
      const newUris = result.assets.map(a => a.uri);
      setNewImages(prev => [...prev, ...newUris].slice(0, MAX_IMAGES - existingImages.length));
    }
  };

  const pickFromCamera = async () => {
    if (totalImages >= MAX_IMAGES) { Alert.alert('알림', `사진은 최대 ${MAX_IMAGES}장까지 추가할 수 있어요.`); return; }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('권한 필요', '카메라 접근 권한이 필요합니다.'); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.7 });
    if (!result.canceled) setNewImages(prev => [...prev, result.assets[0].uri]);
  };

  const handleImagePick = () => {
    Alert.alert('사진 추가', '어떻게 추가할까요?', [
      { text: '카메라로 촬영', onPress: pickFromCamera },
      { text: '갤러리에서 선택', onPress: pickFromGallery },
      { text: '취소', style: 'cancel' },
    ]);
  };

  const removeExistingImage = (index) => {
    const removed = existingImages[index];
    if (removed.path) setRemovedPaths(prev => [...prev, removed.path]);
    setExistingImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeNewImage = (index) => {
    setNewImages(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImage = async (uri, index) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = async () => {
        try {
          const blob = xhr.response;
          const path = `places/${id}_edit_${Date.now()}_${index}.jpg`;
          const storageRef = ref(storage, path);
          await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
          const url = await getDownloadURL(storageRef);
          resolve({ url, path });
        } catch (e) { reject(e); }
      };
      xhr.onerror = reject;
      xhr.responseType = 'blob';
      xhr.open('GET', uri, true);
      xhr.send(null);
    });
  };

  const handleSave = async () => {
    if (!pinTitle.trim()) return Alert.alert('알림', '장소 이름을 입력해주세요.');
    setSaving(true);

    try {
      // 새 이미지 업로드
      let uploaded = [];
      if (newImages.length > 0) {
        uploaded = await Promise.all(newImages.map((uri, i) => uploadImage(uri, i)));
      }

      // 최종 이미지 배열
      const finalUrls = [...existingImages.map(img => img.url), ...uploaded.map(r => r.url)];
      const finalPaths = [...existingImages.map(img => img.path), ...uploaded.map(r => r.path)];

      // Firestore 업데이트
      await updateDoc(doc(db, 'places', id), {
        type: pinType,
        title: pinTitle,
        description: pinDesc,
        category,
        address,
        detailAddress,
        tags: selectedTags,
        imageUrls: finalUrls,
        imagePaths: finalPaths,
        updatedAt: new Date(),
      });

      // 삭제된 이미지 Storage에서 제거 (실패해도 무시)
      if (removedPaths.length > 0) {
        await Promise.allSettled(
          removedPaths.filter(p => p).map(p => deleteObject(ref(storage, p)))
        );
      }

      Alert.alert('완료', '장소가 수정되었습니다! ✅', [
        { text: '확인', onPress: () => router.back() }
      ]);
    } catch (e) {
      Alert.alert('오류', e.message ?? '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>장소 정보를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const imageList = [
    ...existingImages.map((img, i) => ({ type: 'existing', uri: img.url, index: i })),
    ...newImages.map((uri, i) => ({ type: 'new', uri, index: i })),
    ...(totalImages < MAX_IMAGES ? [{ type: 'add' }] : []),
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1C1C1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>장소 수정</Text>
        <TouchableOpacity
          style={[styles.saveHeaderBtn, { backgroundColor: pinType === 'blue' ? '#007AFF' : '#FF3B30' }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.saveHeaderTxt}>저장</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.imageSection}>
          <FlatList
            data={imageList}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, i) => `${item.type}-${i}`}
            renderItem={({ item }) => {
              if (item.type === 'add') {
                return (
                  <TouchableOpacity style={styles.addImageBtn} onPress={handleImagePick}>
                    <Ionicons name="camera-outline" size={28} color="#C7C7CC" />
                    <Text style={styles.addImageCount}>{totalImages}/{MAX_IMAGES}</Text>
                  </TouchableOpacity>
                );
              }
              return (
                <View style={styles.imageThumb}>
                  <Image source={{ uri: item.uri }} style={styles.thumbImg} />
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => item.type === 'existing'
                      ? removeExistingImage(item.index)
                      : removeNewImage(item.index)
                    }
                  >
                    <Ionicons name="close-circle" size={22} color="white" />
                  </TouchableOpacity>
                </View>
              );
            }}
            ListEmptyComponent={
              <TouchableOpacity style={styles.emptyImageBtn} onPress={handleImagePick}>
                <Ionicons name="camera-outline" size={32} color="#C7C7CC" />
                <Text style={styles.imgPlaceholderText}>사진 추가 (최대 10장)</Text>
                <Text style={styles.imgPlaceholderSub}>탭하여 카메라 촬영 또는 갤러리 선택</Text>
              </TouchableOpacity>
            }
          />
        </View>

        <Text style={styles.sectionLabel}>주소</Text>
        <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="주소를 입력해주세요" />

        <Text style={styles.sectionLabel}>상세주소</Text>
        <TextInput style={styles.input} value={detailAddress} onChangeText={setDetailAddress} placeholder="예: 2층, B동 101호" />

        <Text style={styles.sectionLabel}>유형</Text>
        <View style={styles.typeRow}>
          <TouchableOpacity style={[styles.typeBtn, pinType === 'blue' && styles.typeBtnBlue]} onPress={() => setPinType('blue')}>
            <Text style={[styles.typeBtnTxt, pinType === 'blue' && { color: 'white' }]}>👍 추천 (Blue)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.typeBtn, pinType === 'red' && styles.typeBtnRed]} onPress={() => setPinType('red')}>
            <Text style={[styles.typeBtnTxt, pinType === 'red' && { color: 'white' }]}>👎 경고 (Red)</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>장소 이름 <Text style={styles.required}>*</Text></Text>
        <TextInput style={styles.input} placeholder="예: 성수 감성 카페" value={pinTitle} onChangeText={setPinTitle} />

        <Text style={styles.sectionLabel}>한줄 평</Text>
        <TextInput
          style={[styles.input, { height: 90, textAlignVertical: 'top', paddingTop: 14 }]}
          placeholder="예: 분위기 좋고 커피 맛있어요!"
          value={pinDesc} onChangeText={setPinDesc} multiline
        />

        <Text style={styles.sectionLabel}>카테고리 <Text style={styles.required}>*</Text></Text>
        <View style={styles.tagWrap}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.tagChip, category === cat.id && styles.tagChipOn]}
              onPress={() => setCategory(cat.id)}
            >
              <Text style={[styles.tagChipTxt, category === cat.id && { color: 'white' }]}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>테마 태그</Text>
        <View style={styles.tagWrap}>
          {PRESET_THEMES.map(tag => (
            <TouchableOpacity
              key={tag}
              style={[styles.tagChip, selectedTags.includes(tag) && styles.tagChipOn]}
              onPress={() => toggleTag(tag)}
            >
              <Text style={[styles.tagChipTxt, selectedTags.includes(tag) && { color: 'white' }]}>{tag}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.customRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="직접 입력 (예: 🌊 바다뷰)"
            value={customTag} onChangeText={setCustomTag}
            onSubmitEditing={addCustomTag} returnKeyType="done"
          />
          <TouchableOpacity style={styles.addBtn} onPress={addCustomTag}>
            <Ionicons name="add" size={22} color="white" />
          </TouchableOpacity>
        </View>

        {selectedTags.filter(t => !PRESET_THEMES.includes(t)).length > 0 && (
          <View style={[styles.tagWrap, { marginTop: 10 }]}>
            {selectedTags.filter(t => !PRESET_THEMES.includes(t)).map(tag => (
              <TouchableOpacity key={tag} style={styles.tagChipOn} onPress={() => toggleTag(tag)}>
                <Text style={[styles.tagChipTxt, { color: 'white' }]}>{tag} ✕</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: pinType === 'blue' ? '#007AFF' : '#FF3B30' }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="white" /> : <Text style={styles.saveBtnTxt}>수정 완료</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  loadingText: { fontSize: 15, color: '#8E8E93' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F2F2F7',
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1C1C1E' },
  saveHeaderBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  saveHeaderTxt: { color: 'white', fontWeight: '700', fontSize: 14 },
  content: { paddingTop: 20, paddingBottom: 40 },
  imageSection: { height: 160, marginBottom: 20, paddingLeft: 24 },
  emptyImageBtn: {
    width: width - 48, height: 150, borderRadius: 16,
    backgroundColor: '#F8F8F8', borderWidth: 1.5, borderColor: '#E5E5EA',
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  addImageBtn: {
    width: 100, height: 150, borderRadius: 16, marginRight: 10,
    backgroundColor: '#F8F8F8', borderWidth: 1.5, borderColor: '#E5E5EA',
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  addImageCount: { fontSize: 12, color: '#C7C7CC' },
  imageThumb: { width: 150, height: 150, borderRadius: 16, marginRight: 10, overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  removeBtn: { position: 'absolute', top: 6, right: 6 },
  imgPlaceholderText: { fontSize: 15, fontWeight: '600', color: '#8E8E93' },
  imgPlaceholderSub: { fontSize: 12, color: '#C7C7CC' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#1C1C1E', marginBottom: 10, paddingHorizontal: 24 },
  required: { color: '#FF3B30' },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 20, paddingHorizontal: 24 },
  typeBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E5EA' },
  typeBtnBlue: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  typeBtnRed: { backgroundColor: '#FF3B30', borderColor: '#FF3B30' },
  typeBtnTxt: { fontWeight: '700', fontSize: 14, color: '#8E8E93' },
  input: { backgroundColor: '#F2F2F7', padding: 14, borderRadius: 12, fontSize: 15, marginBottom: 20, marginHorizontal: 24 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14, paddingHorizontal: 24 },
  tagChip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F2F2F7', borderWidth: 1.5, borderColor: '#E5E5EA' },
  tagChipOn: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, backgroundColor: '#007AFF', borderWidth: 1.5, borderColor: '#007AFF' },
  tagChipTxt: { fontSize: 13, fontWeight: '600', color: '#8E8E93' },
  customRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 20, paddingHorizontal: 24 },
  addBtn: { width: 46, height: 46, backgroundColor: '#007AFF', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  saveBtn: { padding: 17, borderRadius: 14, alignItems: 'center', marginTop: 10, marginHorizontal: 24 },
  saveBtnTxt: { color: 'white', fontWeight: '800', fontSize: 16 },
});