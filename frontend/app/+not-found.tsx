import { router, Stack } from "expo-router";
import { AppButton, Card, Screen, Subtitle, Title } from "../components/ui";

// Shown when someone opens an address the app doesn't have.
export default function NotFoundScreen() {
  return (
    <Screen center hideDemoBanner>
      <Stack.Screen options={{ title: "Page not found" }} />
      <Title center>We couldn't find that page</Title>
      <Subtitle center>The link may be old or mistyped.</Subtitle>
      <Card>
        <AppButton title="Go to the home screen" onPress={() => router.replace("/")} />
      </Card>
    </Screen>
  );
}
