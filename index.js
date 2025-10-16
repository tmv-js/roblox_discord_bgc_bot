// Load environment variables
require('dotenv').config();

const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    EmbedBuilder 
} = require('discord.js');
const axios = require('axios');

// === ENVIRONMENT VARIABLES ===
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

// === DISCORD CLIENT ===
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ] 
});

// === UTILS ===

// Global cache to avoid duplicate API calls
const cache = new Map();

// Rate-limit-safe GET request
async function safeAxiosGet(url, retries = 3, delay = 3000) {
    for (let i = 0; i < retries; i++) {
        try {
            if (cache.has(url)) {
                return cache.get(url);
            }

            const response = await axios.get(url);
            cache.set(url, response);
            return response;
        } catch (err) {
            if (err.response && err.response.status === 429) {
                console.warn(`⚠️ Rate limited on ${url}. Waiting ${delay / 1000}s before retry...`);
                await new Promise(r => setTimeout(r, delay));
            } else {
                throw err;
            }
        }
    }
    throw new Error(`Failed after ${retries} retries for URL: ${url}`);
}

// === ROBLOX API FUNCTIONS ===

// ✅ Correct username → userId lookup (no fuzzy search)
async function getUserId(username) {
    try {
        const res = await axios.post('https://users.roblox.com/v1/usernames/users', {
            usernames: [username]
        });

        if (!res.data.data || res.data.data.length === 0) {
            throw new Error(`User "${username}" not found`);
        }

        return res.data.data[0].id;
    } catch (err) {
        if (err.response && err.response.status === 429) {
            console.warn(`⚠️ Rate limited on username lookup. Retrying...`);
            await new Promise(r => setTimeout(r, 3000));
            return getUserId(username); // retry once
        }
        throw new Error(`Failed to get user ID for "${username}": ${err.message}`);
    }
}

async function getUserDetails(userId) {
    const res = await safeAxiosGet(`https://users.roblox.com/v1/users/${userId}`);
    return res.data;
}

async function getFriendsCount(userId) {
    const res = await safeAxiosGet(`https://friends.roblox.com/v1/users/${userId}/friends`);
    return res.data.data.length;
}

async function getGroupsCount(userId) {
    const res = await safeAxiosGet(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
    return res.data.data.length;
}

function calculateAccountAge(createdDate) {
    const created = new Date(createdDate);
    const now = new Date();
    const diffDays = Math.ceil(Math.abs(now - created) / (1000 * 60 * 60 * 24));
    return diffDays;
}

// === EMBED BUILDER ===
function createResultsEmbed(username, accountAge, friendsCount, groupsCount) {
    const minAge = 90;
    const minFriends = 20;
    const minGroups = 30;

    const ageMet = accountAge >= minAge;
    const friendsMet = friendsCount >= minFriends;
    const groupsMet = groupsCount >= minGroups;

    const passed = ageMet && friendsMet && groupsMet;

    return new EmbedBuilder()
        .setTitle(`Background Check - ${username}`)
        .setColor(passed ? 0x00FF00 : 0xFF0000)
        .addFields(
            { name: 'Account Age', value: `${ageMet ? '✅' : '❌'} ${accountAge} days (min ${minAge})`, inline: false },
            { name: 'Friends', value: `${friendsMet ? '✅' : '❌'} ${friendsCount} friends (min ${minFriends})`, inline: false },
            { name: 'Groups', value: `${groupsMet ? '✅' : '❌'} ${groupsCount} groups (min ${minGroups})`, inline: false },
            { name: 'Overall Status', value: passed ? '🟢 PASSED' : '🔴 FAILED', inline: false }
        )
        .setFooter({ text: 'Background Check System' })
        .setTimestamp();
}

// === COMMAND REGISTRATION ===
async function registerCommands() {
    const commands = [
        new SlashCommandBuilder()
            .setName('bgc')
            .setDescription('Perform a background check on a Roblox user')
            .addStringOption(option =>
                option.setName('username')
                    .setDescription('The Roblox username to check')
                    .setRequired(true)
            )
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(token);

    try {
        console.log('🔄 Registering slash commands...');
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands }
        );
        console.log('✅ Slash commands registered.');
    } catch (err) {
        console.error('❌ Failed to register commands:', err);
    }
}

// === COMMAND HANDLER ===
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== 'bgc') return;

    const username = interaction.options.getString('username');
    await interaction.deferReply();

    try {
        console.log(`🔍 Running background check for ${username}...`);

        const userId = await getUserId(username);
        console.log(`✅ Found user ID: ${userId}`);

        const [userDetails, friendsCount, groupsCount] = await Promise.all([
            getUserDetails(userId),
            getFriendsCount(userId),
            getGroupsCount(userId)
        ]);

        const accountAge = calculateAccountAge(userDetails.created);

        const embed = createResultsEmbed(userDetails.name, accountAge, friendsCount, groupsCount);
        await interaction.editReply({ embeds: [embed] });

        console.log(`✅ Background check complete for ${username}`);
    } catch (err) {
        console.error(`❌ Error checking ${username}:`, err.message);
        await interaction.editReply(`Error: ${err.message}`);
    }
});

// === ON READY ===
client.once('ready', () => {
    console.log(`🤖 Logged in as ${client.user.tag}`);
    registerCommands();
});

// === LOGIN ===
if (!token) {
    console.error('❌ No DISCORD_TOKEN found. Please check your .env file.');
    process.exit(1);
}

client.login(token);
