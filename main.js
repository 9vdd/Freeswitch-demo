var elements = {
    loginForm:      document.getElementById('config-form'),
    status:        document.getElementById('ua-status'),
    registerButton:  document.getElementById('ua-register'),
    inviteButton:    document.getElementById('ua-invite-submit'),
    video:         document.getElementById('ua-video'),
    uaURI:           document.getElementById('ua-uri'),
    sessionList:     document.getElementById('session-list'),
    sessionTemplate: document.getElementById('session-template'),
    newSessionForm:  document.getElementById('new-session-form')
};

var config = {
    userAgentString: 'SIP.js/0.7.7-devel BB',
    traceSip: true,
    register: false
};

var ua;

var sessionUIs = {};

elements.loginForm.addEventListener('submit', function (e) {
    var form, i, l, name, valuev;
    e.preventDefault();

    form = elements.loginForm;

    document.getElementById('videoframe').style.display = 'none';

    for (i = 0, l = form.length; i < l; i++) {
        name = form[i].name;
        valuev = form[i].value;
        if (name !== 'configSubmit' && valuev !== '') {
            config[name] = valuev;
        }
    }

    elements.status.innerHTML = 'Connecting...';

    ua = new SIP.UA(config);

    ua.on('connected', function () {
        elements.status.innerHTML = 'Connected (Unregistered)';
    });

    ua.on('registered', function () {
        elements.status.innerHTML = 'Connected (Registered)';
    });

    ua.on('unregistered', function () {
        elements.status.innerHTML = 'Connected (Unregistered)';
    });

    ua.on('invite', function (session) {
        createNewSessionUI(session.remoteIdentity.uri, session);
    });

    ua.on('message', function (message) {
        if (!sessionUIs[message.remoteIdentity.uri]) {
            createNewSessionUI(message.remoteIdentity.uri, null, message);
        }
    });

    document.body.className = 'started';

    if (!ua) return;

    if (ua.isRegistered()) {
        ua.unregister();
    } else {
        ua.register();
    }
}, false);

function inviteSubmit(e) {
    e.preventDefault();
    e.stopPropagation();

    // Parse config options
    var video = false;
    var uri = elements.uaURI.value;
    elements.uaURI.value = '';

    if (!uri) return;

    // Send invite
    var session = ua.invite(uri, {
        mediaConstraints: {
            audio: true,
            video: video
        }
    });

    // Create new Session and append it to list
    var ui = createNewSessionUI(uri, session);
}

elements.inviteButton.addEventListener('click', inviteSubmit, false);
elements.newSessionForm.addEventListener('submit', inviteSubmit, false);


function createNewSessionUI(uri, session, message) {
    var tpl = elements.sessionTemplate;
    var node = tpl.cloneNode(true);
    var sessionUI = {};

    uri = session ?
        session.remoteIdentity.uri :
        SIP.Utils.normalizeTarget(uri, ua.configuration.hostport_params);
    var displayName = 'you friend or serial killer';

    if (!uri) { return; }

    // Save a bunch of data on the sessionUI for later access
    sessionUI.session        = session;
    sessionUI.node           = node;
    sessionUI.displayName    = node.querySelector('.display-name');
    sessionUI.uri            = node.querySelector('.uri');
    sessionUI.green          = node.querySelector('.green');
    sessionUI.red            = node.querySelector('.red');
    sessionUI.dtmf           = node.querySelector('.dtmf');
    sessionUI.video          = node.querySelector('video');

    sessionUIs[uri] = sessionUI;

    // Update template
    node.classList.remove('template');
    sessionUI.displayName.textContent = displayName || uri.user;
    sessionUI.uri.textContent = '<' + uri + '>';

    //here comes end of ui creation

    // DOM event listeners
    sessionUI.green.addEventListener('click', function () {
        var session = sessionUI.session;
        if (!session) {
            session = sessionUI.session = ua.invite(uri, {
                mediaConstraints: {
                    audio: true,
                    video: false
                }
            });

            setUpListeners(session);
        } else if (session.accept && !session.startTime) { // Incoming, not connected
            session.accept({
                mediaConstraints: {
                    audio: true,
                    video: false
                }
            });
        }
    }, false);

    sessionUI.red.addEventListener('click', function () {
        var session = sessionUI.session;
        if (!session) {
            return;
        } else if (session.startTime) { // Connected
            session.bye();
        } else if (session.reject) { // Incoming
            session.reject();
        } else if (session.cancel) { // Outbound
            session.cancel();
        }
    }, false);


    // Initial DOM state
    if (session && !session.accept) {
        sessionUI.green.disabled = true;
        sessionUI.green.innerHTML = '...';
        sessionUI.red.innerHTML = 'Cancel';
    } else if (!session) {
        sessionUI.red.disabled = true;
        sessionUI.green.innerHTML = 'Invite';
        sessionUI.red.innerHTML = '...';
    } else {
        sessionUI.green.innerText = 'Accept';
        sessionUI.red.innerHTML = 'Reject';
    }

    // SIP.js event listeners
    function setUpListeners(session) {
        sessionUI.red.disabled = false;

        if (session.accept) {
            sessionUI.green.disabled = false;
            sessionUI.green.innerHTML = 'Accept';
            sessionUI.red.innerHTML = 'Reject';
        } else {
            sessionUI.green.innerHMTL = '...';
            sessionUI.red.innerHTML = 'Cancel';
        }

        session.on('accepted', function () {
            sessionUI.green.disabled = true;
            sessionUI.green.innerHTML = '...';
            sessionUI.red.innerHTML = 'Bye';
            //sessionUI.dtmfInput.disabled = false;
            sessionUI.video.className = 'on';

            var element = sessionUI.video;
            var stream = this.mediaHandler.getRemoteStreams()[0];



            if (typeof element.srcObject !== 'undefined') {
                element.srcObject = stream;
            } else if (typeof element.mozSrcObject !== 'undefined') {
                element.mozSrcObject = stream;
            } else if (typeof element.src !== 'undefined') {
                element.src = URL.createObjectURL(stream);
            } else {
                console.log('Error attaching stream to element.');
            }
        });

        session.on('bye', function () {
            sessionUI.green.disabled = false;
            sessionUI.red.disabled = true;
            //sessionUI.dtmfInput.disable = true;
            sessionUI.green.innerHTML = 'Invite';
            sessionUI.red.innerHTML = '...';
            sessionUI.video.className = '';
            delete sessionUI.session;
        });

        session.on('failed', function () {
            sessionUI.green.disabled = false;
            sessionUI.red.disabled = true;
            //sessionUI.dtmfInput.disable = true;
            sessionUI.green.innerHTML = 'Invite';
            sessionUI.red.innerHTML = '...';
            sessionUI.video.className = '';
            delete sessionUI.session;
        });

        session.on('refer', function (target) {
            session.bye();

            createNewSessionUI(target, ua.invite(target, {
                mediaConstraints: {
                    audio: true,
                    video: false
                }
            }));
        });
    }

    if (session) {
        setUpListeners(session);
    }

    // Add node to live session list
    elements.sessionList.appendChild(node);
}