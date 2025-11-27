import {
  Component,
  OnInit,
  OnDestroy,
  NgZone,
  ChangeDetectorRef,
  Inject,
  PLATFORM_ID,
} from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ChatMessage } from "../models/chat-message.model";
import { WebRTCService } from "../services/webrtc.service";
import { OpenAIAuthenticationService } from "../services/openaiaithentication.service";
import {
  CaseService,
  MortgageApplicationParams,
} from "../services/case.service";
import { ActivatedRoute, Router } from "@angular/router";
import { OpenAIAuthenticationRequestModel } from "../models/OpenAIAuthenticationRequestModel.model";

export enum ConversationMode {
  VOICE = "voice",
  CHAT = "chat",
}

@Component({
  selector: "app-unified-conversation",
  templateUrl: "./unified-conversation.component.html",
  styleUrls: ["./unified-conversation.component.css"],
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [],
})
export class UnifiedConversationComponent implements OnInit, OnDestroy {
  private isBrowser: boolean;

  public ConversationMode = ConversationMode;
  public currentMode: ConversationMode = ConversationMode.VOICE;
  public isInitialized: boolean = false;
  public initError: string | null = null;

  public newMessage: string = "";
  public messages: ChatMessage[] = [];
  public isTyping: boolean = false;

  public statusText: string = "Click to speak";
  public isListening: boolean = false;

  private EPHEMERAL_KEY = "";
  private readonly COMPANY_ID = 1;
  private readonly USER_ID = 2;
  private readonly INITIATOR_ID = 3;
  private readonly INITIATOR_NAME = "User";
  private readonly MODEL = "gpt-4o-realtime-preview-2024-12-17";

  title = "Ever north Ltd";
  public _userCompanyId: number = 0;
  public _userId: number = 0;
  public _initiatorId: number = 0;
  public _initiatorName: string = "";
  private productPage = 0;

  // Storage for mortgage application parameters
  private mortgageApplyParams: any = {};
  private caseDetailsParams: any = {
    Deposit: 0,
    AnnualIncome: 0,
    OutstandingBalance: 0,
    RentalIncome: 0,
    gDV: 0,
  };

  // Buffer map for accumulating streaming text chunks in chat mode
  private responseTextBuffers: { [responseId: string]: string } = {};

  private messageHandler = (event: MessageEvent) => {
    if (event.data && typeof event.data === "string") {
      try {
        const objData = JSON.parse(event.data);

        this.ngZone.run(() => {
          if (objData.type === "response.done") {
            const output = objData.response?.output?.[0];

            console.log("📦 Response output type:", output?.type);

            // ✅ Handle function call
            if (output?.type === "function_call") {
              console.log("🎉🎉🎉 AI CALLED A FUNCTION! 🎉🎉🎉");
              console.log("  - Function name:", output.name);
              console.log("  - Arguments:", output.arguments);
              console.log("  - Call ID:", output.call_id);

              const functionName = output.name;
              const argumentsStr = output.arguments;
              const callId = output.call_id;

              if (functionName && argumentsStr && callId) {
                this.handleFunctionCall(functionName, argumentsStr, callId);
              }
            }

            // Handle regular message
            else if (
              output?.type === "message" &&
              output?.role === "assistant"
            ) {
              const content = output.content as Array<any>;
              let aiText = content?.[0]?.text || content?.[0]?.transcript;

              if (aiText && aiText.trim() !== "") {
                console.log("💬 AI said:", aiText);
                this.isTyping = false;
                this.messages.push({
                  text: aiText,
                  sender: "bot",
                  timestamp: new Date(),
                });
              }
            }
          }

          // Handle user transcript
          else if (
            objData.type ===
            "conversation.item.input_audio_transcription.completed"
          ) {
            const userText = objData.transcript;
            if (userText) {
              console.log("🎤 User said:", userText);
              this.messages.push({
                text: userText,
                sender: "user",
                timestamp: new Date(),
              });
            }
          }
        });
      } catch (e) {
        // Not JSON
      }
    }
  };

  // ✅ NEW: Handle function calls
  private handleFunctionCall(
    functionName: string,
    argumentsStr: string,
    callId: string
  ): void {
    try {
      const args = JSON.parse(argumentsStr);
      console.log(`🔧 Handling function: ${functionName}`, args);

      switch (functionName) {
        case "source_mortgage_products":
          this.sourceMortgageProducts(args, callId);
          break;

        // case "apply_mortgage_product":
        //   this.applyMortgageProduct(args, callId);
        //   break;

        // case "handle_mortgage_sourcing_navigation":
        //   this.handleMortgageSourcingNavigation(args.navigate, callId);
        //   break;

        // case "handle_fact_find_navigation":
        //   this.handleFactFindNavigation(args.navigate, callId);
        //   break;

        default:
          console.warn(`Unknown function: ${functionName}`);
          this.submitFunctionOutput(
            callId,
            `Error: Function ${functionName} not found`
          );
      }
    } catch (error) {
      console.error("Error in handleFunctionCall:", error);

      // ✅ FIX: Type guard for error
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      this.submitFunctionOutput(
        callId,
        `Error processing request: ${errorMessage}`
      );
    }
  }

  // ✅ FIXED: Accept parsed args object
  private sourceMortgageProducts(args: any, callId: string): void {
    try {
      console.log("🔍 sourceMortgageProducts called with:", args);

      const loanAmount = args.loanAmount || 0;
      const propertyValue = args.propertyValuationAmount || 0;
      const caseTypeId = args.caseTypeId || 1;
      const caseTypeName = args.caseTypeName || "Residential Mortgage";
      const productCategoryId = args.productCategoryId || 0;
      const mortgageTermYear = args.mortgageTermYear || 25;
      const mortgageTermMonth = args.mortgageTermMonth || 0;
      const paymentMethod = args.paymentMethod || "Repayment";
      const initialRatePeriodMonths = args.initialRatePeriodMonths || 24;

      const loanToValue =
        propertyValue > 0
          ? ((loanAmount / propertyValue) * 100).toFixed(2)
          : "0";

      const searchParams = {
        loanAmount: loanAmount,
        propertyValue: propertyValue,
        productTypeId: caseTypeId,
        productCategoryId: productCategoryId,
        mortgageTermYear: mortgageTermYear,
        mortgageTermMonth: mortgageTermMonth,
        paymentMethod: paymentMethod,
        initialRatePeriodMonths: initialRatePeriodMonths,
        loanToValue: parseFloat(loanToValue),
      };

      console.log("📊 Mapped Search Parameters:", searchParams);
      this.triggerAngularJSMortgageSearch(searchParams);

      // ✅ Updated message - make it clear it's redirecting
      let categoryText =
        productCategoryId > 0
          ? `\n- Category: ${this.getCategoryName(
              productCategoryId,
              caseTypeId
            )}`
          : "";

      const output = `Excellent! I've initiated your mortgage search with these criteria:
- Case Type: ${caseTypeName}${categoryText}
- Loan Amount: £${loanAmount.toLocaleString()}
- Property Value: £${propertyValue.toLocaleString()}
- LTV: ${loanToValue}%
- Mortgage Term: ${mortgageTermYear} years ${mortgageTermMonth} months
- Payment Method: ${paymentMethod}

You're being redirected to the product sourcing page where you'll see all available mortgage products matching your criteria. The results are loading now!`;

      this.submitFunctionOutput(callId, output);
      console.log("✅ sourceMortgageProducts completed successfully");
    } catch (error: any) {
      console.error("❌ Error in sourceMortgageProducts:", error);
      this.submitFunctionOutput(
        callId,
        "Sorry, I encountered an error while searching. Please try again."
      );
    }
  }

  private sendMessageToParent(eventType: string, payload: any): void {
    if (window.parent && window.parent !== window) {
      const message = {
        source: "MELODIE_AI",
        type: eventType,
        data: payload,
        timestamp: new Date().toISOString(),
      };

      // Send to parent window (AngularJS)
      window.parent.postMessage(message, "*");
      console.log("📤 Sent to AngularJS parent:", message);
    } else {
      console.warn("⚠️ No parent window found");
    }
  }

  // ✅ Function: applyToMortgageProduct - matches Flutter implementation
  private applyMortgageProduct(args: any, callId: string): void {
    const product = args.product;
    console.log(
      "\n╔════════════════════════════════════════════════════════════════╗"
    );
    console.log("║ 📝 MORTGAGE APPLICATION SUBMISSION ║");
    console.log(
      "╚════════════════════════════════════════════════════════════════╝"
    );
    console.log("📋 Function: applyToMortgageProduct");
    console.log("📋 Call ID:", callId);
    console.log(
      "═══════════════════════════════════════════════════════════════════"
    );
    console.log("🏦 Product Details:");
    console.log(JSON.stringify(product, null, 2));
    console.log(
      "═══════════════════════════════════════════════════════════════════\n"
    );

    // Prepare application parameters
    const now = new Date();
    const applicationParams: MortgageApplicationParams = {
      userId: this._userId,
      status: 0,
      creationDate: now.toISOString(),
      updatedDate: now.toISOString(),
      versionNumber: 1,
      userCompanyId: this._userCompanyId,
      lenderCompanyId: product.lenderId || 456,
      productId: product.id || 123,
      caseType: product.productType || this.mortgageApplyParams.mortgageType,
      purposeOfLoan: "",
      areYouReMortgagingORLookingToBuy: "",
      howWillYouUseThisProperty: "",
      whenDoesTheIntroductoryPeriodOnYourCurrentMortgageComeToAnEnd: "",
      propertyValuationAmount:
        this.mortgageApplyParams.propertyValuationAmount || 0,
      outStandingLoanAmount: this.caseDetailsParams.OutstandingBalance || 0,
      depositAmount: this.caseDetailsParams.Deposit || 0,
      loanAmount: this.mortgageApplyParams.loanAmount || 0,
      isThisJointCase: "",
      areYouAFirstTimeBuyer: "",
      preferredMortgageTermYear: Math.floor(
        (this.mortgageApplyParams.totalTermMonth || 240) / 12
      ),
      preferredMortgageTermMonth:
        (this.mortgageApplyParams.totalTermMonth || 240) % 12,
      paymentMethod: this.mortgageApplyParams.paymentMethod || "Repayment",
      mortgageClass: "",
      initialPeriodMonth:
        this.mortgageApplyParams.initialRatePeriodMonths || 24,
      anualIncome: this.caseDetailsParams.AnnualIncome || 0,
      anualRentalIncome: this.caseDetailsParams.RentalIncome || 0,
      doYouHaveAnyAdditionalIncome: "",
      additionalAnualIncome: 0,
      totalGrossDevelopmentValue: this.caseDetailsParams.gDV || 0,
      lifeCoverAmount: 0,
      criticalIllnessAmount: 0,
      lifeOrEarlierCoverAmount: 0,
      areYouASmoker: 0,
      isCaseDataIncluded: "",
      title: product.productType || this.mortgageApplyParams.mortgageType,
      description: "",
      id: 0,
      Country: this.mortgageApplyParams.country || "United Kingdom",
      CurrencySymbol: "£",
    };

    console.log(
      "╔════════════════════════════════════════════════════════════════╗"
    );
    console.log("║ 📤 SENDING TO PARENT ANGULARJS ║");
    console.log(
      "╚════════════════════════════════════════════════════════════════╝"
    );
    console.log("🌐 Full Application Parameters:");
    console.log(JSON.stringify(applicationParams, null, 2));
    console.log(
      "═══════════════════════════════════════════════════════════════════\n"
    );

    // ✅ FIXED - Just call postCase (no subscribe)
    this.caseService.postCase(applicationParams);
    console.log("✅ Application request sent to parent AngularJS");

    // Send notification to parent window
    this.sendMessageToParent("MORTGAGE_APPLICATION_CREATED", {
      productId: product.id,
      lenderId: product.lenderId,
      loanAmount: applicationParams.loanAmount,
      propertyValue: applicationParams.propertyValuationAmount,
      mortgageType: applicationParams.caseType,
    });

    // Match Flutter's success message format
    const msg = `I have sent your mortgage application to our system. Please provide further information along with the necessary documents. A member of our support team will contact you soon after you submit the required information and documents for fact-finding.`;

    console.log(
      "╔════════════════════════════════════════════════════════════════╗"
    );
    console.log("║ 📤 SUBMITTING FUNCTION OUTPUT TO AI ║");
    console.log(
      "╚════════════════════════════════════════════════════════════════╝"
    );
    console.log("Message:", msg);
    console.log(
      "═══════════════════════════════════════════════════════════════════\n"
    );

    this.submitFunctionOutput(callId, msg);
    console.log("✅ applyToMortgageProduct completed successfully");
    console.log(
      "═══════════════════════════════════════════════════════════════════\n"
    );
  }

  // ✅ NEW: Handle navigation to mortgage sourcing
  private handleMortgageSourcingNavigation(
    navigate: boolean,
    callId: string
  ): void {
    if (navigate) {
      // ✅ TELL PARENT to navigate to mortgage sourcing
      this.sendMessageToParent("NAVIGATE_TO_MORTGAGE_SOURCING", {
        mortgageParams: this.mortgageApplyParams,
      });

      const msg = "Navigating to mortgage products list...";
      this.submitFunctionOutput(callId, msg);
    }
  }

  // ✅ Add method to close modal from inside
  public requestCloseModal(): void {
    this.sendMessageToParent("CLOSE_MODAL", {
      reason: "user_requested",
    });
  }

  // ✅ NEW: Handle navigation to fact-find
  private handleFactFindNavigation(navigate: boolean, callId: string): void {
    if (navigate) {
      // ✅ TELL PARENT to navigate to fact-find
      this.sendMessageToParent("NAVIGATE_TO_FACT_FIND", {
        userCompanyId: this._userCompanyId,
        userId: this._userId,
      });

      const msg = "Navigating to fact-find page...";
      this.submitFunctionOutput(callId, msg);
    }
  }

  private triggerAngularJSMortgageSearch(params: {
    loanAmount: number;
    propertyValue: number;
    mortgageTermYear: number;
    mortgageTermMonth: number;
    productTypeId: number;
    productCategoryId: number;
    paymentMethod: string;
    initialRatePeriodMonths: number;
    loanToValue: number;
  }): void {
    console.log("📤 Sending mortgage search to AngularJS parent:", params);

    if (window.parent && window.parent !== window) {
      // ✅ Map to AngularJS $rootScope.userQuickSourceModel structure
      const angularJSPayload = {
        ProductTypeId: params.productTypeId,
        ProductCategoryId: params.productCategoryId,
        LoanAmount: params.loanAmount,
        PurchasePrice: params.propertyValue,
        PaymentMethod: params.paymentMethod,
        LoanTermYear: params.mortgageTermYear,
        LoanTermMonth: params.mortgageTermMonth,
        InitialRatePeriodMonths: params.initialRatePeriodMonths,
        LoanToValue: params.loanToValue,
        SearchProductWithoutClientDetails: true,
        UserId: this._userId,
        OrderBy: "Rate",
      };

      window.parent.postMessage(
        {
          source: "MELODIE_AI",
          type: "MELODIE_MORTGAGE_SEARCH",
          data: angularJSPayload,
          timestamp: new Date().toISOString(),
        },
        "*" // ⚠️ Use your actual domain in production
      );

      console.log("✅ Mortgage search request sent to AngularJS");
      console.log("📋 Full Payload:", angularJSPayload);
    } else {
      console.warn("⚠️ No parent window found");
    }
  }

  // ✅ NEW: Submit function output back to OpenAI
  private submitFunctionOutput(callId: string, output: string): void {
    if (!this.webRTCService || !this.isBrowser) {
      console.warn("⚠️ Cannot submit function output - service not ready");
      return;
    }

    console.log("📤 Submitting function output for call:", callId);
    console.log("📝 Output:", output);

    // ✅ Step 1: Create function output item
    const outputPayload = {
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: output,
      },
    };

    this.webRTCService.sendDataChannelMessage(outputPayload);
    console.log("✅ Function output sent");

    // ✅ Step 2: Trigger AI response after a small delay
    setTimeout(() => {
      const responsePayload = {
        type: "response.create",
        response: {
          modalities:
            this.currentMode === ConversationMode.VOICE
              ? ["audio", "text"]
              : ["text"],
        },
      };

      console.log("🤖 Triggering AI response");
      this.webRTCService.sendDataChannelMessage(responsePayload);
      console.log("✅ AI response triggered");
    }, 100);
  }

  constructor(
    private webRTCService: WebRTCService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: Object,
    private openAIAuthenticationService: OpenAIAuthenticationService,
    private caseService: CaseService,
    public router: Router,
    public activatedRoute: ActivatedRoute
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    console.log("🔧 Constructor: isBrowser =", this.isBrowser);
  }

  async ngOnInit(): Promise<void> {
    console.log("🚀 ngOnInit started");

    this.activatedRoute.queryParams.subscribe((params) => {
      console.log("📝 Query params:", params);

      const userCompanyIdValue = params["userCompanyId"];
      const userIdValue = params["userId"];
      const initiatorIdValue = params["initiatorId"];
      this._initiatorName = params["initiatorName"];

      this._userCompanyId = parseInt(userCompanyIdValue);
      this._userId = parseInt(userIdValue);
      this._initiatorId = parseInt(initiatorIdValue);

      console.log("👤 Parsed IDs:", {
        userCompanyId: this._userCompanyId,
        userId: this._userId,
        initiatorId: this._initiatorId,
        initiatorName: this._initiatorName,
      });

      if (this._userCompanyId > 0) {
        console.log("✅ UserCompanyId is valid, calling API...");
        this.getOpenAIAuthenticationTokenByRequestModelByUserCompany();
      } else {
        console.warn("⚠️ UserCompanyId is 0 or invalid - skipping API call");
        // ✅ IMPORTANT FIX: Still initialize even without params
        this.handleNoQueryParams();
      }
    });
  }

  // ✅ NEW: Handle case when no query params
  private handleNoQueryParams(): void {
    console.log("⚠️ No valid query params - showing error state");
    this.isInitialized = true;
    this.initError =
      "Missing required parameters. Please access via proper link.";
    this.messages.push({
      text: "Hello! Please access this page with proper authentication parameters.",
      sender: "bot",
      timestamp: new Date(),
    });
  }

  public async getOpenAIAuthenticationTokenByRequestModelByUserCompany(): Promise<void> {
    console.log("🔑 Calling authentication API...");

    var openAIAuthenticationRequestModel =
      {} as OpenAIAuthenticationRequestModel;
    openAIAuthenticationRequestModel.ProjectName = "UAM_UVC";

    this.openAIAuthenticationService
      .getOpenAIAuthenticationTokenByRequestModel(
        openAIAuthenticationRequestModel
      )
      .subscribe({
        next: (response) => {
          console.log("✅ API response received:", response);
          const data = response.ResponseData.reaponseData;
          this.EPHEMERAL_KEY = data.client_secret.value;
          console.log(
            "🔑 Ephemeral key set:",
            this.EPHEMERAL_KEY ? "Yes" : "No"
          );
          this.initWebRTCService();
        },
        error: (error) => {
          console.error("❌ API error:", error);
          // ✅ IMPORTANT FIX: Set initialized to true even on error
          this.isInitialized = true;
          this.initError = "Failed to authenticate. Please try again.";
          this.messages.push({
            text: "Authentication failed. Please contact support.",
            sender: "bot",
            timestamp: new Date(),
          });
        },
      });
  }

  public async initWebRTCService(): Promise<void> {
    console.log("🌐 initWebRTCService started");

    if (!this.isBrowser) {
      console.log("⚠️ SSR detected - skipping");
      return;
    }

    if (!this.EPHEMERAL_KEY || this.EPHEMERAL_KEY === "") {
      console.warn("⚠️ No ephemeral key - demo mode");
      this.isInitialized = true;
      this.initError = "API key not configured.";
      this.messages.push({
        text: "Hello! (Demo Mode)",
        sender: "bot",
        timestamp: new Date(),
      });
      return;
    }

    try {
      console.log("🔧 Initializing WebRTC with:", {
        key: this.EPHEMERAL_KEY.substring(0, 10) + "...",
        userCompanyId: this._userCompanyId,
        userId: this._userId,
        initiatorId: this._initiatorId,
        initiatorName: this._initiatorName,
        mode: "voice",
      });

      await this.webRTCService.initRealtime(
        this.EPHEMERAL_KEY,
        this._userCompanyId,
        this._userId,
        this._initiatorId,
        this._initiatorName,
        "voice",
        this.MODEL
      );

      console.log("✅ WebRTC initialized successfully");

      // ✅ CRITICAL: Set initialized to true BEFORE adding listener
      this.isInitialized = true;

      if (typeof window !== "undefined") {
        window.addEventListener("message", this.messageHandler);
        console.log("✅ Message listener added");
      }

      this.messages.push({
        text: "Hello! Start speaking to chat with me.",
        sender: "bot",
        timestamp: new Date(),
      });

      console.log("✅ Welcome message added, initialization complete");
    } catch (error: any) {
      console.error("❌ WebRTC initialization error:", error);

      // ✅ CRITICAL: Set initialized to true even on error
      this.isInitialized = true;

      if (error.message?.includes("401")) {
        this.initError = "Authentication Failed";
      } else if (error.message?.includes("RTCPeerConnection")) {
        this.initError = "WebRTC Connection Failed";
      } else {
        this.initError = `Failed: ${error.message || "Unknown error"}`;
      }

      this.messages.push({
        text: "Connection failed. Running in limited mode.",
        sender: "bot",
        timestamp: new Date(),
      });
    }
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;

    if (typeof window !== "undefined") {
      window.removeEventListener("message", this.messageHandler);
    }

    try {
      this.webRTCService.closeWebRTCConnection();
    } catch (error) {
      console.error("Error closing connection:", error);
    }
  }

  async switchMode(mode: ConversationMode): Promise<void> {
    if (this.currentMode === mode || !this.isBrowser) return;

    if (!this.EPHEMERAL_KEY) {
      alert("Mode switching requires authentication.");
      return;
    }

    try {
      if (mode === ConversationMode.VOICE) {
        // ✅ Switching to VOICE mode
        await this.webRTCService.switchToVoice();
        this.statusText = "Hold to speak";
        console.log("✅ Switched to VOICE mode");
      } else {
        // ✅ Switching to CHAT mode
        console.log("🔄 Switching to CHAT mode - stopping voice...");

        // Stop any ongoing listening
        if (this.isListening) {
          this.isListening = false;
          this.statusText = "Hold to speak";
          // **FIX:** Also tell the service to stop recording if user switches
          // tabs while holding the button
          this.webRTCService.stopRecording();
        }

        // Stop voice and switch to chat
        await this.webRTCService.switchToChat();

        console.log("✅ Switched to CHAT mode - all voice history preserved");
      }

      this.currentMode = mode;
    } catch (error: any) {
      console.error("❌ Mode switch error:", error);
      alert(`Failed to switch: ${error.message}`);
    }
  }

  isActiveMode(mode: ConversationMode): boolean {
    return this.currentMode === mode;
  }

  async sendMessage(): Promise<void> {
    if (!this.isBrowser) return;

    const trimmedMessage = this.newMessage.trim();
    if (!trimmedMessage) return;

    const userMessage: ChatMessage = {
      text: trimmedMessage,
      sender: "user",
      timestamp: new Date(),
    };
    this.messages.push(userMessage);
    this.newMessage = "";

    if (!this.EPHEMERAL_KEY) {
      setTimeout(() => {
        this.messages.push({
          text: `Demo: Received "${trimmedMessage}"`,
          sender: "bot",
          timestamp: new Date(),
        });
      }, 500);
      return;
    }

    this.isTyping = true;

    try {
      await this.webRTCService.sendText(trimmedMessage);
      console.log("✅ Message sent:", trimmedMessage);
    } catch (error: any) {
      console.error("❌ Send error:", error);
      this.isTyping = false;
      this.messages.push({
        text: "Failed to send. Please try again.",
        sender: "bot",
        timestamp: new Date(),
      });
    }
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  // toggleVoice(): void {
  //   if (!this.isBrowser) return;

  //   if (!this.EPHEMERAL_KEY) {
  //     alert("Voice requires authentication.");
  //     return;
  //   }

  //   this.isListening = !this.isListening;
  //   this.statusText = this.isListening ? "Listening..." : "Click to speak";
  //   this.cdr.detectChanges();
  // }

  startListening(event: Event): void {
    event.preventDefault();
    if (!this.isBrowser || !this.EPHEMERAL_KEY) return;

    if (!this.isListening) {
      this.isListening = true;
      this.statusText = "Listening... Release to stop";

      // Call WebRTCService to start streaming audio
      this.webRTCService.startRecording();

      this.cdr.detectChanges();
    }
  }

  stopListening(event: Event): void {
    event.preventDefault();
    if (!this.isBrowser) return;

    if (this.isListening) {
      this.isListening = false;
      this.statusText = "Hold to speak";

      // Call WebRTCService to commit buffer and stop streaming
      this.webRTCService.stopRecording();

      this.cdr.detectChanges();
    }
  }

  // Helper method to get mortgage type ID
  private getMortgageTypeId(mortgageType: string): number {
    const mortgageTypeToId: { [key: string]: number } = {
      "Residential Mortgage": 1,
      "Buy To Let Mortgage": 3,
      "Residential Remortgage": 2,
      "Buy To Let Remortgage": 4,
      Commercial: 6,
    };
    return mortgageTypeToId[mortgageType] || 1;
  }

  // ✅ Helper: Get category name by ID
  private getCategoryName(categoryId: number, caseTypeId: number): string {
    const categoryMap: { [key: number]: string } = {
      // Residential Mortgage (1)
      1: "Home Mover",
      2: "First time buyer",
      3: "Help to Buy Mortgage",
      4: "Right to Buy",
      5: "Shared Ownership",
      29: "Self Build",

      // Residential Remortgage (2)
      6: "Right to Buy",
      7: "Shared Ownership",
      8: "Standard Remortgage",

      // Buy to Let Mortgage (3)
      9: "Experienced Landlord",
      10: "First time Landlord",
      11: "Consumer Buy to Let",

      // Buy to Let Remortgage (4)
      12: "Experienced Landlord",
      13: "Consumer buy to Let",
      39: "Let to Buy",

      // Development Finance (8)
      14: "Full Development Project",
      15: "Conversion Project",
      16: "Heavy Refurbishment",
      17: "Light Refurbishment",

      // Bridging Loan (9)
      18: "Auction Purchase",
      19: "Standard Bridging Loan",
      20: "Semi Commercial Bridging Loan",
      21: "Commercial Bridging Loan",
      22: "Regulated Bridging Loan",
      23: "Structured Short Term Finance",

      // Equity Release (10)
      24: "Equity Release",
      25: "Home Reversion",

      // General Insurance (11)
      26: "Buildings & Contents",
      27: "Buildings Only",
      28: "Contents Only",

      // Portfolio Landlord (24)
      86: "Portfolio Landlord Purchase",
      87: "Portfolio Landlord Re-mortgage",
    };

    return categoryMap[categoryId] || "Not specified";
  }

  // ✅ Helper: Get case type name by ID
  private getCaseTypeName(caseTypeId: number): string {
    const caseTypeMap: { [key: number]: string } = {
      1: "Residential Mortgage",
      2: "Residential Remortgage",
      3: "Buy to Let Mortgage",
      4: "Buy to Let Remortgage",
      5: "Second Charge - Buy to Let & Commercial",
      6: "Commercial Mortgages/ Loans",
      7: "Business Lending",
      8: "Development Finance",
      9: "Bridging Loan",
      10: "Equity Release",
      11: "General Insurance",
      12: "Additional Charge Mortgage (Residential)",
      13: "Additional Charge Mortgage (Un Regulated)",
      24: "Portfolio Landlord",
    };

    return caseTypeMap[caseTypeId] || "Unknown";
  }
}
