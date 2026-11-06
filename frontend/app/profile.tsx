import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import PasswordInput from "../components/PasswordInput";
import { AppButton, Body, Caption, Card, DetailRow, Loading, Notice, Screen, SectionLabel, Spacer, Title } from "../components/ui";
import { colors, fonts, fontSize, spacing } from "../constants/theme";
import { confirmAction, showAlert } from "../services/alert";
import { getErrorMessage, Profile, userAPI } from "../services/api";
import { clearToken } from "../services/auth-storage";

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);

  // Change password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changing, setChanging] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  // Delete account
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const logout = async () => {
    await clearToken();
    router.replace("/");
  };

  useEffect(() => {
    userAPI
      .getProfile()
      .then((data) => setProfile(data.user))
      .catch(async (e: any) => {
        if (e?.response?.status === 401 || e?.response?.status === 403) await logout();
        else showAlert("Error", getErrorMessage(e, "Could not load your profile"));
      });
  }, []);

  const changePassword = async () => {
    setPasswordMessage(null);
    if (!currentPassword || !newPassword) {
      setPasswordMessage({ tone: "danger", text: "Fill in your current and new password." });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage({ tone: "danger", text: "The new password must be at least 8 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ tone: "danger", text: "The new passwords don't match." });
      return;
    }

    setChanging(true);
    try {
      await userAPI.changePassword(currentPassword, newPassword);
      setPasswordMessage({ tone: "success", text: "Password changed. Use it next time you log in." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      setPasswordMessage({ tone: "danger", text: getErrorMessage(e, "Could not change the password") });
    } finally {
      setChanging(false);
    }
  };

  const deleteAccount = async () => {
    setDeleteError(null);
    if (!deletePassword) {
      setDeleteError("Enter your password to confirm.");
      return;
    }
    const ok = await confirmAction(
      "Delete your account?",
      "You'll be logged out and won't be able to log in again. This can't be undone.",
      "Delete account"
    );
    if (!ok) return;

    setDeleting(true);
    try {
      const result = await userAPI.deleteAccount(deletePassword);
      await clearToken();
      showAlert(result.result === "deleted" ? "Account deleted" : "Account closed", result.message);
      router.replace("/");
    } catch (e: any) {
      setDeleteError(getErrorMessage(e, "Could not delete the account"));
      setDeleting(false);
    }
  };

  if (!profile) return <Loading />;

  return (
    <Screen>
      <Title>Your account</Title>
      <Spacer size={spacing.sm} />

      <SectionLabel>Details</SectionLabel>
      <Card>
        <DetailRow label="Email" value={profile.email} />
        <DetailRow label="Member since" value={new Date(profile.createdAt).toLocaleDateString()} />
        <DetailRow label="Recipients" value={String(profile.recipientCount)} />
        <DetailRow label="Transfers" value={String(profile.transferCount)} />
      </Card>

      <SectionLabel>Change password</SectionLabel>
      <Card>
        {passwordMessage && <Notice tone={passwordMessage.tone}>{passwordMessage.text}</Notice>}
        <PasswordInput label="Current password" value={currentPassword} onChangeText={setCurrentPassword} />
        <PasswordInput label="New password" hint="At least 8 characters" value={newPassword} onChangeText={setNewPassword} />
        <PasswordInput label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} onSubmitEditing={changePassword} />
        <AppButton title="Change password" variant="secondary" onPress={changePassword} loading={changing} />
      </Card>

      <AppButton title="Log out" variant="ghost" onPress={logout} />
      <Spacer size={spacing.xl} />

      <SectionLabel style={{ color: colors.danger }}>Delete account</SectionLabel>
      <Card style={styles.dangerCard}>
        <Body>
          This removes your account and personal data.
        </Body>
        <Text style={styles.note}>
          If you&apos;ve ever paid for a transfer, the account is closed instead of erased: you won&apos;t be able to log in,
          but records of those transfers are kept, because the law requires money transfer records to be kept.
        </Text>
        {deleteError && <Notice tone="danger">{deleteError}</Notice>}
        <PasswordInput label="Enter your password to confirm" value={deletePassword} onChangeText={setDeletePassword} />
        <AppButton title="Delete my account" variant="danger" onPress={deleteAccount} loading={deleting} />
      </Card>
      <Caption center>Questions about your data? Contact MoneyWing.</Caption>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dangerCard: { borderWidth: 1.5, borderColor: colors.dangerSoft },
  note: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.lg },
});
