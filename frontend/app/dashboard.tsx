import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Button, StyleSheet, Text, View } from "react-native";
import { userAPI } from "../services/api";
import { clearToken } from "../services/auth-storage";
import { showAlert } from "../services/alert";

export default function DashboardScreen() {
    const [email, setEmail] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const logout = async () => {
        await clearToken();
        router.replace("/");
    };

    useEffect(() => {
        userAPI.getProfile()
            .then((profile) => setEmail(profile.email ?? profile.user?.email ?? null))
            .catch(async (error: any) => {
                // Token missing, expired or invalid: back to the start.
                if (error.response?.status === 401 || error.response?.status === 403) {
                    await logout();
                }
            })
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Welcome to MoneyWing!</Text>
            {email && <Text style={styles.subtitle}>Signed in as {email}</Text>}

            <Button
             title="Start Sending Money"
             onPress={() => showAlert('Coming next', 'The send-money flow is the next thing to build.')}
            />
            <View style={{ height: 12 }} />
            <Button title="Recipients" onPress={() => router.push('/recipients')} />
            <View style={{ height: 12 }} />
            <Button title="Log Out" onPress={logout} color="#666" />
        </View>
    )
}


const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#1E40AF',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 30,
    },
});
