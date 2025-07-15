// index.js

const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    EmbedBuilder, 
    ChannelType, 
    PermissionsBitField, 
    REST, 
    Routes 
} = require("discord.js");
require("dotenv").config();

// =================================================================
//                        CONFIGURATION
//         Replace these values with your actual server IDs
// =================================================================
const SERVER_ID = 'YOUR_SERVER_ID_HERE'; // The ID of the server where the bot runs
const STAFF_ROLE_ID = 'YOUR_STAFF_ROLE_ID_HERE'; // Role for staff who can manage tickets
const MODMAIL_CATEGORY_ID = 'YOUR_MODMAIL_CATEGORY_ID_HERE'; // The category where new tickets are created
const LOG_CHANNEL_ID = 'YOUR_LOG_CHANNEL_ID_HERE'; // Channel where closed ticket logs are sent
const BOT_TOKEN = process.env.TOKEN; // Your bot's token from the .env file
const CLIENT_ID = process.env.CLIENT_ID; // Your bot's client/application ID from the .env file
// =================================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel] // This is crucial for receiving DMs
});

// --- Command Definition ---
const closeCommand = {
  name: 'close',
  description: 'Closes the current modmail ticket.',
};

// --- Register Slash Commands on Startup ---
const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
(async () => {
  try {
    console.log('Started refreshing application (/) commands.');
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, SERVER_ID),
      { body: [closeCommand] },
    );
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error reloading commands:', error);
  }
})();


// --- Bot Ready Event ---
client.once("ready", () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);
  client.user.setActivity("your DMs for messages");
});


// =================================================================
//                      INTERACTION HANDLER
//          This new section handles the /close command
// =================================================================
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'close') {
        const channel = interaction.channel;

        // Verify it's a modmail channel
        if (!channel.topic || !channel.topic.startsWith("UserID:")) {
            return interaction.reply({
                content: '❌ This command can only be used inside a modmail channel.',
                ephemeral: true
            });
        }

        // Defer reply to prevent timeout
        await interaction.reply({
            content: '🔒 Closing this ticket in 5 seconds...',
            ephemeral: true
        });

        const userId = channel.topic.replace("UserID:", "").trim();
        const user = await client.users.fetch(userId).catch(() => null);

        // Notify the user that the ticket is closed
        if (user) {
            const closeEmbed = new EmbedBuilder()
                .setTitle("Ticket Closed")
                .setDescription(`Your ticket has been closed by staff member **${interaction.user.tag}**. You can open a new one by sending another message.`)
                .setColor(0xff5555)
                .setTimestamp();
            await user.send({ embeds: [closeEmbed] }).catch(console.error);
        }

        // Send a log message
        const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle('📪 Modmail Ticket Closed')
                .addFields(
                    { name: 'User', value: user ? `${user.tag} (<@${userId}>)` : `Unknown User (${userId})`, inline: true },
                    { name: 'Closed By', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: true },
                    { name: 'Ticket Channel', value: `${channel.name}`, inline: true }
                )
                .setTimestamp()
                .setColor(0xff5555);
            logChannel.send({ embeds: [logEmbed] });
        }

        // Delete the channel after a delay
        setTimeout(() => {
            channel.delete('Modmail ticket closed.').catch(console.error);
        }, 5000);
    }
});


// =================================================================
//                       MESSAGE HANDLER
//          Handles incoming DMs and staff replies
// =================================================================
client.on("messageCreate", async message => {
    if (message.author.bot) return;

    const guild = client.guilds.cache.get(SERVER_ID);
    if (!guild) return console.log("❌ Server not found! Check your SERVER_ID in the config.");

    // --- Part 1: Handle incoming DMs from users ---
    if (message.channel.type === ChannelType.DM) {
        const existingThread = guild.channels.cache.find(c => c.topic === `UserID:${message.author.id}`);

        // --- Prepare the embed with text and images ---
        const embed = new EmbedBuilder()
            .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
            .setColor(0x3498db)
            .setTimestamp();
        
        // Add message content if it exists
        if (message.content) {
            embed.setDescription(message.content);
        }

        // *** NEW: Handle attachments (images) ***
        let attachments = [];
        if (message.attachments.size > 0) {
            // Set the first image directly in the embed
            embed.setImage(message.attachments.first().url);
            // Collect all attachment URLs
            message.attachments.forEach(att => attachments.push(att.url));
        }

        // If a thread exists, send the new message there
        if (existingThread) {
            await existingThread.send({ embeds: [embed], files: attachments });
        } 
        // Otherwise, create a new thread
        else {
            const safeName = message.author.username.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 20);
            const channelName = `modmail-${safeName}-${message.author.id.slice(-4)}`;

            try {
                const thread = await guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText,
                    parent: MODMAIL_CATEGORY_ID,
                    topic: `UserID:${message.author.id}`,
                    permissionOverwrites: [
                        { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                        { id: STAFF_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                    ]
                });

                await thread.send({
                    content: `📬 New modmail thread opened by <@${message.author.id}>. Staff role <@&${STAFF_ROLE_ID}> has been pinged.`,
                    embeds: [embed],
                    files: attachments
                });
                
                await message.author.send("✅ Thank you for your message! A staff member will be with you shortly.");

            } catch (error) {
                console.error("Error creating modmail channel:", error);
                await message.author.send("❌ Sorry, I was unable to create a ticket. Please contact staff directly.");
            }
        }
    }

    // --- Part 2: Handle replies from staff in a modmail thread ---
    else if (message.guild && message.channel.parentId === MODMAIL_CATEGORY_ID) {
        if (!message.member.roles.cache.has(STAFF_ROLE_ID)) return; // Ignore messages from non-staff

        const userId = message.channel.topic.replace("UserID:", "").trim();
        const user = await client.users.fetch(userId).catch(() => null);
        if (!user) return message.channel.send("⚠️ Unable to find the user to send this message to.");

        const embed = new EmbedBuilder()
            .setAuthor({ name: `Staff: ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
            .setColor(0x2ecc71)
            .setTimestamp();

        if (message.content) {
            embed.setDescription(message.content);
        }

        // *** NEW: Handle attachments from staff ***
        let attachments = [];
        if (message.attachments.size > 0) {
            embed.setImage(message.attachments.first().url);
            message.attachments.forEach(att => attachments.push(att.url));
        }

        try {
            await user.send({ embeds: [embed], files: attachments });
            // Add a checkmark to confirm the message was sent
            await message.react('✅').catch(console.error);
        } catch (error) {
            console.error("Error sending DM to user:", error);
            await message.channel.send("⚠️ **Failed to send message to user.** Their DMs may be closed or they may have blocked the bot.");
            await message.react('❌').catch(console.error);
        }
    }
});

client.login(BOT_TOKEN);
