import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";

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
  // TODO: Replace with your actual API endpoint
  private apiUrl = "https://your-api-endpoint.com/api/cases";

  constructor(private http: HttpClient) {}

  /**
   * Post a new mortgage case/application to the backend
   */
  postCase(params: MortgageApplicationParams): Observable<any> {
    console.log("📤 Posting mortgage application to backend:", params);

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

    console.log(
      "📋 Full application payload:",
      JSON.stringify(payload, null, 2)
    );

    return this.http.post(this.apiUrl, payload);
  }
}
