import { Redirect } from "expo-router";

import { useAuth } from "@/src/auth";
import { Loading } from "@/src/ui";

export default function Index() {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  if (!user) return <Redirect href="/landing" />;
  if (!user.onboarding_done && !user.plan_chosen) return <Redirect href="/choose-plan" />;
  if (!user.onboarding_done) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
