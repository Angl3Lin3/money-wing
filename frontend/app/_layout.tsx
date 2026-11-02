import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { BackButton, HomeButton } from '../components/HeaderNav';

export default function RootLayout() {
  return (
    <View style={styles.container}>
      <Stack
       screenOptions={({ navigation }) => ({
        headerStyle: {
          backgroundColor: '#1E40AF',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        // Home on the right of every screen; Back on the left when there's somewhere to go back to.
        headerLeft: () => <BackButton canGoBack={navigation.canGoBack()} />,
        headerRight: () => <HomeButton />,
       })}
      >
       {/* Start screens: Home only (nothing to go back to) */}
       <Stack.Screen name="index" options={{ title: 'MoneyWing', headerLeft: () => null }}/>
       <Stack.Screen name="dashboard" options={{ title: 'Dashboard', headerLeft: () => null }}/>

       <Stack.Screen name="signup" options={{ title: 'Create Account' }}/>
       <Stack.Screen name="login" options={{ title: 'Log In' }}/>
       <Stack.Screen name="otp" options={{ title: 'Verify OTP'}}/>
       <Stack.Screen name="recipients" options={{ title: 'Recipients' }}/>
       <Stack.Screen name="add-recipient" options={{ title: 'Add Recipient' }}/>
       <Stack.Screen name="send" options={{ title: 'Send Money' }}/>
       <Stack.Screen name="review" options={{ title: 'Review Transfer' }}/>
       <Stack.Screen name="transfer/[id]" options={{ title: 'Transfer' }}/>
       <Stack.Screen name="api-test" options={{ title: 'API Test' }}/>
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
