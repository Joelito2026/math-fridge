import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router'; // <-- 1. Import the router


export default function CustomizeTab() {
  const router = useRouter(); // <-- 2. Initialize it

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleNavigation = (route: string) => {
    setIsDropdownOpen(false);
    // Insert your navigation logic here based on your router:
    if (route === 'scale') {
      // router.push('/ScaleRecipe');
    } else if (route === 'create') {
      // router.push('/CreateRecipe');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Customize Recipe</Text>
      <Text style={styles.subtitle}>Select an option to begin building your custom recipe.</Text>

      {/* --- DROPDOWN TRIGGER --- */}
      <TouchableOpacity 
        style={styles.dropdownButton} 
        activeOpacity={0.8}
        onPress={() => setIsDropdownOpen(true)}
      >
        <Text style={styles.dropdownText}>Select Action...</Text>
        <Feather name={isDropdownOpen ? "chevron-up" : "chevron-down"} size={20} color="#5D4037" />
      </TouchableOpacity>

      {/* --- DROPDOWN MODAL --- */}
      <Modal visible={isDropdownOpen} transparent={true} animationType="fade">
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setIsDropdownOpen(false)}
        >
          <View style={styles.dropdownMenu}>
            <TouchableOpacity 
              style={styles.dropdownItem} 
              onPress={() => handleNavigation('scale')}
            >
              <Feather name="maximize-2" size={20} color="#5D4037" style={styles.dropdownIcon} />
              <View>
                <Text style={styles.dropdownItemTitle}>Scale Recipe</Text>
                <Text style={styles.dropdownItemSubtitle}>Extract and modify from URL</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity 
              style={styles.dropdownItem} 
              onPress={() => handleNavigation('create')}
            >
              <Feather name="edit-3" size={20} color="#4A90E2" style={styles.dropdownIcon} />
              <View>
                <Text style={styles.dropdownItemTitle}>Create Recipe</Text>
                <Text style={styles.dropdownItemSubtitle}>Build manually from scratch</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#FFF6E5',
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#5D4037',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    padding: 18,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  dropdownText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dropdownMenu: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  dropdownIcon: {
    marginRight: 16,
  },
  dropdownItemTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  dropdownItemSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 12,
  },
});