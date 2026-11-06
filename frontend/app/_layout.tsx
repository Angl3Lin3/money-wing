import { Carlito_400Regular, Carlito_700Bold, useFonts } from '@expo-google-fonts/carlito';
import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { BackButton, HomeButton } from '../components/HeaderNav';
import { colors, fonts } from '../constants/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Carlito_400Regular, Carlito_700Bold });

  if (!fontsLoaded) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.secondary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack
       screenOptions={({ navigation }) => ({
        headerStyle: { backgroundColor: colors.secondary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 17 },
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
        // Home on the right of every screen; Back on the left when there's somewhere to go back to.
        headerLeft: () => <BackButton canGoBack={navigation.canGoBack()} />,
        headerRight: () => <HomeButton />,
       })}
      >
       {/* Start screens: Home only (nothing to go back to) */}
       <Stack.Screen name="index" options={{ title: 'MoneyWing', headerLeft: () => null }}/>
       <Stack.Screen name="dashboard" options={{ title: 'MoneyWing', headerLeft: () => null }}/>

       <Stack.Screen name="signup" options={{ title: 'Create Account' }}/>
       <Stack.Screen name="login" options={{ title: 'Log In' }}/>
       <Stack.Screen name="otp" options={{ title: 'Verify Email'}}/>
       <Stack.Screen name="recipients" options={{ title: 'Recipients' }}/>
       <Stack.Screen name="add-recipient" options={{ title: 'Add Recipient' }}/>
       <Stack.Screen name="send" options={{ title: 'Send Money' }}/>
       <Stack.Screen name="review" options={{ title: 'Review Transfer' }}/>
       <Stack.Screen name="transfer/[id]" options={{ title: 'Transfer' }}/>
       <Stack.Screen name="history" options={{ title: 'Transfer History' }}/>
       <Stack.Screen name="profile" options={{ title: 'Your Account' }}/>
       <Stack.Screen name="api-test" options={{ title: 'Developer area' }}/>

       {/* Developer area: dark header so it's never mistaken for the customer app */}
       <Stack.Screen name="dev-login" options={{ title: 'Developer Login', headerStyle: { backgroundColor: colors.dev } }}/>
       <Stack.Screen name="dev" options={{ title: 'Developer Area', headerStyle: { backgroundColor: colors.dev } }}/>
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
});
