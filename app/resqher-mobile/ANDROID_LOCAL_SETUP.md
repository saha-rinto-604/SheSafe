# Android Local Setup

Use this when `npx.cmd expo run:android --device` cannot find the Android SDK or a connected Android device.

## Configure the Local SDK Path

The generated `android` folder is ignored by git. Create `android/local.properties` with the SDK path for this machine:

```properties
sdk.dir=C:/Users/rinto/AppData/Local/Android/Sdk
```

Keep `android/local.properties` local. Do not commit it.

## Check ADB

From `app/resqher-mobile`, run:

```powershell
npm run android:check
```

The helper script looks for ADB in:

```text
$env:ANDROID_HOME\platform-tools\adb.exe
$env:ANDROID_SDK_ROOT\platform-tools\adb.exe
$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe
```

If ADB exists but `adb` is not recognized, add this folder to your Windows PATH:

```text
C:\Users\rinto\AppData\Local\Android\Sdk\platform-tools
```

Optionally set these Windows User Environment Variables manually:

```text
ANDROID_HOME=C:\Users\rinto\AppData\Local\Android\Sdk
ANDROID_SDK_ROOT=C:\Users\rinto\AppData\Local\Android\Sdk
```

Restart PowerShell and VS Code after changing environment variables or PATH, then run:

```powershell
adb devices
```

## Install Platform-Tools

If ADB is missing:

1. Install Android Studio.
2. Open Android Studio.
3. Open SDK Manager.
4. Go to SDK Tools.
5. Install Android SDK Platform-Tools.
6. Optionally install Google USB Driver on Windows.
7. Add Platform-Tools to PATH.
8. Restart PowerShell.
9. Run `adb devices`.

## Physical Phone Checklist

1. Enable Developer options.
2. Enable USB debugging.
3. Connect the phone via USB.
4. Select File Transfer / MTP.
5. Accept the "Allow USB debugging?" popup.
6. If the device shows `unauthorized`, unlock the phone and accept the popup.
7. If no popup appears, revoke USB debugging authorizations and reconnect.
8. Try another cable or USB port if needed.

Use only a target shown by `adb devices` with status `device`. Do not select targets shown as `unauthorized` or `offline`.

For `unauthorized`, unlock the phone and accept "Allow USB debugging". If the prompt does not appear, revoke USB debugging authorizations on the phone and reconnect.

For `offline`, restart the adb server, reconnect the cable, keep the phone unlocked, and check again:

```powershell
adb kill-server
adb start-server
adb devices
```

## Emulator Checklist

1. Open Android Studio.
2. Open Device Manager.
3. Create or start an Android emulator.
4. Run:

```powershell
npx.cmd expo run:android
```

Use `npm run android:check` any time you want to confirm whether the local Android target is visible before running Expo.
