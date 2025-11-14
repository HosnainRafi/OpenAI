import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map } from 'rxjs';
import { VoiceMessageWithOpenAIModel } from '../models/VoiceMessageWithOpenAI.model';




@Injectable({
    providedIn: 'root'
})

export class VoiceMessageWithOpenAIService {

    headers: HttpHeaders = new HttpHeaders();
    //.. baseApiUrl: string = environment.FM_url;
   // baseApiUrl: string = "https://chatms.financemagic.co.uk"
    baseApiUrl: string = "https://demo.financemagic.co.uk"


    //for for UAM and Legate Technologies
    //baseApiUrl: string = "https://erp.u-am.ae";


    requestOptions: any = {};

    constructor(private http: HttpClient) {
        this.initHTTPHeaderWithAutorization();
    }
    private initHTTPHeaderWithAutorization() {
        this.headers.append('Content-Type', 'application/json');
        this.headers.append('Accept', 'application/json');
         
        this.headers.append('Access-Control-Allow-Origin', this.baseApiUrl);
        this.headers.append('Access-Control-Allow-Methods', 'DELETE, PUT, GET, POST');
        this.headers.append('Access-Control-Allow-Credentials', 'true');
        this.headers.append('token', 'ygWGtKUc8Kux9M4aaHRW3vFMKRXlSNsEcKepLo92diw=');

    }




    public postVoiceMessageWithOpenAI(entityModel: VoiceMessageWithOpenAIModel): Observable<any> {
        const requestOptions = { headers: this.headers };
        const url = this.baseApiUrl + '/api/chatmicroservice/voicemessagewithopenai/post';


       // return this.http.post<any>(url, entityModel, this.requestOptions);



        //return this.http.post<any>(url, entityModel, requestOptions);
        return this.http.post<any>(url, entityModel);
    }

    public postVoiceMessageWithOpenAIWithMMServer(entityModel: VoiceMessageWithOpenAIModel): Observable<any> {
        const requestOptions = { headers: this.headers };
        const url = this.baseApiUrl + '/api/voicemessagewithopenai/postvoicemessagewithopenai';


        return this.http.post<any>(url, entityModel, this.requestOptions);



        //return this.http.post<any>(url, entityModel, requestOptions);
       // return this.http.post<any>(url, entityModel);
    }



}
