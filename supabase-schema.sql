-- =====================================================================
-- Greenlight  |  Supabase schema + first project seed
-- Run once: Supabase  >  SQL Editor  >  New query  >  paste  >  Run.
-- =====================================================================

-- Projects you create (one row per prospect project)
create table if not exists public.pb_projects (
  id          text primary key,            -- used in the share link  #l/<id>
  owner       text not null,               -- admin email that owns it
  title       text not null,
  data        jsonb not null default '{}', -- { cats: [...], decisions: [...] }
  created_at  timestamptz not null default now()
);

-- Responses people submit (one row per email per project)
create table if not exists public.pb_responses (
  id          uuid primary key default gen_random_uuid(),
  project_id  text not null,
  email_key   text not null,               -- lowercased email, used to update not duplicate
  email       text not null,
  decisions   jsonb not null default '{}',
  features    jsonb not null default '{}', -- { featureId: 'mvp' | 'soon' | 'later' }
  notes       text default '',
  updated_at  timestamptz not null default now(),
  unique (project_id, email_key)
);

create index if not exists pb_responses_project_idx on public.pb_responses (project_id);
create index if not exists pb_projects_owner_idx     on public.pb_projects (owner);

-- Row Level Security
alter table public.pb_projects  enable row level security;
alter table public.pb_responses enable row level security;

-- Policies. Share by link with no real login yet, so the public anon key
-- needs read and write. Fine for early client polling. Do not store anything
-- sensitive. Tighten this once you add Supabase Auth (Google SSO).
drop policy if exists "anon read projects"    on public.pb_projects;
drop policy if exists "anon insert projects"  on public.pb_projects;
drop policy if exists "anon update projects"  on public.pb_projects;
drop policy if exists "anon read responses"   on public.pb_responses;
drop policy if exists "anon insert responses" on public.pb_responses;
drop policy if exists "anon update responses" on public.pb_responses;

create policy "anon read projects"    on public.pb_projects  for select to anon using (true);
create policy "anon insert projects"  on public.pb_projects  for insert to anon with check (true);
create policy "anon update projects"  on public.pb_projects  for update to anon using (true) with check (true);

create policy "anon read responses"   on public.pb_responses for select to anon using (true);
create policy "anon insert responses" on public.pb_responses for insert to anon with check (true);
create policy "anon update responses" on public.pb_responses for update to anon using (true) with check (true);

-- ---------------------------------------------------------------------
-- Seed the first project: Flick, vertical film web app.
-- Change the owner here if your admin email is different from the default.
-- ---------------------------------------------------------------------
insert into public.pb_projects (id, owner, title, data)
values ('flick', 'cody@gmail.com', 'Flick, vertical film web app', '{"meta":{"wedge":"Win with one thing done beautifully: a fast, full screen, swipe to next feed that makes the filmmaker content effortless to watch in the browser. Everything in the MVP exists to support that core loop.","howTo":"Each feature starts tagged from our written scope. Change anything that does not match your view. The results page shows where the team lands so we can lock the real MVP with confidence.","productType":"web app"},"cats":[{"name":"Core Player and Feed","items":[{"id":"vertical_fullscreen_player","name":"Vertical fullscreen player","info":"The main viewing surface every video plays inside.","default":"mvp"},{"id":"swipe_to_next_feed","name":"Swipe to next feed","info":"TikTok style consumption. The recommended starting wedge.","default":"mvp"},{"id":"autoplay_on_scroll","name":"Autoplay on scroll","info":"The next video starts automatically as you move through the feed.","default":"mvp"},{"id":"tap_to_pause_and_double_tap_to_like","name":"Tap to pause and double tap to like","info":"Gesture controls people already expect.","default":"mvp"},{"id":"resume_where_you_left_off","name":"Resume where you left off","info":"","default":"mvp"},{"id":"seek_and_scrubber_bar","name":"Seek and scrubber bar","info":"Lets a viewer jump to any point in a video.","default":"soon"},{"id":"playback_speed_control","name":"Playback speed control","info":"","default":"soon"},{"id":"quality_selector","name":"Quality selector","info":"Auto or manual resolution choice.","default":"soon"},{"id":"picture_in_picture","name":"Picture in picture","info":"Keeps a video playing in a small floating window.","default":"soon"}]},{"name":"Discovery and Browse","items":[{"id":"curated_or_algorithmic_home_feed","name":"Curated or algorithmic home feed","info":"","default":"mvp"},{"id":"search","name":"Search","info":"Find titles, filmmakers and tags.","default":"mvp"},{"id":"filmmaker_pages","name":"Filmmaker pages","info":"A dedicated page for each creator and their work.","default":"mvp"},{"id":"continue_watching_rail","name":"Continue watching rail","info":"","default":"mvp"},{"id":"browse_by_category_or_genre","name":"Browse by category or genre","info":"","default":"soon"},{"id":"collections_and_playlists","name":"Collections and playlists","info":"Curated groupings of titles.","default":"soon"},{"id":"trending_and_editor_picks","name":"Trending and editor picks","info":"","default":"soon"},{"id":"related_and_more_like_this","name":"Related and more like this","info":"","default":"soon"}]},{"name":"Accounts and Profiles","items":[{"id":"email_and_password_sign_up","name":"Email and password sign up","info":"","default":"mvp"},{"id":"apple_and_google_sign_in","name":"Apple and Google sign in","info":"OAuth sign in on web.","default":"mvp"},{"id":"user_profile","name":"User profile","info":"","default":"mvp"},{"id":"watchlist_or_save_for_later","name":"Watchlist or save for later","info":"","default":"mvp"},{"id":"magic_link_sign_in","name":"Magic link sign in","info":"Passwordless email link for quick access.","default":"soon"},{"id":"watch_history","name":"Watch history","info":"","default":"soon"},{"id":"account_settings","name":"Account settings","info":"","default":"soon"},{"id":"multiple_profiles_per_account","name":"Multiple profiles per account","info":"","default":"later"}]},{"name":"Subscriptions and Monetization","items":[{"id":"paywall_or_subscription_gate","name":"Paywall or subscription gate","info":"","default":"mvp"},{"id":"subscription_tiers","name":"Subscription tiers","info":"","default":"mvp"},{"id":"free_trial","name":"Free trial","info":"","default":"mvp"},{"id":"stripe_subscription_checkout","name":"Stripe subscription checkout","info":"Web checkout for paid plans.","default":"mvp"},{"id":"manage_subscription","name":"Manage and restore subscription","info":"Stripe customer portal for billing and plan changes.","default":"mvp"},{"id":"promo_codes_and_gifting","name":"Promo codes and gifting","info":"","default":"later"},{"id":"rent_or_buy_individual_titles","name":"Rent or buy individual titles","info":"","default":"later"},{"id":"ad_supported_free_tier","name":"Ad supported free tier","info":"","default":"later"}]},{"name":"Social and Engagement","items":[{"id":"like_or_favorite","name":"Like or favorite","info":"","default":"mvp"},{"id":"share_to_social_or_link","name":"Share to social or link","info":"","default":"mvp"},{"id":"follow_filmmakers","name":"Follow filmmakers","info":"","default":"mvp"},{"id":"comments","name":"Comments","info":"","default":"soon"},{"id":"ratings_and_reviews","name":"Ratings and reviews","info":"","default":"soon"}]},{"name":"Filmmaker Tools","items":[{"id":"upload_portal","name":"Upload portal","info":"Where creators submit their work.","default":"mvp"},{"id":"creator_dashboard","name":"Creator dashboard","info":"","default":"soon"},{"id":"performance_analytics","name":"Performance analytics","info":"","default":"soon"},{"id":"payout_and_revenue_reporting","name":"Payout and revenue reporting","info":"","default":"later"},{"id":"submission_and_review_workflow","name":"Submission and review workflow","info":"","default":"later"}]},{"name":"Notifications and Retention","items":[{"id":"web_push_notifications","name":"Web push notifications","info":"Browser push for new content and alerts.","default":"soon"},{"id":"new_release_alerts","name":"New release alerts","info":"Alerts when a followed filmmaker posts.","default":"soon"},{"id":"email_notifications","name":"Email notifications","info":"","default":"later"},{"id":"in_app_inbox","name":"In app inbox","info":"","default":"later"}]},{"name":"Admin Tool and CMS","items":[{"id":"content_ingest_and_encoding_pipeline","name":"Content ingest and encoding pipeline","info":"How raw video gets processed and stored.","default":"mvp"},{"id":"metadata_management","name":"Metadata management","info":"","default":"mvp"},{"id":"content_scheduling_and_publishing","name":"Content scheduling and publishing","info":"","default":"mvp"},{"id":"moderation_tools","name":"Moderation tools","info":"","default":"later"},{"id":"user_management","name":"User management","info":"","default":"later"},{"id":"reporting_and_analytics_dashboard","name":"Reporting and analytics dashboard","info":"","default":"later"}]},{"name":"Playback Quality and Infrastructure","items":[{"id":"adaptive_bitrate_streaming","name":"Adaptive bitrate streaming","info":"Adjusts quality to the viewer connection.","default":"mvp"},{"id":"cdn_delivery","name":"CDN delivery","info":"","default":"mvp"},{"id":"drm_and_content_protection","name":"DRM and content protection","info":"Stops content from being copied or stolen.","default":"mvp"},{"id":"watermarking_and_piracy_protection","name":"Watermarking and piracy protection","info":"","default":"later"},{"id":"casting_to_airplay_and_chromecast","name":"Casting to AirPlay and Chromecast","info":"","default":"later"}]},{"name":"Offline and Extras","items":[{"id":"offline_downloads","name":"Offline downloads","info":"Save titles to watch without a connection.","default":"later"},{"id":"subtitles_and_captions","name":"Subtitles and captions","info":"","default":"soon"},{"id":"multiple_audio_tracks","name":"Multiple audio tracks","info":"","default":"later"},{"id":"accessibility_support","name":"Accessibility support","info":"Screen reader and similar assistive features.","default":"later"},{"id":"localization_and_multiple_languages","name":"Localization and multiple languages","info":"","default":"later"}]}],"decisions":[{"id":"d_experience","q":"Which experience do we optimize for at launch?","options":["Desktop web first","Mobile web first","Both from day one"]},{"id":"d_admin","q":"Admin or content tool for launch?","options":["Full tool at launch","Scaled down and scrappy","Later, keep it manual for now"]}]}'::jsonb)
on conflict (id) do update set title = excluded.title, data = excluded.data;

-- Done.
