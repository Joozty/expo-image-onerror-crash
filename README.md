# expo-image: `onLoadFailed` crash on Android

A minimal reproduction of a fatal Android crash in `expo-image`:

```
com.bumptech.glide.load.engine.CallbackException: Unexpected exception thrown by non-Glide code
Caused by java.lang.IllegalStateException: You can't start or clear loads in RequestListener or Target callbacks.
  ...
  at expo.modules.image.ExpoImageViewWrapper.onSizeChanged
  ...
  at com.swmansion.reanimated.NodesManager.onEventDispatch
  at com.facebook.react.uimanager.events.FabricEventDispatcher.dispatchEvent
  ...
  at expo.modules.image.events.GlideRequestListener.onLoadFailed
```

The full log is in [`crash.txt`](crash.txt).

This is the `onError` counterpart of the `onLoad` crash fixed in expo/expo#40212.
That PR posts the `onLoad` emit to the main queue.
`onLoadFailed` still emits `onError` synchronously, inside Glide's callback.

## What the app does

`App.js` is a single screen, based on the parallax-header snack from expo/expo#39904:

- An `expo-image` `Image` fills a header whose height is animated by Reanimated from the scroll offset.
- The image source always fails to load. A missing local file fails instantly and needs no network. Any failing source works, such as a 404 URL or being offline.
- `contentFit` is `cover`, and `placeholder` and `allowDownscaling` are left at their defaults.

## Steps to reproduce

1. `npm install`
2. Start the app on Android in either way:
   - **Expo Go 57 (no native build):** `npx expo start`, then press `a`. Expo Go catches the exception and shows it as a red error screen.
   - **Release build:** `npx expo run:android --variant release`. The app crashes.
3. Fling the list up and down quickly a few times. A fling is a fast swipe released while still moving, so the list keeps scrolling.

On an emulator you can fling with adb instead:

```sh
for i in $(seq 1 20); do
  adb shell input swipe 540 2100 540 600 30; sleep 0.25
  adb shell input swipe 540 600 540 2100 30; sleep 0.25
done
```

**Expected:** the header shrinks and grows, and the image reports `onError`.

**Actual:** the app crashes with the exception above.

## Results

Tested on an arm64 Android 17 emulator. Each run starts the app fresh and does up to 60 rounds of the flings above.

| Build | Runs that failed | When |
| --- | --- | --- |
| Release, expo-image 57.0.5 unchanged | 5 of 5 crashed | 4 runs on the first fling, 1 run on the 6th |
| Release, with the fix below | 0 of 5 | none, after 39–114 failed-load retries per run |
| Expo Go 57.0.9 | 3 of 3 showed the error screen | within 1 or 2 flings |

The same crash, with the same line numbers, happens in production on a Redmi 13 with Android 16.

## Why a fling

A fling scrolls the list during Android's draw pass, so Reanimated defers the header's height change until the next frame. If an image load fails before that frame, the `onError` event makes Reanimated apply the deferred change right away, while Glide is still inside `onLoadFailed`. The resize makes `ExpoImageViewWrapper` restart the failed request, and Glide throws. Each header resize also restarts the failed load, so failures keep arriving while you fling.

Reanimated is needed because it applies pending UI changes synchronously when an event is dispatched. Without it, the `onError` emit only queues an event for JS.

## Fix

Emit `onError` the way #40212 emits `onLoad`, in `GlideRequestListener.onLoadFailed`:

```kotlin
val imageWrapper = expoImageViewWrapper.get()
if (imageWrapper != null) {
  imageWrapper.appContext.mainQueue.launch {
    imageWrapper.onError.invoke(ImageErrorEvent(errorMessage))
  }
}
```

To try the fix in this repro, edit `node_modules/expo-image/android/src/main/java/expo/modules/image/events/GlideRequestListener.kt`. expo-image ships precompiled for Android, so edits to its sources are ignored until you make it build from source. Add this to `package.json`:

```json
"expo": {
  "autolinking": {
    "buildFromSource": ["expo-image"]
  }
}
```

## Versions

- expo 57.0.24
- expo-image 57.0.5
- react-native 0.86.3 (New Architecture)
- react-native-reanimated 4.5.1
- react-native-worklets 0.10.1
