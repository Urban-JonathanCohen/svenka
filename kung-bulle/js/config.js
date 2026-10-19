// Public configuration. The Supabase anon key is designed to be public: the
// database only exposes the kb_submit / kb_stats functions (see backend/).
// Leave SUPABASE_URL empty to run in offline mock mode.

export const CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  ROUND_SIZE: 10,
  SECONDS_PER_PROMPT: 20,
  // How much the popularity priors in prompts.json weigh against live answers.
  // 1 = a prior of w=30 counts like 30 real answers.
  PRIOR_WEIGHT: 1,
  TIMEZONE: 'Europe/Stockholm',
};
