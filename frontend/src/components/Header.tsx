import { useState, useRef, useEffect } from 'react';
import { AccessibilityInfo, View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, Modal, Animated, findNodeHandle, PanResponder, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// PROPER IMPORT: Pulling your exact design tokens from your theme file
import { COLORS as BRAND_COLORS, getShadowStyle, TYPOGRAPHY, SPACING } from '../theme'; 
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { User } from '@supabase/supabase-js';
import { supabase  } from '../services/supabase'; // Adjust path if needed
import AuthModal from './AuthModal'; // Make sure this matches how you exported it
import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router'; // <-- Add this to your imports
import { usePreferences } from '../contexts/PreferencesContext';

export default function Header() {
    const router = useRouter(); // <-- Add this line right above your state variables
  const pathname = usePathname();
  const routeParams = useGlobalSearchParams<{ tab?: string }>();
  const { colors, reduceMotion, textScale } = usePreferences();
  const COLORS = colors;
  const styles = createStyles(colors);

  const { width } = useWindowDimensions();
  const isDesktop = width > 800;
  // Inside your component function:
  const [user, setUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);
  // Tracks which desktop dropdown is currently open (e.g., 'cuisine', 'seasonal')
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    // Tracks which mobile accordion is currently open
    const [activeMobileDropdown, setActiveMobileDropdown] = useState<string | null>(null);
  useEffect(() => {
    // 1. Check if a user is ALREADY logged in when the app starts
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // 2. Listen for changes (signing in/out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);
  
  // NEW: This measures the exact height of the phone's notch/status bar
  const insets = useSafeAreaInsets();
  // NEW: State to control the menu
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // State for the sliding animation
  const slideAnim = useRef(new Animated.Value(-width)).current; 
  // --- NEW: Account Menu State ---
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const accountSlideAnim = useRef(new Animated.Value(width)).current; // Starts off-screen to the right
  const accountButtonRef = useRef<any>(null);
  const accountCloseRef = useRef<any>(null);
  const accountPanelRef = useRef<any>(null);

  const focusElement = (ref: { current: any }) => {
    if (Platform.OS === 'web') ref.current?.focus?.();
    else {
      const node = findNodeHandle(ref.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    }
  };

  useEffect(() => {
    if (!isMenuOpen) slideAnim.setValue(-width);
    if (!isAccountOpen) accountSlideAnim.setValue(width);
  }, [width, isMenuOpen, isAccountOpen, slideAnim, accountSlideAnim]);

  const openAccount = () => {
    setIsAccountOpen(true);
    Animated.timing(accountSlideAnim, {
      toValue: 0, 
      duration: reduceMotion ? 0 : 250,
      useNativeDriver: true,
    }).start(() => focusElement(accountCloseRef));
  };

  const closeAccount = () => {
    Animated.timing(accountSlideAnim, {
      toValue: width, // Slide back off-screen to the right
      duration: reduceMotion ? 0 : 250,
      useNativeDriver: true,
    }).start(() => {
      setIsAccountOpen(false);
      focusElement(accountButtonRef);
    });
  };

  const navigateFromAccount = (route: '/bookmarks' | '/settings' | '/help' | '/about' | '/?tab=personal') => {
    closeAccount();
    router.push(route as any);
  };

  const accountPanResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => gesture.dx > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderMove: (_, gesture) => accountSlideAnim.setValue(Math.max(0, gesture.dx)),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx > 60 || gesture.vx > 0.65) closeAccount();
      else Animated.spring(accountSlideAnim, { toValue: 0, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => Animated.spring(accountSlideAnim, { toValue: 0, useNativeDriver: true }).start(),
  });

  const webAccountKeyboardProps = Platform.OS === 'web' ? {
    onKeyDown: (event: any) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeAccount();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(accountPanelRef.current?.querySelectorAll?.('button, [href], input, [tabindex]:not([tabindex="-1"])') || []) as any[];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    },
  } : {};

  const handleSignOut = async () => {
    closeAccount();
    await supabase.auth.signOut();
    router.replace('/');
  };

  const openAuthFromAccount = () => {
    closeAccount();
    setTimeout(() => setShowModal(true), reduceMotion ? 0 : 260);
  };

  const openMenu = () => {
    setIsMenuOpen(true); // Show the modal first
    Animated.timing(slideAnim, {
      toValue: 0, // Slide it to its natural position
      duration: reduceMotion ? 0 : 250, // Quarter-second slide
      useNativeDriver: true,
    }).start();
  };

  const closeMenu = () => {
    Animated.timing(slideAnim, {
      toValue: -width, // Slide it back off-screen to the left
      duration: reduceMotion ? 0 : 250,
      useNativeDriver: true,
    }).start(() => {
      setIsMenuOpen(false); // Only hide the modal AFTER the slide finishes
    });
  };
  // --- HELPER: Desktop Standard Link ---
  const DesktopNavLink = ({ title, route }: { title: string, route: string }) => (
    <View style={styles.navItemContainer}>
      <TouchableOpacity onPress={() => {
        setActiveDropdown(null);
        router.push(route as any);
      }}>
        <Text style={styles.navLink}>{title}</Text>
      </TouchableOpacity>
    </View>
  );

  // --- HELPER: Mobile Standard Link ---
  const MobileNavLink = ({ title, route }: { title: string, route: string }) => (
    <View style={styles.mobileNavItemContainer}>
      <TouchableOpacity 
        style={styles.mobileNavItemTrigger}
        onPress={() => {
          setActiveMobileDropdown(null);
          closeMenu();
          router.push(route as any);
        }}
      >
        <Text style={styles.sideMenuLinkText}>{title}</Text>
      </TouchableOpacity>
    </View>
  );

  const AccountMenuLink = ({ label, icon, route }: { label: string; icon: keyof typeof Feather.glyphMap; route: '/bookmarks' | '/settings' | '/help' | '/about' | '/?tab=personal' }) => {
    const routePath = route.split('?')[0];
    const selected = route === '/?tab=personal'
      ? pathname === '/' && routeParams.tab === 'personal'
      : pathname === routePath;
    return (
      <TouchableOpacity
        style={[styles.accountMenuItem, selected && styles.accountMenuItemActive]}
        onPress={() => navigateFromAccount(route)}
        accessibilityRole="menuitem"
        accessibilityState={{ selected }}
        activeOpacity={0.65}
      >
        <View style={styles.accountMenuItemLabel}>
          <Feather name={icon} size={20} color={selected ? colors.textPrimary : colors.primary} />
          <Text style={[styles.accountMenuItemText, { color: colors.textPrimary, fontSize: 16 * textScale }]}>{label}</Text>
        </View>
        <Feather name="chevron-right" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  // --- HELPER: Desktop Dropdown Menu ---
  const DesktopDropdownNav = ({ id, title, items }: { id: string, title: string, items: { label: string, route: string }[] }) => (
    <View style={styles.navItemContainer}>
      <TouchableOpacity 
        style={styles.navItemTrigger}
        onPress={() => setActiveDropdown(activeDropdown === id ? null : id)}
      >
        <Text style={styles.navLink}>{title}</Text>
        <Feather name={activeDropdown === id ? "chevron-up" : "chevron-down"} size={16} color={BRAND_COLORS.background} />
      </TouchableOpacity>

      {activeDropdown === id && (
        <View style={styles.desktopDropdown}>
          {items.map((item) => (
            <TouchableOpacity 
              key={item.label}
              style={styles.desktopDropdownItem}
              onPress={() => {
                setActiveDropdown(null);
                router.push(item.route as any);
              }}
            >
              <Text style={styles.desktopDropdownText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  // --- HELPER: Mobile Dropdown Menu ---
  const MobileDropdownNav = ({ id, title, items }: { id: string, title: string, items: { label: string, route: string }[] }) => (
    <View style={styles.mobileNavItemContainer}>
      <TouchableOpacity 
        style={styles.mobileNavItemTrigger}
        onPress={() => setActiveMobileDropdown(activeMobileDropdown === id ? null : id)}
      >
        <Text style={styles.sideMenuLinkText}>{title}</Text>
        <Feather name={activeMobileDropdown === id ? "chevron-up" : "chevron-down"} size={24} color={COLORS.textPrimary} />
      </TouchableOpacity>

      {activeMobileDropdown === id && (
        <View style={styles.mobileDropdownContent}>
          {items.map((item) => (
            <TouchableOpacity 
              key={item.label}
              style={styles.mobileDropdownItem} 
              onPress={() => {
                setActiveMobileDropdown(null);
                closeMenu();
                router.push(item.route as any);
              }}
            >
              <Text style={styles.mobileDropdownText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
  return (
    <View style={[
        styles.topHeader, 
        // Add the notch height to the top so it pushes the logo down into the safe zone
        { paddingTop: insets.top > 0 ? insets.top + 10 : 15 } 
      ]}>
      
      {/* --- TOP ROW: Centered Logo + Right Icons --- */}
      <View style={styles.topRow}>
  
        {/* FAR LEFT: Hamburger (Mobile Only) */}
        {!isDesktop && (
            <TouchableOpacity style={styles.leftIcon} onPress={openMenu}>
            <Feather name="menu" size={36} color={BRAND_COLORS.background} /> 
            </TouchableOpacity>
        )}

        {/* CENTER: Your Logo (Now clickable to Home) */}
        <TouchableOpacity onPress={() => router.push('/')}>
          <Text style={styles.headerLogoText}>Math Fridge</Text> 
        </TouchableOpacity>

        {/* FAR RIGHT: Account Icon */}
        <TouchableOpacity ref={accountButtonRef} style={styles.rightIcon} onPress={openAccount} accessibilityLabel="Open account menu" accessibilityRole="button" accessibilityState={{ expanded: isAccountOpen }}>
            {isDesktop && (user && (
              <Text style={styles.headerGreeting}>
                {user.user_metadata?.full_name?.split(' ')[0] || user.user_metadata?.first_name || 'Chef'}
              </Text>
            ))}
            <View style={styles.profileIconCircle}>
              <Feather name="user" size={25} color={BRAND_COLORS.secondary} />
            </View>
        </TouchableOpacity>

        </View>

            {/* --- BOTTOM ROW: Desktop Links --- */}
            {isDesktop && (
            <View style={styles.navRow}>
              
              {/* CUISINE WITH DROPDOWN */}
              <View style={styles.navItemContainer}>
                  <DesktopDropdownNav 
                  id="cuisine" 
                  title="Cuisine" 
                  items={[
                    { label: 'Italian', route: '/category/Italian' },
                    { label: 'Greek', route: '/category/Greek' },
                    { label: 'French', route: '/category/French' },
                    { label: 'American', route: '/category/American' },
                    { label: 'Mexican', route: '/category/Mexican' },
                    { label: 'Indian', route: '/category/Indian' },
                    { label: 'Filipino', route: '/category/Filipino' },
                    { label: 'Chinese', route: '/category/Chinese' },
                    { label: 'Japanese', route: '/category/Japanese' },
                    { label: 'Korean', route: '/category/Korean' },
                    { label: 'All Cuisines', route: '/category/all_cuisines' },
                  ]} 
                />
              </View>
          
          {/* STANDARD LINK (No Dropdown) */}
          <DesktopNavLink title="Popular" route="/category/Popular" />
           
           {/* MEAL TYPE WITH DROPDOWN */}
          <View style={styles.navItemContainer}>
            <DesktopDropdownNav 
              id="mealType" 
              title="Meal Type" 
              items={[
                { label: 'Breakfast', route: '/category/Breakfast' },
                { label: 'Snack', route: '/category/Snack' },
                { label: 'Brunch', route: '/category/Brunch' },
                { label: 'Lunch', route: '/category/Lunch' },
                { label: 'Dinner', route: '/category/Dinner' },
                { label: 'All Meal Types', route: '/category/all_meal_types' }
              ]} 
            />
            </View>
          {/* SEASONAL WITH DROPDOWN */}
          <View style={styles.navItemContainer}>
            <DesktopDropdownNav 
              id="seasonal" 
              title="Seasonal" 
              items={[
                { label: 'Fresh Spring Recipes', route: '/category/Fresh Spring Recipes' },
                { label: 'Summer Grilling', route: '/category/Summer Grilling' },
                { label: 'Summer Favorites', route: '/category/Summer Favorites' },
                { label: 'Cozy Fall Soups', route: '/category/Cozy Fall Soups' },
                { label: 'Fall Comfort Food', route: '/category/Fall Comfort Food' },
                { label: 'Hearty Winter Meals', route: '/category/Hearty Winter Meals' },
                { label: 'Holiday Baking', route: '/category/Holiday Baking' },
                { label: 'Game Day Favorites', route: '/category/Game Day Favorites' },
                { label: 'Slow Cooker Season', route: '/category/Slow Cooker Season' },
                { label: 'Light & Fresh Meals', route: '/category/Light & Fresh Meals' },
                { label: 'All Seasonal', route: '/category/all_seasonal' },
              ]} 
            />
          </View>
            
          {/* CATEGORY (Dish Type) WITH DROPDOWN */}
          <View style={styles.navItemContainer}>
            <DesktopDropdownNav 
              id="dishCategory" 
              title="Category" 
              items={[
                      { label: 'Appetizers', route: '/category/Appetizers' },
                      { label: 'Bread', route: '/category/Bread' },
                      { label: 'Snacks', route: '/category/Snacks' },
                      { label: 'Pasta', route: '/category/Pasta' },
                      { label: 'Salad', route: '/category/Salad' },
                      { label: 'Dessert', route: '/category/Dessert' },
                      { label: 'Soup', route: '/category/Soup' },
                      { label: 'Main Dishes', route: '/category/Main Dishes' },
                      { label: 'Drinks', route: '/category/Drinks' },
                      { label: 'All Categories', route: '/category/all_categories' },
              ]} 
            />
          </View>

          {/* BY INGREDIENT WITH DROPDOWN */}
          <View style={styles.navItemContainer}>
            <DesktopDropdownNav 
              id="ingredients" 
              title="By Ingredient" 
              items={[
                      { label: 'Fruits', route: '/category/Fruits' },
                      { label: 'Vegetables', route: '/category/Vegetables' },
                      { label: 'Dairy', route: '/category/Dairy' },
                      { label: 'Seafood', route: '/category/Seafood' },
                      { label: 'Poultry', route: '/category/Poultry' },
                      { label: 'Beef', route: '/category/Beef' },
                      { label: 'Pork', route: '/category/Pork' },
                      { label: 'Grains & Rice', route: '/category/Grains & Rice' },
                      { label: 'Legumes', route: '/category/Legumes' },
                      { label: 'All Ingredients', route: '/category/all_ingredients' },
              ]} 
            />
          </View>

          {/* ABOUT (Standard Link) */}
          <DesktopNavLink title="About" route="/about" />
          
          {/* CUSTOMIZE WITH DROPDOWN */}
          <View style={styles.navItemContainer}>
            <DesktopDropdownNav 
              id="customize" 
              title="Customize" 
              items={[
                { label: 'Scale Recipe', route: '/scale-recipe' },
                { label: 'Create Recipe', route: '/manual' }
              ]} 
            />
          </View>

        </View>
      )}


      {/*  END DESKTOP DROPDOWNS */}

    {/* --- MOBILE SIDE MENU (MODAL) --- */}
    <Modal
        visible={isMenuOpen}
        animationType="fade" // Fades the dark background in
        transparent={true}
        onRequestClose={closeMenu} 
      >
        <View style={styles.modalOverlay}>
          
          {/* Tapping the dark background area closes the menu */}
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeMenu} />
          
          {/* The white panel sliding in from the left */}
          <Animated.View style={[styles.sideMenu, { transform: [{ translateX: slideAnim }] }]}>
            <SafeAreaView style={{ flex: 1 }}>
              
              {/* Close Button Header */}
              <View style={styles.sideMenuHeader}>
                <TouchableOpacity onPress={closeMenu}>
                  <Feather name="x" size={32} color={COLORS.primary} />
                </TouchableOpacity>
              </View>

            {/* The Links */}
              <View style={styles.sideMenuLinks}>
                
                {/* CUISINE (Accordion) */}
                <View style={styles.mobileNavItemContainer}>
                <MobileDropdownNav 
                  id="cuisine" 
                  title="Cuisine" 
                  items={[
                    { label: 'Italian', route: '/category/Italian' },
                    { label: 'Greek', route: '/category/Greek' },
                    { label: 'French', route: '/category/French' },
                    { label: 'American', route: '/category/American' },
                    { label: 'Mexican', route: '/category/Mexican' },
                    { label: 'Indian', route: '/category/Indian' },
                    { label: 'Filipino', route: '/category/Filipino' },
                    { label: 'Chinese', route: '/category/Chinese' },
                    { label: 'Japanese', route: '/category/Japanese' },
                    { label: 'Korean', route: '/category/Korean' },
                    { label: 'All Cuisines', route: '/category/all_cuisines' },
                  ]} 
                />
                </View>

                {/* POPULAR (Standard Link) */}
                <MobileNavLink title="Popular" route="/category/Popular" />
                
                {/* MEAL TYPE (Accordion) */}
                <View style={styles.mobileNavItemContainer}>
                  <MobileDropdownNav 
                  id="mealType" 
                  title="Meal Type" 
                  items={[
                    { label: 'Breakfast', route: '/category/Breakfast' },
                    { label: 'Snack', route: '/category/Snack' },
                    { label: 'Brunch', route: '/category/Brunch' },
                    { label: 'Lunch', route: '/category/Lunch' },
                    { label: 'Dinner', route: '/category/Dinner' },
                    { label: 'All Meal Types', route: '/category/all_meal_types' }
                  ]} 
                />
              
              </View>
                {/* SEASONAL (Accordion) */}
                <View style={styles.mobileNavItemContainer}>
                  <MobileDropdownNav 
                    id="seasonal" 
                    title="Seasonal" 
                    items={[
                      { label: 'Fresh Spring Recipes', route: '/category/Fresh Spring Recipes' },
                      { label: 'Summer Grilling', route: '/category/Summer Grilling' },
                      { label: 'Summer Favorites', route: '/category/Summer Favorites' },
                      { label: 'Cozy Fall Soups', route: '/category/Cozy Fall Soups' },
                      { label: 'Fall Comfort Food', route: '/category/Fall Comfort Food' },
                      { label: 'Hearty Winter Meals', route: '/category/Hearty Winter Meals' },
                      { label: 'Holiday Baking', route: '/category/Holiday Baking' },
                      { label: 'Game Day Favorites', route: '/category/Game Day Favorites' },
                      { label: 'Slow Cooker Season', route: '/category/Slow Cooker Season' },
                      { label: 'Light & Fresh Meals', route: '/category/Light & Fresh Meals' },
                      { label: 'All Seasonal', route: '/category/all_seasonal' },
                    ]} 
                  />
                </View>
                  
                {/* CATEGORY (Accordion) */}
                <View style={styles.mobileNavItemContainer}>
                  <MobileDropdownNav 
                    id="dishCategory" 
                    title="Category" 
                    items={[
                      { label: 'Appetizers', route: '/category/Appetizers' },
                      { label: 'Bread', route: '/category/Bread' },
                      { label: 'Snacks', route: '/category/Snacks' },
                      { label: 'Pasta', route: '/category/Pasta' },
                      { label: 'Salad', route: '/category/Salad' },
                      { label: 'Dessert', route: '/category/Dessert' },
                      { label: 'Soup', route: '/category/Soup' },
                      { label: 'Main Dishes', route: '/category/Main Dishes' },
                      { label: 'Drinks', route: '/category/Drinks' },
                      { label: 'All Categories', route: '/category/all_categories' },
                    ]} 
                  />
                </View>

                {/* BY INGREDIENT (Accordion) */}
                <View style={styles.mobileNavItemContainer}>
                  <MobileDropdownNav 
                    id="ingredient" 
                    title="By Ingredient" 
                    items={[
                      { label: 'Fruits', route: '/category/Fruits' },
                      { label: 'Vegetables', route: '/category/Vegetables' },
                      { label: 'Dairy', route: '/category/Dairy' },
                      { label: 'Seafood', route: '/category/Seafood' },
                      { label: 'Poultry', route: '/category/Poultry' },
                      { label: 'Beef', route: '/category/Beef' },
                      { label: 'Pork', route: '/category/Pork' },
                      { label: 'Grains & Rice', route: '/category/Grains & Rice' },
                      { label: 'Legumes', route: '/category/Legumes' },
                      { label: 'All Ingredients', route: '/category/all_ingredients' },
                    ]} 
                  />
                  </View>

                  {/* CUSTOMIZE WITH ACCORDION */}
                  <View style={styles.mobileNavItemContainer}>
                    <MobileDropdownNav 
                      id="customize" 
                      title="Customize" 
                      items={[
                        { label: 'Scale Recipe', route: '/scale-recipe' },
                        { label: 'Create Recipe', route: '/manual' }
                      ]} 
                    />
                  </View>

                {/* ABOUT (Standard Link) */}
                <MobileNavLink title="About" route="/about" />

              </View>

            </SafeAreaView>
          </Animated.View>

        </View>
      </Modal>

      {/* --- END MOBILE SIDE MENU --- */}
      {/* --- ACCOUNT MENU (RIGHT SIDE MODAL) --- */}
      <Modal
        visible={isAccountOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={closeAccount}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeAccount} accessibilityLabel="Close account menu" accessibilityRole="button" />
          
          <Animated.View ref={accountPanelRef} {...accountPanResponder.panHandlers} {...webAccountKeyboardProps} style={[styles.accountMenu, { backgroundColor: colors.background, paddingTop: Math.max(insets.top + SPACING.sm, SPACING.lg), paddingBottom: Math.max(insets.bottom + SPACING.sm, SPACING.lg), transform: [{ translateX: accountSlideAnim }] }]} accessibilityViewIsModal accessibilityRole="menu" accessibilityLabel="Account menu"> 
            <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
              
              <View style={styles.accountMenuHeader}>
                <TouchableOpacity ref={accountCloseRef} onPress={closeAccount} style={styles.closeButton} accessibilityLabel="Close account menu" accessibilityRole="button">
                  <Feather name="x" size={32} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.accountMenuContent}>
              {/* Inside your Account Menu */}
                <View style={styles.sideMenuLinks}>
                <Text style={[styles.accountSectionTitle, { color: colors.primary, fontSize: 24 * textScale }]}>My Account</Text>
                
                {user ? (
                    <View style={styles.loggedInContainer}>
                        <View style={styles.accountIdentity}>
                          <View style={styles.accountAvatar}>
                            <Text style={styles.accountAvatarText}>
                              {(user.user_metadata?.full_name || user.email || 'C').charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View style={styles.accountIdentityText}>
                            <Text style={[styles.usernameText, { color: colors.textPrimary, fontSize: 17 * textScale }]}>{user.user_metadata?.full_name || user.email?.split('@')[0] || 'Chef'}</Text>
                            <Text style={[styles.loggedInText, { color: colors.textSecondary, fontSize: 16 * textScale }]}>{user.email}</Text>
                          </View>
                        </View>

                        <View style={styles.accountNavigation}>
                          <AccountMenuLink label="My Vault" icon="book-open" route="/?tab=personal" />
                          <AccountMenuLink label="Bookmarks" icon="bookmark" route="/bookmarks" />
                          <AccountMenuLink label="Settings" icon="settings" route="/settings" />
                          <AccountMenuLink label="Help & Support" icon="help-circle" route="/help" />
                          <AccountMenuLink label="About Math Fridge" icon="info" route="/about" />
                        </View>

                        <TouchableOpacity style={[styles.signOutButton, { backgroundColor: colors.surface, borderColor: colors.secondary }]} onPress={handleSignOut}>
                          <Feather name="log-out" size={18} color={colors.primary} />
                          <Text style={[styles.signOutButtonText, { color: colors.primary }]}>Sign Out</Text>
                        </TouchableOpacity>
                    </View>
                    ) : (
                    <View style={styles.loggedInContainer}>
                        <View style={styles.accountIdentity}>
                          <View style={styles.accountAvatar}><Feather name="user" size={22} color={colors.primary} /></View>
                          <View style={styles.accountIdentityText}>
                            <Text style={[styles.usernameText, { color: colors.textPrimary }]}>Guest</Text>
                            <Text style={[styles.loggedInText, { color: colors.textSecondary }]}>Sign in to save and share recipes.</Text>
                          </View>
                        </View>
                        <TouchableOpacity 
                        style={[styles.signOutButton, { backgroundColor: COLORS.primary, marginTop: 15 }]} 
                        onPress={openAuthFromAccount}
                        accessibilityRole="button"
                        activeOpacity={0.72}
                        >
                        <Text style={styles.loginButtonText}>Sign In or Create Account</Text>
                        </TouchableOpacity>
                        <View style={styles.accountNavigation}>
                          <AccountMenuLink label="Settings" icon="settings" route="/settings" />
                          <AccountMenuLink label="Help & Support" icon="help-circle" route="/help" />
                          <AccountMenuLink label="About Math Fridge" icon="info" route="/about" />
                        </View>
                    </View>
                )}
                
                {/* You can keep settings here, maybe wrapped in a check to see if a user is logged in */}
                </View>
              </ScrollView>

            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>
      <AuthModal visible={showModal} onClose={() => setShowModal(false)} />
    </View>
  );
}

const createStyles = (COLORS: import('../contexts/PreferencesContext').AppColors) => StyleSheet.create({
  topHeader: {
    // USING YOUR THEME VARIABLES
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    width: '100%',
  },
  headerLogoText: {
    // USING YOUR THEME VARIABLES
    fontFamily: TYPOGRAPHY.logo, // Your custom cursive font
    fontSize: 45,
    color: BRAND_COLORS.secondary,
    textAlign: 'center',
  },
  
  // --- NEW LAYOUT STYLES ---
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', 
    position: 'relative',
    width: '100%',
  },
  leftIcon: {
    position: 'absolute',
    left: 0,
    padding: 5,
  },
  iconBtn: {
    padding: SPACING.xs,
  },
  iconText: {
    fontSize: 20,
    color: COLORS.textSecondary, // Matching your text color
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.sm,
    gap: SPACING.xl*1.5, // Spacing between links
  },
  navLink: { // header buttons below logo
    color: BRAND_COLORS.background,
    fontFamily: TYPOGRAPHY.body,
    fontSize: 16,
    fontWeight: '500',
  },
  // --- SIDE MENU STYLES ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Darkens the screen behind the menu
    flexDirection: 'row', // Aligns the menu to the left
  },
  sideMenu: {
    width: '75%', // Takes up 3/4 of the phone screen
    height: '100%',
    maxWidth: 350, // <--- ADD THIS LINE
    backgroundColor: COLORS.background, // e.g., your white/cream color
    padding: SPACING.lg,
    // Adds a nice shadow to the edge of the menu
    ...getShadowStyle('elevated'),
  },
  sideMenuHeader: {
    alignItems: 'flex-end', // Puts the "X" button on the right side of the menu
    marginBottom: SPACING.xl,
  },
  accountMenu: {
    width: '75%', 
    maxWidth: 350, // <--- ADD THIS LINE
    height: '100%',
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
    position: 'absolute', // Forces it to the right
    right: 0,             // Locks it to the right edge
    ...getShadowStyle('elevated'),
  },
  accountMenuHeader: {
    alignItems: 'flex-start', // Puts the "X" on the left side of this panel
    marginBottom: SPACING.xl,
    width: '50%'
  },
  closeButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  accountSectionTitle: {
    fontFamily: TYPOGRAPHY.heading,
    fontSize: 24,
    color: COLORS.primary,
    marginBottom: SPACING.md,
  },
  // --- AUTH UI STYLES ---
  loggedInContainer: {
    marginTop: SPACING.md,
    flex: 1,
  },
  loggedInText: {
    fontFamily: TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  emailText: {
    fontFamily: TYPOGRAPHY.body,
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: SPACING.xl,
  },
  usernameText: {
    fontFamily: TYPOGRAPHY.heading,
    color: COLORS.textPrimary,
    fontSize: 17,
  },
  signOutButton: {
    flexDirection: 'row',
    gap: SPACING.sm,
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.secondary,
    padding: SPACING.sm,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  signOutButtonText: {
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.heading,
    fontSize: 14,
  },
  loginButtonText: { color: COLORS.background, fontFamily: TYPOGRAPHY.heading, fontSize: 16 },
  accountIdentity: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingBottom: SPACING.lg },
  accountAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.secondary },
  accountAvatarText: { fontFamily: TYPOGRAPHY.heading, fontSize: 20, color: COLORS.primary },
  accountIdentityText: { flex: 1 },
  accountNavigation: { borderTopWidth: 1, borderTopColor: COLORS.secondary, marginTop: SPACING.sm },
  accountMenuItem: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.secondary },
  accountMenuContent: { paddingBottom: SPACING.sm },
  accountMenuItemActive: { backgroundColor: COLORS.surface, borderLeftWidth: 3, borderLeftColor: COLORS.primary, paddingLeft: SPACING.sm },
  accountMenuItemLabel: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  accountMenuItemText: { fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 16, color: COLORS.textPrimary },
  navItemContainer: {
    position: 'relative', // Crucial for positioning the dropdown below it
    zIndex: 10,
  },
  navItemTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4, // Space between text and chevron
  },
  desktopDropdown: {
    position: 'absolute',
    top: 35, // Pushes it just below the text
    left: -10, // Slight alignment adjustment
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingVertical: 8,
    minWidth: 150,
    ...getShadowStyle('elevated'),
    zIndex: 20,
  },
  desktopDropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  desktopDropdownText: {
    fontFamily: TYPOGRAPHY.body,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  sideMenuLinks: {
    gap: 0, // Removed the gap so the borders touch cleanly
  },
  mobileNavItemContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  mobileNavItemTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between', // Pushes the text left and chevron right
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  sideMenuLinkText: {
    fontSize: 20,
    fontFamily: TYPOGRAPHY.body,
    color: COLORS.textPrimary,
    fontWeight: '600',
    // (Removed the border from here since we moved it to the container)
  },
  mobileDropdownContent: {
    paddingLeft: SPACING.lg, // Indents the sub-menu items
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  mobileDropdownItem: {
    paddingVertical: SPACING.xs,
  },
  mobileDropdownText: {
    fontSize: 18,
    fontFamily: TYPOGRAPHY.body,
    color: COLORS.textSecondary, // Slightly lighter text for hierarchy
  },
  rightIcon: {
    position: 'absolute',
    right: 0,
    padding: 5,
    flexDirection: 'row', // Aligns the text and icon horizontally
    alignItems: 'center', // Centers them vertically
    gap: SPACING.sm, // Adds clean spacing between the name and icon
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  profileIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20, 10, 6, 0.24)',
    borderWidth: 1,
    borderColor: 'rgba(214, 197, 179, 0.22)',
  },
  headerGreeting: {
    fontFamily: TYPOGRAPHY.heading, 
    fontSize: 16,
    color: BRAND_COLORS.secondary,
  },
});
