import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map } from 'rxjs';
import { OpenAIAuthenticationRequestModel } from '../models/OpenAIAuthenticationRequestModel.model';


@Injectable({
    providedIn: 'root'
})

export class OpenAIAuthenticationService {


    headers: HttpHeaders = new HttpHeaders();


    // for finance Magic 
    //baseApiUrl: string = "https://enm.financemagic.co.uk";

    //for Mortgage Magic
    //baseApiUrl: string = "https://admin.mortgage-magic.co.uk";

    //Demo for testing 
      baseApiUrl: string = "https://demo.financemagic.co.uk"

    //for for UAM and Legate Technologies
    //baseApiUrl: string = "https://erp.u-am.ae";

    //for for UAM and Legate Technologies
    //baseApiUrl: string = "http://localhost:22367";

    constructor(private http: HttpClient) {

        this.headers.append('Content-Type', 'application/json');
        this.headers.append('Accept', 'application/json');
         
        this.headers.append('Access-Control-Allow-Origin', this.baseApiUrl);
        this.headers.append('Access-Control-Allow-Methods', 'DELETE, PUT, GET, POST');
        this.headers.append('Access-Control-Allow-Credentials', 'true');
        this.headers.append('token', 'ygWGtKUc8Kux9M4aaHRW3vFMKRXlSNsEcKepLo92diw=');

    }



    getOpenAIAuthenticationToken(): Observable<any> {
        const requestOptions = { headers: this.headers };
        const url = this.baseApiUrl + `/api/openaiauthentication/post/getopenaisession`;

        return this.http.post<any>(url, null, requestOptions);
    }
    
    getOpenAIAuthenticationTokenByRequestModel( openAIAuthenticationRequestModel : OpenAIAuthenticationRequestModel): Observable<any> {
        const requestOptions = { headers: this.headers };
        const url = this.baseApiUrl + `/api/openaiauthentication/post/getopenaisession`;

        return this.http.post<any>(url, openAIAuthenticationRequestModel, requestOptions);
    }

}
