import React from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator, BottomTabBar } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeScreen } from '../screens/HomeScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { PlayerScreen } from '../screens/PlayerScreen';
import { SectionEditorScreen } from '../screens/SectionEditorScreen';
import { MiniPlayer } from '../components/MiniPlayer';
import { colors } from '../theme/colors';
import {
  PixelHomeIcon,
  PixelSearchIcon,
  PixelLibraryIcon,
  PixelSettingsIcon,
} from '../components/PixelIcons';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const TabNavigator: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  // Ensure bottom safe area is respected on Android (gesture / button nav) and iOS
  const bottomInset = insets.bottom;

  return (
    <View style={styles.container}>
      <Tab.Navigator
        initialRouteName="Home"
        tabBar={(props) => (
          <View style={styles.tabBarWrapper}>
            <MiniPlayer onPress={() => navigation.navigate('Player')} />
            <BottomTabBar {...props} />
          </View>
        )}
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.pixelBorder,
            borderTopWidth: 2.5,
            height: 58 + Math.max(bottomInset, 8),
            paddingBottom: Math.max(bottomInset, 6),
            paddingTop: 6,
            shadowColor: colors.pixelShadow,
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 1,
            shadowRadius: 0,
            elevation: 8,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '900',
            letterSpacing: 0.8,
          },
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            tabBarLabel: 'Home',
            tabBarIcon: ({ color, size }) => <PixelHomeIcon size={size || 22} color={color} />,
          }}
        />
        <Tab.Screen
          name="Search"
          component={SearchScreen}
          options={{
            tabBarLabel: 'Search',
            tabBarIcon: ({ color, size }) => <PixelSearchIcon size={size || 22} color={color} />,
          }}
        />
        <Tab.Screen
          name="Library"
          component={LibraryScreen}
          options={{
            tabBarLabel: 'Library',
            tabBarIcon: ({ color, size }) => <PixelLibraryIcon size={size || 22} color={color} />,
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            tabBarLabel: 'Settings',
            tabBarIcon: ({ color, size }) => <PixelSettingsIcon size={size || 22} color={color} />,
          }}
        />
      </Tab.Navigator>
    </View>
  );
};

export const RootNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={TabNavigator} />
        <Stack.Screen
          name="Player"
          component={PlayerScreen}
          options={{
            presentation: 'modal',
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="SectionEditor"
          component={SectionEditorScreen as any}
          options={{
            presentation: 'card',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabBarWrapper: {
    backgroundColor: colors.surface,
  },
});
