

export interface VoiceMessageWithOpenAIModel{
    userCompanyId: number,
    userId: number,
    initiatorId: number,
    initiatorName: string,
    isAnswerByAI: boolean,
    responseId: string,
    responseStatus: string,
    responseAnswerId: string,
    responseAnswerRole: string,
    responseAnswerStatus: string,
    responseAnswerContent: string,
    responseAnswerType: string,
    remarks: string,
}
