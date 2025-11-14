
import { TestBed, async, inject } from '@angular/core/testing';
import { VoiceMessageWithOpenAIService } from './VoiceMessageWithOpenAI.service';

describe('Service: ChatService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [VoiceMessageWithOpenAIService]
    });
  });

  it('should ...', inject([VoiceMessageWithOpenAIService], (service: VoiceMessageWithOpenAIService) => {
    expect(service).toBeTruthy();
  }));
});
 