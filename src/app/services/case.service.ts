import { Injectable } from "@angular/core";

export interface MortgageApplicationParams {
  userId: number;
  status?: number;
  creationDate?: string;
  updatedDate?: string;
  versionNumber?: number;
  userCompanyId: number;
  lenderCompanyId?: number;
  productId?: number;
  caseType: string;
  purposeOfLoan?: string;
  areYouReMortgagingORLookingToBuy?: string;
  howWillYouUseThisProperty?: string;
  whenDoesTheIntroductoryPeriodOnYourCurrentMortgageComeToAnEnd?: string;
  propertyValuationAmount: number;
  outStandingLoanAmount?: number;
  depositAmount?: number;
  loanAmount: number;
  isThisJointCase?: string;
  areYouAFirstTimeBuyer?: string;
  preferredMortgageTermYear: number;
  preferredMortgageTermMonth: number;
  paymentMethod: string;
  mortgageClass?: string;
  initialPeriodMonth: number;
  anualIncome?: number;
  anualRentalIncome?: number;
  doYouHaveAnyAdditionalIncome?: string;
  additionalAnualIncome?: number;
  totalGrossDevelopmentValue?: number;
  lifeCoverAmount?: number;
  criticalIllnessAmount?: number;
  lifeOrEarlierCoverAmount?: number;
  areYouASmoker?: number;
  isCaseDataIncluded?: string;
  title: string;
  description: string;
  id?: number;
  Country?: string;
  CurrencySymbol?: string;
}

@Injectable({
  providedIn: "root",
})
export class CaseService {
  constructor() {}

  /**
   * ✅ Send mortgage search request to parent AngularJS app
   * The parent app will call its own API via $scope.searchUserQuoteButtonClick()
   */
  triggerMortgageSearch(params: {
    propertyValue: number;
    loanAmount: number;
    mortgageType: string;
  }): void {
    console.log(
      "📤 Sending mortgage search request to parent AngularJS:",
      params
    );

    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          source: "MELODIE_AI",
          type: "MELODIE_MORTGAGE_SEARCH",
          data: {
            propertyValue: params.propertyValue,
            loanAmount: params.loanAmount,
            mortgageType: params.mortgageType,
          },
          timestamp: new Date().toISOString(),
        },
        "*" // Use specific origin in production: "https://your-domain.com"
      );
      console.log("✅ Mortgage search request sent to parent");
    } else {
      console.warn("⚠️ No parent window found - running standalone");
    }
  }

  /**
   * ✅ Send mortgage application to parent AngularJS app
   * The parent app will handle the actual API call
   */
  postCase(params: MortgageApplicationParams): void {
    console.log("📤 Sending mortgage application to parent AngularJS:", params);

    const payload = {
      userId: params.userId,
      status: 0,
      creationDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
      versionNumber: 1,
      userCompanyId: params.userCompanyId,
      lenderCompanyId: params.lenderCompanyId || 0,
      productId: params.productId || 0,
      caseType: params.caseType,
      purposeOfLoan: "",
      areYouReMortgagingORLookingToBuy: "",
      howWillYouUseThisProperty: "",
      whenDoesTheIntroductoryPeriodOnYourCurrentMortgageComeToAnEnd: "",
      propertyValuationAmount: params.propertyValuationAmount,
      outStandingLoanAmount: params.outStandingLoanAmount || 0,
      depositAmount: params.depositAmount || 0,
      loanAmount: params.loanAmount,
      isThisJointCase: "",
      areYouAFirstTimeBuyer: "",
      preferredMortgageTermYear: params.preferredMortgageTermYear,
      preferredMortgageTermMonth: params.preferredMortgageTermMonth,
      paymentMethod: params.paymentMethod,
      mortgageClass: "",
      initialPeriodMonth: params.initialPeriodMonth,
      anualIncome: params.anualIncome || 0,
      anualRentalIncome: params.anualRentalIncome || 0,
      doYouHaveAnyAdditionalIncome: "",
      additionalAnualIncome: 0,
      totalGrossDevelopmentValue: params.totalGrossDevelopmentValue || 0,
      lifeCoverAmount: 0,
      criticalIllnessAmount: 0,
      lifeOrEarlierCoverAmount: 0,
      areYouASmoker: 0,
      isCaseDataIncluded: "",
      title: params.title,
      description: params.description,
      id: 0,
      Country: params.Country || "United Kingdom",
      CurrencySymbol: params.CurrencySymbol || "£",
    };

    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          source: "MELODIE_AI",
          type: "MELODIE_CREATE_MORTGAGE_CASE",
          data: payload,
          timestamp: new Date().toISOString(),
        },
        "*" // Use specific origin in production
      );
      console.log("✅ Mortgage application sent to parent AngularJS");
    } else {
      console.warn("⚠️ No parent window - cannot send application");
    }
  }
}
