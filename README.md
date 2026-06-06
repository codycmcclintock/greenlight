# Greenlight

The client alignment tool for your agency. You log in, open a prospect project,
and send one share link. The people you send it to enter their email, tag every
feature as MVP, Soon, or Later, answer your key decisions, add notes on anything
missing, and get a thank you screen. You see the results add up in one place.

It ships with one project already loaded: **Flick, vertical film web app.**

No framework, no build step. Plain HTML, CSS, and JS plus a Supabase database.

## Files

| File | What it is |
|---|---|
| index.html | The app shell. |
| app.js | All the logic (login, dashboard, builder, respondent flow, results). |
| flick-data.js | The Flick sample project data (features, defaults, decisions). |
| styles.css | The look and feel. |
| config.js | Where you paste Supabase keys and the admin login. |
| favicon.svg | The Greenlight mark. |
| supabase-schema.sql | One time database setup, with the Flick project seeded. |
| flick-mvp-spec.md | The written scope for the Flick project. |
| README.md | This file. |

## Open it in Cursor

1. Unzip the folder and open it in Cursor.
2. That is it. There is nothing to install to run it. To preview locally, use any
   static server, for example run `npx serve` in the folder, or just open
   index.html in a browser (local mode works without a server).

## Log in (first load)

The admin login is set in config.js:

    ADMIN_EMAIL: "cody@gmail.com"
    ADMIN_PASSWORD: "Welcome1!"

Type those on the sign in screen. Google sign in comes later. Important: this
login is checked in the browser, so treat it as a soft gate for speed, not real
security. The real lock down is Supabase Auth, which you add once you are past
speed to market.

## Deploy to Vercel

1. Go to vercel.com and log in.
2. New Project, then drag the whole folder into the upload area, or import it
   from a Git repo if you push it to GitHub from Cursor.
3. Framework preset: Other (it is a static site).
4. Deploy. You get a live URL like greenlight.vercel.app.

It runs right away in local mode for testing. For real sharing across people,
connect Supabase below and redeploy.

## Connect Supabase

You already have an account, so this is quick.

1. Create a new project in Supabase (free tier is fine).
2. Open SQL Editor, New query, paste all of supabase-schema.sql, and Run. This
   creates the two tables, the access policies, and seeds the Flick project.
   If your admin email is not cody@gmail.com, change the owner in the seed line
   near the bottom of the SQL so the project shows up under your account.
3. Project Settings, then API. Copy the Project URL and the anon public key
   (labeled anon, never the service_role key).
4. Open config.js and paste both values:

       SUPABASE_URL: "https://yourproject.supabase.co",
       SUPABASE_ANON_KEY: "your anon key",

5. Redeploy to Vercel.

The tag in the bottom right corner shows a hollow circle for local mode and a
filled circle once Supabase is connected.

## The flow end to end

1. You sign in and land on Projects. Flick is already there.
2. Click Copy on the Flick card to grab the share link, or Preview to see exactly
   what the team sees.
3. Send the link. Each person enters their email, fills it out, adds notes, and
   submits.
4. Click View results on the card to see decision tallies, the strongest MVP
   consensus, every category, the notes people left, and who responded. You can
   also read the raw rows in Supabase under pb_responses.
5. To add another prospect, click New, paste their feature list as a CSV or plain
   text, preview, and create. You get a fresh share link.

## Where the data lives

pb_projects: one row per project (id, owner email, title, full content as JSON).

pb_responses: one row per person per project (email, decision answers, the MVP,
Soon, or Later pick per feature, and free text notes). A unique constraint on
project plus email means a person can return with the same email and update
rather than create a duplicate.

The app touches the database through a few functions near the top of app.js
(getProjects, getProject, createProject, saveResponse, getResponses). That is the
only place to change for different behavior.

## Notes for whoever builds on this next

* Security. Both the admin login and the database policies are open for speed.
  The anon key is meant to be public and is safe in the frontend, but the open
  policies mean anyone with a link can read and write. That is acceptable for
  early client polling. The proper next step is Supabase Auth with Google, then
  scoping the results tables behind the signed in user.
* Never put the service_role key in config.js or anywhere in the frontend.
* Editing the seeded Flick project: it lives in three places that match on purpose,
  flick-data.js (used in local mode via app.js), the seed line in the SQL (used in
  Supabase mode), and flick-mvp-spec.md (the human readable scope). Update all three
  if you change it, or just recreate it from the builder.
* Flick features include default MVP/Soon/Later tags from the written scope. Respondents
  start from those tags and can override. Results show where the team diverges from
  the starting position and export a locked MVP list.
