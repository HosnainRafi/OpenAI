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
          // ✅ Handle function calls
          // Streamed text delta events (chat / voice text output)
          if (objData.type === "response.output_text.delta") {
            const rid = objData.response_id;
            const delta = objData.delta || "";
            if (rid) {
              if (!this.responseTextBuffers[rid])
                this.responseTextBuffers[rid] = "";
              this.responseTextBuffers[rid] += delta;
              // Optionally show typing indicator
              this.isTyping = true;
            }
          }

          if (objData.type === "response.done") {
            const output = objData.response?.output?.[0];

            // Handle regular message response
            if (output?.type === "message" && output?.role === "assistant") {
              const content = output.content as Array<any>;
              let aiText = content?.[0]?.text || content?.[0]?.transcript;

              // If final content empty, attempt to use accumulated buffer
              if ((!aiText || aiText.trim() === "") && objData.response?.id) {
                const buffered = this.responseTextBuffers[objData.response.id];
                if (buffered && buffered.trim() !== "") {
                  aiText = buffered;
                  console.log(
                    "🧩 Used buffered streamed text for final message"
                  );
                }
              }

              // ✅ Check if this is a JSON echo of function arguments (skip if so)
              let isJsonEcho = false;
              if (
                aiText &&
                aiText.trim().startsWith("{") &&
                aiText.trim().endsWith("}")
              ) {
                // Check if there's a function_call in the same output array
                const hasFunctionCall = objData.response?.output?.some(
                  (item: any) => item.type === "function_call"
                );
                if (hasFunctionCall) {
                  try {
                    JSON.parse(aiText); // Valid JSON
                    isJsonEcho = true;
                    console.log("⏭️ Skipping JSON echo of function arguments");
                  } catch {
                    // Not valid JSON, treat as normal text
                  }
                }
              }

              if (aiText && aiText.trim() !== "" && !isJsonEcho) {
                this.isTyping = false;
                this.messages.push({
                  text: aiText,
                  sender: "bot",
                  timestamp: new Date(),
                });
                console.log("✅ AI response added:", aiText);
              }

              // Clear buffer for this response id
              if (
                objData.response?.id &&
                this.responseTextBuffers[objData.response.id]
              ) {
                delete this.responseTextBuffers[objData.response.id];
              }
            }

            // ✅ NEW: Handle function call
            else if (output?.type === "function_call") {
              const functionName = output.name;
              const argumentsStr = output.arguments;
              const callId = output.call_id;

              console.log(`🔧 Function called: ${functionName}`, argumentsStr);

              if (functionName && argumentsStr && callId) {
                this.handleFunctionCall(functionName, argumentsStr, callId);
              }
            }
          }

          // Handle user transcripts
          else if (
            objData.type ===
            "conversation.item.input_audio_transcription.completed"
          ) {
            const userText = objData.transcript;
            if (userText) {
              this.messages.push({
                text: userText,
                sender: "user",
                timestamp: new Date(),
              });
              console.log("✅ User voice transcript added:", userText);
            }
          }

          // ✅ NEW: Trigger response after function output submitted
          else if (
            objData.type === "conversation.item.created" &&
            objData.item?.type === "function_call_output"
          ) {
            console.log("✅ Function output submitted, triggering AI response");
            // AI will automatically respond after function output
          }
        });
      } catch (e) {
        // Not JSON or not relevant
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

      switch (functionName) {
        case "source_mortgage_products":
          this.sourceMortgageProducts(args, callId);
          break;

        case "apply_mortgage_product":
          this.applyMortgageProduct(args, callId);
          break;

        case "handle_mortgage_sourcing_navigation":
          this.handleMortgageSourcingNavigation(args.navigate, callId);
          break;

        case "handle_fact_find_navigation":
          this.handleFactFindNavigation(args.navigate, callId);
          break;

        default:
          console.warn(`Unknown function: ${functionName}`);
      }
    } catch (error) {
      console.error("Error handling function call:", error);
    }
  }

  // ✅ Function: sourceMortgageProductsFunction - matches Flutter implementation
  private sourceMortgageProducts(args: any, callId: string): void {
    const mortgageType = args.mortgageType || "Residential Mortgage";
    const property = args.propertyValuationAmount;
    const loan = args.loanAmount;

    console.log(
      "\n╔════════════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║           🏠 MORTGAGE SOURCING REQUEST                         ║"
    );
    console.log(
      "╚════════════════════════════════════════════════════════════════╝"
    );
    console.log("📋 Function: sourceMortgageProductsFunction");
    console.log("📋 Call ID:", callId);
    console.log("📋 Mortgage Type:", mortgageType);
    console.log("🏘️  Property Valuation: £" + property.toLocaleString());
    console.log("💰 Loan Amount: £" + loan.toLocaleString());
    console.log("📊 LTV: " + ((loan / property) * 100).toFixed(2) + "%");
    console.log(
      "═══════════════════════════════════════════════════════════════════\n"
    );

    // Store parameters for later use (matches Flutter mortgageApplyParams)
    this.mortgageApplyParams = {
      criteria: 1,
      propertyValuationAmount: property,
      loanAmount: loan,
      initialRatePeriodMonths: 24,
      totalTermMonth: 240,
      ltvAmount: ((loan / property) * 100).toFixed(2),
      page: this.productPage,
      count: 1,
      productTypeId: this.getMortgageTypeId(mortgageType),
      productCategoryId: 0,
      orderBy: "",
      paymentMethod: "Repayment",
      interestOnlyAmount: 0,
      mortgageType: mortgageType,
      isAddFeesToTheLoan: "No",
      isNoProductFee: "No",
      isProductTypeShowDirectProducts: "No",
      userId: this._userId,
      userCompanyId: this._userCompanyId,
      initiatorId: this._initiatorId,
      country: "United Kingdom",
      isProductTypeFixed: false,
      isProductTypeDiscount: false,
      isProductTypeTracker: false,
      isProductTypeVariable: false,
      preferredMortgageTermYear: 20,
      preferredMortgageTermMonth: 0,
    };

    console.log(
      "╔════════════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║           💾 STORED MORTGAGE PARAMETERS                        ║"
    );
    console.log(
      "╚════════════════════════════════════════════════════════════════╝"
    );
    console.log(JSON.stringify(this.mortgageApplyParams, null, 2));
    console.log(
      "═══════════════════════════════════════════════════════════════════\n"
    );

    // TODO: Replace with actual GraphQL API call like Flutter: GraphqlApiService().sourceProductsFromQuery()
    // For now, return a mock response matching Flutter's product structure
    const mockProduct = {
      lender: "Example Bank",
      initialPayRate: 3.5,
      mortgageClass: "Fixed Rate",
      duration: "2 years",
      maximumLtvAvailable: 80,
      arrangementFee: 999,
      initialMonthlyPayment: 1250.5,
      loanAmount: loan,
      id: 123,
      lenderId: 456,
      productType: mortgageType,
    };

    console.log(
      "╔════════════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║           📦 PRODUCT SOURCED (MOCK)                            ║"
    );
    console.log(
      "╚════════════════════════════════════════════════════════════════╝"
    );
    console.log("🏦 Lender:", mockProduct.lender);
    console.log("💵 Rate:", mockProduct.initialPayRate + "%");
    console.log("🏷️  Type:", mockProduct.mortgageClass);
    console.log("⏰ Duration:", mockProduct.duration);
    console.log("📈 Max LTV:", mockProduct.maximumLtvAvailable + "%");
    console.log("💳 Fee: £" + mockProduct.arrangementFee.toLocaleString());
    console.log(
      "📅 Monthly: £" + mockProduct.initialMonthlyPayment.toLocaleString()
    );
    console.log("Full Product JSON:", JSON.stringify(mockProduct, null, 2));
    console.log(
      "═══════════════════════════════════════════════════════════════════\n"
    );

    // Format message matching Flutter's msg format
    const msg = `${mockProduct.lender} offers a ${
      mockProduct.initialPayRate
    }% ${mockProduct.mortgageClass} residential mortgage for ${
      mockProduct.duration
    }, available to new borrowers with a maximum LTV of ${
      mockProduct.maximumLtvAvailable
    }%, providing an initial monthly repayment of £${mockProduct.initialMonthlyPayment.toFixed(
      2
    )} for a £${
      mockProduct.loanAmount
    } loan.\n\nProduct Details: ${JSON.stringify(mockProduct)}`;

    console.log(
      "╔════════════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║           📤 SUBMITTING FUNCTION OUTPUT                        ║"
    );
    console.log(
      "╚════════════════════════════════════════════════════════════════╝"
    );
    console.log("Message to AI:", msg);
    console.log(
      "═══════════════════════════════════════════════════════════════════\n"
    );

    this.submitFunctionOutput(callId, msg);
    this.productPage++;

    console.log(
      "✅ sourceMortgageProductsFunction completed. Product page incremented to:",
      this.productPage
    );
    console.log(
      "═══════════════════════════════════════════════════════════════════\n"
    );
  }

  // ✅ Function: applyToMortgageProduct - matches Flutter implementation
  private applyMortgageProduct(args: any, callId: string): void {
    const product = args.product;

    console.log(
      "\n╔════════════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║           📝 MORTGAGE APPLICATION SUBMISSION                   ║"
    );
    console.log(
      "╚════════════════════════════════════════════════════════════════╝"
    );
    console.log("� Function: applyToMortgageProduct");
    console.log("📋 Call ID:", callId);
    console.log(
      "═══════════════════════════════════════════════════════════════════"
    );
    console.log("🏦 Product Details:");
    console.log(JSON.stringify(product, null, 2));
    console.log(
      "═══════════════════════════════════════════════════════════════════"
    );
    console.log("📋 Stored mortgageApplyParams:");
    console.log(JSON.stringify(this.mortgageApplyParams, null, 2));
    console.log(
      "═══════════════════════════════════════════════════════════════════"
    );
    console.log("💼 Case Details Params:");
    console.log(JSON.stringify(this.caseDetailsParams, null, 2));
    console.log(
      "═══════════════════════════════════════════════════════════════════\n"
    );

    // Prepare application parameters matching Flutter's applyParams structure
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
    console.log(
      "║           📤 CONSTRUCTED APPLICATION PAYLOAD                   ║"
    );
    console.log(
      "╚════════════════════════════════════════════════════════════════╝"
    );
    console.log("🌐 Full Application Parameters:");
    console.log(JSON.stringify(applicationParams, null, 2));
    console.log(
      "═══════════════════════════════════════════════════════════════════"
    );
    console.log("� Key Fields Summary:");
    console.log("   • User ID:", applicationParams.userId);
    console.log("   • User Company ID:", applicationParams.userCompanyId);
    console.log("   • Lender Company ID:", applicationParams.lenderCompanyId);
    console.log("   • Product ID:", applicationParams.productId);
    console.log("   • Case Type:", applicationParams.caseType);
    console.log(
      "   • Property Value: £" +
        applicationParams.propertyValuationAmount.toLocaleString()
    );
    console.log(
      "   • Loan Amount: £" + applicationParams.loanAmount.toLocaleString()
    );
    console.log(
      "   • Deposit: £" +
        (applicationParams.depositAmount || 0).toLocaleString()
    );
    console.log(
      "   • Term:",
      applicationParams.preferredMortgageTermYear +
        " years " +
        applicationParams.preferredMortgageTermMonth +
        " months"
    );
    console.log("   • Payment Method:", applicationParams.paymentMethod);
    console.log(
      "   • Annual Income: £" +
        (applicationParams.anualIncome || 0).toLocaleString()
    );
    console.log(
      "   • Rental Income: £" +
        (applicationParams.anualRentalIncome || 0).toLocaleString()
    );
    console.log(
      "═══════════════════════════════════════════════════════════════════\n"
    );

    console.log(
      "╔════════════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║           🌐 CALLING BACKEND API (TaskApiService)             ║"
    );
    console.log(
      "╚════════════════════════════════════════════════════════════════╝"
    );
    console.log("API Method: postCaseWithFactFinds (matches Flutter)");
    console.log("Endpoint: [Your API endpoint - to be configured]");
    console.log(
      "═══════════════════════════════════════════════════════════════════\n"
    );

    // Call backend API (matches Flutter: TaskApiService().postCaseWithFactFinds)
    this.caseService.postCase(applicationParams).subscribe({
      next: (response) => {
        console.log(
          "\n╔════════════════════════════════════════════════════════════════╗"
        );
        console.log(
          "║           ✅ APPLICATION SUBMITTED SUCCESSFULLY                ║"
        );
        console.log(
          "╚════════════════════════════════════════════════════════════════╝"
        );
        console.log("📋 Backend Response:");
        console.log(JSON.stringify(response, null, 2));
        console.log(
          "═══════════════════════════════════════════════════════════════════"
        );

        const caseId =
          response?.ResponseData?.task?.id || Math.floor(Math.random() * 10000);
        console.log("🎉 Case ID Created:", caseId);
        console.log(
          "═══════════════════════════════════════════════════════════════════\n"
        );

        // Match Flutter's success message format
        const msg = `I have created an application for you, Case Id:${caseId}. Please provide further information along with the necessary documents. A member of our support team will contact you soon after you submit the required information and documents for fact-finding`;

        console.log(
          "╔════════════════════════════════════════════════════════════════╗"
        );
        console.log(
          "║           📤 SUBMITTING FUNCTION OUTPUT TO AI                 ║"
        );
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
      },
      error: (error) => {
        console.error(
          "\n╔════════════════════════════════════════════════════════════════╗"
        );
        console.error(
          "║           ❌ APPLICATION SUBMISSION FAILED                     ║"
        );
        console.error(
          "╚════════════════════════════════════════════════════════════════╝"
        );
        console.error("🔴 Error Details:");
        console.error(JSON.stringify(error, null, 2));
        console.error(
          "═══════════════════════════════════════════════════════════════════\n"
        );

        console.log("⚠️  Using fallback mock response...");
        // Fallback to mock response
        const mockCaseId = Math.floor(Math.random() * 10000);
        const msg = `I have created an application for you, Case Id:${mockCaseId}. Please provide further information along with the necessary documents. A member of our support team will contact you soon after you submit the required information and documents for fact-finding`;

        this.submitFunctionOutput(callId, msg);

        console.log(
          "⚠️  applyToMortgageProduct completed with fallback (API error)"
        );
        console.log(
          "═══════════════════════════════════════════════════════════════════\n"
        );
      },
    });
  }

  // ✅ NEW: Handle navigation to mortgage sourcing
  private handleMortgageSourcingNavigation(
    navigate: boolean,
    callId: string
  ): void {
    if (navigate) {
      console.log("🧭 Navigating to mortgage sourcing screen");
      // TODO: Implement navigation
      // this.router.navigate(['/mortgage-sourcing']);

      const msg = "Navigating to mortgage products list...";
      this.submitFunctionOutput(callId, msg);
    }
  }

  // ✅ NEW: Handle navigation to fact-find
  private handleFactFindNavigation(navigate: boolean, callId: string): void {
    if (navigate) {
      console.log("🧭 Navigating to fact-find screen");
      // TODO: Implement navigation
      // this.router.navigate(['/fact-find']);

      const msg = "Navigating to fact-find page...";
      this.submitFunctionOutput(callId, msg);
    }
  }

  // ✅ NEW: Submit function output back to OpenAI
  private submitFunctionOutput(callId: string, output: string): void {
    if (!this.webRTCService || !this.isBrowser) return;

    // Step 1: Submit function output
    const outputPayload = {
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: output,
      },
    };

    console.log("📤 Submitting function output:", outputPayload);
    this.webRTCService.sendDataChannelMessage(outputPayload);

    // ✅ CRITICAL FIX: Trigger AI response after function output
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

      console.log("🤖 Triggering AI response after function output");
      this.webRTCService.sendDataChannelMessage(responsePayload);
    }, 100); // Small delay to ensure function output is processed first
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
}
