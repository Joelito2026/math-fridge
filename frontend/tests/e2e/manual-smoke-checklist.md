# Manual end-to-end smoke checklist

Run this checklist before a release on Android, iOS, and web. Record the date,
platform, device/browser, and result for each run.

## Expected-success flows

- [ ] Sign in with email/password and Google.
- [ ] Create a private recipe with ingredients, instructions, categories, and dietary tags.
- [ ] Add, replace, and remove a locally uploaded recipe image.
- [ ] Return Home and confirm the new recipe appears without restarting.
- [ ] Edit the recipe and confirm the updated data appears immediately.
- [ ] Change Target Yield and confirm every ingredient scales from the saved base quantities.
- [ ] Override one ingredient and confirm linked ingredients follow the atomic ratio.
- [ ] Publish the recipe and find it in Community and its category/cuisine pages.
- [ ] Apply dietary filters and confirm the Community results update correctly.
- [ ] Bookmark a public recipe and find it in Bookmarks.
- [ ] Start Cooking Mode, move between steps, check off ingredients, and use a timer.
- [ ] Delete a Vault recipe and confirm it disappears after returning Home.
- [ ] Toggle light/dark/system themes and every text-size option.
- [ ] Open both drawers and confirm notch, home-indicator, scrolling, and close controls are safe.
- [ ] Confirm one, two, or three recipe cards appear per row as screen width changes.

## Expected-failure and recovery flows

These checks pass when the app shows a useful error or safe fallback without
crashing, corrupting data, or leaving navigation stuck.

- [ ] Submit an invalid sign-in and confirm authentication feedback appears.
- [ ] Disconnect the backend and confirm recipe screens show a recoverable network state.
- [ ] Attempt to upload an unsupported or empty image and confirm it is rejected safely.
- [ ] Cancel recipe deletion and confirm the recipe remains.
- [ ] Open a missing/deleted recipe link and confirm a safe unavailable state appears.
- [ ] Attempt an owner-only edit while signed out and confirm access is denied.
- [ ] Deny notification permission and confirm Cooking Mode and its in-app timer still work.
- [ ] Use Android Expo Go and confirm unsupported notification features do not crash startup.
- [ ] Set Extra Large text on a narrow phone and confirm controls wrap or scroll instead of leaving the screen.
- [ ] Use the system Back action at a route root and confirm it falls back to Home without a warning.

## Release record

| Date | Platform/device | App build | Tester | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| | | | | | |
