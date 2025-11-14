import { Injectable } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { VoiceMessageWithOpenAIService } from './VoiceMessageWithOpenAI.service';
import { VoiceMessageWithOpenAIModel } from '../models/VoiceMessageWithOpenAI.model';

@Injectable({
  providedIn: 'root',
})
export class WebRTCService {

  private _voiceMessageWithOpenAIService : VoiceMessageWithOpenAIService;
  
  public _userCompanyId : number = 0;
  public _userId : number= 0;
  public _initiatorId : number= 0;
  public _initiatorName : string = "";
  private _rtcPeerConnection!: RTCPeerConnection
  //private _rtcPeerConnection: RTCPeerConnection
// private _rtcPeerConnection = new RTCPeerConnection();
 private  _mediaStream! : MediaStream;

  constructor(voiceMessageWithOpenAIService : VoiceMessageWithOpenAIService)
  {
    this._voiceMessageWithOpenAIService = voiceMessageWithOpenAIService;
    
    //this._rtcPeerConnection = new (window as any).RTCPeerConnection();
    //this._mediaStream = new MediaStream();
  }

  async init(EPHEMERAL_KEY_1: string, userCompanyId:number, userId:number, initiatorId: number, initiatorName:string): Promise<void> {
    try {
      const EPHEMERAL_KEY = EPHEMERAL_KEY_1;
      this._initiatorId = initiatorId;
      this._initiatorName = initiatorName;
      this._userCompanyId = userCompanyId;
      this._userId = userId;

      this._rtcPeerConnection = new RTCPeerConnection();

     
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;

      // Handle remote track
      this._rtcPeerConnection.ontrack = (event) => {
        if (event.streams[0]) {
          audioEl.srcObject = event.streams[0];
          document.body.appendChild(audioEl);
        } else {
          console.error('No streams found in remote track event.');
        }
      };


      this._rtcPeerConnection.oniceconnectionstatechange = () => {
        if (  this._rtcPeerConnection.iceConnectionState === 'disconnected' ||   this._rtcPeerConnection.iceConnectionState === 'closed') {
          console.log('Peer connection closed.');
        }
      };

      // Capture local audio
       this._mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
       this._mediaStream.getTracks().forEach(track =>   this._rtcPeerConnection .addTrack(track, this._mediaStream));

      // Set up a data channel
      const dataChannel =   this._rtcPeerConnection .createDataChannel('oai-events');
      dataChannel.addEventListener('message', (event) => {
        //console.log('Received event:', event);
        console.log('Received message:', event.data);

        let objData = JSON.parse(event.data);


        if (objData.type === "response.done") {
          // Access Base64-encoded audio chunks
           console.log("message received: " + event.data);
           var data = JSON.parse(event.data);

           this.postVoiceMessageWithOpenAIModel(data, true);
        }
        else if (objData.type === "response.content_part.added") {
          // Access Base64-encoded audio chunks
           //console.log("message sent: " + event.data);
           
          // console.log("message received: " + event.data);
         //  var data = JSON.parse(event.data);
           //this.postVoiceMessageWithOpenAIModel(data, false);
        }

        

      });

      // Create SDP offer
      const offerOptions: RTCOfferOptions = {
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      };

      const offer = await   this._rtcPeerConnection .createOffer(offerOptions);
      await   this._rtcPeerConnection .setLocalDescription(offer);

      const baseUrl = 'https://api.openai.com/v1/realtime';
      const model = 'gpt-4o-realtime-preview-2024-12-17';
      //const model = 'ft:gpt-4o-2024-08-06:mortgage-magick-ltd:my-experiment-mm-faq:AxzESrXI';

      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          'Content-Type': 'application/sdp',
        },
      });

      const answer = {
        type: 'answer' as RTCSdpType,
        sdp: await sdpResponse.text(),
      };


      console.log("sdpResponse :" + answer);

      await   this._rtcPeerConnection .setRemoteDescription(answer);

    } catch (error) {
      console.error('Error during WebRTC initialization:', error);
    }


    try{
      window.addEventListener('message', (event) => {
        // Ensure the message comes from the trusted parent domain
       // if (event.origin !== 'https://mortgage-magic.co.uk') return;
      
        if (event.data === 'close-connection') {
          console.log('Closing WebRTC Connection...');
          this.closeWebRTCConnection();
        }
      });
    }
    catch(ex){console.log("window listener add" +ex)}

  }

  public closeRTCPeerConnection()
  {
    if(this._rtcPeerConnection != null)
    {
    this._rtcPeerConnection.close();
    this._rtcPeerConnection.ontrack = null;
    this._rtcPeerConnection.onicecandidate = null;
    this._rtcPeerConnection.oniceconnectionstatechange = null;
    this._rtcPeerConnection.onsignalingstatechange = null;
    }

    if( this._mediaStream != null)
    {
      const tracks = this._mediaStream.getTracks();
      if(tracks != null)
      {
        tracks.forEach(track => track.stop());
      }
    }

  }


  
  
   closeWebRTCConnection() {
    if (this._rtcPeerConnection) {
      this._rtcPeerConnection.close();
      console.log('WebRTC connection closed.');
    }
  }
  
  

  public postVoiceMessageWithOpenAIModel(data: any, isAnswerByAI: boolean) {


  //   {
  //     "type": "response.audio_transcript.done",
  //     "event_id": "event_AoBCcCUrMpFQpesfcJCPu",
  //     "response_id": "resp_AoBCbMoq1FVzg9ihI3teY",
  //     "item_id": "item_AoBCbvcg3Undpq5p2o1NA",
  //     "output_index": 0,
  //     "content_index": 0,
  //     "transcript": "Hello there! How can I assist you with your financial needs today?"
  // }

  
  //var isAnswerByAI: boolean = false;
  var responseId: string = "";
  var responseStatus: string = "";
  var responseAnswerId: string = "";
  var responseAnswerRole: string = "";
  var responseAnswerStatus: string = "";
  var responseAnswerContent: string = "";
  var responseAnswerType: string = "";
  var remarks: string = "";

  var initiatorName = "";
  
  if(isAnswerByAI)
  {
    var   outputdata = data['response']['output'][0];

    if (outputdata['type'] == 'message' && outputdata['role'] == 'assistant') {
     
      var content = outputdata['content'] as Array<any>;
      var msg = content[0]['transcript'] ?? '';

      isAnswerByAI = true;
      responseId = data['event_id'];
      responseAnswerId = data['response']['id'];      
      responseAnswerContent = msg;
      responseAnswerStatus = outputdata['status'];
      responseAnswerRole = outputdata['role'];
      responseAnswerType = content[0]['type'];
      initiatorName = "Melodie";
      //initiatorName = "Liz Elizabeth";
    }

  }
  else 
{
  

  if (data['type'] == 'response.content_part.added') {
  
    //var   outputdata = data['response']['output'][0];

    var content1 = data['part'];
    var msg = content1['transcript'] ?? '';

    isAnswerByAI = false;
     responseId = data['event_id'];
     responseAnswerId = data['response_id'];    

    responseAnswerContent = msg;
    responseAnswerStatus = 'Completed';
    responseAnswerRole = 'User';
    responseAnswerType = content1[0]['type'];
    initiatorName = this._initiatorName;
  }
}


var voiceMessageWithOpenAIEntityModel = {

  initiatorId : this._initiatorId,
  userCompanyId : this._userCompanyId,
userId : this._userId,        
initiatorName : initiatorName,
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

    this._voiceMessageWithOpenAIService.postVoiceMessageWithOpenAIWithMMServer(voiceMessageWithOpenAIEntityModel).subscribe({
      next: (responseData) => {
        console.log(responseData);
        // if (responseData.Success && responseData.ResponseData != null) {

        // }
      },
      error: (response) => {
        console.log(response);
        console.log(response.error);
      },
    });

  }





   // CORS testing POST request
  //  const postUrl = 'https://chatms.financemagic.co.uk/api/chatmicroservice/voicemessagewithopenai/post';
  //  const postData = {
  //    "initiatorId":115765,"userCompanyId":1003,"userId":115765,"initiatorName":"Melodie","isAnswerByAI":true,"responseId":"event_Ay0rFDpdvWlHhEIG2x0Mk","responseStatus":"","responseAnswerId":"resp_Ay0rBqRRjq71YaZ7b4W3r","responseAnswerRole":"assistant","responseAnswerStatus":"completed","responseAnswerContent":"Certainly! You can access the Mortgage Sourcing System through the Mortgage Magic™ platform. Just log in to your account, and you'll find the mortgage sourcing feature in the dashboard. If you need any guidance navigating the system or finding specific mortgage products, feel free to ask. I'm here to help!","responseAnswerType":"audio","remarks":""
  //  };

  //  const headers = new HttpHeaders({
  //    'Content-Type': 'application/json',
  //    'Authorization': 'Bearer your_token_here'  // Add authorization token if required
  //  });

  //  this.http.post(postUrl, postData, { headers }).subscribe({
  //    next: (response) => {
  //      console.log('POST API Response:', response);
  //    },
  //    error: (error) => {
  //      console.error('POST Error:', error);
  //    }
  //  });



}



// import { Injectable } from '@angular/core';
// import { OpenAIAuthenticationService } from './openaiaithentication.service';

// @Injectable({
//   providedIn: 'root',
// })

// export class WebRTCService {


//   async init(EPHEMERAL_KEY_1 : string): Promise<void> {
//     try {
//       // Get an ephemeral key from your server
//     //   const tokenResponse =  await fetch('/session');
     
//     //   const data = await tokenResponse.json();
//        //const EPHEMERAL_KEY = data.client_secret.value;
//        const EPHEMERAL_KEY = EPHEMERAL_KEY_1;
       

//       // Create a peer connection
//       const pc = new RTCPeerConnection();

//       // Set up to play remote audio from the model
//       const audioEl = document.createElement('audio');
//       audioEl.autoplay = true;
//      // pc.ontrack = (e) => (audioEl.srcObject = e.streams[0]);

//       pc.ontrack = (e) => {
//         console.log('Remote track received:', e.streams[0]);
//         if (e.streams[0]) {
//           audioEl.srcObject = e.streams[0];
//           document.body.appendChild(audioEl); // Ensure audio element is in the DOM
//         } else {
//           console.error('No streams found in remote track event.');
//         }
//       };

//       // Add local audio track for microphone input in the browser
//       const ms = await navigator.mediaDevices.getUserMedia({
//         audio: true,
//       });
//       pc.addTrack(ms.getTracks()[0]);

//       // Set up data channel for sending and receiving events
//       const dc = pc.createDataChannel('oai-events');
//       dc.addEventListener('message', (e) => {
//         console.log('Received message:', e.data);
//       });

//       // Start the session using the Session Description Protocol (SDP)
//       const offerOptions = {
//         offerToReceiveAudio: true,
//         offerToReceiveVideo: false,
//       };
//       const offer = await pc.createOffer(offerOptions);
//       await pc.setLocalDescription(offer);

//       const baseUrl = 'https://api.openai.com/v1/realtime';
//       const model = 'gpt-4o-realtime-preview-2024-12-17';
//       const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
//         method: 'POST',
//         body: offer.sdp,
//         headers: {
//           Authorization: `Bearer ${EPHEMERAL_KEY}`,
//           'Content-Type': 'application/sdp',
//         },
//       });
      
//       const answer =  {
//         type: 'answer' as RTCSdpType,
//         sdp: await sdpResponse.text(),
//       };

//       await pc.setRemoteDescription(answer);

//     } catch (error) {
//       console.error('Error during WebRTC initialization:', error);
//     }
//   }
// }
