import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Alert, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, useWindowDimensions, Vibration, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { isAvailableAsync, useKeepAwake } from 'expo-keep-awake';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchRecipeById } from '../../src/api';
import { usePreferences, AppColors } from '../../src/contexts/PreferencesContext';
import { formatEquivalentMeasurement, formatScaledQuantity, getAtomicMultiplier } from '../../src/scaling';
import { SPACING, TYPOGRAPHY } from '../../src/theme';
import { createThemedStyles } from '../../src/theme/createThemedStyles';
import { RecipeResponse } from '../../src/types';
import { extractTimerSuggestions, formatTimerDuration } from '../../src/timers';
import { cancelCookingTimerNotification, scheduleCookingTimerNotification } from '../../src/cookingNotifications';
import { clearCookingProgress, CookingProgress, loadCookingProgress, saveCookingProgress } from '../../src/cookingProgress';
import { playTimerAlarm, prepareTimerAlarm } from '../../src/timerAlarm';

type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';
type Confirmation = { kind: 'replace'; seconds: number } | { kind: 'reset' };

export default function CookingModeScreen() {
  useKeepAwake('math-fridge-cooking-mode', { suppressDeactivateWarnings: true });
  const router = useRouter();
  const { id, targetYield: targetYieldParam, step: stepParam } = useLocalSearchParams<{ id: string; targetYield?: string; step?: string }>();
  const { width } = useWindowDimensions();
  const { colors, textScale } = usePreferences();
  const styles = createStyles(colors, textScale);
  const [recipe, setRecipe] = useState<RecipeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [checkedIngredients, setCheckedIngredients] = useState<number[]>([]);
  const [showIngredients, setShowIngredients] = useState(false);
  const [wakeLockAvailable, setWakeLockAvailable] = useState(true);
  const [timerStatus, setTimerStatus] = useState<TimerStatus>('idle');
  const [timerDuration, setTimerDuration] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [timerStep, setTimerStep] = useState(0);
  const [notificationsAvailable, setNotificationsAvailable] = useState(true);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [notificationId, setNotificationId] = useState<string | null>(null);
  const [showCustomTimer, setShowCustomTimer] = useState(false);
  const [customHours, setCustomHours] = useState('');
  const [customMinutes, setCustomMinutes] = useState('');
  const [customSeconds, setCustomSeconds] = useState('');
  const [customTimerError, setCustomTimerError] = useState<string | null>(null);
  const [savedTargetYield, setSavedTargetYield] = useState<number | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const notificationIdRef = useRef<string | null>(null);
  const notificationGenerationRef = useRef(0);
  const isWide = width >= 850;
  const targetYield = Math.min(4, Math.max(0.25, Number(targetYieldParam) || savedTargetYield || 1));

  useEffect(() => {
    void isAvailableAsync().then(setWakeLockAvailable).catch(() => setWakeLockAvailable(false));
  }, []);

  useEffect(() => {
    const loadRecipeAndProgress = async () => {
      if (!id) { setLoading(false); setProgressLoaded(true); return; }
      const [data, saved] = await Promise.all([fetchRecipeById(id), loadCookingProgress(id)]);
      setRecipe(data);

      const requestedStep = Number(stepParam);
      if (Number.isInteger(requestedStep) && requestedStep >= 0) setCurrentStep(requestedStep);
      else if (saved) setCurrentStep(Math.max(0, saved.currentStep));
      if (saved) {
        if (Number.isFinite(saved.targetYield)) setSavedTargetYield(saved.targetYield!);
        setCheckedIngredients(saved.checkedIngredients.filter((value) => Number.isInteger(value) && value >= 0));
        if (saved.timer) {
          const expired = saved.timer.status === 'running' && !!saved.timer.endsAt && saved.timer.endsAt <= Date.now();
          setTimerStatus(expired ? 'finished' : saved.timer.status);
          setTimerDuration(saved.timer.duration);
          setRemainingSeconds(expired ? 0 : saved.timer.status === 'running' && saved.timer.endsAt
            ? Math.max(0, Math.ceil((saved.timer.endsAt - Date.now()) / 1000))
            : saved.timer.remainingSeconds);
          setTimerEndsAt(expired ? null : saved.timer.endsAt);
          setTimerStep(saved.timer.step);
          notificationIdRef.current = expired ? null : saved.timer.notificationId;
          setNotificationId(expired ? null : saved.timer.notificationId);
        }
      }
      setProgressLoaded(true);
      setLoading(false);
    };
    void loadRecipeAndProgress();
  }, [id, stepParam]);

  const instructions = useMemo(() => recipe?.recipe_data.instructions.filter((instruction) => instruction.trim()) || [], [recipe]);
  const stepCount = Math.max(1, instructions.length);
  const multiplier = recipe ? getAtomicMultiplier(recipe.recipe_data.ingredients, targetYield) : targetYield;
  const checkedCount = checkedIngredients.length;
  const timerSuggestions = useMemo(() => extractTimerSuggestions(instructions[currentStep] || ''), [currentStep, instructions]);
  const persistentRemainingSeconds = timerStatus === 'running' ? 0 : remainingSeconds;

  useEffect(() => {
    if (!progressLoaded || !id) return;
    const timer: CookingProgress['timer'] = timerStatus === 'idle' ? null : {
      status: timerStatus,
      duration: timerDuration,
      remainingSeconds: persistentRemainingSeconds,
      endsAt: timerEndsAt,
      step: timerStep,
      notificationId,
    };
    const progress: CookingProgress = { version: 1, targetYield, currentStep, checkedIngredients, timer };
    void saveCookingProgress(id, progress);
  }, [checkedIngredients, currentStep, id, notificationId, persistentRemainingSeconds, progressLoaded, targetYield, timerDuration, timerEndsAt, timerStatus, timerStep]);

  useEffect(() => {
    if (!instructions.length) return;
    setCurrentStep((value) => Math.min(value, instructions.length - 1));
  }, [instructions.length]);

  useEffect(() => {
    if (instructions[currentStep]) AccessibilityInfo.announceForAccessibility(`Step ${currentStep + 1} of ${instructions.length}. ${instructions[currentStep]}`);
  }, [currentStep, instructions]);

  useEffect(() => {
    if (timerStatus !== 'running' || !timerEndsAt) return;
    const tick = () => {
      const next = Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000));
      setRemainingSeconds(next);
      if (next === 0) {
        notificationGenerationRef.current += 1;
        notificationIdRef.current = null;
        setNotificationId(null);
        setTimerStatus('finished');
        setTimerEndsAt(null);
        void playTimerAlarm();
        Vibration.vibrate([0, 400, 200, 400]);
        if (Platform.OS === 'web' || !notificationsAvailable) Alert.alert("Time's up!", `${recipe?.title || 'Recipe'} · Step ${timerStep + 1}`);
      }
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [notificationsAvailable, recipe?.title, timerEndsAt, timerStatus, timerStep]);

  const close = () => router.canGoBack() ? router.back() : router.replace(id ? `/${id}` : '/');
  const toggleIngredient = (index: number) => setCheckedIngredients((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index]);

  const cancelScheduledAlert = () => {
    notificationGenerationRef.current += 1;
    const notificationId = notificationIdRef.current;
    notificationIdRef.current = null;
    setNotificationId(null);
    if (notificationId) void cancelCookingTimerNotification(notificationId).catch(() => undefined);
    return notificationGenerationRef.current;
  };

  const scheduleTimerAlert = async (seconds: number, generation: number, step: number) => {
    try {
      const notificationId = await scheduleCookingTimerNotification(seconds, recipe?.title || 'Recipe', step, id);
      if (!notificationId) { if (Platform.OS !== 'web') setNotificationsAvailable(false); return; }
      setNotificationsAvailable(true);
      if (notificationGenerationRef.current === generation) {
        notificationIdRef.current = notificationId;
        setNotificationId(notificationId);
      }
      else await cancelCookingTimerNotification(notificationId);
    } catch {
      setNotificationsAvailable(false);
    }
  };

  const startTimer = (seconds: number) => {
    void prepareTimerAlarm();
    const roundedSeconds = Math.max(1, Math.round(seconds));
    const generation = cancelScheduledAlert();
    setTimerDuration(roundedSeconds);
    setRemainingSeconds(roundedSeconds);
    setTimerEndsAt(Date.now() + roundedSeconds * 1000);
    setTimerStep(currentStep);
    setTimerStatus('running');
    void scheduleTimerAlert(roundedSeconds, generation, currentStep);
  };

  const requestStartTimer = (seconds: number) => {
    if (timerStatus === 'running' || timerStatus === 'paused') {
      setConfirmation({ kind: 'replace', seconds });
      return;
    }
    startTimer(seconds);
  };

  const startCustomTimer = () => {
    const hours = Math.max(0, Number.parseInt(customHours, 10) || 0);
    const minutes = Math.max(0, Number.parseInt(customMinutes, 10) || 0);
    const seconds = Math.max(0, Number.parseInt(customSeconds, 10) || 0);
    const total = hours * 3600 + minutes * 60 + seconds;
    if (total < 1 || total > 24 * 3600) {
      setCustomTimerError('Choose a timer between 1 second and 24 hours.');
      return;
    }
    setShowCustomTimer(false);
    setCustomHours('');
    setCustomMinutes('');
    setCustomSeconds('');
    setCustomTimerError(null);
    if (timerStatus === 'running' || timerStatus === 'paused') {
      setTimeout(() => setConfirmation({ kind: 'replace', seconds: total }), 300);
    } else startTimer(total);
  };

  const pauseTimer = () => {
    const next = timerEndsAt ? Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000)) : remainingSeconds;
    cancelScheduledAlert();
    setRemainingSeconds(next);
    setTimerEndsAt(null);
    setTimerStatus('paused');
  };

  const resumeTimer = () => {
    if (remainingSeconds <= 0) return;
    void prepareTimerAlarm();
    const generation = cancelScheduledAlert();
    setTimerEndsAt(Date.now() + remainingSeconds * 1000);
    setTimerStatus('running');
    void scheduleTimerAlert(remainingSeconds, generation, timerStep);
  };

  const adjustTimer = (deltaSeconds: number) => {
    const currentRemaining = timerStatus === 'running' && timerEndsAt ? Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000)) : remainingSeconds;
    const next = Math.max(1, currentRemaining + deltaSeconds);
    setRemainingSeconds(next);
    if (timerStatus === 'running') {
      const generation = cancelScheduledAlert();
      setTimerEndsAt(Date.now() + next * 1000);
      void scheduleTimerAlert(next, generation, timerStep);
    }
  };

  const dismissTimer = () => {
    cancelScheduledAlert();
    setTimerStatus('idle');
    setTimerDuration(0);
    setRemainingSeconds(0);
    setTimerEndsAt(null);
  };

  const resetProgress = () => {
    setConfirmation({ kind: 'reset' });
  };

  const confirmAction = () => {
    if (!confirmation) return;
    if (confirmation.kind === 'replace') startTimer(confirmation.seconds);
    else {
      dismissTimer();
      setCurrentStep(0);
      setCheckedIngredients([]);
      setShowIngredients(false);
      if (id) void clearCookingProgress(id);
    }
    setConfirmation(null);
  };

  if (loading) return <SafeAreaView style={[styles.safeArea, styles.centered]}><Stack.Screen options={{ headerShown: false }} /><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.loadingText}>Preparing cooking mode…</Text></SafeAreaView>;
  if (!recipe) return <SafeAreaView style={[styles.safeArea, styles.centered]}><Stack.Screen options={{ headerShown: false }} /><Text style={styles.errorTitle}>Recipe unavailable</Text><TouchableOpacity style={styles.primaryButton} onPress={close}><Text style={styles.primaryButtonText}>Return to Recipe</Text></TouchableOpacity></SafeAreaView>;

  const ingredientPanel = <View style={[styles.ingredientsPanel, !isWide && styles.ingredientsPanelMobile]}>
    <View style={styles.panelHeader}>
      <View><Text style={styles.panelTitle}>Ingredients</Text><Text style={styles.panelSubtitle}>{checkedCount} of {recipe.recipe_data.ingredients.length} added · {targetYield.toFixed(2)}×</Text></View>
      <View style={styles.panelHeaderActions}><TouchableOpacity style={styles.resetButton} onPress={resetProgress} accessibilityRole="button" accessibilityLabel="Reset cooking progress"><Feather name="rotate-ccw" size={16} color={colors.primary} /><Text style={styles.resetButtonText}>Reset</Text></TouchableOpacity>{!isWide ? <TouchableOpacity style={styles.panelClose} onPress={() => setShowIngredients(false)} accessibilityRole="button" accessibilityLabel="Hide ingredients"><Feather name="x" size={24} color={colors.primary} /></TouchableOpacity> : null}</View>
    </View>
    <ScrollView contentContainerStyle={styles.ingredientList} showsVerticalScrollIndicator={false}>
      {recipe.recipe_data.ingredients.map((ingredient, index) => {
        const checked = checkedIngredients.includes(index);
        const scaledQuantity = formatScaledQuantity(ingredient, multiplier);
        const equivalent = formatEquivalentMeasurement(ingredient, multiplier);
        const equivalentText = equivalent ? ` (${equivalent.quantity} ${equivalent.unit})` : '';
        return <TouchableOpacity key={`${ingredient.name}-${index}`} style={[styles.ingredientRow, checked && styles.ingredientRowChecked]} onPress={() => toggleIngredient(index)} accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={`${scaledQuantity} ${ingredient.unit}${equivalentText} ${ingredient.name}`}>
          <Feather name={checked ? 'check-circle' : 'circle'} size={25} color={checked ? colors.success : colors.primary} />
          <Text style={[styles.ingredientText, checked && styles.ingredientTextChecked]}><Text style={styles.ingredientAmount}>{scaledQuantity} {ingredient.unit}{equivalentText}</Text>{' '}{ingredient.name}</Text>
        </TouchableOpacity>;
      })}
    </ScrollView>
  </View>;

  return <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
    <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
    <View style={styles.topBar}>
      <TouchableOpacity style={styles.closeButton} onPress={close} accessibilityRole="button" accessibilityLabel="Exit cooking mode"><Feather name="x" size={26} color={colors.primary} /><Text style={styles.closeText}>Exit</Text></TouchableOpacity>
      <View style={styles.titleBlock}><Text style={styles.modeLabel}>FOCUS MODE</Text><Text style={styles.recipeTitle} numberOfLines={1}>{recipe.title}</Text></View>
      <View style={styles.awakeBadge}><Feather name={wakeLockAvailable ? 'sun' : 'moon'} size={15} color={wakeLockAvailable ? colors.success : colors.textSecondary} />{width >= 520 ? <Text style={styles.awakeText}>{wakeLockAvailable ? 'Screen awake' : 'Wake lock unavailable'}</Text> : null}</View>
    </View>

    {timerStatus !== 'idle' ? <View style={[styles.timerBar, timerStatus === 'finished' && styles.timerBarFinished]}>
      <View style={styles.timerIdentity}><Feather name={timerStatus === 'finished' ? 'bell' : 'clock'} size={22} color={timerStatus === 'finished' ? colors.background : colors.primary} /><View><Text style={[styles.timerLabel, timerStatus === 'finished' && styles.timerFinishedText]}>{timerStatus === 'finished' ? "Time's up!" : `${timerStatus === 'paused' ? 'Paused · ' : ''}Step ${timerStep + 1} timer`}</Text><Text style={[styles.timerClock, timerStatus === 'finished' && styles.timerFinishedText]}>{formatTimerDuration(remainingSeconds)}</Text></View></View>
      <View style={styles.timerActions}>
        {timerStatus !== 'finished' ? <TouchableOpacity style={styles.timerSmallButton} onPress={() => adjustTimer(-60)} accessibilityRole="button" accessibilityLabel="Subtract one minute"><Text style={styles.timerSmallText}>−1m</Text></TouchableOpacity> : null}
        {timerStatus === 'running' ? <TouchableOpacity style={styles.timerControlButton} onPress={pauseTimer} accessibilityRole="button"><Feather name="pause" size={20} color={colors.primary} /><Text style={styles.timerControlText}>Pause</Text></TouchableOpacity> : null}
        {timerStatus === 'paused' ? <TouchableOpacity style={styles.timerControlButton} onPress={resumeTimer} accessibilityRole="button"><Feather name="play" size={20} color={colors.primary} /><Text style={styles.timerControlText}>Resume</Text></TouchableOpacity> : null}
        {timerStatus === 'finished' ? <TouchableOpacity style={styles.timerFinishedButton} onPress={() => requestStartTimer(timerDuration)} accessibilityRole="button"><Feather name="rotate-ccw" size={19} color={colors.background} /><Text style={styles.timerFinishedButtonText}>Restart</Text></TouchableOpacity> : <TouchableOpacity style={styles.timerSmallButton} onPress={() => adjustTimer(60)} accessibilityRole="button" accessibilityLabel="Add one minute"><Text style={styles.timerSmallText}>+1m</Text></TouchableOpacity>}
        <TouchableOpacity style={styles.timerDismissButton} onPress={dismissTimer} accessibilityRole="button" accessibilityLabel="Dismiss timer"><Feather name="x" size={22} color={timerStatus === 'finished' ? colors.background : colors.textSecondary} /></TouchableOpacity>
      </View>
    </View> : null}

    <View style={[styles.workspace, isWide && styles.workspaceWide]}>
      {isWide ? ingredientPanel : null}
      <View style={styles.stepPanel}>
        {!isWide ? <TouchableOpacity style={styles.ingredientsButton} onPress={() => setShowIngredients(true)} accessibilityRole="button" accessibilityState={{ expanded: showIngredients }}><Feather name="check-square" size={20} color={colors.primary} /><Text style={styles.ingredientsButtonText}>Ingredients {checkedCount}/{recipe.recipe_data.ingredients.length}</Text></TouchableOpacity> : null}
        <View style={styles.progressHeader}><Text style={styles.stepCounter}>Step {Math.min(currentStep + 1, stepCount)} of {stepCount}</Text><Text style={styles.progressPercent}>{Math.round(((currentStep + 1) / stepCount) * 100)}%</Text></View>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${((currentStep + 1) / stepCount) * 100}%` }]} /></View>
        <ScrollView style={styles.instructionScroll} contentContainerStyle={styles.instructionContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.stepNumber}>{currentStep + 1}</Text>
          <Text style={styles.instructionText}>{instructions[currentStep] || 'No cooking instructions were saved for this recipe.'}</Text>
          <View style={styles.timerSuggestions}>
            {timerSuggestions.length ? <><Text style={styles.timerSuggestionTitle}>Timer suggested for this step</Text><View style={styles.timerSuggestionButtons}>{timerSuggestions.map((suggestion) => <TouchableOpacity key={suggestion.seconds} style={styles.timerSuggestionButton} onPress={() => requestStartTimer(suggestion.seconds)} accessibilityRole="button" accessibilityLabel={`Start a ${suggestion.label} timer`}><Feather name="clock" size={19} color={colors.background} /><Text style={styles.timerSuggestionText}>Start {suggestion.label}</Text></TouchableOpacity>)}</View></> : null}
            <TouchableOpacity style={styles.customTimerButton} onPress={() => { setCustomTimerError(null); setShowCustomTimer(true); }} accessibilityRole="button" accessibilityLabel="Set a custom cooking timer"><Feather name="plus-circle" size={19} color={colors.primary} /><Text style={styles.customTimerButtonText}>Custom Timer</Text></TouchableOpacity>
          </View>
        </ScrollView>
        <View style={styles.navigationRow}>
          <TouchableOpacity style={[styles.navigationButton, styles.previousButton, currentStep === 0 && styles.disabledButton]} onPress={() => setCurrentStep((step) => Math.max(0, step - 1))} disabled={currentStep === 0} accessibilityRole="button" accessibilityLabel="Previous cooking step"><Feather name="arrow-left" size={25} color={currentStep === 0 ? colors.textSecondary : colors.primary} /><Text style={[styles.navigationText, { color: currentStep === 0 ? colors.textSecondary : colors.primary }]}>Previous</Text></TouchableOpacity>
          {currentStep < instructions.length - 1 ? <TouchableOpacity style={[styles.navigationButton, styles.nextButton]} onPress={() => setCurrentStep((step) => Math.min(instructions.length - 1, step + 1))} accessibilityRole="button" accessibilityLabel="Next cooking step"><Text style={styles.nextText}>Next</Text><Feather name="arrow-right" size={25} color={colors.background} /></TouchableOpacity> : <TouchableOpacity style={[styles.navigationButton, styles.finishButton]} onPress={close} accessibilityRole="button" accessibilityLabel="Finish cooking"><Feather name="check" size={25} color={colors.background} /><Text style={styles.nextText}>Finish</Text></TouchableOpacity>}
        </View>
      </View>
    </View>
    {!isWide && showIngredients ? <View style={styles.mobileOverlay}><TouchableOpacity style={styles.overlayDismiss} onPress={() => setShowIngredients(false)} accessibilityLabel="Hide ingredients" />{ingredientPanel}</View> : null}
    <Modal visible={showCustomTimer} transparent animationType="fade" onRequestClose={() => setShowCustomTimer(false)}>
      <View style={styles.modalBackdrop}>
        <View style={styles.customTimerModal} accessibilityViewIsModal>
          <View style={styles.modalHeader}><View><Text style={styles.modalTitle}>Custom Timer</Text><Text style={styles.modalSubtitle}>Set a timer for step {currentStep + 1}</Text></View><TouchableOpacity style={styles.modalClose} onPress={() => setShowCustomTimer(false)} accessibilityRole="button" accessibilityLabel="Close custom timer"><Feather name="x" size={24} color={colors.primary} /></TouchableOpacity></View>
          <View style={styles.timeInputRow}>
            <View style={styles.timeInputGroup}><TextInput style={styles.timeInput} value={customHours} onChangeText={(value) => { setCustomHours(value); setCustomTimerError(null); }} keyboardType="number-pad" inputMode="numeric" placeholder="0" placeholderTextColor={colors.textSecondary} maxLength={2} selectTextOnFocus accessibilityLabel="Timer hours" /><Text style={styles.timeInputLabel}>Hours</Text></View>
            <Text style={styles.timeSeparator}>:</Text>
            <View style={styles.timeInputGroup}><TextInput style={styles.timeInput} value={customMinutes} onChangeText={(value) => { setCustomMinutes(value); setCustomTimerError(null); }} keyboardType="number-pad" inputMode="numeric" placeholder="00" placeholderTextColor={colors.textSecondary} maxLength={3} selectTextOnFocus accessibilityLabel="Timer minutes" /><Text style={styles.timeInputLabel}>Minutes</Text></View>
            <Text style={styles.timeSeparator}>:</Text>
            <View style={styles.timeInputGroup}><TextInput style={styles.timeInput} value={customSeconds} onChangeText={(value) => { setCustomSeconds(value); setCustomTimerError(null); }} keyboardType="number-pad" inputMode="numeric" placeholder="00" placeholderTextColor={colors.textSecondary} maxLength={3} selectTextOnFocus accessibilityLabel="Timer seconds" /><Text style={styles.timeInputLabel}>Seconds</Text></View>
          </View>
          <Text style={styles.timerLimitText}>Maximum 24 hours</Text>
          {customTimerError ? <Text style={styles.timerErrorText} accessibilityRole="alert">{customTimerError}</Text> : null}
          <View style={styles.modalActions}><TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowCustomTimer(false)} accessibilityRole="button"><Text style={styles.modalCancelText}>Cancel</Text></TouchableOpacity><TouchableOpacity style={styles.modalStartButton} onPress={startCustomTimer} accessibilityRole="button"><Feather name="play" size={19} color={colors.background} /><Text style={styles.modalStartText}>Start Timer</Text></TouchableOpacity></View>
        </View>
      </View>
    </Modal>
    <Modal visible={!!confirmation} transparent animationType="fade" onRequestClose={() => setConfirmation(null)}>
      <View style={styles.modalBackdrop}>
        <View style={styles.confirmationModal} accessibilityViewIsModal>
          <View style={styles.confirmationIcon}><Feather name={confirmation?.kind === 'replace' ? 'clock' : 'rotate-ccw'} size={25} color={colors.primary} /></View>
          <Text style={styles.confirmationTitle}>{confirmation?.kind === 'replace' ? 'Replace active timer?' : 'Reset cooking progress?'}</Text>
          <Text style={styles.confirmationMessage}>{confirmation?.kind === 'replace' ? 'Starting this timer will stop the timer already in progress.' : 'This will clear checked ingredients, return to step 1, and dismiss the active timer.'}</Text>
          <View style={styles.modalActions}><TouchableOpacity style={styles.modalCancelButton} onPress={() => setConfirmation(null)} accessibilityRole="button"><Text style={styles.modalCancelText}>{confirmation?.kind === 'replace' ? 'Keep Current' : 'Cancel'}</Text></TouchableOpacity><TouchableOpacity style={styles.confirmDangerButton} onPress={confirmAction} accessibilityRole="button"><Text style={styles.confirmDangerText}>{confirmation?.kind === 'replace' ? 'Replace Timer' : 'Reset'}</Text></TouchableOpacity></View>
        </View>
      </View>
    </Modal>
  </SafeAreaView>;
}

const createStyles = (colors: AppColors, textScale: number) => createThemedStyles({
  safeArea: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  loadingText: { fontFamily: TYPOGRAPHY.body, fontSize: 14, color: colors.textSecondary, marginTop: SPACING.md },
  errorTitle: { fontFamily: TYPOGRAPHY.heading, fontSize: 24, color: colors.textPrimary, marginBottom: SPACING.lg },
  topBar: { minHeight: 78, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.secondary, paddingHorizontal: SPACING.md, gap: SPACING.md, backgroundColor: colors.surface },
  closeButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingHorizontal: SPACING.sm },
  closeText: { fontFamily: TYPOGRAPHY.heading, fontSize: 14, color: colors.primary },
  titleBlock: { flex: 1, minWidth: 0, alignItems: 'center' },
  modeLabel: { fontFamily: TYPOGRAPHY.heading, fontSize: 10, letterSpacing: 1.5, color: colors.textSecondary },
  recipeTitle: { fontFamily: TYPOGRAPHY.heading, fontSize: 18, color: colors.textPrimary, maxWidth: '100%' },
  awakeBadge: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, borderRadius: 18, borderWidth: 1, borderColor: colors.secondary, paddingHorizontal: SPACING.sm },
  awakeText: { fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 11, color: colors.textSecondary },
  timerBar: { minHeight: 78, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md, borderBottomWidth: 1, borderBottomColor: colors.secondary, backgroundColor: colors.surface, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg },
  timerBarFinished: { backgroundColor: colors.success, borderBottomColor: colors.success },
  timerIdentity: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  timerLabel: { fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 12, color: colors.textSecondary },
  timerClock: { fontFamily: TYPOGRAPHY.heading, fontSize: 25, color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  timerFinishedText: { color: colors.background },
  timerActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACING.xs },
  timerSmallButton: { minWidth: 50, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, borderWidth: 1, borderColor: colors.secondary, paddingHorizontal: SPACING.sm },
  timerSmallText: { fontFamily: TYPOGRAPHY.heading, fontSize: 13, color: colors.primary },
  timerControlButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, borderRadius: 21, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: SPACING.md },
  timerControlText: { fontFamily: TYPOGRAPHY.heading, fontSize: 13, color: colors.primary },
  timerFinishedButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, borderRadius: 21, borderWidth: 1, borderColor: colors.background, paddingHorizontal: SPACING.md },
  timerFinishedButtonText: { fontFamily: TYPOGRAPHY.heading, fontSize: 13, color: colors.background },
  timerDismissButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  workspace: { flex: 1 },
  workspaceWide: { flexDirection: 'row', gap: SPACING.lg, padding: SPACING.lg },
  ingredientsPanel: { width: 360, maxWidth: '38%', borderWidth: 1, borderColor: colors.secondary, borderRadius: 16, backgroundColor: colors.surface, overflow: 'hidden' },
  ingredientsPanelMobile: { width: '100%', maxWidth: '100%', maxHeight: '82%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: colors.secondary },
  panelHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  panelTitle: { fontFamily: TYPOGRAPHY.heading, fontSize: 20, color: colors.textPrimary },
  panelSubtitle: { fontFamily: TYPOGRAPHY.body, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  panelClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  resetButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingHorizontal: SPACING.sm, borderRadius: 20 },
  resetButtonText: { fontFamily: TYPOGRAPHY.heading, fontSize: 12, color: colors.primary },
  ingredientList: { padding: SPACING.md, gap: SPACING.sm },
  ingredientRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderWidth: 1, borderColor: colors.secondary, borderRadius: 10, padding: SPACING.sm, backgroundColor: colors.background },
  ingredientRowChecked: { opacity: 0.65, borderColor: colors.success },
  ingredientText: { flex: 1, fontFamily: TYPOGRAPHY.body, fontSize: 14, lineHeight: 20, color: colors.textPrimary },
  ingredientTextChecked: { textDecorationLine: 'line-through', color: colors.textSecondary },
  ingredientAmount: { fontFamily: TYPOGRAPHY.heading },
  stepPanel: { flex: 1, padding: SPACING.lg, minWidth: 0 },
  ingredientsButton: { minHeight: 48, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderWidth: 1, borderColor: colors.secondary, borderRadius: 24, backgroundColor: colors.surface, paddingHorizontal: SPACING.md, marginBottom: SPACING.lg },
  ingredientsButtonText: { fontFamily: TYPOGRAPHY.heading, fontSize: 14, color: colors.primary },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepCounter: { fontFamily: TYPOGRAPHY.heading, fontSize: 16, color: colors.textPrimary },
  progressPercent: { fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 13, color: colors.textSecondary },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.secondary, overflow: 'hidden', marginTop: SPACING.sm },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.success },
  instructionScroll: { flex: 1 },
  instructionContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: SPACING.xl },
  stepNumber: { width: 58, height: 58, textAlign: 'center', lineHeight: 58, borderRadius: 29, overflow: 'hidden', backgroundColor: colors.primary, color: colors.background, fontFamily: TYPOGRAPHY.heading, fontSize: 24, marginBottom: SPACING.lg },
  instructionText: { maxWidth: 780, fontFamily: TYPOGRAPHY.heading, fontSize: 28, lineHeight: 42, color: colors.textPrimary, textAlign: 'center' },
  timerSuggestions: { alignItems: 'center', marginTop: SPACING.xl },
  timerSuggestionTitle: { fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 13, color: colors.textSecondary },
  timerSuggestionButtons: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
  timerSuggestionButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, borderRadius: 24, backgroundColor: colors.primary, paddingHorizontal: SPACING.lg },
  timerSuggestionText: { fontFamily: TYPOGRAPHY.heading, fontSize: 14, color: colors.background },
  customTimerButton: { minHeight: 46, marginTop: SPACING.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, borderRadius: 23, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: SPACING.lg, backgroundColor: colors.surface },
  customTimerButtonText: { fontFamily: TYPOGRAPHY.heading, fontSize: 14, color: colors.primary },
  navigationRow: { flexDirection: 'row', gap: SPACING.md },
  navigationButton: { flex: 1, minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, borderRadius: 14, paddingHorizontal: SPACING.md },
  previousButton: { borderWidth: 1, borderColor: colors.secondary, backgroundColor: colors.surface },
  nextButton: { backgroundColor: colors.primary },
  finishButton: { backgroundColor: colors.success },
  disabledButton: { opacity: 0.5 },
  navigationText: { fontFamily: TYPOGRAPHY.heading, fontSize: 18 },
  nextText: { fontFamily: TYPOGRAPHY.heading, fontSize: 18, color: colors.background },
  primaryButton: { minHeight: 50, justifyContent: 'center', borderRadius: 25, backgroundColor: colors.primary, paddingHorizontal: SPACING.xl },
  primaryButtonText: { fontFamily: TYPOGRAPHY.heading, fontSize: 15, color: colors.background },
  mobileOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  overlayDismiss: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg, backgroundColor: colors.overlay },
  customTimerModal: { width: '100%', maxWidth: 480, borderRadius: 18, borderWidth: 1, borderColor: colors.secondary, padding: SPACING.lg, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACING.md },
  modalTitle: { fontFamily: TYPOGRAPHY.heading, fontSize: 24, color: colors.textPrimary },
  modalSubtitle: { marginTop: 2, fontFamily: TYPOGRAPHY.body, fontSize: 13, color: colors.textSecondary },
  modalClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  timeInputRow: { marginTop: SPACING.xl, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: SPACING.sm },
  timeInputGroup: { flex: 1, alignItems: 'center' },
  timeInput: { width: '100%', minHeight: 64, borderRadius: 12, borderWidth: 1, borderColor: colors.secondary, backgroundColor: colors.surface, textAlign: 'center', fontFamily: TYPOGRAPHY.heading, fontSize: 26, color: colors.textPrimary },
  timeInputLabel: { marginTop: SPACING.xs, fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 11, color: colors.textSecondary },
  timeSeparator: { marginTop: 13, fontFamily: TYPOGRAPHY.heading, fontSize: 28, color: colors.textSecondary },
  timerLimitText: { marginTop: SPACING.md, textAlign: 'center', fontFamily: TYPOGRAPHY.body, fontSize: 12, color: colors.textSecondary },
  timerErrorText: { marginTop: SPACING.sm, textAlign: 'center', fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 12, color: colors.danger },
  modalActions: { width: '100%', marginTop: SPACING.xl, flexDirection: 'row', gap: SPACING.sm },
  modalCancelButton: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 25, borderWidth: 1, borderColor: colors.secondary, backgroundColor: colors.surface },
  modalCancelText: { fontFamily: TYPOGRAPHY.heading, fontSize: 14, color: colors.primary },
  modalStartButton: { flex: 1.4, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, borderRadius: 25, backgroundColor: colors.primary },
  modalStartText: { fontFamily: TYPOGRAPHY.heading, fontSize: 14, color: colors.background },
  confirmationModal: { width: '100%', maxWidth: 430, alignItems: 'center', borderRadius: 18, borderWidth: 1, borderColor: colors.secondary, padding: SPACING.xl, backgroundColor: colors.background },
  confirmationIcon: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 27, backgroundColor: colors.surface },
  confirmationTitle: { marginTop: SPACING.md, textAlign: 'center', fontFamily: TYPOGRAPHY.heading, fontSize: 22, color: colors.textPrimary },
  confirmationMessage: { marginTop: SPACING.sm, textAlign: 'center', fontFamily: TYPOGRAPHY.body, fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  confirmDangerButton: { flex: 1.2, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 25, backgroundColor: colors.danger },
  confirmDangerText: { fontFamily: TYPOGRAPHY.heading, fontSize: 14, color: colors.background },
}, textScale);
