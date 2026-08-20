import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

type TargetYieldSliderProps = {
  value: number;
  onValueChange: (value: number) => void;
  minimumTrackTintColor: string;
  maximumTrackTintColor: string;
  thumbTintColor: string;
  style?: object;
};

export default function TargetYieldSlider({ value, onValueChange, ...props }: TargetYieldSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackRef = useRef<View>(null);
  const trackPageX = useRef(0);
  const minimumValue = 0.25;
  const maximumValue = 4;
  const step = 0.25;
  const progress = (value - minimumValue) / (maximumValue - minimumValue);

  const updateFromPageX = (pageX: number) => {
    if (!trackWidth) return;
    const rawValue = minimumValue + ((pageX - trackPageX.current) / trackWidth) * (maximumValue - minimumValue);
    const steppedValue = Math.round(rawValue / step) * step;
    onValueChange(Math.min(maximumValue, Math.max(minimumValue, steppedValue)));
  };

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => updateFromPageX(event.nativeEvent.pageX),
    onPanResponderMove: (event) => updateFromPageX(event.nativeEvent.pageX),
  }), [trackWidth, onValueChange]);

  const adjust = (direction: 1 | -1) => {
    onValueChange(Math.min(maximumValue, Math.max(minimumValue, value + direction * step)));
  };

  return (
    <View
      style={[styles.touchArea, props.style]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Target yield multiplier"
      accessibilityValue={{ min: minimumValue, max: maximumValue, now: value, text: `${value.toFixed(2)} times` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => adjust(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
      {...panResponder.panHandlers}
    >
      <View
        ref={trackRef}
        style={[styles.track, { backgroundColor: props.maximumTrackTintColor }]}
        onLayout={(event) => {
          setTrackWidth(event.nativeEvent.layout.width);
          trackRef.current?.measureInWindow((x) => { trackPageX.current = x; });
        }}
      >
        <View style={[styles.activeTrack, { width: `${progress * 100}%`, backgroundColor: props.minimumTrackTintColor }]} />
        <View style={[styles.thumb, { left: `${progress * 100}%`, borderColor: props.thumbTintColor, backgroundColor: props.maximumTrackTintColor }]} pointerEvents="none">
          <MaterialCommunityIcons name="knife" size={24} color={props.thumbTintColor} style={styles.knife} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  touchArea: { width: '100%', height: 44, justifyContent: 'center' },
  track: { width: '100%', height: 6, borderRadius: 3, position: 'relative' },
  activeTrack: { height: '100%', borderRadius: 3 },
  thumb: {
    position: 'absolute',
    top: -15,
    width: 36,
    height: 36,
    marginLeft: -18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 3,
  },
  knife: { transform: [{ rotate: '-35deg' }] },
});
