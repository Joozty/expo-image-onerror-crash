import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { Image } from 'expo-image';

// Any source that fails to load works (offline, 404, bad file).
// A missing local file fails instantly and needs no network.
const FAILING_SOURCE = { uri: 'file:///this/file/does/not/exist.jpg' };
// const FAILING_SOURCE = { uri: 'https://httpbin.org/status/404' };

const cards = Array.from({ length: 100 }, (_, index) => index);

export default function App() {
  const scrollY = useSharedValue(0);

  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    height: interpolate(scrollY.value, [0, 500], [200, 80], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.header, headerAnimatedStyle]}>
        <Image source={FAILING_SOURCE} contentFit="cover" style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.ScrollView onScroll={handleScroll} style={styles.scroll}>
        {cards.map((index) => (
          <View key={index} style={styles.card} />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ecf0f1',
    paddingHorizontal: 8,
    paddingTop: 48,
  },
  header: {
    backgroundColor: '#34495e',
    height: 200,
  },
  scroll: {
    flex: 1,
  },
  card: {
    backgroundColor: 'salmon',
    borderRadius: 8,
    height: 100,
    marginTop: 8,
  },
});
