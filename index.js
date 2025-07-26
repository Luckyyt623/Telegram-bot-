"use strict";
var WebSocket = require('ws');
var SocksProxyAgent = require('socks-proxy-agent');
var HttpsProxyAgent = require('https-proxy-agent');
var colors = require('colors');
var asciiArt = require('ascii-art');
var bots = [];
var port = 8080;
var io = require('socket.io')(port);
var fs = require('fs');

// Load proxies
var proxies = fs.readFileSync("proxies.txt", "utf8").split("\n").filter(function(a) {
    return !!a;
});
var httpProxies = fs.readFileSync("httpProxy.txt", "utf8").split("\n").filter(function(a) {
    return !!a;
});

var server = "";
var origin = null;
var xPos, yPos, byteLength = 0;
var connectedCount = 0;
var botCount = 2000;
var client = null;
var users = 0;
var sendCountUpdate = function() {};
var spawnBuf = new Uint8Array([115,10,1,15,32,42,78,101,119,42,77,101,77,101,122,66,111,116,115]);

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomIntCharAt(min, max) {
    return (Math.floor(Math.random() * (max - min + 1)) + min).charCodeAt;
}

function appendStringBytes(string, buf) {
    for (var i = 0; i < string.length; i++) {
        buf[3 + i] = string.charCodeAt[i];
    }
    return buf;
}

function getHost(a) {
    a = a.replace(/[/slither]/g, '');
    a = a.replace(/[ws]/g, '');
    a = a.replace(/[/]/g, '');
    a = a.substr(1);
    return a;
}

function prepareData(a) {
    return new DataView(new ArrayBuffer(a));
}

function createAgent(b) {
    var proxy = b.split(':');
    // Use SocksProxyAgent with proper connection string
    return new SocksProxyAgent(`socks${proxy[2] || 5}://${proxy[0]}:${proxy[1]}`);
}

function createHttpAgent(b) {
    var proxy = b.split(':');
    return new HttpsProxyAgent(`http://${proxy[0]}:${proxy[1]}`);
}

function Bot(id) {
    this.id = id;
    this.connect();
}

Bot.prototype = {
    needPing: false,
    snakeID: null,
    snakeX: 0,
    snakeY: 0,
    headX: 0,
    headY: 0,
    snakeAngle: 0,
    haveSnakeID: false,
    isBoost: false,
    hasConnected: false,
    send: function(buf) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN)
            return;
        this.ws.send(buf);
    },
    connect: function() {
        try {
            if (Math.random() >= 0.5 && proxies.length > 0) {
                this.ws = new WebSocket(server, {
                    headers: {
                        'Origin': origin,
                        'Accept-Encoding': 'gzip, deflate',
                        'Accept-Language': 'en-US,en;q=0.8',
                        'Cache-Control': 'no-cache',
                        'Connection': 'Upgrade',
                        'Host': getHost(server),
                        'Pragma': 'no-cache',
                        'Upgrade': 'websocket',
                        'Sec-WebSocket-Version': '13',
                        'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36'
                    },
                    agent: createAgent(proxies[~~(Math.random() * proxies.length)])
                });
            } else if (httpProxies.length > 0) {
                this.ws = new WebSocket(server, {
                    headers: {
                        'Origin': origin,
                        'Accept-Encoding': 'gzip, deflate',
                        'Accept-Language': 'en-US,en;q=0.8',
                        'Cache-Control': 'no-cache',
                        'Connection': 'Upgrade',
                        'Host': getHost(server),
                        'Pragma': 'no-cache',
                        'Upgrade': 'websocket',
                        'Sec-WebSocket-Version': '13',
                        'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36'
                    },
                    agent: createHttpAgent(httpProxies[~~(Math.random() * httpProxies.length)])
                });
            } else {
                // No proxies available, connect directly
                this.ws = new WebSocket(server, {
                    headers: {
                        'Origin': origin,
                        'Accept-Encoding': 'gzip, deflate',
                        'Accept-Language': 'en-US,en;q=0.8',
                        'Cache-Control': 'no-cache',
                        'Connection': 'Upgrade',
                        'Host': getHost(server),
                        'Pragma': 'no-cache',
                        'Upgrade': 'websocket',
                        'Sec-WebSocket-Version': '13',
                        'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36'
                    }
                });
            }

            this.binaryType = "nodebuffer";
            this.ws.onmessage = this.onMessage.bind(this);
            this.ws.onopen = this.onOpen.bind(this);
            this.ws.onclose = this.onClose.bind(this);
            this.ws.onerror = this.onError.bind(this);
        } catch (e) {
            console.error(`Error connecting bot ${this.id}:`, e.message);
            setTimeout(this.connect.bind(this), 5000);
        }
    },
    spawn: function() {
        this.send(spawnBuf);
    },
    moveTo: function(x, y) {
        var value = this.getValue(this.snakeX, this.snakeY, x, y);
        this.snakeAngle = value;
        if (value < 0 || value > 250) {
            console.log("Error in angle calculation!");
            return;
        }
        var buf = new Buffer([Math.floor(value)]);
        this.send(buf);
    },
    getValue: function(originX, originY, targetX, targetY) {
        var dx = originX - targetX;
        var dy = originY - targetY;
        var theta = Math.atan2(-dy, -dx);
        theta *= 125 / Math.PI;
        if (theta < 0) theta += 250;
        return theta;
    },
    onOpen: function(b) {
        client = this;
        this.send(new Buffer([99]));
        this.hasConnected = true;
        connectedCount++;
        sendCountUpdate();
    },
    onClose: function() {
        client = this;
        this.needPing = false;
        this.haveSnakeID = false;
        if (this.hasConnected) {
            connectedCount--;
            sendCountUpdate();
        }
        setTimeout(this.connect.bind(this), 5000);
    },
    onError: function(e) {
        this.needPing = false;
        console.error(`Bot ${this.id} connection error:`, e.message);
        setTimeout(this.connect.bind(this), 5000);
    },
    decodeSecrect: function(secret) {
        var result = new Uint8Array(24);
        var globalValue = 0;
        for (var i = 0; i < 24; i++) {
            var value1 = secret[17 + i * 2];
            if (value1 <= 96) {
                value1 += 32;
            }
            value1 = (value1 - 98 - i * 34) % 26;
            if (value1 < 0) {
                value1 += 26;
            }

            var value2 = secret[18 + i * 2];
            if (value2 <= 96) {
                value2 += 32;
            }
            value2 = (value2 - 115 - i * 34) % 26;
            if (value2 < 0) {
                value2 += 26;
            }

            var interimResult = (value1 << 4) | value2;
            var offset = interimResult >= 97 ? 97 : 65;
            interimResult -= offset;
            if (i == 0) {
                globalValue = 2 + interimResult;
            }
            result[i] = ((interimResult + globalValue) % 26 + offset);
            globalValue += 3 + interimResult;
        }
        return result;
    },
    boostSpeed: function(a) {
        client = this;
        if (a) {
            this.isBoost = true;
            client.send(new Buffer([253]));
        } else {
            this.isBoost = false;
            client.send(new Buffer([254]));
        }
    },
    disconnect: function() {
        if (this.ws) this.ws.close();
        this.haveSnakeID = false;
    },
    onMessage: function(b) {
        client = this;
        var lol = new Uint8Array(b.data);
        var f = String.fromCharCode(lol[2]);
        var snakeSpeed, lastPacket, etm;

        if (lol.length >= 2) {
            if ("6" == f) {
                console.log("PerInitRespone");
                this.send(this.decodeSecrect(lol));
                this.spawn();
            } else if ("p" == f) {
                this.needPing = true;
            } else if ("a" == f) {
                console.log("Initial setup");
                setInterval(function() {
                    client.moveTo(xPos, yPos);
                }, 100);
                setInterval(function() {
                    client.send(new Buffer([251]));
                }, 250);
            } else if ("v" == f) {
                console.log("dead");
                this.haveSnakeID = false;
                this.disconnect();
            } else if ("g" == f) {
                if ((lol[3] << 8 | lol[4]) == this.snakeID) {
                    this.snakeX = lol[5] << 8 | lol[6];
                    this.snakeY = lol[7] << 8 | lol[8];
                }
            } else if ("n" == f) {
                if ((lol[3] << 8 | lol[4]) == this.snakeID) {
                    this.snakeX = lol[5] << 8 | lol[6];
                    this.snakeY = lol[7] << 8 | lol[8];
                }
            } else if ("G" == f) {
                if ((lol[3] << 8 | lol[4]) == this.snakeID) {
                    this.snakeX = this.snakeX + lol[5] - 128;
                    this.snakeY = this.snakeY + lol[6] - 128;
                }
            } else if ("N" == f) {
                if ((lol[3] << 8 | lol[4]) == this.snakeID) {
                    this.snakeX = this.snakeX + lol[5] - 128;
                    this.snakeY = this.snakeY + lol[6] - 128;
                }
            } else if ("s" == f) {
                if (!this.haveSnakeID) {
                    this.snakeID = lol[3] << 8 | lol[4];
                    this.haveSnakeID = true;
                }
                if ((lol[3] << 8 | lol[4]) == this.snakeID) {
                    if (lol.length >= 31) {
                        snakeSpeed = (lol[12] << 8 | lol[13]) / 1e3;
                    }
                    if (lol.length >= 31 && (((((lol[18] << 16) | (lol[19] << 8) | lol[20]) / 5.0) > 99) || ((((lol[21] << 16) | (lol[22] << 8) | lol[23]) / 5.0) > 99))) {
                        this.snakeX = ((lol[18] << 16) | (lol[19] << 8) | lol[20]) / 5.0;
                        this.snakeY = ((lol[21] << 16) | (lol[22] << 8) | lol[23]) / 5.0;
                    }
                }
            }
        }
    }
};

function start() {
    // Clear existing bots
    for (var i in bots) {
        bots[i].disconnect();
    }
    bots = [];
    
    // Start new bots
    var i = 0;
    var connectInterval = setInterval(function() {
        if (i < botCount) {
            bots.push(new Bot(i));
            i++;
        } else {
            clearInterval(connectInterval);
        }
    }, 5);
}

io.on('connection', function(socket) {
    users++;
    var address = socket.request.connection.remoteAddress;
    console.log('User connected from: ' + address);
    
    sendCountUpdate = function() {
        socket.emit("botCount", connectedCount);
    };
    
    socket.on('start', function(data) {
        server = data.ip;
        origin = data.origin;
        start();
        console.log('Target server: ' + server);
        console.log('Using origin: ' + origin);
        console.log('Starting bot network...');
    });
    
    socket.on('movement', function(data) {
        xPos = data.x;
        yPos = data.y;
    });
    
    socket.on('boostSpeed', function() {
        for (var i in bots) {
            bots[i].boostSpeed(true);
        }
    });
    
    socket.on('normalSpeed', function() {
        for (var i in bots) {
            bots[i].boostSpeed(false);
        }
    });
    
    socket.on('disconnect', function() {
        users--;
        console.log('User disconnected. Remaining users: ' + users);
    });
});

// Display ASCII art and start info
asciiArt.font('MeMezBots-SlitherIO', 'Doom', function(rendered) {
    console.log(rendered);
    console.log(`Server listening on port ${port}`.green);
    console.log('INFO: Bots will automatically reconnect on errors'.green);
});

// Default server (can be overridden via the web interface)
server = "ws://148.113.20.151:475/slither";
origin = "http://slither.io/";