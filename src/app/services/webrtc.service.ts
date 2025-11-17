import { Injectable } from "@angular/core";
import { VoiceMessageWithOpenAIService } from "./VoiceMessageWithOpenAI.service";
import { VoiceMessageWithOpenAIModel } from "../models/VoiceMessageWithOpenAI.model";

type Mode = "voice" | "chat";

@Injectable({ providedIn: "root" })
export class WebRTCService {
  private _voiceMessageWithOpenAIService: VoiceMessageWithOpenAIService;

  public _userCompanyId = 0;
  public _userId = 0;
  public _initiatorId = 0;
  public _initiatorName = "";

  private _rtcPeerConnection!: RTCPeerConnection;
  private _mediaStream!: MediaStream;
  private _dataChannel!: RTCDataChannel;
  private _audioEl!: HTMLAudioElement;

  private _mode: Mode = "voice";
  private _ephemeralKey = "";
  private _model = "gpt-4o-realtime-preview-2024-12-17";

  constructor(voiceMessageWithOpenAIService: VoiceMessageWithOpenAIService) {
    this._voiceMessageWithOpenAIService = voiceMessageWithOpenAIService;
  }

  private readonly GPT_INSTRUCTIONS = `You are a UK Financial Adviser in the UK focusing on Mortgages and protection product.
- Your name is Melodie.
- Your company name Finance Magic™ which is a trading style of Ever North Limited, who are authorised and regulated by the FCA. Our FCA reference number is 800196.
- You are a financial adviser of Ever North Limited.
- You should have knowledge about Residential Mortgage/ Remortgage, Buy to let mortgage/ remortgage, Commercial Loans, Bridging Loan, First time buyer mortgage, Life Insurance, decreasing term life insurance (commonly known as mortgage protection insurance), Income protection insurance, relevant life, whole of life, Building & contents insurance, accident cover insurance. For mortgage sourcing products guide the customer to our sourcing tool.
- Please make sure to respond with a helpful voice via audio
- Be kind, helpful, and courteous
- It is okay to ask the user questions
- Be open to exploration and conversation
- Keep your answers short.
- when you are asked the question "how you are built? what program are you built on", you answer - "I am built by fantastic engineers of Mortgage Magic team with collaboration of other tremendously talented engineers."

Personality:
- Be upbeat and genuine`;

  private readonly MORTGAGE_TOOLS = [
    {
      type: "function",
      name: "source_mortgage_products",
      description:
        "Help users fill in parameters for a mortgage product and fetch recommendations based on the completed input. When recommending product include the lender name. After presenting the first product, ask the user: 'Would you like to proceed with this product or would you like to see another product?' If the user agrees to see another product, call this tool again to load and recommend the next product. After presenting the second product, ask the user only these two questions: 'Would you like to proceed with this product or would you like to navigate to a screen that contains a list of products for you to choose from?' If the user chooses to navigate, call the handle_mortgage_sourcing_navigation tool. If the user agrees to proceed/apply, call the apply_mortgage_product tool, passing the full product object.",
      parameters: {
        type: "object",
        properties: {
          propertyValuationAmount: {
            type: "number",
            description: "The valuation of the property",
          },
          loanAmount: {
            type: "number",
            description: "The amount the user wants to borrow.",
          },
          mortgageType: {
            type: "string",
            description:
              "The type of mortgage the user wants to apply for. Defaults to Residential Mortgage if not specified.",
            enum: [
              "Residential Mortgage",
              "Buy To Let Mortgage",
              "Residential Remortgage",
              "Buy To Let Remortgage",
              "Commercial",
            ],
          },
        },
        required: ["propertyValuationAmount", "loanAmount"],
      },
    },
    {
      type: "function",
      name: "apply_mortgage_product",
      description:
        "Submit an application for the selected mortgage product using the provided product. Once the application is processed, respond exactly with the confirmation message provided in the function_call_output, including the caseId. Then, ask the user if they would like to navigate fact-find page.",
      parameters: {
        type: "object",
        properties: {
          product: {
            type: "object",
            description: "The complete mortgage product object to apply for.",
            properties: {
              id: {
                type: "integer",
                description: "The unique ID of the product.",
              },
              lenderId: {
                type: "integer",
                description: "The lender ID of the product.",
              },
              productType: {
                type: "string",
                description: "The type of product",
              },
            },
          },
        },
        required: ["product"],
      },
    },
    {
      type: "function",
      name: "handle_mortgage_sourcing_navigation",
      description:
        "Process the user's response to mortgage sourcing navigation prompt.",
      parameters: {
        type: "object",
        properties: {
          navigate: {
            type: "boolean",
            description:
              "True if the user agrees to navigate to list of mortgage product page, false otherwise.",
          },
        },
        required: ["navigate"],
      },
    },
    {
      type: "function",
      name: "handle_fact_find_navigation",
      description:
        "Process the user's response to proceed fact-find navigation prompt.",
      parameters: {
        type: "object",
        properties: {
          navigate: {
            type: "boolean",
            description:
              "True if the user agrees to navigate to fact-find page, false otherwise.",
          },
        },
        required: ["navigate"],
      },
    },
  ];

  /**
   * New: one initializer for both modes.
   * Voice: captures mic + enables audio+text.
   * Chat: no mic + text-only (you can still let server speak; we default to text).
   */
  async initRealtime(
    EPHEMERAL_KEY: string,
    userCompanyId: number,
    userId: number,
    initiatorId: number,
    initiatorName: string,
    mode: Mode = "voice",
    model: string = "gpt-4o-realtime-preview-2024-12-17"
  ): Promise<void> {
    this._ephemeralKey = EPHEMERAL_KEY;
    this._model = model;
    this._mode = mode;

    this._initiatorId = initiatorId;
    this._initiatorName = initiatorName;
    this._userCompanyId = userCompanyId;
    this._userId = userId;

    await this.connectRealtime();
  }

  /** Keep your old init() working: just call the new one in voice mode. */
  async init(
    EPHEMERAL_KEY: string,
    userCompanyId: number,
    userId: number,
    initiatorId: number,
    initiatorName: string
  ): Promise<void> {
    return this.initRealtime(
      EPHEMERAL_KEY,
      userCompanyId,
      userId,
      initiatorId,
      initiatorName,
      "voice",
      this._model
    );
  }

  private async connectRealtime(): Promise<void> {
    try {
      this._rtcPeerConnection = new RTCPeerConnection();
      console.log("Rtc", this._rtcPeerConnection);

      // ✅ 1. Create audio element for playback (no mic needed for this)
      this._audioEl = document.createElement("audio");
      this._audioEl.autoplay = true;

      this._rtcPeerConnection.ontrack = (event) => {
        if (event.streams[0]) {
          console.log("🔊 Received audio track from OpenAI");
          this._audioEl.srcObject = event.streams[0];
          if (!document.body.contains(this._audioEl)) {
            document.body.appendChild(this._audioEl);
            console.log("✅ Audio element added to DOM");
          }
        }
      };

      // ✅ 2. Try to get microphone, but don't fail if unavailable
      let hasRealMicrophone = false;
      try {
        this._mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        hasRealMicrophone = true;
        console.log("✅ Microphone access granted - voice mode available");
      } catch (micError: any) {
        // Microphone not available - create silent dummy track instead
        console.warn(
          `⚠️ No microphone available (${micError.name}) - chat mode only`
        );

        // Create a silent audio stream (required for WebRTC to work)
        const audioContext = new AudioContext();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0; // Silent
        const dest = audioContext.createMediaStreamDestination();

        oscillator.connect(gainNode);
        gainNode.connect(dest);
        oscillator.start();

        this._mediaStream = dest.stream;
        console.log(
          "✅ Created silent audio track - app will work in chat mode"
        );
      }

      // ✅ 3. Add audio tracks (real mic or silent) to peer connection
      this._mediaStream.getTracks().forEach((track) => {
        this._rtcPeerConnection.addTrack(track, this._mediaStream);
        console.log(
          hasRealMicrophone
            ? "➕ Added microphone track"
            : "➕ Added silent audio track"
        );
      });

      // ✅ 4. Create data channel
      this._dataChannel = await this._rtcPeerConnection.createDataChannel(
        "oai-events",
        { ordered: true }
      );
      console.log("✅ Data channel created");

      // ✅ 5. Setup data channel event handlers
      this._dataChannel.addEventListener("open", () => {
        console.log("📡 Data channel OPEN");
        this.sendSessionUpdateForMode();
      });

      this._dataChannel.addEventListener("message", (event) => {
        this.handleRealtimeEvent(event.data); // ✅ Use existing handler
      });

      // ✅ 6. Create and send SDP offer
      const offer = await this._rtcPeerConnection.createOffer();
      await this._rtcPeerConnection.setLocalDescription(offer);
      console.log("📤 SDP Offer created");

      // ✅ 7. Send offer to OpenAI
      const baseUrl = "https://api.openai.com/v1/realtime";
      const model = this._model;
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${this._ephemeralKey}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        throw new Error(
          `SDP exchange failed: ${sdpResponse.statusText} - ${errorText}`
        );
      }

      // ✅ 8. Set remote description
      const answerSdp = await sdpResponse.text();
      const answer: RTCSessionDescriptionInit = {
        type: "answer",
        sdp: answerSdp,
      };

      await this._rtcPeerConnection.setRemoteDescription(answer);
      console.log(
        "✅ WebRTC connection established" +
          (hasRealMicrophone ? " with microphone" : " (chat-only mode)")
      );
    } catch (error) {
      console.error("❌ Error during Realtime init:", error);
      throw error;
    }
  }
  public sendDataChannelMessage(payload: any): void {
    if (!this._dataChannel || this._dataChannel.readyState !== "open") {
      console.error("❌ Data channel not ready to send message");
      return;
    }

    this._dataChannel.send(JSON.stringify(payload));
    console.log("📤 Sent data channel message:", payload.type);
  }
  /**
   * New: tell the Realtime session which mode we’re in.
   * voice  -> modalities: ["audio","text"], turn detection on
   * chat   -> modalities: ["text"], turn detection off
   */
  private sendSessionUpdateForMode() {
    if (!this._dataChannel || this._dataChannel.readyState !== "open") {
      console.warn("⚠️ Data channel not ready for session update");
      return;
    }

    if (this._mode === "voice") {
      this._dataChannel.send(
        JSON.stringify({
          type: "session.update",
          session: {
            modalities: ["audio", "text"],
            instructions: this.GPT_INSTRUCTIONS, // ✅ Added
            voice: "shimmer",
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            },
            input_audio_transcription: {
              model: "whisper-1",
            },
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
            tools: this.MORTGAGE_TOOLS, // ✅ Added
            tool_choice: "auto", // ✅ Added
          },
        })
      );
      console.log("📤 Sent VOICE session update with tools and instructions");
    } else {
      this._dataChannel.send(
        JSON.stringify({
          type: "session.update",
          session: {
            modalities: ["text"],
            instructions: this.GPT_INSTRUCTIONS, // ✅ Added
            turn_detection: null,
            tools: this.MORTGAGE_TOOLS, // ✅ Added for chat too
            tool_choice: "auto", // ✅ Added
          },
        })
      );
      console.log("📤 Sent CHAT session update with tools");
    }
  }

  /** New: send a text message over the Realtime connection (chat + voice). */
  public async sendText(message: string) {
    console.log(this._dataChannel);
    if (!this._dataChannel || this._dataChannel.readyState !== "open") return;

    // ✅ CORRECT: Create conversation item first
    this._dataChannel.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: message,
            },
          ],
        },
      })
    );

    // Then trigger response with explicit modalities based on current mode
    this._dataChannel.send(
      JSON.stringify({
        type: "response.create",
        response: {
          modalities: this._mode === "voice" ? ["audio", "text"] : ["text"],
        },
      })
    );
  }

  /** New: switch to CHAT without reconnecting — stop mic and update session. */
  /** Switch to CHAT - stop mic, stop audio, update session. */
  public async switchToChat() {
    if (this._mode === "chat") return;

    console.log("🔄 Switching to CHAT mode (non-destructive)...");
    this._mode = "chat";

    // Instead of tearing down tracks & renegotiation, simply disable mic capture.
    if (this._mediaStream) {
      this._mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = false; // keep track so we can re-enable quickly
        console.log("� Disabled local mic track (kept for rapid resume)");
      });
    }

    // Mute remote audio element but keep playback pipeline alive (avoids autoplay issues later).
    if (this._audioEl) {
      this._audioEl.muted = true; // do NOT pause; keep decoding active
      console.log("� Remote audio element muted (chat mode)");
    }

    // Cancel any ongoing response to avoid overlapping speech.
    if (this._dataChannel && this._dataChannel.readyState === "open") {
      this._dataChannel.send(JSON.stringify({ type: "response.cancel" }));
      console.log("❌ Cancelled ongoing voice response before chat switch");
    }

    // Optional: clear buffer only if actively recording previously.
    if (this._dataChannel && this._dataChannel.readyState === "open") {
      this._dataChannel.send(
        JSON.stringify({ type: "input_audio_buffer.clear" })
      );
      console.log("🧹 Cleared residual input audio buffer");
    }

    // Small delay just to let client-side state settle before session.update.
    await new Promise((r) => setTimeout(r, 60));
    this.sendSessionUpdateForMode();
    console.log("✅ Switched to CHAT mode (mic disabled, session updated)");
  }

  /** Switch to VOICE - capture mic and update session. */
  /** Switch to VOICE - capture mic and update session. */
  public async switchToVoice() {
    if (this._mode === "voice") return;
    console.log("🔄 Switching to VOICE mode (re-enable mic)...");
    this._mode = "voice";

    try {
      // Re-enable existing mic track if we preserved it; otherwise capture anew.
      let needNewStream = true;
      if (this._mediaStream) {
        const audioTracks = this._mediaStream.getAudioTracks();
        if (audioTracks.length) {
          audioTracks.forEach((t) => {
            if (t.readyState === "live") {
              t.enabled = true;
              console.log("✅ Re-enabled preserved mic track");
              needNewStream = false;
            }
          });
        }
      }

      if (needNewStream) {
        console.log("🎤 No preserved mic track, acquiring new stream...");
        this._mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        this._mediaStream.getAudioTracks().forEach((track) => {
          this._rtcPeerConnection.addTrack(track, this._mediaStream);
          console.log("➕ Added newly captured mic track to peer connection");
        });
      }

      // Ensure remote audio element is unmuted & attempts playback upon data arrival.
      if (this._audioEl) {
        this._audioEl.muted = false;
        const attemptPlay = () => {
          this._audioEl
            .play()
            .then(() => console.log("🔊 Remote audio playing"))
            .catch((e) => console.warn("⚠️ play() deferred until data", e));
        };
        this._audioEl.addEventListener("canplay", attemptPlay, { once: true });
        // fire an immediate attempt too (may succeed if buffered already)
        attemptPlay();
      }

      // Send session update to restore audio+text modalities & VAD.
      await new Promise((r) => setTimeout(r, 80));
      this.sendSessionUpdateForMode();
      console.log("✅ Switched to VOICE mode (session updated)");
    } catch (error) {
      console.error("❌ Error re-enabling voice mode:", error);
      // Fallback: attempt full reconnect (may lose prior short-term state)
      try {
        console.log("♻️ Attempting full reconnect as fallback...");
        await this.connectRealtime();
        this.sendSessionUpdateForMode();
        console.log("✅ Fallback reconnect successful");
      } catch (e) {
        console.error("❌ Fallback reconnect failed", e);
      }
      throw error;
    }
  }

  /** Your existing close logic, unchanged */
  public closeRTCPeerConnection() {
    if (this._rtcPeerConnection != null) {
      this._rtcPeerConnection.close();
      this._rtcPeerConnection.ontrack = null;
      this._rtcPeerConnection.onicecandidate = null;
      this._rtcPeerConnection.oniceconnectionstatechange = null;
      this._rtcPeerConnection.onsignalingstatechange = null;
    }
    if (this._mediaStream != null) {
      const tracks = this._mediaStream.getTracks();
      if (tracks != null) tracks.forEach((track) => track.stop());
    }
    if (this._audioEl && this._audioEl.parentElement) {
      this._audioEl.pause();
      this._audioEl.srcObject = null;
      this._audioEl.parentElement.removeChild(this._audioEl);
    }
  }

  closeWebRTCConnection() {
    this.closeRTCPeerConnection();
  }

  /** Handle Realtime server events (keeps your post logic) */
  private handleRealtimeEvent(raw: string) {
    try {
      console.log("Received Realtime event:", raw);
      const objData = JSON.parse(raw);
      window.postMessage(raw, "*");
      if (objData.type === "response.done") {
        // assistant final text
        this.postVoiceMessageWithOpenAIModel(objData, true);
      } else if (objData.type === "response.content_part.added") {
        // user partial transcript (if in voice/VAD mode)
        this.postVoiceMessageWithOpenAIModel(objData, false);
      }

      // You can also handle "response.audio.delta" if you want to intercept audio chunks.
    } catch (e) {
      // ignore parse errors
    }
  }

  // ----------------------------
  // Your original persistence code (unchanged)
  // ----------------------------
  public postVoiceMessageWithOpenAIModel(data: any, isAnswerByAI: boolean) {
    let responseId = "";
    let responseStatus = "";
    let responseAnswerId = "";
    let responseAnswerRole = "";
    let responseAnswerStatus = "";
    let responseAnswerContent = "";
    let responseAnswerType = "";
    let remarks = "";
    let initiatorName = "";

    if (isAnswerByAI) {
      const outputdata = data["response"]?.["output"]?.[0];
      if (
        outputdata?.["type"] === "message" &&
        outputdata?.["role"] === "assistant"
      ) {
        const content = outputdata["content"] as Array<any>;
        const msg = content?.[0]?.["transcript"] ?? "";

        isAnswerByAI = true;
        responseId = data["event_id"];
        responseAnswerId = data["response"]?.["id"];
        responseAnswerContent = msg;
        responseAnswerStatus = outputdata["status"];
        responseAnswerRole = outputdata["role"];
        responseAnswerType = content?.[0]?.["type"] ?? "text";
        initiatorName = "Melodie";
      }
    } else {
      if (data["type"] === "response.content_part.added") {
        const content1 = data["part"];
        const msg = content1?.["transcript"] ?? "";
        isAnswerByAI = false;
        responseId = data["event_id"];
        responseAnswerId = data["response_id"];
        responseAnswerContent = msg;
        responseAnswerStatus = "Completed";
        responseAnswerRole = "User";
        responseAnswerType =
          (Array.isArray(content1)
            ? content1[0]?.["type"]
            : content1?.["type"]) ?? "text";
        initiatorName = this._initiatorName;
      }
    }

    const voiceMessageWithOpenAIEntityModel = {
      initiatorId: this._initiatorId,
      userCompanyId: this._userCompanyId,
      userId: this._userId,
      initiatorName: initiatorName,
      isAnswerByAI: isAnswerByAI,
      responseId: responseId,
      responseStatus: responseStatus,
      responseAnswerId: responseAnswerId,
      responseAnswerRole: responseAnswerRole,
      responseAnswerStatus: responseAnswerStatus,
      responseAnswerContent: responseAnswerContent,
      responseAnswerType: responseAnswerType,
      remarks: remarks,
    } as VoiceMessageWithOpenAIModel;

    console.log(JSON.stringify(voiceMessageWithOpenAIEntityModel));

    this._voiceMessageWithOpenAIService
      .postVoiceMessageWithOpenAIWithMMServer(voiceMessageWithOpenAIEntityModel)
      .subscribe({
        next: (responseData) => console.log(responseData),
        error: (response) => {
          console.log(response);
          console.log(response.error);
        },
      });
  }

  /** Starts sending mic audio (interrupts AI if speaking) */
  public startRecording(): void {
    if (!this._dataChannel || this._dataChannel.readyState !== "open") {
      console.warn("Data channel not ready to start recording");
      return;
    }

    console.log("🎤 Starting recording - interrupting AI...");

    // ✅ 1. Cancel any ongoing AI response
    this._dataChannel.send(JSON.stringify({ type: "response.cancel" }));
    console.log("❌ Cancelled ongoing AI response");

    // ✅ 2. Stop audio playback immediately
    if (this._audioEl) {
      this._audioEl.pause();
      this._audioEl.currentTime = 0;
      // Don't mute! Just pause
      console.log("🔇 Audio playback paused");
    }

    // ✅ 3. Clear audio buffer
    this._dataChannel.send(
      JSON.stringify({ type: "input_audio_buffer.clear" })
    );
    console.log("🧹 Audio buffer cleared");
  }

  /** Stops sending mic audio (commits buffer, triggers response) */
  public stopRecording(): void {
    if (!this._dataChannel || this._dataChannel.readyState !== "open") {
      console.warn("Data channel not ready to stop recording");
      return;
    }

    console.log("🛑 Stopping recording...");

    // ✅ 1. Ensure audio is ready to play next response
    if (this._audioEl) {
      this._audioEl.muted = false; // Unmute before creating response
      console.log("🔊 Audio unmuted and ready");
    }

    // ✅ 2. Commit buffer
    this._dataChannel.send(
      JSON.stringify({ type: "input_audio_buffer.commit" })
    );
    console.log("✅ Audio buffer committed");

    // ✅ 3. Trigger response (with small delay to ensure audio is ready)
    setTimeout(() => {
      if (this._dataChannel && this._dataChannel.readyState === "open") {
        this._dataChannel.send(JSON.stringify({ type: "response.create" }));
        console.log("🤖 Response creation triggered");
      }
    }, 50);
  }
}

/**** Example how to use this code */
// Start in voice mode (uses EPHEMERAL_KEY)
// await webRTCService.initRealtime(EPHEMERAL_KEY, companyId, userId, initiatorId, initiatorName, 'voice');

// // Switch to chat (same connection + same EPHEMERAL_KEY; no mic)
// await webRTCService.switchToChat();

// // Send a text message in chat mode (or in voice mode if you want TTS reply from the model)
// await webRTCService.sendText("Hello in text mode!");

// // Switch back to voice (re-captures mic, updates session to audio+text)
// await webRTCService.switchToVoice();
