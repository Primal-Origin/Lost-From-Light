// commands/close.js
const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('close')
    .setDescription('Close the current modmail ticket'),

  async execute(interaction) {
    const channel = interaction.channel;

    if (!channel.name.startsWith("modmail-")) {
      return interaction.reply({
        content: '❌ This command can only be used inside a modmail channel.',
        ephemeral: true
      });
    }

    // ✅ Respond immediately so Discord doesn't time out
    await interaction.reply({
      content: '✅ Closing this ticket in 3 seconds...',
      ephemeral: true
    });

    // Optional log message
    const userId = channel.name.split('-').pop();
    const logChannel = interaction.client.channels.cache.get('1350182636148097094'); // replace with your actual log channel ID
    if (logChannel?.isTextBased()) {
      const logEmbed = new EmbedBuilder()
        .setTitle('📪 Modmail Closed')
        .addFields(
          { name: 'User', value: `<@${userId}>`, inline: true },
          { name: 'Closed by', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Channel', value: `${channel.name}`, inline: true }
        )
        .setTimestamp()
        .setColor(0xff5555);
      logChannel.send({ embeds: [logEmbed] });
    }

    // Wait and delete the channel
    setTimeout(() => {
      channel.delete().catch(console.error);
    }, 3000);
  }
};