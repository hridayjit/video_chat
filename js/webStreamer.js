import {$self, $peer} from './pairedNodes.js';


//page events
function prepareNamespace(hash, set_location) {
    let ns = hash.replace(/^#/, ''); // remove # from the hash
    if (/^[0-9]{7}$/.test(ns)) {
        console.log('Checked existing namespace', ns);
        return ns;
    }
    ns = Math.random().toString().substring(2, 9);
    console.log('Created new namespace', ns);
    if (set_location) window.location.hash = ns;
    return ns;
}

function resetPeer(peer) {
    displayStream(null, '#peer');
    peer.connection.close();
    peer.connection = new RTCPeerConnection($self.rtcConfig);
}

function joinCall() {
    $self.socket.open();

}
function leaveCall() {
    $self.socket.close();
    resetPeer($peer);
}

function handleCallButton(event) {
    const call_button = event.target;
    if (call_button.className === 'join') {
        console.log('Joining the call...');
        call_button.className = 'leave';
        call_button.innerText = 'Leave Call';
        joinCall();
    } else {
        console.log('Leaving the call...');
        call_button.className = 'join';
        call_button.innerText = 'Join Call';
        leaveCall();
    }
}

function displayStream(stream, selector) {
    document.querySelector(selector).srcObject = stream;
}

async function requestUserMedia(media_constraints) {
    $self.mediaStream = new MediaStream();
    $self.media = await navigator.mediaDevices.getUserMedia(media_constraints);
    // $self.mediaStream.addTrack($self.media.getTracks()[0]);
    $self.mediaStream.addTrack($self.media.getVideoTracks()[0]);
    $self.mediaStream.addTrack($self.media.getAudioTracks()[0]);
    console.log($self.mediaStream);
    displayStream($self.mediaStream, '#self');
}

//webrtc


async function handleRtcConnectionNegotiation() {
    $self.isMakingOffer = true;
    console.log('Attempting to make an offer...');
    await $peer.connection.setLocalDescription();
    $self.socket.emit('signal', { description: $peer.connection.localDescription });
    $self.isMakingOffer = false;
}
function handleRtcIceCandidate({candidate}) {
    console.log('Attempting to handle an ICE candidate...');
    $self.socket.emit('signal', { candidate: candidate });
}

function handleRtcPeerTrack({ track, streams: [stream] }) {
    // TODO: Handle peer media tracks
    console.log('Attempt to display media from peer...');
    console.log(stream);
    displayStream(stream, '#peer');
}

function registerRtcCallbacks(peer) {
    peer.connection.onnegotiationneeded = handleRtcConnectionNegotiation;
    peer.connection.onicecandidate = handleRtcIceCandidate;
    peer.connection.ontrack = handleRtcPeerTrack;
}

function addStreamingMedia(stream, peer) {
    if (stream) {
        for (let track of stream.getTracks()) {
            peer.connection.addTrack(track, stream);
        }
    }
}

function establishCallFeatures(peer) {
    registerRtcCallbacks(peer);
    addStreamingMedia($self.mediaStream, peer);
}

function handleScConnect() {
    console.log('Successfully connected to the signaling server!');
    document.querySelector('#header h1').innerText = 'Welcome to Room #' + $self.namespace;
    establishCallFeatures($peer);
}

function handleScConnectedPeer() {
    $self.isPolite = true;
}
function handleScDisconnectedPeer() {
    resetPeer($peer);
    establishCallFeatures($peer);
}

async function handleScSignal({ description, candidate }) {
    if (description) {
        const ready_for_offer = !$self.isMakingOffer && ($peer.connection.signalingState === 'stable' || $self.isSettingRemoteAnswerPending);
        const offer_collision = description.type === 'offer' && !ready_for_offer;
        $self.isIgnoringOffer = !$self.isPolite && offer_collision;
        if ($self.isIgnoringOffer) {
            return;
        }
        $self.isSettingRemoteAnswerPending = description.type === 'answer';
        await $peer.connection.setRemoteDescription(description);
        $self.isSettingRemoteAnswerPending = false;
        if (description.type === 'offer') {
            await $peer.connection.setLocalDescription();
            $self.socket.emit('signal', { description: $peer.connection.localDescription });
        }
    } else if (candidate) {
        // Handle ICE candidates
        try {
            await $peer.connection.addIceCandidate(candidate);
        } catch(e) {
            // Log error unless $self is ignoring offers
            // and candidate is not an empty string
            if (!$self.isIgnoringOffer && candidate.candidate.length > 1) {
                console.error('Unable to add ICE candidate for peer:', e);
            }
        }
    }
}
//sockets
function registerScCallbacks() {
    $self.socket.on('connect', handleScConnect);
    $self.socket.on('connected peer', handleScConnectedPeer);
    $self.socket.on('disconnected peer', handleScDisconnectedPeer);
    $self.socket.on('signal', handleScSignal);
}

//end of functions



window.onload = () => {
    console.log(window.location.hash);
    $self.namespace = prepareNamespace(window.location.hash, true);
    $self.socket = io('http://140.245.28.61:3000/'+$self.namespace, {autoConnect: false});
    registerScCallbacks();
    requestUserMedia($self.mediaConstraints);
};

document.querySelector('#call-button').addEventListener('click', handleCallButton);

// console.log($self);