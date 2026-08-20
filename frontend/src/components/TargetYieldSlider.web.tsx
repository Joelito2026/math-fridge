import type { CSSProperties, FormEvent } from 'react';

type TargetYieldSliderProps = {
  value: number;
  onValueChange: (value: number) => void;
  minimumTrackTintColor: string;
  maximumTrackTintColor: string;
  thumbTintColor: string;
  style?: object;
};

export default function TargetYieldSlider({ value, onValueChange, minimumTrackTintColor }: TargetYieldSliderProps) {
  const updateValue = (event: FormEvent<HTMLInputElement>) => {
    onValueChange(event.currentTarget.valueAsNumber);
  };

  return (
    <input
      aria-label="Target yield multiplier"
      type="range"
      min={0.25}
      max={4}
      step={0.25}
      value={value}
      onInput={updateValue}
      onChange={updateValue}
      style={{
        width: '100%',
        height: 40,
        marginTop: 8,
        accentColor: minimumTrackTintColor,
      } satisfies CSSProperties}
    />
  );
}
