# CC Studio Mobile

Shared React Native mobile client for the `cc-studio` monorepo.

It pairs with both desktop apps:

- `claude-studio`
- `codex-studio`

The mobile app is provider-neutral. It speaks the shared `studio:*` remote-control protocol, stores pairing state under `cc-studio`, and can parse session payloads from both desktop providers.

## Run Locally

```bash
cd mobile
npm install
npm start
```

In a second terminal:

```bash
npm run ios
# or
npm run android
```

## Pairing Flow

1. Open either desktop app.
2. Go to `Settings -> Remote Control`.
3. Generate a pairing QR code.
4. Scan it with `CC Studio` mobile.

The pairing is end-to-end encrypted. The relay server never sees plaintext remote commands or streaming output.

## Notes

- iOS native project name: `CCStudioMobile`
- Android package name: `com.ccstudiomobile`
- Shared E2EE domain: `cc-studio-e2ee`
