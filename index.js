const axios = require('axios');
const fs = require('fs');
const WebSocket = require('ws');
const path = require('path');
const config = require('./config.json');

const FILEPATH = './tokens.txt';
const INTERVAL = 5 * 60 * 1000;
const GATEWAY_URL =  "wss://gateway.discord.gg/?v=10&encoding=json";
const DISCORD_USER_URL = "https://discord.com/api/v9/users/@me";

function getTimestamp() {
    return `[${new Date().toLocaleTimeString()}]`;
}

function readAndSortTokens(filepath) {
    return fs.readFileSync(filepath, 'utf-8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .sort();
}

async function checkToken(token, index) {
    try {
        await axios.get(DISCORD_USER_URL, {
            headers: { Authorization: token }
        });
        console.log(`${getTimestamp()} Token ${index + 1} is valid`);
        return token;
    } catch (error) {
        if (error.response && error.response.status === 401) {
            console.error(`${getTimestamp()} Token ${index + 1} is invalid, remove or replace it from tokens.txt`);
        } else {
            console.error(`${getTimestamp()} Error checking token ${index + 1}: ${error.message}`);
        }
        return null;
    }
}

async function validateTokens(tokens) {
    const checks = tokens.map((token, index) => checkToken(token, index));
    const results = await Promise.all(checks);
    return results.filter(Boolean);
}

function wsJoin(token) {
    const ws = new WebSocket(GATEWAY_URL);
    const auth = {
        op: 2,
        d: {
            token,
            properties: {
                $os: 'Linux',
                $browser: 'Firefox',
                $device: 'desktop'
            }
        }
    };
    const vc = {
        op: 4,
        d: {
            guild_id: config.GUILD_ID,
            channel_id: config.VC_CHANNEL,
            self_mute: config.MUTED,
            self_deaf: config.DEAFEN
        }
    };

    ws.on('message', (data) => {
        const payload = JSON.parse(data);
        const {t, op, d } = payload;
        if (op === 10) {
        const heartbeatInterval = d.heartbeat_interval;
        setInterval(() => {
            ws.send(JSON.stringify({ op: 1, d: null }));
        }, heartbeatInterval);
    }

    if (op === 11) {
        // Heartbeat ACK
    }
});
    
    ws.on('open', () => {
        ws.send(JSON.stringify(auth));
        setTimeout(() => ws.send(JSON.stringify(vc)), 1000);
        console.info(`${getTimestamp()} ${token.slice(0, 10)}... joined voice channel`);
    });
    ws.on('error', err => {
        console.error(`${getTimestamp()} WebSocket error for ${token.slice(0, 10)}...: ${err.message}`);
    });
    setTimeout(() => ws.close(), INTERVAL - 1000);
  ws.on('close', () => {
  console.info(`${getTimestamp()} ${token.slice(0, 10)}... disconnected`);
});
}

async function main() {
    const tokens = readAndSortTokens(FILEPATH); // sort
    const validTokens = await validateTokens(tokens); // validate
    validTokens.forEach(wsJoin);
    setInterval(() => {
        validTokens.forEach(wsJoin);
    }, INTERVAL);
}

main();

