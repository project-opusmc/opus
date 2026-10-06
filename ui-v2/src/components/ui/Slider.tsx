type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
};

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue = (next) => String(next),
}: SliderProps) {
  return (
    <label className="ui-slider">
      <span className="ui-slider__header">
        <strong>{label}</strong>
        <output>{formatValue(value)}</output>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
