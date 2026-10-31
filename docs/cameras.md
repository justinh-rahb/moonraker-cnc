# Camera pages (iframe)

In **Settings → Cameras**, choose **HTML page (iframe)** as the stream type and enter the URL of an embeddable HTML camera-player page. Relative iframe URLs such as `/webcam/player` or `/screen` use the selected printer's web host (port 80/443 for a standard Moonraker endpoint), so pages outside the frontend's webcam proxy still resolve correctly. MJPEG streams retain the existing same-host camera proxy behavior. Absolute HTTP(S) URLs are supported.

**Add from Moonraker** reads the connected printer's webcam definitions, including `service: iframe`, and adds supported cameras that are not already present. Existing cameras and local preferences are preserved. Enabled state, URLs, aspect ratio, rotation and flips are carried over; imported custom aspect ratios remain selectable. Repeating the import does not create duplicates. Import changes Retrograde's existing per-printer preferences, not Moonraker's webcam definitions.

The iframe uses the existing camera selector, aspect ratio, flip/rotation and optional scanlines. Snapshot and FPS controls are hidden for this type because the embedded player manages playback. URLs, type and preferences use the existing per-host cache, settings import/export and Moonraker synchronization.

The embedded browsing context is created only while the camera panel is expanded, in view and the page is visible. Collapse, scrolling off-screen, hiding the tab, changing cameras or switching hosts removes it, releasing the embedded player's resources. Returning recreates the player. The MJPEG worker and WebRTC players retain their existing behavior.

The page's server must permit embedding through its CSP `frame-ancestors` / `X-Frame-Options` policy, and browsers may block HTTP content inside an HTTPS frontend. Retrograde cannot override those browser policies. Use the player page URL, rather than a raw RTSP URL or an image snapshot.

The service follows the [Moonraker webcam configuration conventions](https://moonraker.readthedocs.io/en/stable/configuration/#webcam) and [Fluidd's iframe camera implementation](https://github.com/fluidd-core/fluidd/blob/738ff932030588adb65684f49be4db893ad03216/src/components/widgets/camera/services/IframeCamera.vue).
