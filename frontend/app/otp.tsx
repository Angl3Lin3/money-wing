import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
    Button,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableWithoutFeedback,
    View
} from "react-native";
import { authAPI, getErrorMessage } from "../services/api";
import { saveToken } from "../services/auth-storage";
import { showAlert } from "../services/alert";

export default function OTPScreen() {
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const params = useLocalSearchParams();
    const email = params.email as string;
    const [resending, setResending] = useState(false);

    const resendOtp = async () => {
        setResending(true);
        try {
            await authAPI.resendOTP(email);
            showAlert('Code sent', 'A new code is on its way.');
        } catch (error: any) {
            showAlert('Error', getErrorMessage(error, 'Could not resend the code'));
        } finally {
            setResending(false);
        }
    };

    const verifyOtp = async () => {
        if (!otp || otp.length !== 6) {
            showAlert('Error', 'Please enter a valid 6-digit OTP');
            return;
        }

        setLoading(true);
        try {
            const result = await authAPI.verifyOTP(email, otp);
            await saveToken(result.token); // stay logged in
            // SUCCESS: Navigate immediately to dashboard
            router.replace('/dashboard');
        } catch (error: any) {
            // ERROR: Show alert only on failure
            showAlert('Error', getErrorMessage(error, 'Verification failed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.container}
            >
                <View style={styles.innerContainer}>
                    <Text style={styles.title}>Verify Your Email</Text>
                    <Text style={styles.subtitle}>Enter the OTP sent to {email}</Text>
                    
                    <TextInput
                        style={styles.input}
                        placeholder="Enter OTP Code"
                        value={otp}
                        onChangeText={setOtp}
                        keyboardType="numeric"
                        maxLength={6}
                        onSubmitEditing={verifyOtp} // Submit on enter key
                        returnKeyType="done"
                    />

                    <View style={styles.buttonContainer}>
                        <Button 
                            title={loading ? "Verifying..." : "Verify OTP"} 
                            onPress={verifyOtp}
                            disabled={loading}
                        />
                        <View style={{ height: 10 }} />
                        <Button
                            title={resending ? "Sending..." : "Resend code"}
                            onPress={resendOtp}
                            disabled={resending}
                            color="#666"
                        />
                    </View>
                </View>
            </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    innerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#1E40AF',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 30,
        textAlign: 'center',
    },
    input: {
        width: '80%',
        height: 50,
        borderColor: '#ccc',
        borderWidth: 1,
        borderRadius: 8,
        padding: 15,
        marginBottom: 20,
        fontSize: 18,
        textAlign: 'center',
        backgroundColor: '#f8f9fa',
    },
    buttonContainer: {
        width: '80%',
        marginTop: 10,
    },
});