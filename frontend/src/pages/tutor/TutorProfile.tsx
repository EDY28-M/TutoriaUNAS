import { AccountProfile } from '../../components/panels/AccountProfile';
import type { Portal } from '../../hooks/usePortal';
import type { DemoUser } from '../../types/auth';

export function TutorProfile({ user, portal }: { user: DemoUser; portal: Portal }) {
  return <AccountProfile user={user} portal={portal} />;
}
