<script>
  import { onMount, onDestroy } from "svelte";

  export let url = "";
  export let type = "go2rtc"; // 'go2rtc' | 'camera-streamer'
  export let transformStyle = "";
  export let onPlay = () => {};
  export let onError = () => {};

  let videoElement;
  let peerConnection = null;
  let isConnecting = false;

  async function startStream() {
    if (!url || isConnecting) return;

    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    isConnecting = true;

    try {
      peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      peerConnection.ontrack = (event) => {
        if (videoElement) {
          videoElement.srcObject = event.streams[0];
          onPlay();
        }
      };

      // Add transceiver to receive video
      peerConnection.addTransceiver("video", { direction: "recvonly" });

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // Wait for ICE gathering to complete before sending offer
      await new Promise((resolve) => {
        if (peerConnection.iceGatheringState === "complete") {
          resolve();
        } else {
          const checkState = () => {
            if (peerConnection.iceGatheringState === "complete") {
              peerConnection.removeEventListener(
                "icegatheringstatechange",
                checkState
              );
              resolve();
            }
          };
          peerConnection.addEventListener("icegatheringstatechange", checkState);
        }
      });

      const processedUrl = url;
      let response;

      if (type === "camera-streamer") {
        // camera-streamer expects sdp to be form-urlencoded
        const body = new URLSearchParams({ sdp: peerConnection.localDescription.sdp });
        response = await fetch(processedUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body,
        });
      } else {
        // go2rtc defaults (and others) often expect raw body or handle specific content types
        // Simple raw SDP POST is common for go2rtc http signaling
        response = await fetch(processedUrl, {
          method: "POST",
          body: peerConnection.localDescription.sdp,
        });
      }

      if (!response.ok) {
        throw new Error(`Signaling failed: ${response.status} ${response.statusText}`);
      }

      const answerSdp = await response.text();
      // Ensure we have a valid SDP type, assuming answer if just SDP string
      const answer = {
          type: "answer",
          sdp: answerSdp
      };

      await peerConnection.setRemoteDescription(answer);

    } catch (err) {
      console.error("WebRTC Connection Error:", err);
      onError(err);
    } finally {
      isConnecting = false;
    }
  }

  function stopStream() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (videoElement) {
        videoElement.srcObject = null;
    }
    isConnecting = false;
  }

  // Restart stream when URL or Type changes
  $: if (url && type) {
    stopStream();
    startStream();
  }

  onDestroy(() => {
    stopStream();
  });
</script>

<div class="webrtc-container">
  <!-- svelte-ignore a11y-media-has-caption -->
  <video
    bind:this={videoElement}
    on:loadedmetadata={() => videoElement?.play()}
    muted
    playsinline
    autoplay
    style="transform: {transformStyle};"
  ></video>
</div>

<style>
  .webrtc-container {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  
  video {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
</style>
