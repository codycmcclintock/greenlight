/* =========================================================================
   Greenlight config

   1) Paste your Supabase URL and anon key below to turn on real sharing.
      Leave them blank to run in local mode (this browser only) for testing.

   2) The admin login below is a SOFT gate for speed to market only. Because
      this is checked in the browser, treat it as a doorway, not real security.
      Real protection comes later from Supabase Auth (Google SSO). Until then,
      do not put anything truly sensitive behind it.
   ========================================================================= */
window.GREENLIGHT_CONFIG = {
  SUPABASE_URL: "",        // example: https://yourproject.supabase.co
  SUPABASE_ANON_KEY: "",   // your anon public key (never the service_role key)

  ADMIN_EMAIL: "cody@gmail.com",
  ADMIN_PASSWORD: "Welcome1!"
};
