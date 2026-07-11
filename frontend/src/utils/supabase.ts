import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabasePublishableKey = process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY || '';

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('缺少 Supabase 配置，请检查 .env 文件。');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey);

// Supabase Auth uses email internally. The product intentionally exposes only
// a username, so a deterministic internal address is used for authentication.
export function usernameToLoginEmail(username: string) {
  return `${username.trim().toLowerCase()}@vocab.local`;
}

export function validateUsername(username: string) {
  return /^[a-zA-Z0-9_]{3,32}$/.test(username.trim());
}
