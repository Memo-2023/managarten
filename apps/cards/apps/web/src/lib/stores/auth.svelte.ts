/**
 * Auth Store — uses the shared Mana auth factory.
 *
 * SSO: tokens land in the shared `*.mana.how` storage so a user already
 * signed into mana.how / cardecky.mana.how lands directly in the app
 * without re-typing credentials. The factory wires up the token
 * manager + refresh + storage adapter for us.
 */

import { createManaAuthStore } from '@mana/shared-auth-ui';

export const authStore = createManaAuthStore();
