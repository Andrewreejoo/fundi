import type { Api } from '$lib/server/api';
import type { Lang } from '$lib/i18n';

declare global {
  namespace App {
    interface User {
      id: string;
      phone: string;
      name: string | null;
      roles: string[];
      language: Lang;
      has_pin: boolean;
      is_provider: boolean;
      verification_level: string | null;
      provider_status: string | null;
    }
    interface Locals {
      api: Api;
      user: User | null;
      lang: Lang;
      secure: boolean;
    }
    interface PageData {
      user?: User | null;
      lang?: Lang;
    }
  }
}

export {};
