import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { DeviceDetectorService, DeviceInfo } from 'ngx-device-detector';
import { WebRTCService } from './services/webrtc.service';
import { OpenAIAuthenticationService } from './services/openaiaithentication.service';
import { OpenAIAuthenticationRequestModel } from './models/OpenAIAuthenticationRequestModel.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  deviceinfo!: DeviceInfo;

  title = 'Ever north Ltd';
  public _userCompanyId: number = 0;
  public _userId: number = 0;
  public _initiatorId: number = 0;
  public _initiatorName: string = "";

  constructor(private webRTCService: WebRTCService, private openAIAuthenticationService: OpenAIAuthenticationService, public router: Router, public activatedRoute: ActivatedRoute) {


  }


  ngOnInit(): void {

    this.activatedRoute.queryParams.subscribe(params => {

      const userCompanyIdValue = params['userCompanyId'];
      const userIdValue = params['userId'];
      const initiatorIdValue = params['initiatorId'];

      this._initiatorName = params['initiatorName'];

      this._userCompanyId = parseInt(userCompanyIdValue);
      this._userId = parseInt(userIdValue);
      this._initiatorId = parseInt(initiatorIdValue);

      if (this._userCompanyId > 0) {
        //this.getOpenAIAuthenticationTokenByUserCompanyId();
        this.getOpenAIAuthenticationTokenByRequestModelByUserCompany();
      }

    });



  }


  onClickTalkToAIFinancialAdivserAsistant(): void {

  }


  public getOpenAIAuthenticationTokenByUserCompanyId(): void {

    this.openAIAuthenticationService.getOpenAIAuthenticationToken()
      .subscribe(response => {

        const data = response.ResponseData.reaponseData;
        console.log('API response:', response);

        const EPHEMERAL_KEY = data.client_secret.value;
        console.log('EPHEMERAL_KEY response:', EPHEMERAL_KEY);

        this.webRTCService.init(EPHEMERAL_KEY, this._userCompanyId, this._userId, this._initiatorId, this._initiatorName).catch(error => {
          console.error('Error initializing WebRTC:', error);
        });


      }, error => {
        console.error('API error:', error);
      });
  }

  
  public getOpenAIAuthenticationTokenByRequestModelByUserCompany(): void {

    var openAIAuthenticationRequestModel = {} as OpenAIAuthenticationRequestModel;
    //openAIAuthenticationRequestModel.ProjectName = "LEGATE";
    openAIAuthenticationRequestModel.ProjectName = "UAM_UVC";
    

    this.openAIAuthenticationService.getOpenAIAuthenticationTokenByRequestModel(openAIAuthenticationRequestModel)
      .subscribe(response => {

        const data = response.ResponseData.reaponseData;
        console.log('API response:', response);

        const EPHEMERAL_KEY = data.client_secret.value;
        console.log('EPHEMERAL_KEY response:', EPHEMERAL_KEY);

        this.webRTCService.init(EPHEMERAL_KEY, this._userCompanyId, this._userId, this._initiatorId, this._initiatorName).catch(error => {
          console.error('Error initializing WebRTC:', error);
        });


      }, error => {
        console.error('API error:', error);
      });
  }




  ngOnDestroy(): void {

    this.webRTCService.closeRTCPeerConnection();
  }






}
