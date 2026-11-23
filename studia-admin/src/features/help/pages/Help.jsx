// Phase 7: a short admin guide and about STUDIA. Static content — no
// repository needed beyond the app version already shown on /settings/system.
import { useEffect, useState } from 'react';
import * as settingsRepo from '../../settings/data/settingsRepository';
import PageHeader from '../../../shared/components/PageHeader';
import { Card } from '../../../shared/components/ui';

const GUIDE = [
  { q: 'Reading vs. writing', a: 'Users, classes, content and assessments are read and delete only here — those records are created in the mobile app. Class announcements are posted by instructors in the mobile app, so here you can read and moderate them.' },
  { q: 'Deleting something permanent', a: 'Every permanent delete (a user, a class, a piece of content, an announcement) asks you to type DELETE first, and is recorded in Security → Audit log.' },
  { q: 'Tables on a small screen', a: 'Every list turns into stacked cards below about 720px, with the same actions available at the bottom of each card.' },
  { q: 'Staying signed in', a: 'The session times out after a period of inactivity, with a warning first. Signing out in one tab signs every open tab out too.' },
  { q: 'Changing the admin password', a: 'Settings → Account walks through the OTP flow: send a code to the admin email, verify it, then set a password that meets all five rules.' },
];

export default function Help() {
  const [version, setVersion] = useState(null);

  useEffect(() => {
    let mounted = true;
    settingsRepo.getSettings().then((s) => {
      if (mounted) setVersion(s.system.appVersion);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      <PageHeader title="Help" subtitle="Short admin guide and about STUDIA." />

      <div className="stack">
        <Card title="Admin guide">
          <dl className="guide-list">
            {GUIDE.map((item) => (
              <div key={item.q}>
                <dt>{item.q}</dt>
                <dd>{item.a}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card title="About STUDIA">
          <p>
            STUDIA is a mobile-first, AI-assisted learning platform for Occidental Mindoro State
            University — Mamburao Campus. It works like a classroom hub, with built-in AI for video
            lesson transcription, instant summaries, smart task management and adaptive quiz
            generation across the student and instructor apps.
          </p>
          <p className="muted small">This admin portal{version ? ` targets STUDIA Mobile ${version}` : ''}. Support: the OMSU IT office.</p>
        </Card>
      </div>
    </>
  );
}
