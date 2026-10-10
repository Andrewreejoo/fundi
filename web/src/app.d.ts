import type { Api } from '$lib/server/api';

declare global {
  namespace App {
    interface User {
      id: string;
      phone: string;
      name: string | null;
      roles: string[];
      has_pin: boolean;
      is_seller: boolean;
      seller_kind: 'dealer' | 'private' | null;
      seller_name: string | null;
      seller_verified: boolean | null;
      unread_messages: number;
      favorites_count: number;
    }
    interface Locals {
      api: Api;
      user: User | null;
      secure: boolean;
    }
  }
}

export {};
