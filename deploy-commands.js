// deploy-commands.js
require('dotenv').config(); // Load .env file

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const { guildId } = require('./config.json');

const clientId = process.env.CLIENT_ID;
const token = process.env.TOKEN;

const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  if (command.data) {
    commands.push(command.data.toJSON());
  }
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('🔁 Refreshing application (/) commands...');

    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );

    console.log('✅ Successfully reloaded guild commands.');
  } catch (error) {
    console.error('❌ Error reloading commands:', error);
  }
})();