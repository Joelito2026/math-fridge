# Math Fridge frontend tests

Tests live outside `app/` so Expo Router never mistakes them for routes.

## Commands

- `npm test` runs the complete suite once.
- `npm run test:watch` reruns affected tests while developing.
- `npm run test:coverage` writes a coverage report to `coverage/`.

## Test philosophy

A negative test should still pass. It passes by proving that Math Fridge safely
rejects or falls back from invalid input, unsupported conversions, missing data,
and other error conditions. Do not commit intentionally failing tests to the
main suite; a red suite should indicate a regression that needs attention.

Current coverage includes:

- `tests/unit/`: recipe scaling, conversions, and legacy ingredient normalization.
- `tests/integration/`: authenticated API request contracts and signed-out fallbacks.
- `tests/security/`: Google OAuth callback integrity, token/session validation, duplicate callbacks, and cancelled sign-in handling.

Future folders can add:

- `tests/integration/` for API and authenticated recipe workflows.
- `tests/components/` for React Native interaction and accessibility tests.
- `e2e/` for device-level Maestro flows across Android and iOS.
