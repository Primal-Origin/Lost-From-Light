const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require("discord.js");
require("dotenv").config(); // Load environment variables from .env

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel] // Required for DM support
});

const { prefix, ServerID } = require("./config.json");

client.on("ready", () => {
  console.log("✅ Bot is online");
  client.user.setActivity("Watching My DMs");
});

client.on("messageCreate", async message => {
  if (message.author.bot) return;

  // ========== DM HANDLER ==========
  if (message.channel.type === 1 || message.channel.type === "DM") {
    const guild = client.guilds.cache.get(ServerID);
    if (!guild) return console.log("❌ Server not found!");

    const modChannel = guild.channels.cache.find(channel =>
      channel.name.includes(`modmail-${message.author.username.toLowerCase().replace(/[^a-z0-9]/g, '-')}`)
    );

    const embed = new EmbedBuilder()
      .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
      .setDescription(message.content || "*No text provided*")
      .setColor(0x3498db)
      .setTimestamp();

    const modmailCategoryId = '1386308114189385828'; // replace with your actual ID
    const staffRoleId = '1381979543434297445';

    if (modChannel) {
      modChannel.send({ embeds: [embed] });
    } else {
      const channelName = `modmail-${message.author.username.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${message.author.id.slice(-4)}`;

      const channel = await guild.channels.create({
        name: channelName,
        type: 0,
        parent: modmailCategoryId,
        topic: `Modmail thread with ${message.author.tag}`,
        permissionOverwrites: [
          {
            id: guild.roles.everyone,
            deny: ["ViewChannel"]
          },
          {
            id: client.user.id,
            allow: ["ViewChannel", "SendMessages"]
          },
          {
            id: staffRoleId,
            allow: ["ViewChannel", "SendMessages"]
          }
        ]
      });

      channel.send({
        content: `📬 New modmail opened by <@${message.author.id}> — <@&${staffRoleId}>`,
        embeds: [embed]
      });
    }
  }

  // ========== STAFF REPLY HANDLER ==========
  if (message.guild && message.channel.name.startsWith("modmail-")) {
    const parts = message.channel.name.split("-");
    const userIdChunk = parts[parts.length - 1];
    const targetUser = await client.users.fetch(message.mentions.users.first()?.id || message.author.id).catch(() => null);

    if (targetUser) {
      const embed = new EmbedBuilder()
        .setAuthor({ name: `Staff Reply from ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
        .setDescription(message.content || "*No message*")
        .setColor(0x2ecc71)
        .setTimestamp();

      targetUser.send({ embeds: [embed] }).catch(() => {
        message.channel.send("⚠️ Could not send message to user.");
      });
    }
  }
});

client.login(process.env.TOKEN);