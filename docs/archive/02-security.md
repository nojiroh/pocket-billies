# Phase 02 - Security

## Goal
Tighten Firebase rules and client-side risks, and make saves versioned.

## Verify first
- The Firestore rules (in the README) let any signed-in user read all /users and /codes documents.
- The Firebase web config is committed. That is normal, but check API-key restrictions.
- The Studio keeps the GitHub token in localStorage when "keep me signed in" is ticked (sessionStorage otherwise).
- ~57 innerHTML uses in game code.

## Tasks
1. Tighten the Firestore rules so friend lookup works by code only. Test the rules.
2. Recommend restricting the API key by domain, and say whether App Check is worth adding.
3. Assess a GitHub device-flow login or session-only token storage for the Studio.
4. Review every innerHTML use, especially anything that renders saves, friend names or imported data. Fix the unsafe ones now (the full UI rework is phase 06).
5. Add a `saveVersion` field to saves. Old saves (local and cloud) are rejected with a clear "this save is from an older version" message instead of crashing.
6. Design the friend data so phase 18 (trading and battles for Billies, robots and parts) is not blocked: who can read what, who can write what.

## Ask me before
Changing the Studio login method; wiping existing cloud data.

## Done when
Rules tested, saveVersion enforced, innerHTML review written up, tag `phase-02-done`.

## First reply
Same four items as phase 01.
