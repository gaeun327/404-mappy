import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
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

import {
  useRouter,
  useFocusEffect,
} from 'expo-router';


// ========================================
// 카카오 REST API KEY
// ========================================

const KAKAO_REST_API_KEY =
  process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY;


// ========================================
// 두 좌표 사이 거리 계산
// ========================================

const getDistance = (
  lat1,
  lon1,
  lat2,
  lon2
) => {
  const R = 6371000;

  const dLat =
    (lat2 - lat1) * Math.PI / 180;

  const dLon =
    (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;

  return (
    R *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )
  );
};


// ========================================
// 거리 표시
// ========================================

const formatDistance = (distance) => {
  const value = Number(distance);

  if (!value || Number.isNaN(value)) {
    return '';
  }

  if (value < 1000) {
    return `${Math.round(value)}m`;
  }

  return `${(value / 1000).toFixed(1)}km`;
};


// ========================================
// 가까운 리뷰 핀 그룹화
// 20m 이내 리뷰 → 하나의 핀
// ========================================

// ========================================
// 같은 장소의 리뷰 핀 그룹화
//
// 1. kakaoPlaceId가 있으면
//    → 같은 카카오 장소 ID끼리만 묶음
//
// 2. kakaoPlaceId가 없는 기존 리뷰는
//    → 기존처럼 20m 이내 리뷰끼리 묶음
// ========================================

const groupNearbyPins = (
  pins,
  radius = 20
) => {
  const groups = [];

  pins.forEach((pin) => {
    const latitude =
      Number(pin.latitude);

    const longitude =
      Number(pin.longitude);

    if (
      Number.isNaN(latitude) ||
      Number.isNaN(longitude)
    ) {
      return;
    }

    const kakaoPlaceId =
      typeof pin.kakaoPlaceId === 'string'
        ? pin.kakaoPlaceId.trim()
        : '';

    let existingGroup = null;


    // ========================================
    // 카카오 장소 ID가 있는 리뷰
    // → 같은 ID끼리만 묶기
    // ========================================

    if (kakaoPlaceId) {
      existingGroup =
        groups.find((group) => {
          return (
            group.kakaoPlaceId ===
            kakaoPlaceId
          );
        });
    }


    // ========================================
    // 카카오 장소 ID가 없는 기존 리뷰
    // → ID 없는 리뷰끼리만 20m 기준으로 묶기
    // ========================================

    else {
      existingGroup =
        groups.find((group) => {

          // 카카오 ID가 있는 그룹에는
          // 거리만으로 합치지 않음
          if (group.kakaoPlaceId) {
            return false;
          }

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


    // ========================================
    // 기존 그룹 발견
    // ========================================

    if (existingGroup) {
      existingGroup.reviews.push(pin);

      const count =
        existingGroup.reviews.length;


      // 그룹 핀 위치를
      // 리뷰 좌표 평균으로 계산
      existingGroup.latitude =
        (
          existingGroup.latitude *
            (count - 1) +
          latitude
        ) / count;


      existingGroup.longitude =
        (
          existingGroup.longitude *
            (count - 1) +
          longitude
        ) / count;
    }


    // ========================================
    // 새로운 그룹 생성
    // ========================================

    else {
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


// ========================================
// 카테고리 아이콘
// ========================================

const CATEGORY_ICONS = {
  food: {
    icon: 'restaurant',
    color: '#FF6B35',
  },

  cafe: {
    icon: 'cafe',
    color: '#8B5CF6',
  },

  nature: {
    icon: 'leaf',
    color: '#10B981',
  },

  culture: {
    icon: 'color-palette',
    color: '#F59E0B',
  },

  popup: {
    icon: 'gift',
    color: '#EC4899',
  },

  shop: {
    icon: 'bag-handle',
    color: '#3B82F6',
  },

  hospital: {
    icon: 'medical',
    color: '#EF4444',
  },

  beauty: {
    icon: 'cut',
    color: '#D946EF',
  },

  parking: {
    icon: 'car',
    color: '#6B7280',
  },

  stay: {
    icon: 'bed',
    color: '#0EA5E9',
  },

  fitness: {
    icon: 'barbell',
    color: '#F97316',
  },

  study: {
    icon: 'book',
    color: '#14B8A6',
  },

  play: {
    icon: 'game-controller',
    color: '#8B5CF6',
  },

  etc: {
    icon: 'location',
    color: '#6B7280',
  },
};


// ========================================
// HOME
// ========================================

export default function HomeScreen() {
  const router = useRouter();

  const mapRef = useRef(null);

  const searchRequestRef =
    useRef(0);


  // ========================================
  // 핀
  // ========================================

  const [pins, setPins] =
    useState([]);

  const [allPins, setAllPins] =
    useState([]);

  const groupedPins =
    groupNearbyPins(pins, 20);

    // 친구별 지도 필터
const [friends, setFriends] = useState([]);
const [selectedFriendUid, setSelectedFriendUid] = useState('전체');
const [showFriendFilter, setShowFriendFilter] = useState(false);


  // ========================================
  // 로딩
  // ========================================

  const [loading, setLoading] =
    useState(false);

  const [
    searchLoading,
    setSearchLoading,
  ] = useState(false);


  // ========================================
  // 현재 위치
  // ========================================

  const [
    userLocation,
    setUserLocation,
  ] = useState(null);

  const [
    nearbyCount,
    setNearbyCount,
  ] = useState(0);


  // ========================================
  // 카테고리
  // ========================================

  const [
    selectedCategory,
    setSelectedCategory,
  ] = useState('전체');


  // ========================================
  // 카카오 검색
  // ========================================

  const [
    searchText,
    setSearchText,
  ] = useState('');

  const [
    searchResults,
    setSearchResults,
  ] = useState([]);

  const [
    showSearchResults,
    setShowSearchResults,
  ] = useState(false);

  const [
    selectedSearchPlace,
    setSelectedSearchPlace,
  ] = useState(null);


  // ========================================
  // 그룹 리뷰 선택
  // ========================================

  const [
    selectedReviewGroup,
    setSelectedReviewGroup,
  ] = useState(null);

  const [
    reviewModalVisible,
    setReviewModalVisible,
  ] = useState(false);


  // ========================================
  // 화면 다시 들어올 때
  // ========================================

  useFocusEffect(
    useCallback(() => {
      fetchPins();
      initLocation();
    }, [])
  );


  // ========================================
  // 검색 자동 실행
  // ========================================

  useEffect(() => {
    const keyword =
      searchText.trim();

    if (keyword.length < 2) {
      searchRequestRef.current += 1;

      setSearchResults([]);
      setShowSearchResults(false);
      setSearchLoading(false);

      return;
    }

    const timer =
      setTimeout(() => {
        searchKakaoPlaces(keyword);
      }, 400);

    return () => {
      clearTimeout(timer);
    };

  }, [
    searchText,
    userLocation,
  ]);


  // ========================================
  // 현재 위치 초기화
  // ========================================

  const initLocation = async () => {
    try {
      const { status } =
        await Location
          .requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        return;
      }

      const loc =
        await Location
          .getCurrentPositionAsync({
            accuracy:
              Location.Accuracy.Balanced,
          });

      const {
        latitude,
        longitude,
      } = loc.coords;

      setUserLocation({
        latitude,
        longitude,
      });

      mapRef.current
        ?.animateToRegion(
          {
            latitude,
            longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          500
        );

      setAllPins((prev) => {
        const nearby =
          prev.filter(
            (p) =>
              getDistance(
                latitude,
                longitude,
                p.latitude,
                p.longitude
              ) <= 1000
          );

        setNearbyCount(
          nearby.length
        );

        return prev;
      });

    } catch (e) {
      console.log(
        '현재 위치 불러오기 오류:',
        e
      );
    }
  };


  // ========================================
  // 친구 + 내 장소 불러오기
  // ========================================

  const fetchPins = async () => {
    try {
      const myUid =
        auth.currentUser?.uid;

      if (!myUid) {
        return;
      }

      const myDoc =
        await getDoc(
          doc(
            db,
            'users',
            myUid
          )
        );

      const friendUids =
        myDoc.exists()
          ? (
              myDoc.data()
                .friends ?? []
            )
          : [];
      // 친구 UID → 닉네임 불러오기
const friendList = await Promise.all(
  friendUids.map(async (uid) => {
    try {
      const friendSnap = await getDoc(
        doc(db, 'users', uid)
      );

      if (!friendSnap.exists()) return null;

      const data = friendSnap.data();

      return {
        uid,
        nickname: data.nickname || '친구',
      };
    } catch (e) {
      return null;
    }
  })
);

setFriends(friendList.filter(Boolean));

      const allowedUids = [
        myUid,
        ...friendUids,
      ];

      const q = query(
        collection(
          db,
          'places'
        ),
        orderBy(
          'createdAt',
          'desc'
        )
      );

      const snap =
        await getDocs(q);

      const data =
        snap.docs
          .map((d) => ({
            id: d.id,
            ...d.data(),
          }))
          .filter((p) =>
            allowedUids.includes(
              p.userUid
            )
          );

      setAllPins(data);
      setPins(data);

      if (userLocation) {
        const nearby =
          data.filter(
            (p) =>
              getDistance(
                userLocation.latitude,
                userLocation.longitude,
                p.latitude,
                p.longitude
              ) <= 1000
          );

        setNearbyCount(
          nearby.length
        );

      } else {
        setNearbyCount(0);
      }

    } catch (e) {
      console.log(
        '핀 불러오기 오류:',
        e
      );
    }
  };


  // ========================================
  // 카카오 장소 검색
  // ========================================

  const searchKakaoPlaces =
    async (keyword) => {

      if (!KAKAO_REST_API_KEY) {
        console.log(
          '카카오 REST API 키가 없습니다.'
        );

        return;
      }

      const requestId =
        ++searchRequestRef.current;

      setSearchLoading(true);

      try {
        let url =
          'https://dapi.kakao.com/v2/local/search/keyword.json' +
          `?query=${encodeURIComponent(keyword)}` +
          '&size=10';

        if (userLocation) {
          url +=
            `&x=${userLocation.longitude}` +
            `&y=${userLocation.latitude}` +
            '&sort=distance';
        }

        const response =
          await fetch(
            url,
            {
              method: 'GET',

              headers: {
                Authorization:
                  `KakaoAK ${KAKAO_REST_API_KEY}`,
              },
            }
          );

        if (!response.ok) {
          const errorText =
            await response.text();

          console.log(
            '카카오 검색 API 오류:',
            response.status,
            errorText
          );

          throw new Error(
            '카카오 장소 검색 실패'
          );
        }

        const data =
          await response.json();

        if (
          requestId !==
          searchRequestRef.current
        ) {
          return;
        }

        const documents =
          data.documents ?? [];

        setSearchResults(
          documents
        );

        setShowSearchResults(
          documents.length > 0
        );

      } catch (e) {
        console.log(
          '카카오 장소 검색 오류:',
          e
        );

        if (
          requestId ===
          searchRequestRef.current
        ) {
          setSearchResults([]);
          setShowSearchResults(false);
        }

      } finally {
        if (
          requestId ===
          searchRequestRef.current
        ) {
          setSearchLoading(false);
        }
      }
    };


  // ========================================
  // 검색 결과 선택
  // ========================================

  const selectSearchPlace =
    (place) => {

      const latitude =
        Number(place.y);

      const longitude =
        Number(place.x);

      if (
        Number.isNaN(latitude) ||
        Number.isNaN(longitude)
      ) {
        Alert.alert(
          '오류',
          '장소 위치를 확인할 수 없습니다.'
        );

        return;
      }

      Keyboard.dismiss();

      setSelectedSearchPlace({
  id: place.id,

  name: place.place_name,

  address:
    place.road_address_name ||
    place.address_name ||
    '',

  latitude,

  longitude,
});

      setShowSearchResults(false);

      mapRef.current
        ?.animateToRegion(
          {
            latitude,
            longitude,
            latitudeDelta: 0.008,
            longitudeDelta: 0.008,
          },
          700
        );
    };


  // ========================================
  // 검색 초기화
  // ========================================

  const clearSearch = () => {
    searchRequestRef.current += 1;

    setSearchText('');
    setSearchResults([]);
    setShowSearchResults(false);
    setSelectedSearchPlace(null);
    setSearchLoading(false);

    Keyboard.dismiss();
  };


  // ========================================
  // 현재 위치 이동
  // ========================================

  const moveToUserLocation =
    async () => {

      try {
        const { status } =
          await Location
            .requestForegroundPermissionsAsync();

        if (
          status !== 'granted'
        ) {
          Alert.alert(
            '권한 거부',
            '위치 권한을 허용해야 합니다.'
          );

          return;
        }

        const lastKnown =
          await Location
            .getLastKnownPositionAsync(
              {}
            );

        if (lastKnown) {
          const {
            latitude,
            longitude,
          } = lastKnown.coords;

          mapRef.current
            ?.animateToRegion(
              {
                latitude,
                longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              },
              500
            );
        }

        const userLoc =
          await Location
            .getCurrentPositionAsync({
              accuracy:
                Location.Accuracy.Balanced,
            });

        const {
          latitude,
          longitude,
        } = userLoc.coords;

        setUserLocation({
          latitude,
          longitude,
        });

        mapRef.current
          ?.animateToRegion(
            {
              latitude,
              longitude,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            },
            1000
          );

        const nearby =
          allPins.filter(
            (p) =>
              getDistance(
                latitude,
                longitude,
                p.latitude,
                p.longitude
              ) <= 1000
          );

        setNearbyCount(
          nearby.length
        );

      } catch (e) {
        console.log(
          '현재 위치 이동 오류:',
          e
        );

        Alert.alert(
          '오류',
          '현재 위치를 불러오지 못했습니다.'
        );
      }
    };


  // ========================================
  // 현재 위치에 장소 추가
  // ========================================

  const openAddPlace =
    async () => {

      setLoading(true);

      try {
        const { status } =
          await Location
            .requestForegroundPermissionsAsync();

        if (
          status !== 'granted'
        ) {
          Alert.alert(
            '권한 거부',
            '위치 권한을 허용해야 합니다.'
          );

          return;
        }

        const userLoc =
          await Location
            .getCurrentPositionAsync(
              {}
            );

        router.push({
          pathname:
            '/addplace',

          params: {
            latitude:
              userLoc.coords.latitude,

            longitude:
              userLoc.coords.longitude,

            address:
              '현재 위치',
          },
        });

      } catch (e) {
        console.log(
          '장소 추가 위치 오류:',
          e
        );

        Alert.alert(
          '오류',
          '현재 위치를 불러오지 못했습니다.'
        );

      } finally {
        setLoading(false);
      }
    };


  // ========================================
  // 지도 길게 눌러 장소 추가
  // ========================================

  const handleMapLongPress =
    (e) => {

      const {
        latitude,
        longitude,
      } =
        e.nativeEvent.coordinate;

      router.push({
        pathname:
          '/addplace',

        params: {
          latitude,
          longitude,

          address:
            '지도에서 선택한 위치',
        },
      });
    };


  // ========================================
  // 장소 상세
  // ========================================

  const goToDetail =
    (pin) => {

      router.push({
        pathname:
          '/detail',

        params: {
          id:
            pin.id,

          title:
            pin.title,

          description:
            pin.description,

          type:
            pin.type,

          user:
            pin.userNickname,

          userEmail:
            pin.userEmail ?? '',

          address:
            pin.address ?? '',

          detailAddress:
            pin.detailAddress ?? '',

          imagePaths:
            encodeURIComponent(
              JSON.stringify(
                pin.imagePaths ?? []
              )
            ),

          tags:
            JSON.stringify(
              pin.tags ?? []
            ),

          category:
            pin.category ?? '',

          verified:
            pin.verified
              ? 'true'
              : 'false',
        },
      });
    };


  // ========================================
  // 그룹 핀 클릭
  // ========================================

  const handleGroupPress =
    (group) => {

      if (
        !group.reviews ||
        group.reviews.length === 0
      ) {
        return;
      }

      // 리뷰 하나 → 바로 상세
      if (
        group.reviews.length === 1
      ) {
        goToDetail(
          group.reviews[0]
        );

        return;
      }

      // 리뷰 여러 개 → 선택창
      setSelectedReviewGroup(
        group
      );

      setReviewModalVisible(
        true
      );
    };


  // ========================================
  // 리뷰 선택
  // ========================================

  const selectReview =
    (review) => {

      setReviewModalVisible(
        false
      );

      setSelectedReviewGroup(
        null
      );

      goToDetail(review);
    };


  // ========================================
  // 리뷰 선택창 닫기
  // ========================================

  const closeReviewModal = () => {
    setReviewModalVisible(false);
    setSelectedReviewGroup(null);
  };

// ========================================
// 검색한 카카오 장소에 리뷰 작성
// ========================================

const handleSearchPlacePress = () => {
  if (!selectedSearchPlace) {
    return;
  }

  Alert.alert(
    '리뷰 작성',
    `${selectedSearchPlace.name}에 리뷰를 작성할까요?`,
    [
      {
        text: '취소',
        style: 'cancel',
      },
      {
        text: '작성하기',

        onPress: () => {
          router.push({
            pathname: '/addplace',

            params: {
              latitude:
                selectedSearchPlace.latitude,

              longitude:
                selectedSearchPlace.longitude,

              address:
                selectedSearchPlace.address ?? '',

              placeName:
                selectedSearchPlace.name ?? '',

              placeId:
                selectedSearchPlace.id ?? '',
            },
          });
        },
      },
    ]
  );
};
  // ========================================
  // 카테고리 필터
  // ========================================

  const handleCategory =
    (categoryId) => {

      setSelectedCategory(
        categoryId
      );

      const filtered =
        categoryId === '전체'
          ? allPins
          : allPins.filter(
              (p) =>
                p.category ===
                categoryId
            );

      setPins(filtered);

      if (userLocation) {
        const nearby =
          filtered.filter(
            (p) =>
              getDistance(
                userLocation.latitude,
                userLocation.longitude,
                p.latitude,
                p.longitude
              ) <= 1000
          );

        setNearbyCount(
          nearby.length
        );

      } else {
        setNearbyCount(0);
      }
    };
    // ========================================
// 친구별 지도 필터
// ========================================

const handleFriendFilter = (friendUid) => {
  setSelectedFriendUid(friendUid);

  let filtered = allPins;

  // 특정 친구를 선택한 경우
  if (friendUid !== '전체') {
    filtered = filtered.filter(
      (p) => p.userUid === friendUid
    );
  }

  // 현재 선택된 카테고리도 같이 적용
  if (selectedCategory !== '전체') {
    filtered = filtered.filter(
      (p) => p.category === selectedCategory
    );
  }

  setPins(filtered);

  // 1km 내 장소 개수도 다시 계산
  if (userLocation) {
    const nearby = filtered.filter(
      (p) =>
        getDistance(
          userLocation.latitude,
          userLocation.longitude,
          p.latitude,
          p.longitude
        ) <= 1000
    );

    setNearbyCount(nearby.length);
  } else {
    setNearbyCount(0);
  }

  setShowFriendFilter(false);
};

  return (
    <View style={styles.container}>

      {/* ============================= */}
      {/* 지도 */}
      {/* ============================= */}

      <MapView
        ref={mapRef}
        style={styles.map}

        showsUserLocation={true}

        onPress={() => {
          Keyboard.dismiss();

          setShowSearchResults(
            false
          );
        }}

        onLongPress={
          handleMapLongPress
        }

        initialRegion={{
          latitude: 37.5665,
          longitude: 126.9780,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >

        {/* ============================= */}
        {/* MAPPY 그룹 핀 */}
        {/* ============================= */}

        {groupedPins.map(
          (group) => {

            const reviewCount =
              group.reviews.length;

            const mainPin =
              group.reviews[0];

            return (
             <Marker
  key={group.id}

  coordinate={{
    latitude: group.latitude,
    longitude: group.longitude,
  }}

  onPress={() =>
    handleGroupPress(group)
  }

  hitSlop={{
    top: 15,
    bottom: 15,
    left: 15,
    right: 15,
  }}

  tracksViewChanges={false}
>

                <View
                  style={[
                    styles.customMarker,

                    reviewCount > 1
                      ? styles.groupMarker
                      : {
                          backgroundColor:
                            mainPin.type ===
                            'blue'
                              ? '#007AFF'
                              : '#FF3B30',
                        },
                  ]}
                >

                  {reviewCount > 1 ? (

                    <Text
                      style={
                        styles.markerCount
                      }
                    >
                      {reviewCount}
                    </Text>

                  ) : (

                    <Ionicons
                      name={
                        CATEGORY_ICONS[
                          mainPin.category
                        ]?.icon ??
                        'location'
                      }

                      size={14}

                      color="white"
                    />

                  )}

                </View>

              </Marker>
            );
          }
        )}


        {/* ============================= */}
        {/* 검색해서 선택한 장소 */}
        {/* ============================= */}

        {selectedSearchPlace && (
  <Marker
    coordinate={{
      latitude:
        selectedSearchPlace.latitude,

      longitude:
        selectedSearchPlace.longitude,
    }}

    title={
      selectedSearchPlace.name
    }

    description="눌러서 리뷰 작성"

    pinColor="#34C759"

    onPress={
      handleSearchPlacePress
    }

    onCalloutPress={
      handleSearchPlacePress
    }
  />
)}

      </MapView>
{/* ============================= */}
{/* 장소가 없을 때 안내 */}
{/* ============================= */}

{!loading && allPins.length === 0 && !selectedSearchPlace && (
  <View style={styles.emptyMapCard}>
    <View style={styles.emptyMapIcon}>
      <Ionicons
        name="map-outline"
        size={22}
        color="#007AFF"
      />
    </View>

    <View style={styles.emptyMapContent}>
      <Text style={styles.emptyMapTitle}>
        아직 저장된 장소가 없어요
      </Text>

      <Text style={styles.emptyMapDescription}>
        장소를 검색하거나 + 버튼을 눌러{'\n'}
        첫 번째 장소를 기록해보세요!
      </Text>
    </View>

    <Ionicons
      name="arrow-down"
      size={23}
      color="#007AFF"
    />
  </View>
)}


      {/* ============================= */}
      {/* 검색 + 카테고리 */}
      {/* ============================= */}

      <View style={styles.topLayer}>

        <View style={styles.searchBar}>

          <Ionicons
            name="search"
            size={20}
            color="#007AFF"
          />

          <TextInput
            style={
              styles.searchInput
            }

            placeholder="장소를 검색하세요"

            placeholderTextColor="#8E8E93"

            value={
              searchText
            }

            onChangeText={(
              text
            ) => {

              setSearchText(
                text
              );

              if (
                text.trim()
                  .length >= 2
              ) {
                setShowSearchResults(
                  true
                );
              }
            }}

            onFocus={() => {
              if (
                searchResults.length >
                0
              ) {
                setShowSearchResults(
                  true
                );
              }
            }}

            returnKeyType="search"

            autoCorrect={false}
          />

          {searchLoading ? (

            <ActivityIndicator
              size="small"
              color="#007AFF"
            />

          ) : searchText.length >
            0 ? (

            <TouchableOpacity
              onPress={
                clearSearch
              }
            >

              <Ionicons
                name="close-circle"
                size={20}
                color="#8E8E93"
              />

            </TouchableOpacity>

          ) : null}

        </View>
        
       
        {/* ============================= */}
        {/* 검색 결과 */}
        {/* ============================= */}

        {showSearchResults && (

          <View
            style={
              styles.searchResultBox
            }
          >

            {searchResults.length >
            0 ? (

              <FlatList
                data={
                  searchResults
                }

                keyExtractor={(
                  item
                ) =>
                  item.id
                }

                keyboardShouldPersistTaps="handled"

                showsVerticalScrollIndicator={
                  false
                }

                renderItem={({
                  item,
                }) => {

                  const address =
                    item.road_address_name ||
                    item.address_name;

                  const distance =
                    formatDistance(
                      item.distance
                    );

                  return (

                    <TouchableOpacity
                      style={
                        styles.searchResultItem
                      }

                      onPress={() =>
                        selectSearchPlace(
                          item
                        )
                      }
                    >

                      <View
                        style={
                          styles.searchResultIcon
                        }
                      >

                        <Ionicons
                          name="location"
                          size={19}
                          color="#007AFF"
                        />

                      </View>


                      <View
                        style={
                          styles.searchResultContent
                        }
                      >

                        <Text
                          style={
                            styles.searchResultName
                          }

                          numberOfLines={
                            1
                          }
                        >
                          {
                            item.place_name
                          }
                        </Text>


                        <Text
                          style={
                            styles.searchResultAddress
                          }

                          numberOfLines={
                            1
                          }
                        >
                          {address ||
                            '주소 정보 없음'}
                        </Text>


                        <View
                          style={
                            styles.searchResultMeta
                          }
                        >

                          {item.category_group_name ? (

                            <Text
                              style={
                                styles.searchResultCategory
                              }
                            >
                              {
                                item.category_group_name
                              }
                            </Text>

                          ) : null}


                          {distance ? (

                            <Text
                              style={
                                styles.searchResultDistance
                              }
                            >
                              {distance}
                            </Text>

                          ) : null}

                        </View>

                      </View>

                    </TouchableOpacity>

                  );
                }}
              />

            ) : !searchLoading ? (

              <View
                style={
                  styles.noResultBox
                }
              >

                <Text
                  style={
                    styles.noResultText
                  }
                >
                  검색 결과가 없습니다.
                </Text>

              </View>

            ) : null}

          </View>

        )}


        {/* ============================= */}
        {/* 카테고리 */}
        {/* ============================= */}

        <ScrollView
          horizontal

          showsHorizontalScrollIndicator={
            false
          }

          style={
            styles.filterScroll
          }

          keyboardShouldPersistTaps="handled"
        >
             {/* 친구별 지도 필터 */}

  <TouchableOpacity
    style={styles.friendFilterBtn}
    onPress={() =>
      setShowFriendFilter((prev) => !prev)
    }
    activeOpacity={0.8}
  >
    <Ionicons
      name="people-outline"
      size={17}
      color="#007AFF"
    />

    <Text style={styles.friendFilterBtnText}>
      {selectedFriendUid === '전체'
        ? '전체 친구'
        : friends.find(
            (friend) =>
              friend.uid === selectedFriendUid
          )?.nickname || '친구'}
    </Text>

    <Ionicons
      name={
        showFriendFilter
          ? 'chevron-up'
          : 'chevron-down'
      }
      size={15}
      color="#8E8E93"
    />
  </TouchableOpacity>


          {[
            {
              label: '전체',
              id: '전체',
            },

            {
              label: '🍽️ 음식점',
              id: 'food',
            },

            {
              label: '☕ 카페',
              id: 'cafe',
            },

            {
              label: '🌿 자연',
              id: 'nature',
            },

            {
              label: '🎨 문화',
              id: 'culture',
            },

            {
              label: '🎪 팝업',
              id: 'popup',
            },

            {
              label: '🛍️ 쇼핑',
              id: 'shop',
            },

            {
              label: '🏥 병원·약국',
              id: 'hospital',
            },

            {
              label: '💇 미용',
              id: 'beauty',
            },

            {
              label: '🚗 주차장',
              id: 'parking',
            },

            {
              label: '🏨 숙소',
              id: 'stay',
            },

            {
              label: '🏋️ 운동·헬스',
              id: 'fitness',
            },

            {
              label: '📚 카공·스터디',
              id: 'study',
            },

            {
              label: '🎮 오락·취미',
              id: 'play',
            },

            {
              label: '📍 기타',
              id: 'etc',
            },

          ].map((f) => (

            <TouchableOpacity
              key={
                f.id
              }

              style={[
                styles.filterBtn,

                selectedCategory ===
                  f.id &&
                  styles.filterBtnActive,
              ]}

              onPress={() =>
                handleCategory(
                  f.id
                )
              }
            >

              <Text
                style={[
                  styles.filterBtnTxt,

                  selectedCategory ===
                    f.id && {
                    color:
                      '#007AFF',

                    fontWeight:
                      '700',
                  },
                ]}
              >
                {f.label}
              </Text>

            </TouchableOpacity>

          ))}

        </ScrollView>
          {/* 친구 필터 드롭다운 */}
{showFriendFilter && (
  <View style={styles.friendDropdown}>

    {/* 전체 친구 */}
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
        전체 친구
      </Text>

      {selectedFriendUid === '전체' && (
        <Ionicons
          name="checkmark"
          size={18}
          color="#007AFF"
        />
      )}
    </TouchableOpacity>

    {/* 친구 목록 */}
    {friends.map((friend) => (
      <TouchableOpacity
        key={friend.uid}
        style={styles.friendDropdownItem}
        onPress={() =>
          handleFriendFilter(friend.uid)
        }
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


      {/* ============================= */}
      {/* 1km 내 장소 */}
      {/* ============================= */}

      <View
        style={
          styles.nearbyBanner
        }
      >

        <Ionicons
          name="location"
          size={14}
          color="#007AFF"
        />

        <Text
          style={
            styles.nearbyText
          }
        >
          1km 내{' '}

          <Text
            style={
              styles.nearbyCount
            }
          >
            {nearbyCount}개
          </Text>

          의 스팟
        </Text>

      </View>


      {/* ============================= */}
      {/* 장소 추가 */}
      {/* ============================= */}

      <TouchableOpacity
        style={
          styles.addPinBtn
        }

        onPress={
          openAddPlace
        }

        disabled={
          loading
        }
      >

        {loading ? (

          <ActivityIndicator
            color="white"
            size="small"
          />

        ) : (

          <Ionicons
            name="add"
            size={30}
            color="white"
          />

        )}

      </TouchableOpacity>


      {/* ============================= */}
      {/* 현재 위치 */}
      {/* ============================= */}

      <TouchableOpacity
        style={
          styles.locationBtn
        }

        onPress={
          moveToUserLocation
        }
      >

        <Ionicons
          name="locate"
          size={28}
          color="#007AFF"
        />

      </TouchableOpacity>


      {/* ============================= */}
      {/* 그룹 리뷰 선택 Modal */}
      {/* ============================= */}

      <Modal
        visible={
          reviewModalVisible
        }

        transparent

        animationType="slide"

        onRequestClose={
          closeReviewModal
        }
      >

        <View
          style={
            styles.reviewModalOverlay
          }
        >

          {/* 바깥 영역 누르면 닫힘 */}

          <TouchableOpacity
            style={
              styles.reviewModalBackground
            }

            activeOpacity={1}

            onPress={
              closeReviewModal
            }
          />


          {/* 하단 시트 */}

          <View
            style={
              styles.reviewSheet
            }
          >

            <View
              style={
                styles.reviewSheetHandle
              }
            />


            {/* 제목 */}

            <View
              style={
                styles.reviewSheetHeader
              }
            >

              <View>

                <Text
                  style={
                    styles.reviewSheetTitle
                  }
                >
                  이 장소의 리뷰
                </Text>

                <Text
                  style={
                    styles.reviewSheetCount
                  }
                >
                  {
                    selectedReviewGroup
                      ?.reviews
                      ?.length ?? 0
                  }
                  개의 리뷰
                </Text>

              </View>


              <TouchableOpacity
                style={
                  styles.reviewCloseBtn
                }

                onPress={
                  closeReviewModal
                }
              >

                <Ionicons
                  name="close"
                  size={22}
                  color="#1C1C1E"
                />

              </TouchableOpacity>

            </View>


            {/* 리뷰 목록 */}

            <FlatList
              data={
                selectedReviewGroup
                  ?.reviews ?? []
              }

              keyExtractor={(
                item
              ) =>
                item.id
              }

              showsVerticalScrollIndicator={
                false
              }

              contentContainerStyle={{
                paddingBottom: 30,
              }}

              renderItem={({
                item,
              }) => {

                const isGood =
                  item.type ===
                  'blue';

                return (

                  <TouchableOpacity
                    style={
                      styles.reviewSelectCard
                    }

                    activeOpacity={
                      0.7
                    }

                    onPress={() =>
                      selectReview(
                        item
                      )
                    }
                  >

                    {/* 추천 / 인증 */}

                    <View
                      style={
                        styles.reviewCardTop
                      }
                    >

                      <View
                        style={[
                          styles.reviewTypeBadge,

                          {
                            backgroundColor:
                              isGood
                                ? '#007AFF'
                                : '#FF3B30',
                          },
                        ]}
                      >

                        <Text
                          style={
                            styles.reviewTypeText
                          }
                        >
                          {isGood
                            ? '👍 추천'
                            : '👎 비추천'}
                        </Text>

                      </View>


                      {item.verified === true && (

                        <View
                          style={
                            styles.reviewVerifiedBadge
                          }
                        >

                          <Ionicons
                            name="checkmark-circle"
                            size={14}
                            color="#34C759"
                          />

                          <Text
                            style={
                              styles.reviewVerifiedText
                            }
                          >
                            방문 인증
                          </Text>

                        </View>

                      )}

                    </View>


                    {/* 리뷰 제목 */}

                    <Text
                      style={
                        styles.reviewSelectTitle
                      }

                      numberOfLines={
                        1
                      }
                    >
                      {item.title ||
                        '장소 리뷰'}
                    </Text>


                    {/* 리뷰 내용 */}

                    {item.description ? (

                      <Text
                        style={
                          styles.reviewSelectDescription
                        }

                        numberOfLines={
                          2
                        }
                      >
                        {
                          item.description
                        }
                      </Text>

                    ) : null}


                    {/* 작성자 */}

                    <View
                      style={
                        styles.reviewAuthorRow
                      }
                    >

                      <View
                        style={
                          styles.reviewAvatar
                        }
                      >

                        <Text
                          style={
                            styles.reviewAvatarText
                          }
                        >
                          {(
                            item.userNickname ||
                            '?'
                          )
                            .charAt(0)
                            .toUpperCase()}
                        </Text>

                      </View>


                      <Text
                        style={
                          styles.reviewAuthor
                        }
                      >
                        {item.userNickname ||
                          '익명'}
                      </Text>


                      <Ionicons
                        name="chevron-forward"
                        size={17}
                        color="#C7C7CC"

                        style={{
                          marginLeft:
                            'auto',
                        }}
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


// ========================================
// STYLE
// ========================================

const styles = StyleSheet.create({

  container: {
    flex: 1,
  },


  map: {
    width: '100%',
    height: '100%',
  },


  // ======================================
  // MAPPY 핀
  // ======================================

  customMarker: {
    width: 32,
    height: 32,

    borderRadius: 16,

    alignItems: 'center',
    justifyContent: 'center',

    shadowColor: '#000',

    shadowOffset: {
      width: 0,
      height: 2,
    },

    shadowOpacity: 0.3,
    shadowRadius: 4,

    elevation: 5,

    borderWidth: 2,
    borderColor: 'white',
  },


  groupMarker: {
    width: 36,
    height: 36,

    borderRadius: 18,

    backgroundColor:
      '#007AFF',

    borderWidth: 2.5,

    borderColor:
      'white',
  },


  markerCount: {
    color: 'white',

    fontSize: 13,

    fontWeight: '800',
  },


  // ======================================
  // 상단
  // ======================================

  topLayer: {
    position: 'absolute',

    top: 50,

    width: '100%',

    zIndex: 20,

    elevation: 20,
  },


  // ======================================
  // 검색창
  // ======================================

  searchBar: {
    backgroundColor:
      'white',

    height: 50,

    borderRadius: 15,

    flexDirection: 'row',

    alignItems: 'center',

    paddingHorizontal: 15,

    marginHorizontal: 20,

    elevation: 8,

    shadowColor: '#000',

    shadowOffset: {
      width: 0,
      height: 2,
    },

    shadowOpacity: 0.12,

    shadowRadius: 8,
  },


  searchInput: {
    flex: 1,

    marginLeft: 10,

    marginRight: 8,

    fontSize: 15,

    color: '#1C1C1E',

    backgroundColor:
      'white',
  },


  // ======================================
  // 검색 결과
  // ======================================

  searchResultBox: {
    backgroundColor:
      'white',

    marginHorizontal: 20,

    marginTop: 5,

    borderRadius: 14,

    maxHeight: 340,

    overflow: 'hidden',

    elevation: 10,

    shadowColor: '#000',

    shadowOffset: {
      width: 0,
      height: 3,
    },

    shadowOpacity: 0.15,

    shadowRadius: 8,
  },


  searchResultItem: {
    minHeight: 78,

    flexDirection: 'row',

    alignItems: 'center',

    paddingHorizontal: 14,

    paddingVertical: 10,

    borderBottomWidth:
      StyleSheet.hairlineWidth,

    borderBottomColor:
      '#E5E5EA',
  },


  searchResultIcon: {
    width: 34,
    height: 34,

    borderRadius: 17,

    backgroundColor:
      '#EAF3FF',

    alignItems: 'center',

    justifyContent:
      'center',

    marginRight: 11,
  },


  searchResultContent: {
    flex: 1,
  },


  searchResultName: {
    fontSize: 15,

    fontWeight: '700',

    color: '#1C1C1E',

    marginBottom: 4,
  },


  searchResultAddress: {
    fontSize: 12,

    color: '#636366',

    marginBottom: 5,
  },


  searchResultMeta: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 8,
  },


  searchResultCategory: {
    fontSize: 11,

    color: '#8E8E93',
  },


  searchResultDistance: {
    fontSize: 11,

    fontWeight: '700',

    color: '#007AFF',
  },


  noResultBox: {
    paddingVertical: 25,

    alignItems: 'center',

    justifyContent:
      'center',
  },


  noResultText: {
    fontSize: 14,

    color: '#8E8E93',
  },

  emptyMapArrow: {
  marginLeft: 8,
  transform: [{ rotate: '45deg' }],
},
  // ======================================
  // 카테고리
  // ======================================

  filterScroll: {
    marginTop: 10,

    paddingLeft: 20,
  },


 filterBtn: {
  height: 36,
  paddingHorizontal: 14,
  borderRadius: 18,

  backgroundColor: '#FFFFFF',

  alignItems: 'center',
  justifyContent: 'center',

  marginRight: 8,

  elevation: 2,
},


  filterBtnActive: {
    backgroundColor:
      '#EAF3FF',

    borderWidth: 1.5,

    borderColor:
      '#007AFF',
  },


  filterBtnTxt: {
    fontSize: 13,

    color: '#3A3A3C',
  },


  // ======================================
  // 1km 배너
  // ======================================

  nearbyBanner: {
    position: 'absolute',

    bottom: 110,

    left: 20,

    backgroundColor:
      'white',

    flexDirection: 'row',

    alignItems: 'center',

    paddingHorizontal: 14,

    paddingVertical: 8,

    borderRadius: 20,

    elevation: 4,

    gap: 5,
  },


  nearbyText: {
    fontSize: 13,

    color: '#3A3A3C',
  },


  nearbyCount: {
    fontWeight: '800',

    color: '#007AFF',
  },


  // ======================================
  // 장소 추가
  // ======================================

  addPinBtn: {
    position: 'absolute',

    bottom: 40,

    right: 20,

    backgroundColor:
      '#007AFF',

    width: 55,

    height: 55,

    borderRadius: 30,

    justifyContent:
      'center',

    alignItems: 'center',

    elevation: 6,

    zIndex: 1,

    shadowColor:
      '#007AFF',

    shadowOpacity: 0.4,

    shadowRadius: 8,
  },


  // ======================================
  // 현재 위치
  // ======================================

  locationBtn: {
    position: 'absolute',

    bottom: 40,

    left: 20,

    backgroundColor:
      'white',

    width: 55,

    height: 55,

    borderRadius: 30,

    justifyContent:
      'center',

    alignItems: 'center',

    elevation: 5,

    zIndex: 1,

    shadowColor: '#000',

    shadowOpacity: 0.1,

    shadowRadius: 8,
  },


  // ======================================
  // 리뷰 선택 Modal
  // ======================================

  reviewModalOverlay: {
    flex: 1,

    justifyContent:
      'flex-end',

    backgroundColor:
      'rgba(0,0,0,0.25)',
  },


  reviewModalBackground: {
    ...StyleSheet.absoluteFillObject,
  },


  reviewSheet: {
    backgroundColor:
      'white',

    borderTopLeftRadius: 26,

    borderTopRightRadius: 26,

    paddingHorizontal: 20,

    paddingTop: 10,

    maxHeight: '65%',

    elevation: 20,
  },


  reviewSheetHandle: {
    width: 40,

    height: 5,

    borderRadius: 3,

    backgroundColor:
      '#D1D1D6',

    alignSelf: 'center',

    marginBottom: 18,
  },


  reviewSheetHeader: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'space-between',

    marginBottom: 16,
  },


  reviewSheetTitle: {
    fontSize: 21,

    fontWeight: '800',

    color: '#1C1C1E',
  },


  reviewSheetCount: {
    fontSize: 13,

    color: '#8E8E93',

    marginTop: 3,
  },


  reviewCloseBtn: {
    width: 36,

    height: 36,

    borderRadius: 18,

    backgroundColor:
      '#F2F2F7',

    alignItems: 'center',

    justifyContent:
      'center',
  },


  reviewSelectCard: {
    backgroundColor:
      '#F8F8FA',

    borderRadius: 18,

    padding: 16,

    marginBottom: 12,
  },


  reviewCardTop: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 8,

    marginBottom: 10,
  },


  reviewTypeBadge: {
    paddingHorizontal: 9,

    paddingVertical: 4,

    borderRadius: 12,
  },


  reviewTypeText: {
    color: 'white',

    fontSize: 11,

    fontWeight: '700',
  },


  reviewVerifiedBadge: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 4,

    backgroundColor:
      '#EDFAF4',

    paddingHorizontal: 8,

    paddingVertical: 4,

    borderRadius: 12,
  },


  reviewVerifiedText: {
    color: '#34C759',

    fontSize: 11,

    fontWeight: '700',
  },


  reviewSelectTitle: {
    fontSize: 17,

    fontWeight: '800',

    color: '#1C1C1E',

    marginBottom: 6,
  },


  reviewSelectDescription: {
    fontSize: 14,

    color: '#636366',

    lineHeight: 20,

    marginBottom: 14,
  },


  reviewAuthorRow: {
    flexDirection: 'row',

    alignItems: 'center',

    borderTopWidth:
      StyleSheet.hairlineWidth,

    borderTopColor:
      '#E5E5EA',

    paddingTop: 12,
  },


  reviewAvatar: {
    width: 28,

    height: 28,

    borderRadius: 14,

    backgroundColor:
      '#E6F1FB',

    alignItems: 'center',

    justifyContent:
      'center',

    marginRight: 8,
  },


  reviewAvatarText: {
    color: '#185FA5',

    fontSize: 12,

    fontWeight: '800',
  },


  reviewAuthor: {
    fontSize: 13,

    fontWeight: '700',

    color: '#3A3A3C',
  },
  emptyMapCard: {
  position: 'absolute',
  left: 20,
  right: 20,
  bottom: 105,

  flexDirection: 'row',
  alignItems: 'center',

  backgroundColor: 'white',
  borderRadius: 18,

  paddingHorizontal: 16,
  paddingVertical: 14,

  shadowColor: '#000',
  shadowOffset: {
    width: 0,
    height: 3,
  },
  shadowOpacity: 0.1,
  shadowRadius: 10,

  elevation: 6,

  zIndex: 10,
},

emptyMapIcon: {
  width: 42,
  height: 42,
  borderRadius: 21,

  backgroundColor: '#EAF3FF',

  alignItems: 'center',
  justifyContent: 'center',

  marginRight: 12,
},

emptyMapContent: {
  flex: 1,
},

emptyMapTitle: {
  fontSize: 14,
  fontWeight: '700',
  color: '#1C1C1E',

  marginBottom: 3,
},

emptyMapDescription: {
  fontSize: 12,
  lineHeight: 17,
  color: '#8E8E93',
},



friendFilterBtn: {
  height: 36,
  paddingHorizontal: 12,
  borderRadius: 18,

  backgroundColor: '#FFFFFF',

  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',

  gap: 5,
  marginRight: 8,

  borderWidth: 1,
  borderColor: '#E5E5EA',

  alignSelf: 'center',
},

friendFilterBtnText: {
  fontSize: 13,
  fontWeight: '700',
  color: '#1C1C1E',
},

friendDropdown: {
  position: 'absolute',

  top: 100,
  left: 20,

  width: 165,

  backgroundColor: '#FFFFFF',
  borderRadius: 12,

  paddingVertical: 4,

  shadowColor: '#000',
  shadowOffset: {
    width: 0,
    height: 3,
  },
  shadowOpacity: 0.12,
  shadowRadius: 8,

  elevation: 8,
  zIndex: 100,
},

friendDropdownItem: {
  height: 38,
  paddingHorizontal: 12,

  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
},

friendDropdownText: {
  fontSize: 13,
  fontWeight: '600',
  color: '#1C1C1E',
},

friendDropdownTextActive: {
  color: '#007AFF',
  fontWeight: '700',
},
});