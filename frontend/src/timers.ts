export type TimerSuggestion = { seconds: number; label: string };

const UNIT_SECONDS: Record<string, number> = {
  second: 1, seconds: 1, sec: 1, secs: 1,
  minute: 60, minutes: 60, min: 60, mins: 60,
  hour: 3600, hours: 3600, hr: 3600, hrs: 3600,
};

export function formatTimerDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  if (hours) return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export function extractTimerSuggestions(instruction: string): TimerSuggestion[] {
  const suggestions: TimerSuggestion[] = [];
  const occupiedRanges: Array<[number, number]> = [];
  const rangePattern = /(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/gi;
  let match: RegExpExecArray | null;

  while ((match = rangePattern.exec(instruction)) !== null) {
    const multiplier = UNIT_SECONDS[match[3].toLowerCase()];
    addSuggestion(suggestions, Number(match[1]) * multiplier);
    addSuggestion(suggestions, Number(match[2]) * multiplier);
    occupiedRanges.push([match.index, rangePattern.lastIndex]);
  }

  const durationPattern = /(\d+(?:\.\d+)?)\s*(hours?|hrs?)(?:\s*(?:and\s*)?(\d+(?:\.\d+)?)\s*(minutes?|mins?))?|(?:\d+(?:\.\d+)?)\s*(minutes?|mins?|seconds?|secs?)\b/gi;
  while ((match = durationPattern.exec(instruction)) !== null) {
    if (occupiedRanges.some(([start, end]) => match!.index >= start && match!.index < end)) continue;
    const matchedText = match[0];
    const hourMatch = matchedText.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?)/i);
    const minuteMatch = matchedText.match(/(\d+(?:\.\d+)?)\s*(minutes?|mins?)/i);
    const secondMatch = matchedText.match(/(\d+(?:\.\d+)?)\s*(seconds?|secs?)/i);
    const seconds = (hourMatch ? Number(hourMatch[1]) * 3600 : 0)
      + (minuteMatch ? Number(minuteMatch[1]) * 60 : 0)
      + (secondMatch ? Number(secondMatch[1]) : 0);
    addSuggestion(suggestions, seconds);
  }

  return suggestions.sort((left, right) => left.seconds - right.seconds);
}

function addSuggestion(suggestions: TimerSuggestion[], seconds: number) {
  const rounded = Math.round(seconds);
  if (rounded < 1 || rounded > 24 * 60 * 60 || suggestions.some((suggestion) => suggestion.seconds === rounded)) return;
  suggestions.push({ seconds: rounded, label: formatHumanDuration(rounded) });
}

function formatHumanDuration(seconds: number) {
  if (seconds % 3600 === 0) return `${seconds / 3600} ${seconds === 3600 ? 'hour' : 'hours'}`;
  if (seconds >= 3600 && seconds % 60 === 0) {
    const hours = Math.floor(seconds / 3600);
    const minutes = (seconds % 3600) / 60;
    return `${hours} hr ${minutes} min`;
  }
  if (seconds % 60 === 0) return `${seconds / 60} ${seconds === 60 ? 'minute' : 'minutes'}`;
  return `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
}
