// analytics-screen.tsx — Smart Analytics: engagement, content consumption, struggling concepts.
import { View } from "react-native";

import { Card, ListState, PageTitle, SectionHeader } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { SPACE } from "@/shared/constants/tokens";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { BarChart } from "@/features/instructor/components/bar-chart";
import { useAnalytics } from "@/features/instructor/hooks/use-analytics";

export default function AnalyticsScreen() {
  const goBack = useSafeBack("/instructor/home");
  const { data, loading, error, refetch } = useAnalytics();

  return (
    <Screen role="instructor" scope="instructor/analytics">
      <PageTitle title="Analytics" subtitle="Engagement, content consumption and struggling concepts." onBack={goBack} />

      <ListState loading={loading} error={error} onRetry={refetch}>
        {data ? (
          <View style={{ gap: SPACE.lg }}>
            <View style={{ gap: SPACE.md }}>
              <SectionHeader title="Engagement by class" />
              <Card>
                <BarChart rows={data.engagement.map((e) => ({ label: e.classCode, percent: e.engagementPercent }))} tone="primary" />
              </Card>
            </View>

            <View style={{ gap: SPACE.md }}>
              <SectionHeader title="Content consumption" />
              <Card>
                <BarChart
                  rows={data.consumption.map((c) => ({ label: c.title, sublabel: c.classCode, percent: c.viewRatePercent }))}
                  tone="blue"
                />
              </Card>
            </View>

            <View style={{ gap: SPACE.md }}>
              <SectionHeader title="Struggling concepts" />
              <Card>
                <BarChart
                  rows={data.struggling.map((s) => ({ label: s.concept, sublabel: s.classCode, percent: s.missRatePercent }))}
                  tone="orange"
                />
              </Card>
            </View>
          </View>
        ) : null}
      </ListState>
    </Screen>
  );
}
