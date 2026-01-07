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
    console.log(`${getTimestamp()} Validating ${tokens.length} tokens...`);
    const results = await Promise.all(tokens.map((token, index) => checkToken(token, index)));
    const validTokens = tokens.filter((_, i) => results[i] !== null);
    console.log(`${getTimestamp()} ${validTokens.length}/${tokens.length} tokens are valid.`);
    return validTokens;
}

function wsJoin(token) {
    let ws = new WebSocket(GATEWAY_URL);
    let heartbeatInterval = null;
    let sequence = null;

    const auth = {
        op: 2,
        d: {
            token,
            properties: {
                os: 'Linux',
                browser: 'Firefox',
                device: 'desktop'
            }
        }
    };

    const vc = {
        op: 4,
        d: {
            guild_id: config.GUILD_ID,
            channel_id: config.VC_CHANNEL,
            self_mute: !!config.MUTED,
            self_deaf: !!config.DEAFEN
        }
    };

    ws.on('open', () => {
        ws.send(JSON.stringify(auth));
        console.info(`${getTimestamp()} ${token.slice(0, 10)}... connected and identified`);
    });

    ws.on('message', (data) => {
        try {
            const payload = JSON.parse(data);
            const { op, t, s, d } = payload;
            if (s) sequence = s;

            if (op === 10) { // Hello
                const interval = d.heartbeat_interval * 0.9; // slight jitter
                if (heartbeatInterval) clearInterval(heartbeatInterval);
                heartbeatInterval = setInterval(() => {
                    ws.send(JSON.stringify({ op: 1, d: sequence }));
                }, interval);

                // Join voice shortly after identify
                setTimeout(() => {
                    ws.send(JSON.stringify(vc));
                    console.info(`${getTimestamp()} ${token.slice(0, 10)}... joined voice channel`);
                }, 2000);
            }
        } catch (e) {
            console.error(`${getTimestamp()} Parse error:`, e.message);
        }
    });

    ws.on('close', (code) => {
        console.info(`${getTimestamp()} ${token.slice(0, 10)}... disconnected (${code}), reconnecting in 5-10s...`);
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        ws = null;
        // Auto-reconnect
        setTimeout(() => wsJoin(token), 5000 + Math.random() * 5000);
    });

    ws.on('error', (err) => {
        console.error(`${getTimestamp()} WS Error (${token.slice(0, 10)}...): ${err.message}`);
    });
}

async function main() {
    const tokens = readAndSortTokens(FILEPATH); 
    const validTokens = await validateTokens(tokens); 
    validTokens.forEach(wsJoin);
    setInterval(() => {
        validTokens.forEach(wsJoin);
    }, INTERVAL);
}

main();




