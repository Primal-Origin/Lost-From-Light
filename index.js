const { Client, GatewayIntentBits, Partials, EmbedBuilder, ChannelType, PermissionsBitField } = require("discord.js");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

const { ServerID } = require("./config.json");

// Replace with your real values
const STAFF_ROLE_ID = '1381979543434297445';
const MODMAIL_CATEGORY_ID = '1386308114189385828';

client.once("ready", () => {
  console.log("✅ Bot is online");
  client.user.setActivity("Watching DMs");
});

// 📬 DM handler — user sends message to bot
client.on("messageCreate", async message => {
  if (message.author.bot) return;

  // --- Handle DMs ---
  if (message.channel.type === ChannelType.DM) {
    const guild = client.guilds.cache.get(ServerID);
    if (!guild) return console.log("❌ Server not found!");

    const existingThread = guild.channels.cache.find(channel =>
      channel.topic === `UserID:${message.author.id}`
    );

    const embed = new EmbedBuilder()
      .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
      .setDescription(message.content || "*No message content*")
      .setColor(0x3498db)
      .setTimestamp();

    if (existingThread) {
      existingThread.send({ embeds: [embed] });
    } else {
      const safeName = message.author.username.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const channelName = `modmail-${safeName}-${message.author.id.slice(-4)}`;

      const thread = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: MODMAIL_CATEGORY_ID,
        topic: `UserID:${message.author.id}`,
        permissionOverwrites: [
          {
            id: guild.roles.everyone,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: client.user.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
          },
          {
            id: STAFF_ROLE_ID,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
          }
        ]
      });

      thread.send({
        content: `📬 New modmail thread opened by <@${message.author.id}> — <@&${STAFF_ROLE_ID}>`,
        embeds: [embed]
      });
    }
  }

  // --- Handle replies from staff inside a modmail thread ---
  if (message.guild && message.channel.parentId === MODMAIL_CATEGORY_ID) {
    if (!message.member.roles.cache.has(STAFF_ROLE_ID)) return; // Only staff allowed

    const threadTopic = message.channel.topic;
    if (!threadTopic || !threadTopic.startsWith("UserID:")) {
      return message.channel.send("⚠️ Could not determine target user.");
    }

    const userId = threadTopic.replace("UserID:", "").trim();
    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) return message.channel.send("⚠️ Unable to find the user.");

    const embed = new EmbedBuilder()
      .setAuthor({ name: `Staff: ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
      .setDescription(message.content || "*No message content*")
      .setColor(0x2ecc71)
      .setTimestamp();

    user.send({ embeds: [embed] }).catch(() => {
      message.channel.send("⚠️ Could not send message to the user’s DMs.");
    });
  }
});

client.login(process.env.TOKEN);
