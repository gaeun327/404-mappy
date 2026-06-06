import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { auth, db, storage } from '../firebaseConfig';
import { doc, getDoc, updateDoc, collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';

export default function EditProfileScreen() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileImage, setProfileImage] = useState(null); // 새로 선택한 로컬 uri
  const [currentImageUrl, setCurrentImageUrl] = useState(null); // 기존 이미지 url
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) {
          const data = snap.data();
          setNickname(data.nickname ?? auth.currentUser?.displayName ?? '');
          setCurrentImageUrl(data.profileImageUrl ?? null);
        }
      } catch (e) { console.log('프로필 로드 오류:', e); }
      finally { setLoading(false); }
    };
    loadProfile();
  }, []);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7,
    });
    if (!result.canceled) setProfileImage(result.assets[0].uri);
  };

  const uploadProfileImage = async (uri) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = async () => {
        try {
          const blob = xhr.response;
          const path = `profiles/${auth.currentUser.uid}.jpg`;
          const storageRef = ref(storage, path);
          await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
          const url = await getDownloadURL(storageRef);
          resolve(url);
        } catch (e) { reject(e); }
      };
      xhr.onerror = reject;
      xhr.responseType = 'blob';
      xhr.open('GET', uri, true);
      xhr.send(null);
    });
  };

  const handleSave = async () => {
    if (!nickname.trim()) return Alert.alert('알림', '닉네임을 입력해주세요.');

    // 비밀번호 변경 시 유효성 검사
    if (newPassword) {
      if (!currentPassword) return Alert.alert('알림', '현재 비밀번호를 입력해주세요.');
      if (newPassword.length < 6) return Alert.alert('알림', '새 비밀번호는 6자 이상이어야 합니다.');
      if (newPassword !== confirmPassword) return Alert.alert('알림', '새 비밀번호가 일치하지 않습니다.');
    }

    setSaving(true);
    try {
      const uid = auth.currentUser?.uid;

      // 1. 프로필 이미지 업로드
      let imageUrl = currentImageUrl;
      if (profileImage) {
        imageUrl = await uploadProfileImage(profileImage);
      }

      // 2. Firestore 업데이트
      await updateDoc(doc(db, 'users', uid), {
        nickname: nickname.trim(),
        ...(imageUrl ? { profileImageUrl: imageUrl } : {}),
      });

      // 3. 내가 쓴 글들 userNickname 일괄 업데이트
      const myEmail = auth.currentUser?.email;
      if (myEmail && nickname.trim() !== auth.currentUser?.displayName) {
        const placesSnap = await getDocs(query(collection(db, 'places'), where('userEmail', '==', myEmail)));
        if (!placesSnap.empty) {
          const batch = writeBatch(db);
          placesSnap.docs.forEach(d => batch.update(d.ref, { userNickname: nickname.trim() }));
          await batch.commit();
        }
      }

      // 4. Firebase Auth displayName 업데이트
      await updateProfile(auth.currentUser, {
        displayName: nickname.trim(),
        ...(imageUrl ? { photoURL: imageUrl } : {}),
      });

      // 5. 비밀번호 변경
      if (newPassword && currentPassword) {
        const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await updatePassword(auth.currentUser, newPassword);
      }

      Alert.alert('완료', '프로필이 수정되었습니다! ✅', [
        { text: '확인', onPress: () => router.back() }
      ]);
    } catch (e) {
      if (e.code === 'auth/wrong-password') {
        Alert.alert('오류', '현재 비밀번호가 틀렸습니다.');
      } else {
        Alert.alert('오류', e.message ?? '저장에 실패했습니다.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  const displayImage = profileImage ?? currentImageUrl;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1C1C1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>프로필 수정</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.saveBtnTxt}>저장</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* 프로필 이미지 */}
        <View style={styles.imageSection}>
          <TouchableOpacity onPress={pickImage} style={styles.avatarWrap} activeOpacity={0.8}>
            {displayImage ? (
              <Image source={{ uri: displayImage }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={40} color="#8B5CF6" />
              </View>
            )}
            <View style={styles.cameraBtn}>
              <Ionicons name="camera" size={16} color="white" />
            </View>
          </TouchableOpacity>
          <Text style={styles.imageHint}>탭하여 사진 변경</Text>
        </View>

        {/* 닉네임 */}
        <Text style={styles.label}>닉네임</Text>
        <TextInput
          style={styles.input}
          value={nickname}
          onChangeText={setNickname}
          placeholder="닉네임 입력"
          maxLength={20}
        />

        {/* 이메일 (수정 불가) */}
        <Text style={styles.label}>이메일</Text>
        <View style={[styles.input, styles.inputDisabled]}>
          <Text style={{ color: '#8E8E93', fontSize: 15 }}>{auth.currentUser?.email}</Text>
        </View>

        {/* 비밀번호 변경 */}
        <Text style={styles.sectionTitle}>비밀번호 변경</Text>
        <Text style={styles.label}>현재 비밀번호</Text>
        <TextInput
          style={styles.input}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          placeholder="현재 비밀번호"
          secureTextEntry
        />
        <Text style={styles.label}>새 비밀번호</Text>
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="새 비밀번호 (6자 이상)"
          secureTextEntry
        />
        <Text style={styles.label}>새 비밀번호 확인</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="새 비밀번호 확인"
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.saveBtnLarge}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="white" /> : <Text style={styles.saveBtnLargeTxt}>저장하기</Text>}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F2F2F7',
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1C1C1E' },
  saveBtn: { backgroundColor: '#007AFF', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  saveBtnTxt: { color: 'white', fontWeight: '700', fontSize: 14 },

  content: { padding: 24, paddingBottom: 48 },

  imageSection: { alignItems: 'center', marginBottom: 32 },
  avatarWrap: { position: 'relative', marginBottom: 8 },
  avatarImg: { width: 90, height: 90, borderRadius: 45 },
  avatarPlaceholder: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#F3EEFF', alignItems: 'center', justifyContent: 'center',
  },
  cameraBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#007AFF', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'white',
  },
  imageHint: { fontSize: 12, color: '#8E8E93' },

  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1C1C1E', marginTop: 8, marginBottom: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F2F2F7' },
  label: { fontSize: 13, fontWeight: '700', color: '#1C1C1E', marginBottom: 8 },
  input: { backgroundColor: '#F2F2F7', borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 20 },
  inputDisabled: { justifyContent: 'center' },

  saveBtnLarge: { backgroundColor: '#007AFF', padding: 17, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  saveBtnLargeTxt: { color: 'white', fontWeight: '800', fontSize: 16 },
});