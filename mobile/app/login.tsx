import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { api, setTokens } from "../src/api/client";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e = email, p = password) {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post("/auth/login/", { email: e, password: p });
      await setTokens(data.tokens.access, data.tokens.refresh);
      if (data.user.role === "guardian") router.replace("/guardian");
      else router.replace("/driver");
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: { message: string } } } };
      setError(ax.response?.data?.error?.message || "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 24, backgroundColor: "#F4F1EA", gap: 12, justifyContent: "center" }}>
      <Text style={{ fontSize: 28, fontWeight: "700", color: "#0B1F3A" }}>RouteWise</Text>
      <Text style={{ color: "#5C6B7A" }}>Driver and family app. Demo data is fictional.</Text>
      {error ? <Text accessibilityRole="alert" style={{ color: "#B42318" }}>{error}</Text> : null}
      <Text nativeID="email-label">Email</Text>
      <TextInput
        accessibilityLabel="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={input}
      />
      <Text>Password</Text>
      <TextInput accessibilityLabel="Password" secureTextEntry value={password} onChangeText={setPassword} style={input} />
      <Pressable onPress={() => submit()} disabled={busy} style={btn}>
        <Text style={{ color: "white", fontWeight: "700" }}>{busy ? "Signing in…" : "Sign in"}</Text>
      </Pressable>
      {process.env.EXPO_PUBLIC_DEMO_MODE === "true" && (
        <View style={{ gap: 8, marginTop: 12 }}>
          <Text style={{ fontSize: 12, color: "#5C6B7A" }}>Demo accounts</Text>
          <Pressable style={btnGhost} onPress={() => submit("driver@jefferson.demo", "DemoPass123!")}>
            <Text>Driver</Text>
          </Pressable>
          <Pressable style={btnGhost} onPress={() => submit("guardian@jefferson.demo", "DemoPass123!")}>
            <Text>Guardian</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const input = { backgroundColor: "white", borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, minHeight: 48 };
const btn = { backgroundColor: "#0B1F3A", padding: 14, borderRadius: 8, alignItems: "center" as const, minHeight: 48 };
const btnGhost = { backgroundColor: "white", padding: 12, borderRadius: 8, alignItems: "center" as const, minHeight: 48, borderWidth: 1, borderColor: "#0B1F3A" };
