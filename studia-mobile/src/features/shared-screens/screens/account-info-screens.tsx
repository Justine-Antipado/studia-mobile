// account-info-screens.tsx — read-only Account sub pages: Privacy Policy and About (= Learn More).
import { Text, View } from "react-native";

import { LearnMoreView } from "@/features/onboarding/screens/learn-more-screen";
import type { Role } from "@/core/types/role";
import { Card, PageTitle } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { useSafeBack } from "@/shared/hooks/use-safe-back";

const POLICY_UPDATED = "November 2026";

const POLICY: { title: string; body: string }[] = [
  {
    title: "What we collect",
    body: "Your name, school email, course/section (students) or department (instructors), and the work you submit in your classes: assignments, quiz answers and grades.",
  },
  {
    title: "How it is used",
    body: "To run your classes, show your instructor your submissions, and compute grades. AI features process the text you give them; do not paste passwords or sensitive personal data.",
  },
  {
    title: "Who can see it",
    body: "Only you and the instructor of the class you belong to. Studia does not sell your data or show it to advertisers.",
  },
  {
    title: "Your choices",
    body: "You can edit your profile and change your password from the Account tab. To delete your account, contact the OMSC Mamburao Campus administrator.",
  },
];

export function AccountPrivacyScreen({ role }: { role: Role }) {
  const goBack = useSafeBack(`/${role}/account`);
  return (
    <Screen role={role} scope={`${role}/account-privacy`}>
      <PageTitle title="Privacy Policy" subtitle={`Last updated ${POLICY_UPDATED}`} onBack={goBack} />
      {POLICY.map((p) => (
        <Card key={p.title}>
          <View style={{ gap: SPACE.xs }}>
            <Text style={TYPE.h3}>{p.title}</Text>
            <Text style={TYPE.body}>{p.body}</Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

/** About Application shows the same content as the welcome screen's "Learn More". */
export function AccountAboutScreen({ role }: { role: Role }) {
  const goBack = useSafeBack(`/${role}/account`);
  return <LearnMoreView onBack={goBack} />;
}

export const StudentAccountPrivacy = () => <AccountPrivacyScreen role="student" />;
export const InstructorAccountPrivacy = () => <AccountPrivacyScreen role="instructor" />;
export const StudentAccountAbout = () => <AccountAboutScreen role="student" />;
export const InstructorAccountAbout = () => <AccountAboutScreen role="instructor" />;
