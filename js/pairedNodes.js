export const $self = {
    rtcConfig: null,
    isPolite: false,
    isMakingOffer: false,
    isIgnoringOffer: false,
    isSettingRemoteAnswerPending: false,
    mediaConstraints: { audio: true, video: true },
    socket: null,
    namespace: null
};

export const $peer = {
    connection: new RTCPeerConnection($self.rtcConfig),

};