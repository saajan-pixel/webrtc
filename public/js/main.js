const createUserBtn = document.getElementById("create-user");
const username = document.getElementById("username");
const allUsersHtml = document.getElementById("allusers");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const endCallBtn = document.getElementById("end-call-btn");

const socket = io();
let localStream;
let caller;

// Singleton method -> Create one instance and use it throughout all application process
const PeerConnection = (function () {
  let peerConnection;

  const createPeerConnection = () => {
    const iceServers = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun.l.google.com:5349" },
      { urls: "stun:stun1.l.google.com:3478" },
      { urls: "stun:stun1.l.google.com:5349" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:5349" },
      { urls: "stun:stun3.l.google.com:3478" },
      { urls: "stun:stun3.l.google.com:5349" },
      { urls: "stun:stun4.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:5349" },
      {
        urls: "turn:global.relay.metered.ca:443",
        username: "openai",
        credential: "openai",
      },
    ];

    peerConnection = new RTCPeerConnection(iceServers);

    // add local stream to peer connection
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });
    // listen to remote stream and add to peer connection
    peerConnection.ontrack = function (event) {
      remoteVideo.srcObject = event.streams[0];
    };
    // listen for ice candidate
    peerConnection.onicecandidate = function (event) {
      if (event.candidate) {
        socket.emit("icecandidate", event.candidate);
      }
    };

    return peerConnection;
  };

  return {
    getInstance: () => {
      if (!peerConnection) {
        peerConnection = createPeerConnection();
      }

      return peerConnection;
    },
  };
})();

// handle browser events
createUserBtn.addEventListener("click", () => {
  if (username.value !== "") {
    const usernameContainer = document.querySelector(".username-input");
    socket.emit("join-user", username.value);
    usernameContainer.style.display = "none";
  }
});

endCallBtn.addEventListener("click", (e) => {
  socket.emit("call-ended", caller);
});

// handle socket events
socket.on("joined", (allUsers) => {
  console.log(allUsers);
  const createUsersHtml = () => {
    allUsersHtml.innerHTML = "";
    for (const user in allUsers) {
      const li = document.createElement("li");
      li.textContent = `${user} ${user === username.value ? "(You)" : ""}`;

      if (user !== username.value) {
        const button = document.createElement("button");
        button.textContent = "Call";
        button.classList.add("call-btn");
        button.addEventListener("click", () => {
          startCall(user);
        });
        li.appendChild(button);
      }
      allUsersHtml.appendChild(li);
    }
  };

  createUsersHtml();
});

socket.on("offer", async ({ from, to, offer }) => {
  const pc = PeerConnection.getInstance();
  // set remote description
  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("answer", { from, to, answer: pc.localDescription });
  caller = [from, to];
});

socket.on("answer", async ({ from, to, answer }) => {
  const pc = PeerConnection.getInstance();
  await pc.setRemoteDescription(answer);

  // show end call btn
  endCallBtn.style.display = "block";
  socket.emit("end-call", { from, to });
  caller = [from, to];
});

socket.on("icecandidate", async (candidate) => {
  const pc = PeerConnection.getInstance();
  await pc.addIceCandidate(new RTCIceCandidate(candidate));
});

socket.on("end-call", ({ from, to }) => {
  endCallBtn.style.display = "block";
});

socket.on("call-ended", (caller) => {
  endCall();
});

const startCall = async (user) => {
  const pc = PeerConnection.getInstance();
  const offer = await pc.createOffer();

  await pc.setLocalDescription(offer);
  socket.emit("offer", {
    from: username.value,
    to: user,
    offer: pc.localDescription,
  });
};

const endCall = () => {
  const pc = PeerConnection.getInstance();
  if (pc) {
    pc.close();
    endCallBtn.style.display = "none";
  }
};

// initialize app
const startMyVideo = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    console.log("Stream", stream);
    localStream = stream;
    localVideo.srcObject = stream;
  } catch (error) {
    console.error(error);
  }
};

startMyVideo();
