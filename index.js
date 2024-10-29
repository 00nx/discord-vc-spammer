const axios = require('axios');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const config = require('./config.json');

const filepath = './tokens.txt';

function sort(filepath) {
    const fileContent = fs.readFileSync(filepath, 'utf-8');
    return fileContent.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .sort();
}

async function checkTokens(tokens) {
    const validTokens = [];

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        try {
            const response = await axios.get('https://discord.com/api/v10/users/@me', {
                headers: {
                    Authorization: `${token}`
                }
            });
            console.log(`Token ${i + 1} is valid:`);
            validTokens.push(token);
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.error(`Token ${i + 1} is invalid`);
            } else {
                console.error(`Error checking token ${i + 1}:`, error.message);
            }
        }
    }
    return validTokens;
}

function ws_joiner(token, username) {
    const ws = new WebSocket('wss://gateway.discord.gg/?v=9&encoding=json');
    const auth = {
        op: 2,
        d: {
            token: token,
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

    ws.on('open', () => {
        ws.send(JSON.stringify(auth));
        ws.send(JSON.stringify(vc));
        console.info(`\x1b[32mToken ${token} joined the voice channel successfully\x1b[0m`);
    });


    ws.on('error', console.error);

    setTimeout(() => ws.close(), 300000);
}
 
async function main() {
    const tokens = sort(filepath);
    const validTokens = await checkTokens(tokens);

    validTokens.forEach(token => {
        ws_joiner(token);
    });

    setInterval(() => {
        validTokens.forEach(token => {
            ws_joiner(token);
        });
    }, 300000); 
}

main();