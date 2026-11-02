
import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';



export default function RootLayout() {


  return (
    <View style={styles.container}>
      <Stack
       screenOptions={{
        headerStyle: {
          backgroundColor: '#1E40AF',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        }
       }}
      >
       <Stack.Screen name="index" options={{ title: 'MoneyWing'}}/>
       <Stack.Screen name="signup" options={{ title: 'Create Account' }}/>
       <Stack.Screen name="login" options={{ title: 'Log In' }}/>
       <Stack.Screen name="otp" options={{ title: 'Verify OTP'}}/>
       <Stack.Screen name="dashboard" options={{ title: 'Dashboard', headerLeft: () => null }}/>

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


