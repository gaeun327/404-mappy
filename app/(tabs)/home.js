import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  TextInput,
  ScrollView,
  Alert,
  Keyboard,
  ActivityIndicator,
  FlatList,
  Modal,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { db, auth } from '../../firebaseConfig';
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc,
} from 'firebase/firestore';
import { useRouter, useFocusEffect } from 'expo-router';

const KAKAO_REST_API_KEY =
  process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY;

const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDistance = (distance) => {
  const value = Number(distance);

  if (!value || Number.isNaN(value)) return '';
  if (value < 1000) return `${Math.round(value)}m`;

  return `${(value / 1000).toFixed(1)}km`;
};

const groupNearbyPins = (pins, radius = 20) => {
  const groups = [];

  pins.forEach((pin) => {
    const latitude = Number(pin.latitude);
    const longitude = Number(pin.longitude);

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) return;

    const kakaoPlaceId =
      typeof pin.kakaoPlaceId === 'string'
        ? pin.kakaoPlaceId.trim()
        : '';

    let existingGroup = null;

    if (kakaoPlaceId) {
      existingGroup = groups.find(
        (group) => group.kakaoPlaceId === kakaoPlaceId
      );
    } else {
      existingGroup = groups.find((group) => {
        if (group.kakaoPlaceId) return false;

        return (
          getDistance(
            group.latitude,
            group.longitude,
            latitude,
            longitude
          ) <= radius
        );
      });
    }

    if (existingGroup) {
      existingGroup.reviews.push(pin);

      const count = existingGroup.reviews.length;

      existingGroup.latitude =
        (existingGroup.latitude * (count - 1) + latitude) / count;

      existingGroup.longitude =
        (existingGroup.longitude * (count - 1) + longitude) / count;
    } else {
      groups.push({
        id: kakaoPlaceId
          ? `kakao-${kakaoPlaceId}`
          : `group-${pin.id}`,
        kakaoPlaceId,
        latitude,
        longitude,
        reviews: [pin],
      });
    }
  });

  return groups;
};

const CATEGORY_ICONS = {
  food: { icon: 'restaurant', color: '#FF6B35' },
  cafe: { icon: 'cafe', color: '#8B5CF6' },
  nature: { icon: 'leaf', color: '#10B981' },
  culture: { icon: 'color-palette', color: '#F59E0B' },
  popup: { icon: 'gift', color: '#EC4899' },
  shop: { icon: 'bag-handle', color: '#3B82F6' },
  hospital: { icon: 'medical', color: '#EF4444' },
  beauty: { icon: 'cut', color: '#D946EF' },
  parking: { icon: 'car', color: '#6B7280' },
  stay: { icon: 'bed', color: '#0EA5E9' },
  fitness: { icon: 'barbell', color: '#F97316' },
  study: { icon: 'book', color: '#14B8A6' },
  play: { icon: 'game-controller', color: '#8B5CF6' },
  etc: { icon: 'location', color: '#6B7280' },
};

export default function HomeScreen() {
  const router = useRouter();
  const mapRef = useRef(null);
  const searchRequestRef = useRef(0);

  const [allPins, setAllPins] = useState([]);
  const [bookmarksOnly, setBookmarksOnly] = useState(false);
  const [pinsLoading, setPinsLoading] = useState(true);
  const [pinsError, setPinsError] = useState(false);

  const [friends, setFriends] = useState([]);
  const [selectedFriendUid, setSelectedFriendUid] = useState('전체');
  const [showFriendFilter, setShowFriendFilter] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('전체');

  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedSearchPlace, setSelectedSearchPlace] = useState(null);

  const [selectedReviewGroup, setSelectedReviewGroup] = useState(null);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);

  const myEmail = auth.currentUser?.email;

  // 친구, 카테고리, 북마크 조건을 항상 함께 적용합니다.
  const pins = useMemo(
    () =>
      allPins.filter((pin) => {
        if (
          selectedFriendUid !== '전체' &&
          pin.userUid !== selectedFriendUid
        ) {
          return false;
        }

        if (
          selectedCategory !== '전체' &&
          pin.category !== selectedCategory
        ) {
          return false;
        }

        if (
          bookmarksOnly &&
          (!myEmail || !(pin.bookmarks ?? []).includes(myEmail))
        ) {
          return false;
        }

        return true;
      }),
    [
      allPins,
      selectedFriendUid,
      selectedCategory,
      bookmarksOnly,
      myEmail,
    ]
  );

  const groupedPins = useMemo(
    () => groupNearbyPins(pins, 20),
    [pins]
  );

  const nearbyCount = userLocation
    ? pins.filter(
        (pin) =>
          getDistance(
            userLocation.latitude,
            userLocation.longitude,
            pin.latitude,
            pin.longitude
          ) <= 1000
      ).length
    : 0;

  const hasFilters =
    bookmarksOnly ||
    selectedFriendUid !== '전체' ||
    selectedCategory !== '전체';

  const resetFilters = () => {
    setBookmarksOnly(false);
    setSelectedFriendUid('전체');
    setSelectedCategory('전체');
    setShowFriendFilter(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchPins();
      initLocation();
    }, [])
  );

  useEffect(() => {
    const keyword = searchText.trim();

    if (keyword.length < 2) {
      searchRequestRef.current += 1;
      setSearchResults([]);
      setShowSearchResults(false);
      setSearchLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      searchKakaoPlaces(keyword);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchText, userLocation]);

  const initLocation = async () => {
    try {
      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = loc.coords;

      setUserLocation({ latitude, longitude });

      mapRef.current?.animateToRegion(
        {
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500
      );
    } catch (error) {
      console.log('현재 위치 불러오기 오류:', error);
    }
  };

  const fetchPins = async () => {
    setPinsLoading(true);
    setPinsError(false);

    try {
      const myUid = auth.currentUser?.uid;
      if (!myUid) return;

      const myDoc = await getDoc(doc(db, 'users', myUid));
      const friendUids = myDoc.exists()
        ? myDoc.data().friends ?? []
        : [];

      const friendList = await Promise.all(
        friendUids.map(async (uid) => {
          try {
            const friendSnap = await getDoc(doc(db, 'users', uid));

            if (!friendSnap.exists()) return null;

            return {
              uid,
              nickname: friendSnap.data().nickname || '친구',
            };
          } catch {
            return null;
          }
        })
      );

      setFriends(friendList.filter(Boolean));

      setSelectedFriendUid((previous) =>
        previous === '전체' || friendUids.includes(previous)
          ? previous
          : '전체'
      );

      const allowedUids = [myUid, ...friendUids];

      const snap = await getDocs(
        query(collection(db, 'places'), orderBy('createdAt', 'desc'))
      );

      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((pin) => allowedUids.includes(pin.userUid));

      setAllPins(data);
    } catch (error) {
      setPinsError(true);
      console.log('핀 불러오기 오류:', error);
    } finally {
      setPinsLoading(false);
    }
  };

  const searchKakaoPlaces = async (keyword) => {
    if (!KAKAO_REST_API_KEY) {
      console.log('카카오 REST API 키가 없습니다.');
      return;
    }

    const requestId = ++searchRequestRef.current;
    setSearchLoading(true);

    try {
      let url =
        'https://dapi.kakao.com/v2/local/search/keyword.json' +
        `?query=${encodeURIComponent(keyword)}&size=10`;

      if (userLocation) {
        url +=
          `&x=${userLocation.longitude}` +
          `&y=${userLocation.latitude}&sort=distance`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log('카카오 검색 API 오류:', response.status, errorText);
        throw new Error('카카오 장소 검색 실패');
      }

      const data = await response.json();

      if (requestId !== searchRequestRef.current) return;

      const documents = data.documents ?? [];
      setSearchResults(documents);
      setShowSearchResults(documents.length > 0);
    } catch (error) {
      console.log('카카오 장소 검색 오류:', error);

      if (requestId === searchRequestRef.current) {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    } finally {
      if (requestId === searchRequestRef.current) {
        setSearchLoading(false);
      }
    }
  };

  const selectSearchPlace = (place) => {
    const latitude = Number(place.y);
    const longitude = Number(place.x);

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      Alert.alert('오류', '장소 위치를 확인할 수 없습니다.');
      return;
    }

    Keyboard.dismiss();

    setSelectedSearchPlace({
      id: place.id,
      name: place.place_name,
      address: place.road_address_name || place.address_name || '',
      latitude,
      longitude,
    });

    setShowSearchResults(false);

    mapRef.current?.animateToRegion(
      {
        latitude,
        longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      },
      700
    );
  };

  const clearSearch = () => {
    searchRequestRef.current += 1;
    setSearchText('');
    setSearchResults([]);
    setShowSearchResults(false);
    setSelectedSearchPlace(null);
    setSearchLoading(false);
    Keyboard.dismiss();
  };

  const moveToUserLocation = async () => {
    try {
      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('권한 거부', '위치 권한을 허용해야 합니다.');
        return;
      }

      const lastKnown = await Location.getLastKnownPositionAsync({});

      if (lastKnown) {
        const { latitude, longitude } = lastKnown.coords;

        mapRef.current?.animateToRegion(
          {
            latitude,
            longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          },
          500
        );
      }

      const userLoc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = userLoc.coords;

      setUserLocation({ latitude, longitude });

      mapRef.current?.animateToRegion(
        {
          latitude,
          longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        1000
      );
    } catch (error) {
      console.log('현재 위치 이동 오류:', error);
      Alert.alert('오류', '현재 위치를 불러오지 못했습니다.');
    }
  };

  const openAddPlace = async () => {
    setLoading(true);

    try {
      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('권한 거부', '위치 권한을 허용해야 합니다.');
        return;
      }

      const userLoc = await Location.getCurrentPositionAsync({});

      router.push({
        pathname: '/addplace',
        params: {
          latitude: userLoc.coords.latitude,
          longitude: userLoc.coords.longitude,
          address: '현재 위치',
        },
      });
    } catch (error) {
      console.log('장소 추가 위치 오류:', error);
      Alert.alert('오류', '현재 위치를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleMapLongPress = (event) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;

    router.push({
      pathname: '/addplace',
      params: {
        latitude,
        longitude,
        address: '지도에서 선택한 위치',
      },
    });
  };

  const goToDetail = (pin) => {
    router.push({
      pathname: '/detail',
      params: {
        id: pin.id,
        title: pin.title,
        description: pin.description,
        type: pin.type,
        user: pin.userNickname,
        userEmail: pin.userEmail ?? '',
        address: pin.address ?? '',
        detailAddress: pin.detailAddress ?? '',
        imagePaths: encodeURIComponent(
          JSON.stringify(pin.imagePaths ?? [])
        ),
        tags: JSON.stringify(pin.tags ?? []),
        category: pin.category ?? '',
        verified: pin.verified ? 'true' : 'false',
      },
    });
  };

  const handleGroupPress = (group) => {
    if (!group.reviews?.length) return;

    if (group.reviews.length === 1) {
      goToDetail(group.reviews[0]);
      return;
    }

    setSelectedReviewGroup(group);
    setReviewModalVisible(true);
  };

  const selectReview = (review) => {
    setReviewModalVisible(false);
    setSelectedReviewGroup(null);
    goToDetail(review);
  };

  const closeReviewModal = () => {
    setReviewModalVisible(false);
    setSelectedReviewGroup(null);
  };

  const handleSearchPlacePress = () => {
    if (!selectedSearchPlace) return;

    Alert.alert(
      '리뷰 작성',
      `${selectedSearchPlace.name}에 리뷰를 작성할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '작성하기',
          onPress: () =>
            router.push({
              pathname: '/addplace',
              params: {
                latitude: selectedSearchPlace.latitude,
                longitude: selectedSearchPlace.longitude,
                address: selectedSearchPlace.address ?? '',
                placeName: selectedSearchPlace.name ?? '',
                placeId: selectedSearchPlace.id ?? '',
              },
            }),
        },
      ]
    );
  };

  const handleCategory = (categoryId) => {
    setSelectedCategory(categoryId);
  };

  const handleFriendFilter = (friendUid) => {
    setSelectedFriendUid(friendUid);
    setShowFriendFilter(false);
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        showsUserLocation
        onPress={() => {
          Keyboard.dismiss();
          setShowSearchResults(false);
        }}
        onLongPress={handleMapLongPress}
        initialRegion={{
          latitude: 37.5665,
          longitude: 126.978,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {groupedPins.map((group) => {
          const reviewCount = group.reviews.length;
          const mainPin = group.reviews[0];

          return (
            <Marker
              key={
                group.id +
                '-' +
                group.reviews.map((review) => review.id).join('-')
              }
              coordinate={{
                latitude: group.latitude,
                longitude: group.longitude,
              }}
              onPress={() => handleGroupPress(group)}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              tracksViewChanges={false}
            >
              <View
                style={[
                  styles.customMarker,
                  reviewCount > 1
                    ? styles.groupMarker
                    : {
                        backgroundColor:
                          mainPin.type === 'blue'
                            ? '#007AFF'
                            : '#FF3B30',
                      },
                ]}
              >
                {reviewCount > 1 ? (
                  <Text style={styles.markerCount}>{reviewCount}</Text>
                ) : (
                  <Ionicons
                    name={
                      CATEGORY_ICONS[mainPin.category]?.icon ??
                      'location'
                    }
                    size={14}
                    color="white"
                  />
                )}
              </View>
            </Marker>
          );
        })}

        {selectedSearchPlace && (
          <Marker
            coordinate={{
              latitude: selectedSearchPlace.latitude,
              longitude: selectedSearchPlace.longitude,
            }}
            title={selectedSearchPlace.name}
            description="눌러서 리뷰 작성"
            pinColor="#34C759"
            onPress={handleSearchPlacePress}
            onCalloutPress={handleSearchPlacePress}
          />
        )}
      </MapView>

      {!pinsLoading &&
        !selectedSearchPlace &&
        (pinsError || pins.length === 0) && (
          <View style={styles.emptyMapCard}>
            <View style={styles.emptyMapIcon}>
              <Ionicons
                name={bookmarksOnly ? 'bookmark-outline' : 'map-outline'}
                size={22}
                color="#007AFF"
              />
            </View>

            <View style={styles.emptyMapContent}>
              <Text style={styles.emptyMapTitle}>
                {pinsError
                  ? '장소를 불러오지 못했어요'
                  : bookmarksOnly
                    ? '조건에 맞는 저장한 장소가 없어요'
                    : hasFilters
                      ? '조건에 맞는 장소가 없어요'
                      : '아직 공유된 장소가 없어요'}
              </Text>

              <Text style={styles.emptyMapDescription}>
                {pinsError
                  ? '인터넷 연결을 확인한 후 다시 시도해 주세요.'
                  : bookmarksOnly
                    ? '피드나 장소 상세에서 북마크하거나 필터를 바꿔보세요.'
                    : hasFilters
                      ? '다른 친구나 카테고리를 선택해 보세요.'
                      : '장소를 검색하거나 + 버튼을 눌러 첫 번째 장소를 기록해보세요!'}
              </Text>

              {(pinsError || hasFilters) && (
                <TouchableOpacity
                  onPress={pinsError ? fetchPins : resetFilters}
                  style={{ paddingTop: 8 }}
                >
                  <Text style={{ color: '#007AFF', fontWeight: '700' }}>
                    {pinsError ? '다시 시도' : '필터 초기화'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

      <View style={styles.topLayer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#007AFF" />

          <TextInput
            style={styles.searchInput}
            placeholder="장소를 검색하세요"
            placeholderTextColor="#8E8E93"
            value={searchText}
            onChangeText={(text) => {
              setSearchText(text);

              if (text.trim().length >= 2) {
                setShowSearchResults(true);
              }
            }}
            onFocus={() => {
              if (searchResults.length > 0) {
                setShowSearchResults(true);
              }
            }}
            returnKeyType="search"
            autoCorrect={false}
          />

          {searchLoading ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : searchText.length > 0 ? (
            <TouchableOpacity onPress={clearSearch}>
              <Ionicons
                name="close-circle"
                size={20}
                color="#8E8E93"
              />
            </TouchableOpacity>
          ) : null}
        </View>

        {showSearchResults && (
          <View style={styles.searchResultBox}>
            {searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const address =
                    item.road_address_name || item.address_name;
                  const distance = formatDistance(item.distance);

                  return (
                    <TouchableOpacity
                      style={styles.searchResultItem}
                      onPress={() => selectSearchPlace(item)}
                    >
                      <View style={styles.searchResultIcon}>
                        <Ionicons
                          name="location"
                          size={19}
                          color="#007AFF"
                        />
                      </View>

                      <View style={styles.searchResultContent}>
                        <Text
                          style={styles.searchResultName}
                          numberOfLines={1}
                        >
                          {item.place_name}
                        </Text>

                        <Text
                          style={styles.searchResultAddress}
                          numberOfLines={1}
                        >
                          {address || '주소 정보 없음'}
                        </Text>

                        <View style={styles.searchResultMeta}>
                          {!!item.category_group_name && (
                            <Text style={styles.searchResultCategory}>
                              {item.category_group_name}
                            </Text>
                          )}

                          {!!distance && (
                            <Text style={styles.searchResultDistance}>
                              {distance}
                            </Text>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            ) : !searchLoading ? (
              <View style={styles.noResultBox}>
                <Text style={styles.noResultText}>
                  검색 결과가 없습니다.
                </Text>
              </View>
            ) : null}
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={[
              styles.friendFilterBtn,
              bookmarksOnly && styles.filterBtnActive,
            ]}
            onPress={() => {
              setBookmarksOnly((previous) => !previous);
              setShowFriendFilter(false);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: bookmarksOnly }}
          >
            <Ionicons
              name={bookmarksOnly ? 'bookmark' : 'bookmark-outline'}
              size={17}
              color="#007AFF"
            />
            <Text
              style={[
                styles.friendFilterBtnText,
                bookmarksOnly && { color: '#007AFF' },
              ]}
            >
              저장한 장소
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.friendFilterBtn}
            onPress={() => setShowFriendFilter((previous) => !previous)}
            activeOpacity={0.8}
          >
            <Ionicons
              name="people-outline"
              size={17}
              color="#007AFF"
            />

            <Text style={styles.friendFilterBtnText}>
              {selectedFriendUid === '전체'
                ? '나 + 전체 친구'
                : friends.find(
                    (friend) => friend.uid === selectedFriendUid
                  )?.nickname || '친구'}
            </Text>

            <Ionicons
              name={showFriendFilter ? 'chevron-up' : 'chevron-down'}
              size={15}
              color="#8E8E93"
            />
          </TouchableOpacity>

          {[
            { label: '전체', id: '전체' },
            { label: '🍽️ 음식점', id: 'food' },
            { label: '☕ 카페', id: 'cafe' },
            { label: '🌿 자연', id: 'nature' },
            { label: '🎨 문화', id: 'culture' },
            { label: '🎪 팝업', id: 'popup' },
            { label: '🛍️ 쇼핑', id: 'shop' },
            { label: '🏥 병원·약국', id: 'hospital' },
            { label: '💇 미용', id: 'beauty' },
            { label: '🚗 주차장', id: 'parking' },
            { label: '🏨 숙소', id: 'stay' },
            { label: '🏋️ 운동·헬스', id: 'fitness' },
            { label: '📚 카공·스터디', id: 'study' },
            { label: '🎮 오락·취미', id: 'play' },
            { label: '📍 기타', id: 'etc' },
          ].map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.filterBtn,
                selectedCategory === category.id &&
                  styles.filterBtnActive,
              ]}
              onPress={() => handleCategory(category.id)}
            >
              <Text
                style={[
                  styles.filterBtnTxt,
                  selectedCategory === category.id && {
                    color: '#007AFF',
                    fontWeight: '700',
                  },
                ]}
              >
                {category.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {showFriendFilter && (
          <View style={styles.friendDropdown}>
            <TouchableOpacity
              style={styles.friendDropdownItem}
              onPress={() => handleFriendFilter('전체')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.friendDropdownText,
                  selectedFriendUid === '전체' &&
                    styles.friendDropdownTextActive,
                ]}
              >
                나 + 전체 친구
              </Text>

              {selectedFriendUid === '전체' && (
                <Ionicons
                  name="checkmark"
                  size={18}
                  color="#007AFF"
                />
              )}
            </TouchableOpacity>

            {friends.map((friend) => (
              <TouchableOpacity
                key={friend.uid}
                style={styles.friendDropdownItem}
                onPress={() => handleFriendFilter(friend.uid)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.friendDropdownText,
                    selectedFriendUid === friend.uid &&
                      styles.friendDropdownTextActive,
                  ]}
                >
                  {friend.nickname}
                </Text>

                {selectedFriendUid === friend.uid && (
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color="#007AFF"
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.nearbyBanner}>
        <Ionicons name="location" size={14} color="#007AFF" />
        <Text style={styles.nearbyText}>
          1km 내{' '}
          <Text style={styles.nearbyCount}>{nearbyCount}개</Text>
          의 스팟
        </Text>
      </View>

      <TouchableOpacity
        style={styles.addPinBtn}
        onPress={openAddPlace}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="white" size="small" />
        ) : (
          <Ionicons name="add" size={30} color="white" />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.locationBtn}
        onPress={moveToUserLocation}
      >
        <Ionicons name="locate" size={28} color="#007AFF" />
      </TouchableOpacity>

      <Modal
        visible={reviewModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeReviewModal}
      >
        <View style={styles.reviewModalOverlay}>
          <TouchableOpacity
            style={styles.reviewModalBackground}
            activeOpacity={1}
            onPress={closeReviewModal}
          />

          <View style={styles.reviewSheet}>
            <View style={styles.reviewSheetHandle} />

            <View style={styles.reviewSheetHeader}>
              <View>
                <Text style={styles.reviewSheetTitle}>
                  이 장소의 리뷰
                </Text>
                <Text style={styles.reviewSheetCount}>
                  {selectedReviewGroup?.reviews?.length ?? 0}개의 리뷰
                </Text>
              </View>

              <TouchableOpacity
                style={styles.reviewCloseBtn}
                onPress={closeReviewModal}
              >
                <Ionicons name="close" size={22} color="#1C1C1E" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={selectedReviewGroup?.reviews ?? []}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 30 }}
              renderItem={({ item }) => {
                const isGood = item.type === 'blue';

                return (
                  <TouchableOpacity
                    style={styles.reviewSelectCard}
                    activeOpacity={0.7}
                    onPress={() => selectReview(item)}
                  >
                    <View style={styles.reviewCardTop}>
                      <View
                        style={[
                          styles.reviewTypeBadge,
                          {
                            backgroundColor: isGood
                              ? '#007AFF'
                              : '#FF3B30',
                          },
                        ]}
                      >
                        <Text style={styles.reviewTypeText}>
                          {isGood ? '👍 추천' : '⚠️ 주의'}
                        </Text>
                      </View>

                      {item.verified === true && (
                        <View style={styles.reviewVerifiedBadge}>
                          <Ionicons
                            name="checkmark-circle"
                            size={14}
                            color="#34C759"
                          />
                          <Text style={styles.reviewVerifiedText}>
                            방문 인증
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text
                      style={styles.reviewSelectTitle}
                      numberOfLines={1}
                    >
                      {item.title || '장소 리뷰'}
                    </Text>

                    {!!item.description && (
                      <Text
                        style={styles.reviewSelectDescription}
                        numberOfLines={2}
                      >
                        {item.description}
                      </Text>
                    )}

                    <View style={styles.reviewAuthorRow}>
                      <View style={styles.reviewAvatar}>
                        <Text style={styles.reviewAvatarText}>
                          {(item.userNickname || '?')
                            .charAt(0)
                            .toUpperCase()}
                        </Text>
                      </View>

                      <Text style={styles.reviewAuthor}>
                        {item.userNickname || '익명'}
                      </Text>

                      <Ionicons
                        name="chevron-forward"
                        size={17}
                        color="#C7C7CC"
                        style={{ marginLeft: 'auto' }}
                      />
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
  customMarker: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 5,
    borderWidth: 2, borderColor: 'white',
  },
  groupMarker: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#007AFF', borderWidth: 2.5, borderColor: 'white',
  },
  markerCount: { color: 'white', fontSize: 13, fontWeight: '800' },
  topLayer: {
    position: 'absolute', top: 50, width: '100%',
    zIndex: 20, elevation: 20,
  },
  searchBar: {
    backgroundColor: 'white', height: 50, borderRadius: 15,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 15, marginHorizontal: 20, elevation: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8,
  },
  searchInput: {
    flex: 1, marginLeft: 10, marginRight: 8,
    fontSize: 15, color: '#1C1C1E', backgroundColor: 'white',
  },
  searchResultBox: {
    backgroundColor: 'white', marginHorizontal: 20, marginTop: 5,
    borderRadius: 14, maxHeight: 340, overflow: 'hidden', elevation: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15, shadowRadius: 8,
  },
  searchResultItem: {
    minHeight: 78, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  searchResultIcon: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#EAF3FF', alignItems: 'center',
    justifyContent: 'center', marginRight: 11,
  },
  searchResultContent: { flex: 1 },
  searchResultName: {
    fontSize: 15, fontWeight: '700', color: '#1C1C1E', marginBottom: 4,
  },
  searchResultAddress: {
    fontSize: 12, color: '#636366', marginBottom: 5,
  },
  searchResultMeta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  searchResultCategory: { fontSize: 11, color: '#8E8E93' },
  searchResultDistance: {
    fontSize: 11, fontWeight: '700', color: '#007AFF',
  },
  noResultBox: {
    paddingVertical: 25, alignItems: 'center', justifyContent: 'center',
  },
  noResultText: { fontSize: 14, color: '#8E8E93' },
  filterScroll: { marginTop: 10, paddingLeft: 20 },
  filterBtn: {
    height: 36, paddingHorizontal: 14, borderRadius: 18,
    backgroundColor: '#FFFFFF', alignItems: 'center',
    justifyContent: 'center', marginRight: 8, elevation: 2,
  },
  filterBtnActive: {
    backgroundColor: '#EAF3FF', borderWidth: 1.5, borderColor: '#007AFF',
  },
  filterBtnTxt: { fontSize: 13, color: '#3A3A3C' },
  nearbyBanner: {
    position: 'absolute', bottom: 110, left: 20,
    backgroundColor: 'white', flexDirection: 'row',
    alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, elevation: 4, gap: 5,
  },
  nearbyText: { fontSize: 13, color: '#3A3A3C' },
  nearbyCount: { fontWeight: '800', color: '#007AFF' },
  addPinBtn: {
    position: 'absolute', bottom: 40, right: 20,
    backgroundColor: '#007AFF', width: 55, height: 55, borderRadius: 30,
    justifyContent: 'center', alignItems: 'center', elevation: 6,
    zIndex: 1, shadowColor: '#007AFF', shadowOpacity: 0.4, shadowRadius: 8,
  },
  locationBtn: {
    position: 'absolute', bottom: 40, left: 20,
    backgroundColor: 'white', width: 55, height: 55, borderRadius: 30,
    justifyContent: 'center', alignItems: 'center', elevation: 5,
    zIndex: 1, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8,
  },
  reviewModalOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  reviewModalBackground: { ...StyleSheet.absoluteFillObject },
  reviewSheet: {
    backgroundColor: 'white', borderTopLeftRadius: 26,
    borderTopRightRadius: 26, paddingHorizontal: 20,
    paddingTop: 10, maxHeight: '65%', elevation: 20,
  },
  reviewSheetHandle: {
    width: 40, height: 5, borderRadius: 3,
    backgroundColor: '#D1D1D6', alignSelf: 'center', marginBottom: 18,
  },
  reviewSheetHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16,
  },
  reviewSheetTitle: {
    fontSize: 21, fontWeight: '800', color: '#1C1C1E',
  },
  reviewSheetCount: {
    fontSize: 13, color: '#8E8E93', marginTop: 3,
  },
  reviewCloseBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F2F2F7', alignItems: 'center',
    justifyContent: 'center',
  },
  reviewSelectCard: {
    backgroundColor: '#F8F8FA', borderRadius: 18,
    padding: 16, marginBottom: 12,
  },
  reviewCardTop: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 10,
  },
  reviewTypeBadge: {
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12,
  },
  reviewTypeText: { color: 'white', fontSize: 11, fontWeight: '700' },
  reviewVerifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EDFAF4', paddingHorizontal: 8,
    paddingVertical: 4, borderRadius: 12,
  },
  reviewVerifiedText: {
    color: '#34C759', fontSize: 11, fontWeight: '700',
  },
  reviewSelectTitle: {
    fontSize: 17, fontWeight: '800', color: '#1C1C1E', marginBottom: 6,
  },
  reviewSelectDescription: {
    fontSize: 14, color: '#636366', lineHeight: 20, marginBottom: 14,
  },
  reviewAuthorRow: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA', paddingTop: 12,
  },
  reviewAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#E6F1FB', alignItems: 'center',
    justifyContent: 'center', marginRight: 8,
  },
  reviewAvatarText: {
    color: '#185FA5', fontSize: 12, fontWeight: '800',
  },
  reviewAuthor: {
    fontSize: 13, fontWeight: '700', color: '#3A3A3C',
  },
  emptyMapCard: {
    position: 'absolute', left: 20, right: 20, bottom: 105,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'white', borderRadius: 18,
    paddingHorizontal: 16, paddingVertical: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1, shadowRadius: 10, elevation: 6, zIndex: 10,
  },
  emptyMapIcon: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#EAF3FF', alignItems: 'center',
    justifyContent: 'center', marginRight: 12,
  },
  emptyMapContent: { flex: 1 },
  emptyMapTitle: {
    fontSize: 14, fontWeight: '700', color: '#1C1C1E', marginBottom: 3,
  },
  emptyMapDescription: {
    fontSize: 12, lineHeight: 17, color: '#8E8E93',
  },
  friendFilterBtn: {
    height: 36, paddingHorizontal: 12, borderRadius: 18,
    backgroundColor: '#FFFFFF', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: 5, marginRight: 8, borderWidth: 1,
    borderColor: '#E5E5EA', alignSelf: 'center',
  },
  friendFilterBtnText: {
    fontSize: 13, fontWeight: '700', color: '#1C1C1E',
  },
  friendDropdown: {
    position: 'absolute', top: 100, left: 20, width: 165,
    backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 8, zIndex: 100,
  },
  friendDropdownItem: {
    height: 38, paddingHorizontal: 12, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  friendDropdownText: {
    fontSize: 13, fontWeight: '600', color: '#1C1C1E',
  },
  friendDropdownTextActive: {
    color: '#007AFF', fontWeight: '700',
  },
});